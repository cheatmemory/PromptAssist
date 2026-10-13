/**
 * skill-generator-core · 「🤷 不清楚，交给 AI 决定」的处理规则
 * ------------------------------------------------------------------
 * 为什么单独建这个模块：
 *   `UNSURE_VALUE` 早先只在两处出现——定义，以及「每道选择型题都要包含这个兜底选项」
 *   的**出题规则**。也就是说：兜底选项被强制加进了每一道题，却**没有任何一处规则
 *   告诉下游 AI 收到它之后该怎么办**。用户点「交给 AI 决定」，STEP2 收到的是
 *   `{"i1": "__unsure__"}` —— 一个它不认识的字符串。
 *
 *   更糟的是它与同一份 prompt 里的另一条规则**直接矛盾**：
 *     「the interaction decisions **the user made in stage 2** MUST be honoured」
 *   用户没做决定，规则却要求「必须照用用户做的决定」。模型只能二选一：
 *   违反规则，或卡住。这是逻辑自相矛盾，不是描述不清。
 *
 * 本模块给出的答案是三条硬规则：
 *   1. `__unsure__` 是**有效答案**，不是「此题未答」。区别很关键——
 *      「未答」应该退回默认或追问；「交给 AI 决定」是用户**授权你替他决定**。
 *   2. 决定必须**落到具体取值 + 给出依据**，依据只能来自已知的约束
 *      （交付形态画像 / 专业调研结论 / 锁定技术栈），不能来自「一般都这么选」。
 *   3. 决定必须**可溯源**（写进产物的 `assumptions`），让用户事后能推翻。
 *
 * 为什么第 3 条重要：这类决定本质是**在信息不足时替用户做承诺**。
 * 承诺必须留痕，否则用户拿到产物才发现选错了，却不知道错在哪一步。
 */

/** 供 UI 显示用的文案。 */
export const UNSURE_VALUE = '__unsure__'
export const UNSURE_LABEL = '🤷 不清楚，交给 AI 决定'

/**
 * 注入 STEP2 的英文规则（STEP2 的 CRITICAL RULES 是英文，保持一致）。
 * 放在 CRITICAL RULES 里而不是 user 消息里 —— 放 user 消息时模型容易
 * 当成「用户背景信息」而不是「操作指令」。
 */
export const UNSURE_RULES_EN = [
  'HOW TO HANDLE `__unsure__` ANSWERS:',
  '`__unsure__` means the user explicitly delegated this decision to you. It is a **valid answer, not a skipped question** — never treat it as missing data, never silently drop it, never fall back to a generic default.',
  'For every `__unsure__` you receive: (1) decide a concrete value, (2) justify it ONLY by an input you were actually given — the deliverable profile constraints, the professional research conclusions, or the locked technology stack. Generic reasons like "this is the common choice" are FORBIDDEN. (3) record it in `sections.assumptions` as 「<field>：<value>（依据：<the specific input you used>）」.',
  'When a `__unsure__` decision genuinely conflicts with a hard constraint (e.g. the user delegated output format but the deliverable profile has no file export), do NOT silently pick something impossible. Record it in `sections.assumptions` as 「未能落实：<what was delegated>（原因：<the specific constraint>）」 and choose the closest feasible option.',
  'The rule "honour the interaction decisions the user made" applies to the decisions the user ACTUALLY made. For delegated ones, the obligation is to decide defensibly and record the assumption — not to imitate a user choice that does not exist.',
].join('\n')

/** 注入 STEP3 的中文规则（STEP3 正文是中文）。 */
export const UNSURE_RULES_ZH = [
  '## 用户把决定权交给了你（`__unsure__`）',
  '',
  '若上游答案里出现 `__unsure__`，说明用户**主动授权你替他决定**这一项。它是有效答案，',
  '不是「这题没答」——不要跳过、不要套用泛泛的默认值。',
  '',
  '每一项都必须：',
  '1. **给出具体取值**（不能写「视情况而定」「按需选择」）；',
  '2. **给出依据**，且依据只能来自你手上真实掌握的信息——交付形态画像的硬约束、',
  '   专业调研结论、已锁定的技术栈。**禁止**「通常做法是…」这类通用理由；',
  '3. **写进 `sections.assumptions`**，格式：「<字段>：<你定的值>（依据：<具体依据>）」，',
  '   让用户事后能一眼看出你是凭什么替他决定的，并可以推翻。',
  '',
  '若某项委托与硬约束冲突（如用户委托了「输出形式」，但该交付形态根本不支持文件导出），',
  '**不要**默默选一个做不到的方案。写进 `assumptions`：「未能落实：<被委托的项>（原因：',
  '<具体约束>）」，并选最接近的可行方案。',
].join('\n')

/**
 * 从答案对象里抽出所有 `__unsure__` 的题号，用于诊断与提示。
 * 数组值里可能混着正常选项与 `__unsure__`（用户多选时），两种都要认。
 */
export function collectUnsure(answers) {
  const hit = []
  for (const [id, v] of Object.entries(answers || {})) {
    const list = Array.isArray(v) ? v : [v]
    if (list.some(x => typeof x === 'string' && x.trim() === UNSURE_VALUE)) hit.push(id)
  }
  return hit
}

/**
 * 把「这些题用户委托了」渲染成给模型看的清单。
 * 显式点名比让模型自己在 JSON 里认字符串可靠得多 —— 实测它认不出来。
 */
export function renderUnsureNotice(answers, questionLabels = {}) {
  const hit = collectUnsure(answers)
  if (!hit.length) return ''
  const lines = [
    `【用户已委托你决定的题（共 ${hit.length} 项）】`,
    '以下题目用户选择了「🤷 不清楚，交给 AI 决定」，**这是明确授权，不是漏答**。',
    '每一条都必须给出具体取值 + 真实依据 + 记入 sections.assumptions：',
  ]
  for (const id of hit) {
    const label = questionLabels[id] ? `${questionLabels[id]}（${id}）` : id
    lines.push(`  - ${label}`)
  }
  lines.push('⚠️ 禁止用「通常做法」「一般为」这类通用理由；依据必须是你手上真实掌握的信息。')
  return lines.join('\n')
}
