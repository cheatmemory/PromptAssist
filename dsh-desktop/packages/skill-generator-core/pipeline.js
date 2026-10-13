/**
 * skill-generator-core · 两段访谈 + 两段生成流程
 * ------------------------------------------------------------------
 * 与运行时无关：模型调用由调用方注入（插件传 ctx.llm.stream 的适配器，
 * 独立应用传 fetch+SSE 的适配器），因此两种形态走的是同一套流程与规则。
 *
 * 流程：
 *   段①  stepInterview  专业知识调研（把专业需求问清）
 *   段②  stepInteraction 智能体交互调研（把智能体形态问清，依赖段①答案 + 交付形态）
 *   段③  stepSkill      技能方法论
 *   段④  stepWorkflow   工作流 + 最终提示词文档
 */

import {
  MAX_TOKENS, SYSTEM_INTERVIEW, SYSTEM_INTERACTION, SYSTEM_STEP2, SYSTEM_STEP3,
  fill, archetypeTable, UNSURE_VALUE, UNSURE_LABEL, PROMPTDOC_SECTION_COUNT,
} from './prompts.js'
import { matchProfile, renderProfile, profileById, needsPlatformQuestion, matchMobilePlatform, MOBILE_PLATFORMS } from './deliverables.js'
import { renderUIStandards, renderUIFieldsHint, renderUIChecklist, matchUIForms } from './ui-standards.js'
import { renderTechStack } from './tech-stacks.js'
import { renderUnsureNotice } from './unsure.js'
import { generateJSON } from './json.js'
import { renderSkillBody } from './render.js'
import { compileSkill } from './compile.js'
import { briefText, formOf, dualTrack } from './brief.js'
import { isValidArchetype, renderSkeleton, suggestArchetype, ARCHETYPE_SKELETONS } from './archetypes.js'

/**
 * 从访谈答案里解析用户已确认的工作形态。
 * 不依赖题目 id——只要答案值里出现合法 archetype id 即可，
 * 这样第一期由模型自拟的题号（q1/q5/…）变化也不会失效。
 */
export function resolveArchetype(input, answers) {
  if (input.archetype && isValidArchetype(input.archetype)) return input.archetype
  for (const v of Object.values(answers || {})) {
    for (const raw of (Array.isArray(v) ? v : [v])) {
      if (typeof raw !== 'string') continue
      // 模型给出的选项值可能带空格或中文引号，先归一化再匹配
      const id = raw.trim().replace(/^["'「『]|["'」』]$/g, '')
      if (isValidArchetype(id)) return id
    }
  }
  return null
}

/** 把已确认的骨架拼进 system prompt——这是「载入」真正发生的地方。 */
function withSkeleton(system, archetypeId) {
  if (!archetypeId) return system
  return `${system}\n\n【用户在访谈中已确认工作形态：${archetypeId}】\n` +
    '以下是该工作形态的结构化骨架，steps 与 workflow 必须按此骨架划分与排序；' +
    '骨架的「必采信息」要落到 steps[].questions，「该阶段产出」要落到 steps[].done，' +
    '「通用铁律」并入 principles，「典型误区」并入 pitfalls。\n\n' +
    renderSkeleton(archetypeId)
}

/**
 * 规范化模型返回的题目：
 *   - 丢掉结构不完整（没题面/没选项）的题
 *   - 选择型题**强制补上**「🤷 不清楚，交给 AI 决定」兜底项
 *     —— 这条不能指望模型一定听话，UI 层有 bug 就会退化成「必须选一个」，
 *     对不懂技术的用户是致命的。
 *   - 布尔题在 UI 层靠 type 渲染成是/否，不走 options
 */
export function normalizeQuestions(raw) {
  const list = Array.isArray(raw) ? raw : raw?.questions || []
  const out = []
  for (const q of list) {
    if (!q || typeof q.label !== 'string' || !q.label.trim()) continue
    const type = ['single', 'multiple', 'boolean', 'text'].includes(q.type) ? q.type : 'single'
    if (type === 'text') {
      out.push({
        id: String(q.id || `q${out.length + 1}`),
        label: q.label.trim(),
        type,
        required: false,
        // dimension 必须保留：extractFreeform 靠它区分这道手输题来自哪一段访谈。
        // 早先漏了它，导致所有手输需求都被当成「知识段」，无法在产物里区分来源。
        ...(q.dimension ? { dimension: q.dimension } : {}),
        help: q.help || '',
      })
      continue
    }
    if (type === 'boolean') {
      out.push({
        id: String(q.id || `q${out.length + 1}`),
        label: q.label.trim(),
        type,
        required: q.required !== false,
        ...(q.dimension ? { dimension: q.dimension } : {}),
        help: q.help || '',
      })
      continue
    }
    const options = (Array.isArray(q.options) ? q.options : [])
      .filter(o => o && typeof o.value === 'string' && typeof o.label === 'string' && o.label.trim())
      .map(o => ({
        value: o.value,
        label: o.label.trim(),
        ...(o.note ? { note: o.note } : {}),
        ...(o.recommended ? { recommended: true } : {}),
      }))
    if (options.length < 2) continue
    if (!options.some(o => o.value === UNSURE_VALUE)) {
      options.push({ value: UNSURE_VALUE, label: UNSURE_LABEL })
    }
    out.push({
      id: String(q.id || `q${out.length + 1}`),
      label: q.label.trim(),
      type,
      options,
      ...(q.dimension ? { dimension: q.dimension } : {}),
      ...(q.recommendAll ? { recommendAll: true } : {}),
      required: q.required !== false,
      help: q.help || '',
    })
  }
  return out
}

/** 交付形态 id 归一：接受「移动端App」这样的标签，或已经是 id 的值。 */
function profileIdOf(deliverable) {
  // ⚠️ 已经是 id 的不要再过 matchProfile（它只认 keywords，不认 id，会退化成
  //    unspecified）——这类「归一后又归一」的 bug 会让兜底注入静默失效且断言假通过。
  return typeof deliverable === 'string' && profileById(deliverable).id === deliverable
    ? deliverable
    : matchProfile(deliverable).id
}

/**
 * 从答案里解析该用哪套移动端栈。
 * 非移动端形态、或没答/答不上来时返回 null → `renderTechStack` 按形态原样取（向后兼容）。
 * 答「交给 AI 决定」也返回 null：此时该由模型按 `__unsure__` 规则自己决定，
 * 它会给出依据并记入 assumptions，而不是在这里被默默定成双端。
 */
function platformIdOf(answers) {
  const p = matchMobilePlatform(answers)
  return p ? p.stackId : null
}

/**
 * 强制注入「目标平台」必答题（2026-10-06）。
 *
 * 与 `__unsure__` 兜底项同一个道理：**不能指望模型一定出这道题**。
 * prompt 里写了「移动端必答题」，模型仍可能漏；而漏了的后果是技术栈锁错
 * （双端锁成 Kotlin = 静默放弃 iOS），且用户全程不知情。
 * 这类「静默降级」比报错更糟，所以兜底必须在代码里，不能只在 prompt 里。
 *
 * 只在两个条件都满足时注入：
 *   1. 交付形态是移动端（否则问「上哪些平台」毫无意义）
 *   2. 模型出的题里没有等价的平台题（用关键词探测，避免重复问）
 */
export function injectPlatformQuestion(questions, deliverable) {
  if (!needsPlatformQuestion(profileIdOf(deliverable))) return questions
  const has = (questions || []).some(q =>
    typeof q?.label === 'string' &&
    /(平台|ios|android|安卓|苹果|双端|跨端|iphone)/i.test(q.label))
  if (has) return questions
  const spec = profileById(profileIdOf(deliverable)).platformQuestion
  return [
    ...(questions || []),
    {
      id: spec.id,
      label: spec.label,
      type: 'single',
      required: spec.required,
      dimension: spec.dimension,
      help: spec.help,
      options: [
        ...MOBILE_PLATFORMS.map(p => ({
          value: p.label,
          label: p.label,
          note: PLATFORM_OPTION_NOTE[p.id],
        })),
        // 同样给兜底项：用户确实可能不知道该上哪个平台，此时由 AI 决定并记依据
        { value: UNSURE_VALUE, label: UNSURE_LABEL },
      ],
    },
  ]
}

const PLATFORM_OPTION_NOTE = {
  cross: '一套代码出两个平台；省事，但任一端有特殊要求时会被拖累',
  android: '包体最小、启动最快；只上安卓应用商店',
  ios: '需付费开发者账号；只上 App Store',
}

/**
 * 答案规范化。
 *
 * ⚠️ 关于 `__unsure__`（「🤷 不清楚，交给 AI 决定」）：
 *   早先这里把 `__unsure__` **直接删掉**（注释写「当作未回答，让下游按 AI 建议走」），
 *   于是下游 STEP2/STEP3 根本收不到任何委托信号——用户点了「交给 AI 决定」，
 *   等于什么都没发生，AI 只能凭常识随便编。这与「委托是有效答案、须记入 assumptions」
 *   的规则直接矛盾。
 *
 *   现在的做法：**原样保留** `__unsure__`（含 multiple 题里混着的情况），
 *   委托信号由 `unsure.js` 的 `collectUnsure` / `renderUnsureNotice` 显式提取。
 *   下游「按 AI 建议走」的行为不变——变的只是 AI 现在**知道**这是用户的授权，
 *   并被要求给出依据 + 记入 `sections.assumptions`。
 */
function normalizeAnswers(questions, answers) {
  const out = {}
  for (const q of questions || []) {
    const v = answers ? answers[q.id] : undefined
    if (v === undefined) continue
    if (q.type === 'multiple') {
      // 保留原样（含 __unsure__）：委托信号不能在这里被吃掉
      const list = (Array.isArray(v) ? v : [v])
      if (list.length) out[q.id] = list
    } else {
      out[q.id] = v
    }
  }
  return out
}

/**
 * 抽取「用户手输的补充需求」——两段访谈里所有 type=text 题的用户输入。
 *
 * 为什么必须单独抽出来：
 *   text 题（如「其他特殊能力需求」）是用户唯一能自由表达的地方，但答案只是被
 *   `JSON.stringify` 混进 STEP2/STEP3 的 user 消息里，**混在上百道结构化答案中间、
 *   无任何标记**。模型很可能读漏，或者读到了但没落实到任何字段——而用户完全无从察觉。
 *   实测确认 `compileSkill` 也不写 answers，所以原始诉求没有任何可追溯的落点。
 *
 * 因此这里把它单独抽成结构化条目，随产物落盘，保证：
 *   ① 用户说过什么永远查得到；
 *   ② 可以事后核对模型有没有漏采纳。
 */
export function extractFreeform(questions, answers, stage = 'interaction') {
  const out = []
  for (const q of questions || []) {
    if (!q || q.type !== 'text') continue
    const raw = answers ? answers[q.id] : undefined
    const text = typeof raw === 'string' ? raw.trim() : ''
    if (!text) continue
    out.push({
      // stage 取自调用方（哪一段的题表传进来的），dimension 只作为兜底线索。
      // 早先靠 `dimension === '其他'` 反推阶段，但 normalizeQuestions 当时会丢 dimension，
      // 导致所有手输需求都被误标为 knowledge。
      stage,
      dimension: q.dimension || '',
      question: String(q.label || '').trim(),
      answer: text,
    })
  }
  return out
}

/**
 * 把「题表 + 答案」渲染成模型看得懂的**完整选择清单**（2026-10-06 新增）。
 *
 * ## 为什么必须加这个（这是优先级 1 修的那个断链）
 *
 * `answers` 里存的**只有选项的 value**（`client.js` 点选项时 `set(o.value)`），
 * 于是 `【需求调研答案】${JSON.stringify(answers)}` 送进模型的就是 `{"k3":"vet..."}` 这种。
 * **选项的 label 与 note 一个字都没进去。**
 *
 * 而 note 恰恰是**用户实际读到的、往往最有信息量的那段文字**。实测踩到的实例
 * （宠物健康监测，2026-10-06）：用户在访谈里为「L2 怎么判」选了一个选项，
 * 该选项 note 写着他自己查到的临床判据「单项偏离个体基线 20%–50%，且连续 ≥2 天未回落、
 * 偏离方向与该猫已知慢病（CKD）的恶化趋势一致」——**模型从未看到这段话**，
 * 于是自己编了一套 `±20%` + `1.5×IQR`，并把用户明确说「不称重」的记录口径改成了「克」。
 * 用户提供的 5 个精确判据（50 ml/kg/日、月降 5%、20%–50%、甲亢、呕吐性状）**全部丢失**，
 * 而产物里一个都找不到。
 *
 * **注意这不是「用户手输内容被降级」的问题**——手输内容有 `extractFreeform` 的显式
 * 三件套保护着。断的是**选项 note 这条链路**：它在 UI 层就没进 answers，在 prompt 层也没展开，
 * **两头都没有保护**，所以更隐蔽、更致命。
 *
 * ## 渲染成什么格式
 * 每条给四件事：**题号 / 题面 / 用户选的 label / 该 label 的 note**。
 * note 是关键——它常常包含具体的数值判据、方向性约束、以及「为什么不这样选」的理由，
 * 这些是用户（或系统按用户情况生成的）刻意写下的判据，必须原样送达模型。
 *
 * 同时保留题号，模型要回灌纠错时能指名道姓地说「k3 那题」。
 *
 * @param {Array} questions 题表（两段合并后的）
 * @param {object} answers  用户答案（value 形态）
 * @returns {string} 可直接放进 user 消息的文本；无答案时返回 ''
 */
export function renderAnswers(questions, answers) {
  const lines = []
  for (const q of questions || []) {
    if (!q) continue
    const raw = answers ? answers[q.id] : undefined
    if (raw === undefined) continue
    const vals = (Array.isArray(raw) ? raw : [raw]).filter(v => v !== undefined && v !== null)
    if (!vals.length) continue

    const head = `【${q.id}】${q.label || ''}`
    if (q.type === 'text') {
      // 手输题：原样带上（落实交给 extractFreeform 的三件套，这里只做可读呈现）
      lines.push(head)
      lines.push(`  用户填写：${vals.join(' / ')}`)
      continue
    }
    if (q.type === 'boolean') {
      lines.push(head)
      lines.push(`  用户选择：${vals.map(v => (v === true ? '是' : v === false ? '否' : String(v))).join(' / ')}`)
      continue
    }

    // 选择型：**必须把 label 与 note 一起带出来**，这是本函数存在的全部理由
    const byValue = new Map((q.options || []).map(o => [o.value, o]))
    const picked = vals.map(v => byValue.get(v)).filter(Boolean)
    if (!picked.length) {
      // 答案里出现了题表里没有的 value（题表被重生成过、或跨版本残留）——照实显示，别静默丢
      lines.push(head)
      lines.push(`  用户选择：${vals.join(' / ')}`)
      continue
    }
    lines.push(head)
    for (const o of picked) {
      lines.push(`  用户选择：${o.label}${o.recommended ? '（推荐项）' : ''}`)
      // note 单起一行且缩进——它是本函数要抢救的核心内容，缩进让模型知道它属于上面这个选项
      if (o.note) lines.push(`    该选项说明：${o.note}`)
    }
  }
  if (!lines.length) return ''
  // ⚠️ 标题固定为「需求调研答案」：调用方（含验证脚本）靠它定位这一段，
  //    别因为改了渲染形式就把标题删掉——它是这段内容的唯一稳定标识。
  lines.unshift('【需求调研答案】以下是用户逐题实际选择的内容：')
  lines.push('')
  lines.push('⚠️ 「该选项说明」是用户读到并认可的内容，')
  lines.push('   其中的具体数值、方向性判据、记录口径与约束**必须原样采用**，不许用通用值替代，')
  lines.push('   也不许因为「你这里有更精确的方案」而替换它——那是用户已经拍板的决定。')
  lines.push('   用户没给判据的地方才由你补充，且补充时要标注「AI 建议（用户未提供）」。')
  return lines.join('\n')
}

/** 宽松取数组：非数组一律当空数组。调用方（UI/序列化层）传错类型时不崩。 */
function asQuestionList(v) {
  return Array.isArray(v) ? v : []
}

/**
 * 从 input 取两段合并题表。
 * 与 `runPipeline` 里的取法保持一致（含非数组的兜底），否则同一份答案在
 * 「生成阶段」与「落盘阶段」会用不同的题表去解释，`normalizeAnswers` 过滤后
 * 的答案集合会对不上——那会让「回灌纠错指名 k3」这类定位失效。
 */
function allQuestionsOf(input) {
  return [...asQuestionList(input?.interviewQuestions), ...asQuestionList(input?.interactionQuestions)]
}

/**
 * @typedef {(system: string, userText: string, maxTokens: number, signal?: AbortSignal)
 *   => Promise<{text: string, reasoningChars?: number, finish?: string}>} CallModel
 */

/** 段① 专业知识调研：依据工作事项产出「以调研清楚为准」的专业选择题。 */
export async function stepInterview(callModel, input, signal) {
  const form = formOf(input)
  const profile = matchProfile(form.deliverable)
  const user = [
    briefText(form),
    '',
    '请基于以上工作事项，设计专业知识调研题，用于摸清使用者在这个专业领域的真实需求与判定口径。',
    '题数由任务复杂度决定，不要凑数：每一道题都必须会实质改变生成出来的技能。',
  ].join('\n')
  // 访谈只需要形态清单（名称+适用场景）来出题与写 note，不需要流程骨架——
  // 完整词表会拉长 prompt、推高思考量、挤压正文额度。
  const system = fill(SYSTEM_INTERVIEW, {
    domain: form.domain, archetypes: archetypeTable('brief'), deliverable: form.deliverable,
    // ⭐ 2026-10-11：形态题已从问卷移到界面独立步骤，这里把用户选的值告诉模型，
    // 让它知道形态已定、不要再问。⚠️ 不传会导致 `{{ARCHETYPE_FIELD}}` 落成空串。
    archetype: resolveArchetype(input, null),
  })
  const data = await generateJSON(callModel, system, user, MAX_TOKENS.questions, 3)
  // 目标平台题在代码里兜底注入，不靠模型自觉出（漏了会静默锁错栈）
  const questions = injectPlatformQuestion(normalizeQuestions(data), profile.id)
  if (!questions.length) throw new Error('没有生成出有效的专业调研题，请重试')
  return { questions, plan: data?.plan || null, deliverableProfile: profile.id }
}

/** 段② 智能体交互调研：基于段①答案 + 交付形态画像，确定智能体形态。 */
export async function stepInteraction(callModel, input, knowledgeAnswers, signal) {
  const form = formOf(input)
  const profile = matchProfile(form.deliverable)
  const system = fill(SYSTEM_INTERACTION, { domain: form.domain, deliverable: form.deliverable })
    .replace(/\{\{KNOWLEDGE_ANSWERS\}\}/g, renderProfile(profile) + '\n\n' + briefText(form) +
      // 同 stepSkill：段①选项的 label + note 必须一起带进段②。
      // 段②要据此出题，而「用户在选项里认可的判据」正是出题时最该沿用的东西——
      // 丢掉它，段②就会基于零信息重新设计，问出与用户已拍板的口径相冲突的题。
      '\n【用户在专业知识调研中的选择】\n' +
      (renderAnswers(asQuestionList(input.interviewQuestions), knowledgeAnswers)
        || JSON.stringify(knowledgeAnswers || {}, null, 2)))
  const user = [
    '请基于上面的任务简报、专业调研结论与交付形态约束，设计智能体形态调研题。',
    '每一道题都要给推荐并说明推荐理由；选项必须落在该交付形态下真实可行的范围内。',
  ].join('\n')
  const data = await generateJSON(callModel, system, user, MAX_TOKENS.interaction, 3)
  // 目标平台题在代码里兜底注入，不靠模型自觉出（漏了会静默锁错栈）
  const questions = injectPlatformQuestion(normalizeQuestions(data), profile.id)
  if (!questions.length) throw new Error('没有生成出有效的形态调研题，请重试')
  return { questions, plan: data?.plan || null, deliverableProfile: profile.id }
}

/** 段③：技能方法论（结构化章节 + 英文 slug + 触发式 description）。 */
export async function stepSkill(callModel, input, answers, freeform, signal) {
  const form = formOf(input)
  const archetypeId = resolveArchetype(input, answers)
  const profile = matchProfile(form.deliverable)
  const system = withSkeleton(fill(SYSTEM_STEP2, {
    domain: form.domain,
    archetypes: archetypeTable(),
    uiFieldsHint: renderUIFieldsHint(form.deliverable),
    // 紧凑版：只给 slot → 取值，不展开「为什么」与「何时可换」。
    // 完整版会显著拉长 STEP2 的 system prompt，推高推理模型思考量、挤压正文额度。
    techStack: renderTechStack({ deliverable: profile.id, compact: true, platformStackId: platformIdOf(answers) }),
  }), archetypeId)
  const user = [
    briefText(form),
    // ⚠️ 必须用 renderAnswers（带 label + note），不能只 JSON.stringify(answers)。
    //    实测事故（宠物健康 2026-10-06）：用户为「L2 怎么判」选的选项 note 里写着
    //    他自己的临床判据（偏离 20%–50%、连续 ≥2 天、与 CKD 恶化方向一致），
    //    而这里原本只送 value → 模型全程没看到，自编了一套 ±20% + 1.5×IQR 把它顶掉了。
    renderAnswers(allQuestionsOf(input), answers) || `【需求调研答案】${JSON.stringify(answers || {}, null, 2)}`,
    // ⚠️ 光把 `__unsure__` 混在 answers 的 JSON 里不行 —— 实测模型认不出这个字符串，
    //    会当噪声忽略。必须显式点名哪些题被委托了，它才会去认真决定。
    //    renderUnsureNotice 无委托时返回 ''，这里 filter 掉避免留空行。
    ...[renderUnsureNotice(answers, input.questionLabels)].filter(Boolean),
    ...(freeform && freeform.length ? [
      '',
      '【用户手输的补充需求 —— 必须逐条落实，不得忽略】',
      ...freeform.map((f, i) => `${i + 1}. 问：${f.question}\n   答：${f.answer}`),
      '这些是用户在固定选项之外主动提出的要求，优先级高于任何选项推荐。',
      '每一条都必须能在 sections 里找到对应落点（principles / steps / specializations / pitfalls /',
      'outputSpec / uiDesign 之一）；若某条确实无法落实，必须在 sections.uiDesign.constraints 里',
      '写明「未能落实：<原文>」与原因，**不许静默丢弃**。',
    ] : []),
    archetypeId
      ? '工作形态已由用户在上一步确认，请直接采用，不要另行判定。'
      : '用户未确认工作形态，请自行从受控词表中判定最接近的一类。',
    '请设计技能方法论与交互选项（JSON）。',
  ].join('\n')
  const data = await generateJSON(callModel, system, user, MAX_TOKENS.methodology, 3, {
    validate: validateSections,
  })
  const sections = data.sections || null
  return {
    slug: sections?.slug || null,
    description: data.description || '',
    archetypeId,
    sections,
    skillMethodology: sections
      ? renderSkillBody(sections, data.skillMethodology || '')
      : data.skillMethodology || '',
    interactionOptions: data.interactionOptions || [],
  }
}

/**
 * STEP2 产物的必需字段校验。
 *
 * ⚠️ 这段校验的存在理由不是「模型偶尔忘写」，而是 2026-10-05 实测到的静默残缺：
 *   `closeTruncated` 把被截断的尾部补齐成合法 JSON，于是输出能 parse、流程不报错，
 *   但 `pitfalls` / `outputSpec` / `assumptions` / `uiDesign` 全部为空——
 *   这四个字段恰好排在 JSON 的尾部，一截断就整段消失。
 *   实测那次：steps=5、principles=6 拿到了，uiDesign 直接是 undefined。
 *   所以这里不是「防御性编程」，是在补一个会静默产出残缺产物的真实漏洞。
 *
 * 返回 true = 通过；返回字符串 = 缺什么（该字符串会回灌给模型让它补齐）。
 */
export function validateSections(data) {
  const s = data?.sections
  if (!s || typeof s !== 'object') return 'sections 字段缺失或不是对象'
  const missing = []
  // 文本类字段
  for (const k of ['slug', 'category', 'archetype', 'role', 'deliverable', 'coreWorkflow']) {
    if (typeof s[k] !== 'string' || !s[k].trim()) missing.push(k)
  }
  // 数组类字段：必须存在且非空。空数组等于没写。
  const arr = ['stagesUsed', 'principles', 'triggers', 'steps', 'pitfalls', 'outputSpec']
  for (const k of arr) {
    if (!Array.isArray(s[k]) || s[k].length === 0) missing.push(k)
  }
  if (!Array.isArray(s.techDecisions) || s.techDecisions.length === 0) missing.push('techDecisions')
  if (!s.specializations || typeof s.specializations !== 'object'
    || Object.keys(s.specializations).length === 0) missing.push('specializations')
  // uiDesign 四个子字段——缺任一整块界面方案就没了
  if (!s.uiDesign || typeof s.uiDesign !== 'object') {
    missing.push('uiDesign')
  } else {
    for (const k of ['hierarchy', 'layout', 'interactionPatterns', 'states', 'constraints']) {
      if (typeof s.uiDesign[k] !== 'string' || !s.uiDesign[k].trim()) missing.push(`uiDesign.${k}`)
    }
  }
  // assumptions 可以是空数组（用户没委托任何题时），但**不能缺字段**——
  // 缺字段意味着这段被截断了，而「有委托却没记录」正是之前修过的断链。
  if (!Array.isArray(s.assumptions)) missing.push('assumptions（无委托时给空数组，不要省略该字段）')
  if (missing.length) {
    return `sections 缺少必需字段：${missing.join('、')}`
  }
  // steps 的每个元素也要有骨架，否则下游 promptDoc 拿不到判据
  for (const [i, st] of s.steps.entries()) {
    if (!st || typeof st !== 'object') return `steps[${i}] 不是对象`
    for (const k of ['title', 'goal']) {
      if (typeof st[k] !== 'string' || !st[k].trim()) return `steps[${i}] 缺少 ${k}`
    }
  }
  return true
}

/** 段④：工作流 + 最终提示词文档 + 关键技术。 */
export async function stepWorkflow(callModel, input, answers, skill, freeform, signal) {
  const form = formOf(input)
  // 段③ 可能自行判定出 archetype；用户已确认时优先用用户的
  const archetypeId = resolveArchetype(input, answers) || skill?.archetypeId || skill?.sections?.archetype || null
  const profile = matchProfile(form.deliverable)
  const uiForms = matchUIForms(answers)
  const system = withSkeleton(fill(SYSTEM_STEP3, {
    domain: form.domain,
    archetypes: archetypeTable(),
    uiStandards: renderUIStandards({ deliverable: profile.id, uiForms }),
    uiChecklist: renderUIChecklist(),
    // STEP3 用完整版：keyTech 就在这一步产出，必须带「何时可换」条件才判断得了该不该换
    techStack: renderTechStack({ deliverable: profile.id, platformStackId: platformIdOf(answers) }),
  }), archetypeId)
// STEP3 的 prompt 里最大的一块是「技能方法论」——它是 STEP2 的完整产物，
// 含全部 steps/framework 判据表。正因为大，它必须走双轨：
//   进 prompt 用节选版（保住思考+正文的额度余量），落盘用完整版（render.js 拿的是
//   sections 原始数据，不经过这里，所以产物不受截断影响）。
// 过去这里是整份塞入、没有裁剪，靠32768 额度硬扛 —— 能跑，但没有余量。
const methodologyTrack = dualTrack(skill?.skillMethodology || '', 4000)
const user = [
  briefText(form),
  // 同 stepSkill：必须带 label + note，否则用户在选项里认可的判据会被 AI 自编的值顶掉
  renderAnswers(allQuestionsOf(input), answers) || `【需求调研答案】${JSON.stringify(answers || {}, null, 2)}`,
  `【技能方法论】${methodologyTrack.text}`,
  methodologyTrack.truncated
    ? `   （技能方法论全文 ${methodologyTrack.fullLength} 字符，以上为前4000 字符节选。`
      + `工作流的节点顺序必须与节选中列出的阶段一致；需要更细的判据时以技能包 SKILL.md 为准。）`
    : '',
    `【交互选项】${JSON.stringify(skill?.interactionOptions || [])}`,
    archetypeId ? `【工作形态】${archetypeId}（已确认，流程节点顺序须遵循其骨架）` : '',
    // STEP3 也要知道哪些项是被委托的 —— 否则 keyTech 里若出现偏离，
    // 模型既说不出依据，也没法在 promptDoc 里提醒用户「这条是我替你定的」。
    renderUnsureNotice(answers, input.questionLabels),
    ...(freeform && freeform.length ? [
      '',
      '【用户手输的补充需求 —— 必须体现在 promptDoc 里】',
      ...freeform.map((f, i) => `${i + 1}. 问：${f.question}\n   答：${f.answer}`),
      'promptDoc 的各段要求（尤其是 UI 与信息层级规范段）必须覆盖这些要求；',
      '若某条无法在本形态下实现，必须在 promptDoc 中显式写明「本形态不支持：<原文>」，不许静默丢弃。',
    ] : []),
    '请产出工作流、最终提示词文档与关键技术清单（JSON）。',
  ].filter(Boolean).join('\n')
  const data = await generateJSON(callModel, system, user, MAX_TOKENS.workflow, 3, {
    validate: validateWorkflow,
  })
  return {
    archetypeId,
    workflow: data.workflow || { version: 1, entry: 'n1', nodes: [], edges: [] },
    promptDoc: data.promptDoc || '',
    keyTech: data.keyTech || [],
  }
}

/**
 * STEP3 产物的必需字段校验。同 validateSections 的理由：截断补齐会造出残缺产物。
 * STEP3 特有的风险点是 promptDoc —— 它在 JSON 尾部且体量最大，一截断就整块消失，
 * 而它恰恰是用户真正要拿走的那份文档。
 */
export function validateWorkflow(data) {
  const missing = []
  const wf = data?.workflow
  if (!wf || typeof wf !== 'object') return 'workflow 字段缺失或不是对象'
  if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) missing.push('workflow.nodes')
  else {
    for (const [i, n] of wf.nodes.entries()) {
      if (!n || typeof n !== 'object' || typeof n.id !== 'string') return `workflow.nodes[${i}] 缺少 id`
      if (typeof n.type !== 'string' || !n.type) return `workflow.nodes[${i}]（${n.id}）缺少 type`
    }
    if (!wf.nodes.some(n => n.type === 'start')) missing.push('workflow.nodes 里的 start 节点')
  }
  if (!Array.isArray(wf.edges) || wf.edges.length === 0) missing.push('workflow.edges')
  if (typeof data.promptDoc !== 'string' || data.promptDoc.trim().length < 200) {
    // 200 字符是地板线：promptDoc 最小可信体量。远低于此说明被截断了。
    //⚠️ 段数不再手写「七段」—— 从 PROMPTDOC_SECTIONS 派生。
    //   过去这里是第三个手写「七段」的地方（另两处在 prompts.js 的段落清单与 JSON 骨架），
    //   三处独立文本一旦漂移就会给模型矛盾指令，2026-10-07 实测踩过。
    missing.push(`promptDoc（当前 ${(data.promptDoc || '').length} 字符，明显短于${PROMPTDOC_SECTION_COUNT} 段齐备的体量）`)
  }
  if (!Array.isArray(data.keyTech) || data.keyTech.length === 0) missing.push('keyTech')
  if (missing.length) return `缺少：${missing.join('、')}`
  return true
}

/**
 * 完整流水线：段③ → 段④ → 编译落盘。
 * 访谈问题由调用方先行取得，答案作为 `input.interview`（专业）
 * 与 `input.interaction`（形态）传入，两者会合并。
 */
export async function runPipeline(callModel, input, targetDir) {
  const merged = { ...(input.interview || input.answers || {}), ...(input.interaction || {}) }
  // 两段题号不同（k1… / i1…），但都靠同一套 id 过滤，所以合并题表一次过滤即可。
  // 用 Array.isArray 卡一道：调用方（或序列化层）传了非数组时，
  // 直接展开会抛 "is not iterable" 让整条流水线崩掉，这里降级为空数组。
  const asList = v => (Array.isArray(v) ? v : [])
  const allQuestions = [...asList(input.interviewQuestions), ...asList(input.interactionQuestions)]
  const answers = normalizeAnswers(allQuestions, merged)
  // 两段题表分别抽：stage 要标明这条手输需求来自哪一段访谈，产物里才分得清
  const freeform = [
    ...extractFreeform(asList(input.interviewQuestions), answers, 'knowledge'),
    ...extractFreeform(asList(input.interactionQuestions), answers, 'interaction'),
  ]
  const archetypeId = resolveArchetype(input, answers)
  const skill = await stepSkill(callModel, input, answers, freeform)
  const wf = await stepWorkflow(callModel, input, answers, skill, freeform)
  return {
    archetypeId,
    answers,
    freeform,
    skill,
    workflow: wf,
    out: compileSkill({
      domain: input.domain,
      slug: skill.slug,
      skillName: input.agentName || input.domain,
      description: skill.description || input.description,
      sections: skill.sections,
      skillMethodology: skill.skillMethodology,
      workflow: wf.workflow,
      promptDoc: wf.promptDoc,
      keyTech: wf.keyTech,
      freeform,
      targetDir,
      // 可选交付物 AGENTS.md 的开关：沿用到落盘阶段（undefined 视为生成）
      includeAgentsMd: input.includeAgentsMd,
    }),
  }
}

// ======================================================================
// 工作形态推荐（2026-10-11）
// ======================================================================

/**
 * 让 **AI 推荐工作形态**（用户要求：以前是 AI 推荐的，别退回本地启发式）。
 *
 * ## 为什么要有这一步
 * 形态题原本是问卷第 1 题，prompt 要求模型「根据前面各题的用户回答判断最贴近的一项，
 * 把 recommended 设为 true」——那是**模型判断**。形态改成界面上的独立一步后，
 * 问卷答案还不存在，我把推荐换成了本地关键词启发式 —— **那是能力降级**，
 * 词表永远追不上用户的自然语言表达。
 *
 * ## 现在的分工
 *   主路径：调模型推荐（准确、理解自然语言）
 *   兜底：模型失败/超时 → `suggestArchetype(form)` 启发式 → 再不行就不推荐
 *
 * ## 为什么单独一次调用，而不是复用段①
 * 段① 要出 10-15 道题，maxTokens 16384、思考耗时长；这里只要一个 id，
 * 用小额度快速拿结果，**不让用户为了看一个推荐等十几秒**。
 */
export async function suggestArchetypeByAI(callModel, input, signal) {
  const form = formOf(input)
  const user = [
    '根据下面这份工作事项，判断它最适合哪一种工作形态。',
    '',
    '# 工作事项',
    briefText(form),
    '',
    '# 可选形态（只能从下面 id 里选一个，不要另造）',
    ARCHETYPE_SKELETONS.map(a => `${a.id}：${a.label}——${a.summary}`).join('\n'),
    '',
    '# 判断要求',
    '- 选「这项工作的主要动作」最接近的一个，不要被行业名称带偏（比如「财务」不等于「合规核查」）。',
    '- 若确实无法判断，archetype 留空字符串，不要硬猜。',
    '',
    '只输出 JSON：{"archetype":"","reason":"一句话理由，不超过 30 字"}',
  ].join('\n')
  const system = '你是资深的工作流设计专家。只输出 JSON，不要前言与结束语。'
  try {
    // 额度给 2048：推理模型要留思考空间，但只需产出两个短字段
    const data = await generateJSON(callModel, system, user, 2048, 1)
    const id = String(data?.archetype || '').trim()
    if (!isValidArchetype(id)) return { id: null, reason: data?.reason || '', fallback: false }
    return { id, reason: String(data?.reason || ''), fallback: false }
  } catch {
    // ⚠️ 兜底链：AI 不可用时退回启发式，绝不让这一步卡住用户
    const fb = suggestArchetype(form)
    return { id: fb?.id || null, reason: '按关键词匹配推测', fallback: true }
  }
}
