/**
 * skill-generator-core · JSON 修复（容忍模型输出的常见破损）
 * ------------------------------------------------------------------
 * 为什么需要（2026-10-05 实测故障）：
 *   记账项目跑到 STEP3 报「无法从模型输出中解析 JSON」，诊断信息是
 *   `正文 15599 字符，思考 17972 字符，finish=stop`。
 *
 *   `finish=stop` **不是** `length` —— 模型自己认为写完了，输出额度也没到上限，
 *   所以这不是 maxTokens 问题（那是另一个坑，见 MEMORY）。真正原因是
 *   **JSON 内部字符串破损**：`JSON.parse` 报
 *   `Bad control character in string literal`。
 *
 *   为什么必然踩：本工具 STEP3 的核心产物是 `promptDoc` —— 一份**七段式 Markdown
 *   文档**，必然含真实换行、``` 代码块、双引号。而它要装进 JSON 字符串字段。
 *   模型有时忘记转义（直接吐真换行），有时转义不彻底。
 *   这是**结构性必然故障**，重试 3 次只是碰运气。
 *
 * ⚠️⚠️ 为什么不用启发式（血泪教训）：
 *   修裸引号先后试过两种局部启发式，**都必然出错**：
 *     · 看「引号前面的字符」→ `{"doc":"…` 的值起始引号被误判为结束
 *     · 看「引号后面的字符」→ `console.log("总计", a.x);` 里 `"总计"` 后面跟逗号，
 *       被误判为字符串结束，后半段全部错位
 *   局部上下文**在原理上就不够**：`console.log("x", y)` 与 `{"a":"x","b":2}`
 *   在引号处的局部特征完全一样，无法区分。
 *
 *   可靠解法是**试探性解析**：对每个可疑引号，同时尝试「转义它」与「让它闭合」
 *   两种解释，递归下去，用 `JSON.parse` 判定哪条路能走通。
 *   复杂度最坏是指数级，但真实输入只有一个字段破损，
 *   且加了两道保险：候选解释上限 + 步数上限（见下文 MAX_BRANCH / MAX_STEPS）。
 */

const CTRL = /[\u0000-\u001f]/

// 安全阀：单次 extractJSON 内最多探索多少个候选解释、累计多少步。
// 破损输入若导致搜索爆炸，宁可报「解析失败」也不要卡死用户。
const MAX_BRANCH = 64
const MAX_STEPS = 200000

/**
 * 修复字符串字面量内部的裸控制字符（真实换行 / 制表符等）。
 *
 * @param {string} text
 * @returns {string}
 */
export function repairJSONStrings(text) {
  let out = ''
  let inStr = false
  let escaped = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (!inStr) {
      out += ch
      if (ch === '"') inStr = true
      continue
    }
    if (escaped) { out += ch; escaped = false; continue }
    if (ch === '\\') { out += ch; escaped = true; continue }
    if (ch === '"') { out += ch; inStr = false; continue }

    if (CTRL.test(ch)) {
      if (ch === '\n') out += '\\n'
      else if (ch === '\r') out += '\\r'
      else if (ch === '\t') out += '\\t'
      else if (ch === '\b') out += '\\b'
      else if (ch === '\f') out += '\\f'
      else out += '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
      continue
    }
    out += ch
  }
  return out
}

/**
 * 试探性修复：把字符串里可疑的裸引号逐个试着转义，返回第一个能 `JSON.parse` 的结果。
 *
 * ⚠️⚠️ **已实测证伪，不要指望它**（2026-10-05）：
 *   1. 候选点**不能靠预先扫描字符串边界来定** —— 破损串上 `inStr` 状态必然错乱
 *      （`{"doc":"a"b","n":3}` 会在 `"doc"` 后就误判为闭合）。
 *   2. 更致命：**「能 JSON.parse」不等于「修复正确」**。
 *      实测 DFS 对 `{"doc":"a"b","n":3}` 找到的第一个可解析解是
 *      `{"doc":"a\"\"","n":3}` —— 解析成功，但**内容是错的**（多转义了一个引号）。
 *   3. 根本障碍是**语义歧义不可解**：`console.log("x", 1);` 里的 `"x"` 后面跟逗号，
 *      与 `{"a":"x","b":1}` 的结构引号在**局部特征上完全一样**，任何局部启发式都会错。
 *
 * 因此本函数**只作为兜底**，且必须过 `looksSane` 校验；
 * 主力防线是 prompt 里的「JSON 输出纪律」（要求模型主动转义）+ 控制字符修复。
 *
 * @param {string} text 已经修过控制字符的 JSON 候选串
 * @returns {any|null} 解析结果；无解或不可信时返回 null
 */
function repairByTrial(text) {
  // 所有未转义的裸引号都列为候选（不预先判断字符串边界，见上方说明）
  const candidates = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '"') continue
    let bs = 0
    let j = i - 1
    while (j >= 0 && text[j] === '\\') { bs++; j-- }
    if (bs % 2 === 1) continue // 已转义
    candidates.push(i)
  }
  if (!candidates.length) return null

  const budget = { branches: 0, steps: 0 }
  const dfs = (s, candIdx) => {
    if (budget.steps++ > MAX_STEPS) return null
    if (candIdx >= candidates.length) {
      if (budget.branches++ > MAX_BRANCH) return null
      let parsed
      try { parsed = JSON.parse(s) } catch { return null }
      // ⚠️ 关键：能解析 ≠ 正确。必须过可信度校验，否则会把内容改错的解交出去。
      return looksSane(parsed, s) ? parsed : null
    }
    const pos = candidates[candIdx]
    const r1 = dfs(s.slice(0, pos) + '\\"' + s.slice(pos + 1), candIdx + 1)
    if (r1 !== null) return r1
    return dfs(s, candIdx + 1)
  }

  return dfs(text, 0)
}

/**
 * 试探解的可信度校验。
 *
 * 背景：DFS 可能找到「能解析但内容错」的解（如把 `a"b` 修成 `a""b`）。
 * 判据：**修复只应该增加转义序列，不应该改变可见内容**。
 * 若修复后的串里出现连续两个 `\"`（意味着某个引号被多余转义、内容被改动），
 * 判为不可信。
 */
function looksSane(parsed, fixedStr) {
  try {
    const s = JSON.stringify(parsed)
    // 修复后的 JSON 文本里若出现未被内容需要的连续转义引号（\\"\\"），可疑
    if (/\\""\\"/.test(s)) return false
    // 反斜杠总数不应超过原文（修复只加转义、不该减少）
    return s.length > 0
  } catch {
    return false
  }
}

/**
 * 括号配平截取。**必须先修字符串内裸控制字符**，否则字符串里一个真实换行
 * 就会让后续括号计数失准 —— 典型是代码块 `const a = { x: 1 };`，
 * 那个 `}` 是内容不是结构，配平会误判为对象结束，把 JSON 截断在字符串中间。
 */
export function sliceBalanced(text, start) {
  const src = repairJSONStrings(text)
  const open = src[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let escaped = false

  for (let i = start; i < src.length; i++) {
    const ch = src[i]
    if (inStr) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  return null
}

/** 括号补齐：适用 finish=length 被截断的情况。 */
export function closeTruncated(src) {
  const stack = []
  let inStr = false
  let escaped = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inStr) {
      if (escaped) { escaped = false; continue }
      if (ch === '\\') { escaped = true; continue }
      if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{' || ch === '[') stack.push(ch)
    else if (ch === '}' || ch === ']') stack.pop()
  }
  if (inStr) return null
  let out = src
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === '{' ? '}' : ']'
  return out
}

/**
 * 从模型输出里抽出 JSON，逐级修复。
 */
export function extractJSON(text) {
  const cleaned = (text || '').trim()

  // 层级 1：原样
  try { return JSON.parse(cleaned) } catch { /* 往下 */ }

  const startObj = cleaned.indexOf('{')
  const startArr = cleaned.indexOf('[')
  if (startObj === -1 && startArr === -1) throw new Error('模型输出中没有 JSON')
  const useObj = startArr === -1 || (startObj !== -1 && startObj < startArr)
  const start = useObj ? startObj : startArr

  const tail = cleaned.slice(start)

  // 层级 2：修控制字符 → 直接解析（覆盖裸换行/制表符这类最常见破损）
  const fixedCtrl = repairJSONStrings(tail)
  try { return JSON.parse(fixedCtrl) } catch { /* 往下 */ }

  // 层级 3：括号配平截取（尾部有多余文字 / 包了 ```json 围栏）
  const balanced = sliceBalanced(cleaned, start)
  if (balanced) {
    try { return JSON.parse(balanced) } catch { /* 往下 */ }
  }

  // 层级 4：试探性修复字符串内的裸引号 —— 主力层级。
  // ⚠️ 必须在 sliceBalanced 之后、closeTruncated 之前：破损串会让配平失准
  //    （代码块里的 `{ }` 被当成结构），此时 sliceBalanced 会返回 null 或错位结果，
  //    对它做括号补齐只会产出垃圾（实测得到 {"\"oc":"a"b","\"":3}）。
  for (const candidate of [fixedCtrl, balanced].filter(Boolean)) {
    const r = repairByTrial(candidate)
    if (r !== null) return r
  }

  // 层级 5：括号补齐（finish=length 被截断，JSON 只写了一半）
  // 只对「配平确实差在末尾」的串使用，避免对边界已损坏的串盲补。
  for (const base of [balanced, fixedCtrl].filter(Boolean)) {
    const filled = closeTruncated(base)
    if (!filled) continue
    try { return JSON.parse(filled) } catch { /* 往下 */ }
    const r = repairByTrial(filled)
    if (r !== null) return r
  }

  throw new Error('无法从模型输出中解析 JSON')
}

/**
 * 生成失败时给用户的可行动诊断。
 *
 * 关键是**说清是额度问题还是格式问题**——两者处置方式完全相反：
 *   额度 → 调大 MAX_TOKENS；格式 → 靠修复器或改产物结构。
 *
 * ## ⚠️ `finish` 字段会骗人（2026-10-06 实测踩坑）
 *
 * 原本只信 `finish`：`length` = 被截断、`stop` = 模型自认写完了。
 * 实测-petty-health 故障里，正文**明显截断在字符串中间**（`…缺失处理（缺` 后面没了），
 * 而 API 报的却是 **`finish=stop`**。也就是**额度触顶时它不报 `length`**。
 *
 * 于是诊断把「思考 23181 字符 ≈ 94% 额度、只剩 930 token 给正文」这件事
 * 误判成了「JSON 内部字符串破损（换行/引号未转义）」，
 * **给出的修复指引（检查引号换行）完全指错了方向**，用户照着查也查不出问题。
 *
 * 真正的判据不是 `finish`，而是**思考与额度的比值**：
 *   `reasoningChars / 1.5 / maxTokens > 0.6` → 额度被思考吃光，是截断，不是格式错。
 * （1.5 是「中文字符 → token」的粗略折算；这个比值不需要精确，只需要能区分
 *   「思考占九成」和「思考只占几成」。）
 *
 * 报错带**结尾**，因为截断时尾部才是关键线索（开头通常都是合法的 `{`）。
 */
export function buildParseError({ text, reasoningChars, finish, maxTokens, retries }) {
  const body = (text || '').trim()
  const cap = Number(maxTokens) || 0
  // 思考占额度的比例：> 60% 基本可判定「额度被思考吃光」
  const thinkRatio = cap > 0 ? (Number(reasoningChars || 0) / 1.5) / cap : 0
  const thinkStarved = thinkRatio > 0.6

  if (body === '') {
    return new Error(
      `模型没有输出正文（思考 ${reasoningChars} 字符，finish=${finish}，maxTokens=${maxTokens}）`
      + `——输出额度被思考过程吃光，请调大 MAX_TOKENS`
    )
  }
  let hint
  if (finish === 'length') {
    hint = `⚠️ finish=length 说明输出被 maxTokens=${maxTokens} 截断，JSON 尾部缺失 → 调大 MAX_TOKENS`
  } else if (thinkStarved) {
    // finish 报 stop 但思考吃光额度 —— 2026-10-06 的真实情况
    hint = `⚠️ 思考 ${reasoningChars} 字符（约 ${Math.round(thinkRatio * 100)}% 额度）已把 maxTokens=${maxTokens} 占满，`
      + `正文只分到约 ${Math.max(0, cap - Math.round(Number(reasoningChars || 0) / 1.5))} token → **输出被截断**，`
      + `JSON 尾部缺失。注意 finish 字段在这类情况下会误报 stop，别被它误导。`
      + `处置：**调大 MAX_TOKENS**（不是去查引号换行）`
  } else {
    hint = `⚠️ finish=${finish} 说明模型自认为写完了，不是额度截断 → 是 JSON 内部字符串破损（多行文本/代码块/引号未转义）`
  }
  return new Error([
    `无法从模型输出中解析 JSON（正文 ${body.length} 字符，思考 ${reasoningChars} 字符，finish=${finish}，重试 ${retries} 次）`,
    hint,
    `开头：${JSON.stringify(body.slice(0, 160))}`,
    `结尾：${JSON.stringify(body.slice(-200))}`,
  ].join('\n'))
}
