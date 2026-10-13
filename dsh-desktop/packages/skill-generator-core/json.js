/**
 * skill-generator-core · JSON 抽取与带诊断的重试
 * ------------------------------------------------------------------
 * 模型调用由调用方注入（两种形态的运行时不同：harness 用 ctx.llm.stream，
 * 独立应用用 fetch + SSE），本模块只负责「拿到文本 → 抽出 JSON」以及失败时的诊断。
 *
 * ⚠️ 抽取与修复逻辑在 `json-repair.js`。2026-10-05 拆分的原因：
 *   记账项目跑到 STEP3 报「无法从模型输出中解析 JSON（正文 15599 字符，
 *   思考 17972 字符，finish=stop）」。`finish=stop` 不是 `length` → 不是额度截断，
 *   而是 JSON **内部字符串**破损（`Bad control character in string literal`）。
 *   旧实现只容忍「外壳破损」（前后多余文字、```json 围栏），对内部破损完全无能，
 *   而重试 3 次只是碰运气 —— STEP3 产出七段式 Markdown（必然含换行/代码块/引号），
 *   这是**结构性必然故障**。
 */
import { extractJSON, buildParseError } from './json-repair.js'

export { extractJSON, repairJSONStrings, sliceBalanced, closeTruncated, buildParseError } from './json-repair.js'

/**
 * 带重试与诊断的「生成并抽 JSON」。
 *
 * ## 额度策略：**按失败原因决定要不要涨额度**，不是无脑逐次加。
 *
 * 最初是无脑加（第 2 次 ×1.5、第 3 次 ×2），理由是「思考深度每次不同、可能这次思考吃满额度」。
 * 但实测发现这在**格式错**的场景下是净损失：
 *   - `finish=length`（被额度截断）→ 涨额度**确实有用**；
 *   - `finish=stop`（模型自认写完，是 JSON 内部字符串破损）→ 涨额度**有害**，
 *     因为格式坏与额度无关，把额度提到 24576/32768 只会让模型写出同样格式坏但更长的内容，
 *     每次重试多烧几千 token（这就是记账项目「生成很慢」的一个直接来源）。
 * 所以这里读 `out.finish` 分叉：只有 `length` 才涨，其余保持原额度重试。
 *
 * ## 为什么还要回灌诊断
 * 这一步对「修复器也救不回的破损」是唯一有效的手段 ——
 * 裸引号的语义歧义在原理上不可解（实测），但模型收到「你的输出里引号没转义」
 * 后通常能在第二次就转义好。单纯重发同样的 prompt 是在浪费额度。
 *
 * ## validate 回调：拦住「能 parse 但内容残缺」的产物（2026-10-05）
 * 实测踩到的坑：`closeTruncated` 会把被截断的尾部**补齐成合法 JSON**，
 * 于是 `{"sections":{"steps":[…],"pitfalls":["a","b"` 会被「修成」
 * `{"sections":{"steps":[…],"pitfalls":["a","b"]}}` —— 能 parse，但 **pitfalls 后面
 * 的 outputSpec / assumptions / uiDesign 全丢了**。系统一声不吭，用户拿到残缺产物。
 * 而且补齐后的对象长得完全合法，`extractJSON` 内部无法判断「这真是模型写的」还是
 * 「这是我补的」，所以判定必须由**知道该段需要哪些字段的调用方**来做。
 * 校验不过 → 当作失败 → 回灌缺失字段清单让模型补齐。
 *
 * @param {(system: string, userText: string, maxTokens: number) => Promise<{text: string, reasoningChars?: number, finish?: string}>} callModel
 *        由调用方注入的模型调用。必须返回 { text, reasoningChars?, finish? }。
 *        reasoningChars 用于诊断「思考吃掉全部输出额度」这类静默失败。
 * @param {object} [opts]
 * @param {(data: any) => (true | string)} [opts.validate]
 *        产物校验。返回 true 通过；返回字符串视为不通过，该字符串会作为
 *        「缺什么」的说明回灌给模型。缺省不校验。
 * @returns {Promise<any>} 解析出的 JSON
 */
export async function generateJSON(callModel, system, userText, maxTokens, retries = 3, opts = {}) {
  const validate = opts.validate || null
  let lastError
  // 每次重试都把上次的失败诊断**回灌给模型**，让它自己修正格式。
  let feedback = ''
  // 只有「被额度截断」才需要加额度。加额度标记会随下一轮的 finish 重新评估。
  let bump = 1
  for (let i = 0; i < retries; i++) {
    const budget = Math.min(Math.round(maxTokens * bump), 32768)
    let out
    try {
      out = await callModel(system, userText + feedback, budget)
    } catch (error) {
      lastError = error
      // 网络/限流类失败与额度无关，别在这里加额度。
      feedback = '\n\n【上一次调用失败，请修正后重试】' + (error?.message || String(error)).slice(0, 300)
      continue
    }
    let data
    try {
      data = extractJSON(out.text)
    } catch (parseError) {
      const truncated = (out.finish ?? '') === 'length'
      lastError = buildParseError({
        text: out.text,
        reasoningChars: out.reasoningChars ?? 0,
        finish: out.finish ?? 'unknown',
        maxTokens: budget,
        retries,
      })
      // 被额度截断 → 逐次加额度（第 2 次 ×1.5，第 3 次 ×2，上限 32768）。
      // 其余原因（JSON 内部字符串破损等）→ 保持原额度，加额度只会让模型写得更长更乱。
      //
      // ⚠️ 2026-10-06 新增第二档判定：**`finish` 会在额度触顶时误报 `stop`**，
      // 所以不能只看它。思考占额度 > 60% 也是「被额度截断」的等价信号——
      // 宠物健康那次就是 `stop` + 思考占 94%，旧代码因此不涨额度、白重试 3 次，
      // 而按「格式坏」的方向回灌指引（检查引号换行）完全指错。
      const thinkRatio = budget > 0 ? (Number(out.reasoningChars || 0) / 1.5) / budget : 0
      bump = (truncated || thinkRatio > 0.6) ? Math.min(bump * 1.5, 2) : 1
      const starved = !truncated && thinkRatio > 0.6
      feedback = [
        '',
        '【上一次输出无法被解析为 JSON，请修正后重试】',
        String(lastError.message).slice(0, 600),
        truncated || starved
          ? '本次是被输出额度截断：请**大幅压缩内容**（删掉重复解释、只留结论），再重试。'
          : '若报 control character 请把换行写成 \\n；若字符串内有半角引号请写成 \\" 或改用中文引号「」。',
      ].join('\n')
      continue
    }
    // 解析成功 ≠ 产物可用：截断补齐会造出「能 parse 但尾部字段全丢」的残缺对象。
    if (validate) {
      const verdict = validate(data)
      if (verdict !== true) {
        lastError = new Error(`产物字段不完整：${verdict}`)
        // 字段缺失不是额度问题，**不涨额度**——涨了只会让模型写更多无关内容，
        // 而真正要做的是把缺的那几项补上。
        bump = 1
        feedback = [
          '',
          '【上一次输出虽然能解析，但内容不完整，请重新输出完整的 JSON】',
          `缺失或异常：${String(verdict).slice(0, 400)}`,
          '这些字段是 MANDATORY，缺任何一项整轮产物都不可用。',
          '请**完整重新输出一遍**，确保所有 MANDATORY 字段都在，且数组元素数量符合要求。',
        ].join('\n')
        continue
      }
    }
    return data
  }
  throw new Error(`生成失败（重试 ${retries} 次）：${lastError?.message}`)
}
