/**
 * skill-generator-core · meta-prompt 与调用额度
 * ------------------------------------------------------------------
 * 这是「规则」的唯一事实来源。改动这里会同时影响两种形态：
 *   - 独立应用  prompt-forge（src/main/engine.js）
 *   - Harness 插件 dsh-plugin-skill-generator（index.js）
 *
 * 流程分两段访谈：
 *   段① SYSTEM_INTERVIEW  —— 专业知识调研：把「要解决什么专业问题」问清
 *   段② SYSTEM_INTERACTION —— 智能体交互调研：把「做成什么样的智能体」问清
 * 两段不是并列的两份清单，而是**前后依赖**：段②的每一题都必须能从段①的答案里
 * 推出理由，且其可行选项受第一步表单选定的「交付形态」硬约束。
 */

import {
  UNSURE_VALUE, UNSURE_LABEL, UNSURE_RULES_EN, UNSURE_RULES_ZH,
  collectUnsure, renderUnsureNotice,
} from './unsure.js'
// 「🤷 不清楚，交给 AI 决定」兜底选项相关的常量与规则，定义在 `unsure.js`。
// ⚠️ 这里必须 `import` 而不只是 `export ... from`：`fill()` 在本模块内引用
//    UNSURE_RULES_EN，单纯重导出不会把它绑进当前作用域（会 ReferenceError）。
// ⚠️ 出题时「必须带兜底选项」在本文件的 SYSTEM_INTERACTION 里定义；
//    收到它之后怎么办在 unsure.js 定义 —— 两件事分开才不会漏（曾因只定义前者而完全无人消费）。
export { UNSURE_VALUE, UNSURE_LABEL, UNSURE_RULES_EN, UNSURE_RULES_ZH, collectUnsure, renderUnsureNotice }

export const DEFAULT_MODEL = 'deepseek-v4-flash'

/**
 * `maxTokens` 封顶的是**思考 + 回答的合计**。推理模型（如 deepseek-v4-flash）会先思考，
 * 给太小的值会导致正文一个字都不输出、JSON 解析失败，且**与输入长度无关**。
 */
export const MAX_TOKENS = {
  // 段① 要输出多道题，其中工作形态题必须列全 12 个选项且每项带适用场景说明，
  // 正文量远大于其他环节；同时推理模型会先思考（实测思考可达 1.4 万字符 ≈ 7k token），
  // maxTokens 封顶的是「思考 + 正文」合计，给 8192 会导致正文在句子中间被截断。
  questions: 16384,
  // 段② 题量比段① 少，但要带推荐理由与画像约束，给足余量。
  interaction: 16384,
  answers: 8192,
  // ⚠️ 2026-10-06 实测故障后上调。真实数字（宠物健康项目，18 题带精确判据）：
  //   思考 23181 字符 ≈ 15454 token，**占上限 94%**；正文只分到约 930 token
  //   （1395 字符），而实际要写 6934 字符 → 截断在字符串中间 → JSON 解析失败。
  //
  //   两点要分清，别混为一谈：
  //   1. `maxTokens` 封顶的是「思考 + 正文」**合计**，所以额度必须按
  //      「思考峰值 × 安全系数」来给，而不是按正文需要量来给。
  //   2. **额度触顶时 API 报的是 `finish=stop` 而不是 `finish=length`**（实测），
  //      于是 `buildParseError` 会把它误判成「JSON 内部字符串破损」并给出
  //      「检查换行与引号」的错误指引——方向完全错。真正的证据是
  //      `reasoningChars / maxTokens > 0.6` 这个比值。
  //      该比值已写进 json.js 的诊断分支，那里才是不误判的地方。
  //
  // 为什么给 32768：思考峰值的实测上界是 2.3 万字符 ≈ 1.5 万 token；
  // 留一倍余量可覆盖「题目更多 / 判据更密」的场景。32768 是多数模型的上限。
  //
  // ⚠️ 这里还有一个**容易被忽略的连带效应**：调额之后，输入侧的信息量也会抬高思考量。
  // 实测（2026-10-06 宠物健康）加了 `renderAnswers`（把用户选项里的 note 送进 prompt）之后，
  // 模型拿到了 5 个精确判据（50 ml/kg/日、月降 5%、20%–50%、CKD 恶化方向、呕吐性状），
  // 于是要多想「怎么把它们整合成不自相矛盾的一套阈值」→ **思考量暴涨到 23181 字符（1.5 万 token）**。
  // 而**思考与正文共用同一个 maxTokens 预算**，输入侧的 +943 token 只是账面，
  // 推理模型会为它额外付出「思考 token」，这才是额度不够用的真正来源。
  // 所以：**改动输入信息量时，必须同时检查思考量，不能只看 prompt 变长了多少。**
  methodology: 32768,
  // STEP3 同样上调：它要产出 workflow + promptDoc + keyTech 三样，
  // 且 promptDoc 是七段式 Markdown（最重的一块）。实测思考 4489–11858 字符，
  // 上限 16384 时正文只写到 5785 字符就用尽，同样处在截断边缘。
  workflow: 32768,
}

export function fill(template, vars = {}) {
  const map = {
    DOMAIN: vars.domain || '通用',
    ARCHETYPE_COUNT: String(ARCHETYPE_COUNT),
    ARCHETYPES_IDS: vars.archetypes ? ARCHETYPES.map(a => a.id).join(' / ') : '',
    ARCHETYPES: vars.archetypes || '',
    // ⭐ 2026-10-11：形态题从问卷移到界面上的独立步骤后，段① 的 prompt 要告诉模型
    // 「形态已由用户选定、不要重复问」并把用户选的值原样报给它。
    // ⚠️ fill() 是**白名单映射**：不加这一行，`{{ARCHETYPE_FIELD}}` 会原样露给模型。
    // 传空字符串时降级为一句中性说明，避免出现「用户未指定」这种模型无法处理的表述。
    ARCHETYPE_FIELD: vars.archetype
      ? `用户已在界面选定了工作形态：**${vars.archetype}**。`
      : '',
    DELIVERABLE: vars.deliverable || '暂不确定（由 AI 建议）',
    DELIVERABLE_PROFILE: vars.profile || '',
    UI_STANDARDS: vars.uiStandards || '',
    UI_FIELDS_HINT: vars.uiFieldsHint || '',
    UI_CHECKLIST: vars.uiChecklist || '',
    TECH_STACK: vars.techStack || '',
    // 「交给 AI 决定」的处理规则。默认给英文版；STEP3 传 unsureRulesZh 覆盖成中文版。
    UNSURE_RULES: vars.unsureRules || UNSURE_RULES_EN,
    UNSURE_RULES_ZH: vars.unsureRulesZh || UNSURE_RULES_ZH,
  }
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in map ? map[k] : m))
}

// ---- archetype 受控词表 ----
// 唯一数据源是 `./archetypes.js` 的 ARCHETYPE_SKELETONS（含 summary / applicableWhen /
// stages 等完整结构）。这里只做派生，供 render.js 与 meta-prompt 使用，
// 避免两处各写一份而漂移。
//
// 设计原则：**按「工作形态」切分，不按「行业职能」切分**。
// 早期版本里曾有「估值测算」「税务合规」两个偏金融的原型，骨架全是标的/折现/税种
// 这类金融术语，已泛化为「测算评估」「合规核查」。
// 若用户场景确实不属于任何一类，允许选最接近的并说明；后续可由用户库扩展新原型，
// 但**内置词表必须受控**，否则每次生成都是新词，产物无法按形态聚合、无法复用骨架。
import { ARCHETYPE_SKELETONS } from './archetypes.js'
import { renderUIStandards, renderUIFieldsHint } from './ui-standards.js'
import { renderTechStack } from './tech-stacks.js'

export const ARCHETYPES = ARCHETYPE_SKELETONS.map(a => ({
  id: a.id,
  label: a.label,
  workflow: a.stages.map(s => s.name).join(' → '),
  summary: a.summary,
  applicableWhen: a.applicableWhen,
}))

/**
 * 供 meta-prompt 内联使用的词表文本。
 * - full：含 id / 名称 / 一句话说明 / 适用场景 / 流程 —— 用于段②段③，需要骨架
 * - brief：去掉流程行 —— 用于访谈环节。访谈只需要知道"有哪些形态、各自管什么事"，
 *   给出完整流程会显著拉长 prompt，进而推高推理模型的思考量、挤压正文输出额度。
 */
export function archetypeTable(mode = 'full') {
  return ARCHETYPES.map(a => {
    const head = `${a.id}（${a.label}）—— ${a.summary}`
    const applicable = `  适用：${a.applicableWhen}`
    return mode === 'brief' ? [head, applicable].join('\n') : [head, applicable, `  流程：${a.workflow}`].join('\n')
  }).join('\n')
}

export const ARCHETYPE_COUNT = ARCHETYPES.length

// ======================================================================
// 段① 专业知识调研
// ======================================================================
// 这一段只负责把「专业上要解决什么」问清楚：判定口径、数据来源、阈值、
// 例外情形、合规约束。**不碰**交互方式、技术栈、记忆这些实现层的东西——
// 那些是段②的职责。混在一起问，用户会拿到一份 15 题却没一句问到点上的清单。
export const SYSTEM_INTERVIEW = [
  '你是一位资深的{{DOMAIN}}领域需求分析专家。',
  '',
  '用户的任务简报已经给全了（团队、智能体名称、专业领域、交付形态、任务背景、目标、痛点）。',
  '本阶段的任务：设计一组【专业知识调研题】，把使用者在这个专业领域里的真实需求、判定口径与边界情形问清楚。',
  '**本阶段不负责**交互方式、技术选型、界面形态、记忆策略——那些会在下一阶段单独问。你在这一段问它们就是浪费用户时间。',
  '',
  '## 题数（重要）',
  '- **不要固定 15 题，也不要凑数**。题数由这个任务的实际复杂度决定，简单场景 4-6 题就够，复杂决策链 8-12 题。',
  '- 先在心里判断「要问清这件事，最少需要哪几类信息」，一类一题，合并同类项。',
  '- 判断标准：**每一道题都必须会实质改变生成出来的技能**。改了答案就要改技能的判据、步骤或输出，才值得问。',
  '- 把你的判断写进 `plan`：`plan.count` 是你实际出的题数，`plan.rationale` 用一句话说明**为什么这个任务需要这么多题**（例如「该任务涉及 3 类成本口径和 2 类例外情形，需要逐项确认」）。这个理由会展示给用户看，要具体，不要写「因为需要全面了解需求」这种空话。',
  '',
  '## 题目规则',
  '本段的目标是确定「**专业方法选择**」——即针对该需求应当采用哪些专业方法、口径、标准或处理规则。',
  '**本段不是出考试题，也不是考察用户是否了解某专业知识。**以下8 条为硬约束，逐条遵守：',
  '1. 必须从前面已描述的【具体需求 / 痛点 / 所选数据库或模型 / 所选技能库】出发，'
    + '推导出「针对该需求应当采用哪些专业方法、口径、标准或处理规则」，选项即这些可落地的专业方法或方案。',
  '2. 选项必须是具体的专业方法、技术、口径、判断标准或处理规则'
    + '（如：同比环比、趋势外推、杜邦分析、本量利分析、风险评分卡、合规比对、趋势外推、区间估计等）。'
    + '严禁出现「以下哪项属于…」「某方法主要用于…」「下列说法正确的是…」等考察知识记忆或概念辨析的考试题。',
  '3. 题干要体现「**需求→方法**」的映射：点明针对哪条需求或痛点，选项给出几种可选的专业方法路径，'
    + '让用户选择最适合本需求的方法组合。',
  '4. 每道题的 explain/help 必须说明三件事：**针对用户的哪条具体需求**、**为什么推荐对应方法**、'
    + '**该方法在最终 Prompt 中应如何落地**（给出处理规则 / 判断标准）。'
    + '不要空泛地说「这道题用来确定…」。',
  '5. 选项之间要有**方法层面的区分度**（不同方法 / 路径 / 口径），描述中体现该方法对当前需求的专业价值。',
  '6. 若使用 boolean（判断）题型，只能是「**是否启用某项专业处理能力**」这类能力开关，**不得用于考察知识**。',
  '7. **【重要】严禁出现计算机编程 / 算法实现细节类的方法选项**'
    + '（如 K-Means、DBSCAN、神经网络调参、爬虫框架、SQL 优化技巧、具体库名等）。'
    + '本项目面向**业务用户**，专业方法应聚焦该领域的**业务口径与分析方法**，而不是如何编程实现；'
    + '涉及数据分析时用「统计口径 / 分析方法」表述，不涉及具体代码或算法实现步骤。',
  '8. **【重要】所有配置项只基于用户在本项目中实际填写或选择的内容**'
    + '（智能体名称、领域、背景、目标、痛点、所选数据库 / 技能库 / 词典等）展开，'
    + '不得引入用户从未接触过的系统内置模板或外部专有知识作为必选判断依据。'
    + '若用户未选择某项，则相关配置项应改为「是否启用」开关或略过。',
  '',
  '- 题型只用 single（单选）/ multiple（多选）/ boolean（是否）。',
  '- 普通题给 3-5 个选项，选项必须具体到专业颗粒度。禁止「高质量/一般/较低」这类空泛档位；要写出实际的判断依据、数值区间或具体做法。',
  '- **已知的不要再问**：团队名称、智能体名称、专业领域、任务背景、目标、痛点、交付形态（当它不是「暂不确定」时）都已经填过了，问一遍是浪费用户耐心。',
  '- 必须问到、且是本领域的**专业判断依据**：',
  '  1. 核心判定口径与阈值（哪些指标、按什么标准、卡在哪个数）——至少 2 题，这是本段最重要的部分。',
  '  2. 数据来源与可信度（数据从哪来、谁提供、可信度如何、缺失怎么办）——至少 1 题。',
  '  3. 使用者与使用场景（谁用、一次性还是长期高频、批量还是单件）——至少 1 题，它决定后面技能要不要留痕和记忆。',
  '  4. 该领域最常见的例外情况与高风险误区——至少 1 题。',
  '  5. 领域特有的约束：合规/监管/保密要求、时效性、精度要求、协作与交接方式——有多少问多少，没有就不问。',
  '- ⛔ **不要再出「工作形态」题**（2026-10-11 改）。工作形态已由界面上的**独立一步**让用户从 12 张卡片里直接选定，',
  '  平台会通过 {{ARCHETYPE_FIELD}} 把它传给你。**你这一段只需要问专业问题**，不要重复问形态。',
  '  （历史原因：形态题原本是本段的一道选择题，要求列全 12 个受控词表选项。',
  '   但那12 张卡在问卷里要滚动看完，用户反馈「很丑、字太多」，已改为独立步骤 + 卡片网格。）',
  '- 若用户的交付形态是「暂不确定」，本段**必须**补 1-2 题来问清最终交付形态（桌面应用 / 浏览器 Web 页面 / 移动端 App / 微信小程序 / 命令行工具 / 后端服务），并说明每种形态对这个任务意味着什么。',
  '- 问题语言与用户填写内容保持一致。',
  '',
  '只输出 JSON：',
  '{"plan":{"count":0,"rationale":"为什么需要这么多题，一句话，具体"},"questions":[{"id":"k1","label":"题面","type":"single|multiple|boolean","options":[{"value":"english-kebab","label":"选项文字","note":"仅工作形态题需要：该形态的适用场景","recommended":true}],"required":true,"help":"补充说明；工作形态题在这里写推荐理由"}]}',
  '注意：`note` 与 `recommended` 只有工作形态题需要，其它题可省略。',
].join('\n')

// ======================================================================
// 段② 智能体交互调研
// ======================================================================
// 段① 已经把专业需求问清了，这一段要回答另一个问题：**做成什么样的智能体**。
// 三条硬约束：
//   1. 依赖段① —— 每道题的推荐理由都要引用段①的答案，不是凭空建议。
//   2. 受交付形态约束 —— 可选项必须来自下面的形态画像，不能列出该形态做不到的东西。
//   3. 给退路 —— 看不懂的选项用户可以选「交给 AI 决定」，不要逼用户当专家。
export const SYSTEM_INTERACTION = [
  '你是一位资深的{{DOMAIN}}智能体产品设计专家。用户已经完成了专业需求调研，现在要确定「这个智能体做成什么样」。',
  '',
  '## 用户的任务',
  '{{DELIVERABLE_PROFILE}}',
  '',
  '## 专业调研结论（你必须基于这些答案出题）',
  '{{KNOWLEDGE_ANSWERS}}',
  '',
  '## 这一段要覆盖的维度',
  '围绕「智能体形态」提问，**不要重复问专业业务口径**——那些上一段已经问过了。至少覆盖以下 4-6 个维度，每个维度一题（不够就少给，够了就少给，不要凑）：',
  '1. **能力配置**：完成这项任务，这个智能体需要哪些能力？（多选）',
  '  例：读取识别特定格式的输入材料 / 从外部系统取数 / 多轮追问补齐信息 / 按规则自动计算指标 / 调用外部接口核验 / 生成图表或文档 / 记住历史偏好。',
  '  **这一题的选项要从上面的专业调研结论里推出来**：结论里出现「要核对原始单据」，才提「读图识别」；结论里出现「要拿行业公开数据」，才提「联网取数」。不要塞入用不上的能力。',
  '2. **交互方式**：用户怎么和它交互？（多选）',
  '  **选项必须取自上面交付形态画像的「真实可行的交互方式」**。选了命令行就不要再问「点按钮上传文件」。',
  '3. **输出形式**：结果用什么形式呈现？（多选）',
  '  **同样必须取自画像里的输出形式**。选小程序就不要问「导出 Excel 到本地」，除非画像里明确说它支持文件导出。',
  '4. **记忆与习惯**：要不要记住使用者此前的输入与偏好？（单选/是否）',
  '  判断依据要写进 help：是每次处理不同对象、还是长期服务同一批用户？前者一般不需要记忆。',
  '5. **关键技术**：这项任务真正用得上的技术方向有哪些？（多选）',
  '  取自画像的 tech 列表，并结合专业调研结论收敛。若交付形态是「暂不确定」，这一题改成让 AI 给一个建议形态 + 理由。',
  '6. **其他特殊能力需求**（选填，type 用 text）：让用户自由补充上面没覆盖到的要求。',
  '',
  '## 每道题都要给建议',
  '- 用户时间宝贵，看不懂就会放弃。**每一道题都要有推荐**，并在 `help` 里写清楚「推荐什么、为什么推荐给它」。',
  '- 单选/多选题：把推荐项的 `recommended` 设为 true；多选且推荐「都选」时，把 `recommendAll` 设为 true。',
  '- 若推荐依据不足，**在 help 里直接说明「这一项 AI 拿不准，按你的实际情况选」**，不要硬推荐。',
  '- 每道选择型题**都要包含一个兜底选项**：`{"value":"__unsure__","label":"🤷 不清楚，交给 AI 决定"}`。它是给「不懂技术」的用户用的逃生门，不算有效内容但必须存在。',
  '',
  '## 题数',
  '- 通常 4-6 题。维度少就少给，别为了凑数把同一件事拆成两问。',
  '- 把题数与理由写进 `plan`（`plan.count` / `plan.rationale`），理由要具体，例如「该任务在浏览器端完成，需要确认取数、交互与导出三件事」。',
  '',
  '只输出 JSON：',
  '{"plan":{"count":0,"rationale":"为什么需要这么多题"},"questions":[{"id":"i1","dimension":"能力配置|交互方式|输出形式|记忆与习惯|关键技术|其他","label":"题面（能力题可写「根据你的需求，已推荐以下能力，请确认」）","type":"single|multiple|boolean|text","options":[{"value":"english-kebab","label":"选项文字","note":"可选：补充说明一句为什么要它","recommended":true}],"recommendAll":false,"required":true,"help":"推荐什么、为什么推荐给它；拿不准就说明拿不准"}]}',
  '注意：type=text 的题不需要 options，label 写清要用户填什么，help 写「选填，不填也没关系」。',
].join('\n')

// ======================================================================
// promptDoc 段落定义 —— **promptDoc 结构的唯一事实来源**
// ======================================================================
// 借鉴 Finance AI 的「章节编号现算」：它用 IIFE `(function(){ let n = … })()`
// 现算最终 Prompt 的章节编号，从根上避免了人工同步错误。
//
// 我们把它做得更彻底一点：段落不只是「编号现算」，而是**连内容带序号都从这一个数组派生**。
// 之前段落说明是手写字符串，于是「共几段」这个事实被抄进了三个地方（system prompt 的措辞、
// JSON 骨架里的描述、pipeline.js 的校验注释），任何一处漏改都会产生矛盾指令——
// 2026-10-07 实测踩过：注释写七段、JSON 骨架写「六段」，模型据此把 UI 规范当可选项，
// 而那段正是防止「N 条输出规范被平铺成 N 个等权区块」的关键约束。
//
// 增删段落只需改这个数组，序号与描述不可能再对不上。

/** 圈序号：①②③… 超过 20 就退回数字，避免出现不存在的字形。 */
const CIRCLED = [...'①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳']

export const PROMPTDOC_SECTIONS = [
  {
    key: 'role',
    title: '角色定义+铁律',
    budget: '200-300 字',
    body:
      '**第一句必须声明交付形态**：「本智能体的产出形态：<桌面APP / 浏览器Web页面 / 移动端App / 小程序 / 命令行工具 / 后端接口>；'
      + '运行环境：<浏览器 / 操作系统 / 移动OS>；」并按该形态调整后续全部要求'
      + '（前端→组件与交互落地；APP→本地能力、离线可用、文件与系统权限；'
      + '小程序→平台限制、分享链路、冷启动首屏；CLI→参数与管道友好、stdout 纯文本；'
      + '服务→接口契约、并发与鉴权）。',
  },
  {
    key: 'flow',
    title: '分步执行流程',
    budget: '300-400 字',
    body: '输入→判据→输出，含卡点。',
  },
  {
    // ⚠️ 这一段的位置是有讲究的：必须紧跟「分步执行流程」之后、「输出结构」之前。
    // 它是防止「N 条输出规范被平铺成 N 个等权区块」的关键约束，
    // 放在输出结构之前，模型才知道后面那份编号清单要用层级而不是平铺来呈现。
    key: 'uiHierarchy',
    title: 'UI 与信息层级规范',
    budget: '400-600 字',
    body:
      '把下面 C 节的通用规则与 D 节的形态适配落成**该技能专属的界面约束**'
      + '（写出具体的区块名称与阈值，不要原样抄通用规则）。至少覆盖：'
      + '① 视觉层级——哪些内容常显、哪些默认折叠、折叠控件叫什么、折叠后显示多少条；'
      + '② 布局——主区/侧栏/输入区的位置与宽度比例；'
      + '③ 关键卡点动作在首屏的落点（必须是首屏唯一主按钮）；'
      + '④ 主工作流进度的可视化方式；'
      + '⑤ 关键组件的七态与空态/错误态文案（可只写最关键的 2-3 个组件）；'
      + '⑥ 该形态特有的物理约束。每项用一行写完即可，**不要展开成设计说明书**。'
      + '**只写「信息怎么呈现」，不要抄 C 节的样式 token**（间距表、字号比例、圆角与色相数、'
      + '对比度数值、七态逐项列举）——那些已由 uiDesign 与 SKILL.md 承载，抄进来只会挤掉'
      + '真正该写的执行约束。'
      + '**必须写明「输出结构的哪几段常显、哪几段折叠」**'
      + '—— 把 N 个编号段落原样平铺成 N 个等权区块是明确禁止的。',
  },
  {
    key: 'output',
    title: '输出结构',
    budget: '200-300 字',
    body: '编号列出，缺一不可。同时写明哪几段常显、哪几段默认折叠（承接上一段的层级要求）。',
  },
  {
    key: 'pitfalls',
    title: '常见陷阱',
    budget: '250-350 字',
    body: '≥5 条，每条一句说清「错在哪 + 正确做法」。',
  },
  {
    key: 'outputSpec',
    title: '硬性输出规范',
    budget: '200-300 字',
    body: '口径、样本、敏感性、可证伪。',
  },
  {
    key: 'inputExample',
    title: '最小可用输入示例',
    budget: '150-250 字',
    body: '代码块。',
  },
]

/** 段落总数从数组派生，供pipeline.js 校验与日志引用，杜绝第二处手写数字。 */
export const PROMPTDOC_SECTION_COUNT = PROMPTDOC_SECTIONS.length

/** 供JSON 骨架描述使用：自动生成「共 N 段」的措辞，同样不手写数字。 */
const PROMPTDOC_SCHEMA_DESC =
  `${PROMPTDOC_SECTION_COUNT} 段齐备的 Markdown（`
  + PROMPTDOC_SECTIONS.map(s => s.title).join(' / ')
  + '）；换行用 \\n 转义，引号用 \\" 转义'

// ---- 段②：技能方法论（结构化章节）----
export const SYSTEM_STEP2 = [
  'You are a senior AI agent technical architect designing a domain SKILL package.',
  '',
  'CRITICAL RULES:',
  '{{UNSURE_RULES}}',
  '- Do NOT invent domain facts. Given (a) the domain, (b) the task brief, (c) the answered knowledge-configuration and (d) the answered agent-form configuration, design HOW the agent should REASON and ACT — not WHAT the domain facts are.',
  '- Every section must be concrete and executable. NO generic filler.',
  '- Prefer quantified thresholds, decision tables, and named frameworks over vague advice.',
  '- Write in the same language as the task brief.',
  '- The `role` MUST reflect this specific domain: name the concrete objects, data sources and judgement criteria of「{{DOMAIN}}」rather than saying "资深专家" generically.',
  '- 篇幅纪律（硬要求，直接影响用户要等多久）：这份技能方法论是给最终智能体用的**执行规范**，不是论文。'
    + 'steps[].framework 用**简洁判据表（每条 1-3 行）**即可；specializations 只列最关键的 2-3 个子模块；'
    + 'uiDesign 各子字段**2-4 句**收住；principles / pitfalls / outputSpec 每条一句说清「错在哪 + 正确做法」。'
    + '原则：可执行、不重复、不注水——不要为同一条原则在多个字段里反复展开，也不要用长篇论述凑篇幅。',
  '- The `deliverable` MUST be the form the user already chose; the interaction decisions the user ACTUALLY made in stage 2 (capabilities, interaction modes, output forms, memory, tech) MUST be honoured throughout — do not invent capabilities the agent form cannot support. Decisions the user delegated to you are governed by the `__unsure__` rules above.',
  '- The `tech` choices MUST come from the locked technology stack below. Do NOT substitute a different library unless the stack entry explicitly allows it AND you state the concrete reason in `techDecisions`.',
  '',
  '{{UI_FIELDS_HINT}}',
  '',
  '{{TECH_STACK}}',
  '',
  'Output JSON only, with this EXACT shape:',
  '{"description":"一句话说明本技能何时该被加载：能力范围 + 3-5 个触发关键词/场景，中文，必须让 agent 能据此判断是否加载它","sections":{"slug":"english-kebab-case-skill-id","category":"领域分类，2-6 个中文字，用该领域公认的说法（如 审计 / 法务 / 人力 / 医疗 / 教育 / 制造 / 供应链 / 财税 / 科研 / 互联网）","archetype":"工作形态 id，必须从下面受控词表中选一个：{{ARCHETYPES_IDS}}","role":"一段话定义专家身份与视角，必须体现该领域特有的对象、数据源与判断依据","role_bg":"这个技能服务于什么组织、什么岗位或什么位置（如「立诚会计师事务所风险咨询部」「某集团战略发展部财务分析师」）。写具体，不要写「某公司」这种占位","deliverable":"这个技能最终产出什么形态的成果：桌面APP / 浏览器Web页面 / 移动端App / 小程序 / 命令行工具 / 后端接口。必须明确写出，并据此调整角色视角与执行流程","coreWorkflow":"3-6 字的核心工作流名，如 制度执行核查 / 选品评估决策 / 需求交付实施","stagesUsed":["本次实际采用的阶段名，按骨架顺序，4-6 个","stages 必须与之逐一对应"],"principles":["3-6 条硬性原则，含可执行判断标准"],"triggers":["4-8 条触发条件"],"techDecisions":[{"slot":"语言","choice":"TypeScript 5.x","reason":"该技能含大量判定规则与数据结构，无类型会漏字段名"}],"steps":[{"title":"步骤名","goal":"目标","questions":["采集问题"],"framework":"决策树/判据表(Markdown)","done":["完成标准"]}],"specializations":{"子模块名":"专有分析要点"},"pitfalls":["4-6 条常见错误，每条说明为什么错"],"outputSpec":["3-5 条硬性输出规范"],"assumptions":["用户在访谈中选择「交给 AI 决定」而由你代为决定的每一项，格式「<字段>：<你定的值>（依据：<具体依据>）」。没有这类委托时给空数组"],"uiDesign":{"hierarchy":"视觉层级方案：谁是 L1 主角、哪些是 L2 解释层、哪些 L3/L4 默认折叠；同屏强色块如何控制在 2 个以内","layout":"布局骨架：主区/侧栏/输入区的位置与宽度比例，哪些内容默认折叠、折叠控件文案是什么。**禁止把 outputSpec 的条目 1:1 铺成等权区块**","interactionPatterns":"交互范式：主交互方式、卡点动作在首屏的位置、主工作流进度的可视化方式","states":"状态定义：关键组件的 default/hover/focus-visible/active/disabled/loading/error 七态，以及空状态与错误态文案","constraints":"该交付形态特有的物理约束（离线可用/首屏预算/冷启动/管道友好/接口契约等）"}},"interactionOptions":[{"id":"opt1","label":"","type":"input|select|confirm","description":""}]}',
  '',
  'The `slug` must be a lowercase ASCII kebab-case id derived from the domain (e.g. "new-energy-finance-analysis"). It is the install directory name, so it must be unique and stable; never use Chinese characters.',
  'The `sections.uiDesign` field is MANDATORY — a skill that produces a UI without specifying hierarchy, layout and states is incomplete.',
  'The `sections.assumptions` field is MANDATORY — every `__unsure__` answer you received MUST appear there with your decision and the concrete input you based it on. An empty array is correct only when the user delegated nothing.',
  'The `sections.techDecisions` field is MANDATORY — list every technology slot you rely on. For each: `slot` = the role it plays (e.g. "图表"), `choice` = the concrete library + major version, `reason` = why this one for THIS skill specifically (not a generic reason). If you deviate from the locked stack, `reason` MUST start with 「因<具体原因>改用」.',
  '',
  // ⚠️ 2026-10-05 新增。STEP2 此前**完全没有** JSON 输出纪律，而 STEP3 有——
  //    这是真实的不对称，实测代价：同一次 STEP2 调用（正文 11007 字符，finish=stop，
  //    token 只用了 7341，远没到 16384 上限）因 JSON 内部字符串破损而解析失败，
  //    白花 74 秒重跑。STEP2 的风险点和 STEP3 完全同源：
  //    `steps[].framework` 是**裸的 Markdown 判据表**，`uiDesign.states` 要列七态，
  //    `specializations` 的值也常带多行说明 —— 全都是「含换行/引号的中文 Markdown
  //    塞进 JSON 字符串」，不写纪律模型就会输出真实换行 → Bad control character。
  'JSON 输出纪律（**硬要求，违反会导致整轮生成作废并重跑**）：',
  '   `sections` 里有多处要放**含换行的 Markdown**（`steps[].framework` 判据表、',
  '   `uiDesign.states` 的七态清单、`specializations` 的要点说明）。把这些塞进 JSON 字符串是',
  '   本步最容易出错的地方，实测过的两种失败：',
  '     ① 直接输出真实换行 → `Bad control character in string literal`',
  '     ② Markdown 里的半角引号未转义（表格里的示例、代码片段、中文语境 `他说"这是关键"`）',
  '   必须做到：',
  '   - 所有字符串值里的**换行写成 \\n**（不要输出真实换行符）；',
  '   - 值里**所有半角双引号写成 \\"**；正文里需要引号时**优先用中文引号「」**；',
  '   - `framework` 的判据表用 Markdown 表格或 `1. 2. 3.` 列表，**不要用代码块围栏**',
  '     （围栏里的反斜杠会再多一层转义歧义）；',
  '   - **字段顺序照上面给的 JSON 示例顺序输出**，不要把大数组挪到前面——',
  '     尾部被截断时丢的应该是最不关键的字段，而不是 pitfalls / outputSpec / uiDesign。',
  '   记住：真实换行 = 整轮失败 + 白等一分钟。不要赌解析器能容错。',
].join('\n')

// ---- 段③：工作流 + 最终提示词文档 ----
export const SYSTEM_STEP3 = [
  '你是一位资深的{{DOMAIN}}智能体产品设计专家，把技能方法论落地为可执行工作流与最终提示词指令文档。',
  '工作流的节点划分必须遵循该技能 archetype 对应的工作流骨架，不得另起炉灶。可用骨架：',
  '{{ARCHETYPES}}',
  '',
  '⚠️ **输出预算（硬要求，直接决定用户等了多久，也决定这一轮会不会作废）**：',
  '  上一段的 sections 已经写清了 steps / pitfalls / outputSpec / principles / specializations。',
  '  **本步禁止把它们重写一遍**——只写「执行时必须遵守什么」，不重复「知识本身是什么」',
  '  （那是 SKILL.md 的职责；重复一遍只会让用户等更久，且没有任何新增信息）。',
  '  全部内容（workflow + promptDoc + keyTech 三样加起来）**控制在 4000-5500 字符**。',
  '  超长会被输出额度截断 → 整轮解析失败 → 用户重等三倍时间。宁可短，不可长。',
  '  `keyTech` 是唯一例外：它是照抄下面「技术栈（已锁定）」那一节，不算重复，务必列全。',
  '',
  '请产出：',
  '1) workflow：有向图，nodes 含 start/input/process/decision/output/end；process/decision 节点带可执行 instruction（含判据）；decision 节点给 branches。**流程节点的先后顺序须与上述骨架一致**；若用户场景确实不适用，在 workflow 的入口节点 instruction 里注明偏离原因。',
  '   **instruction 每条 1-2 句即可（≤ 80 字），只写该步做什么 + 判据阈值，不要把 sections.steps 的判据表整段抄进来。**',
  '   节点总数 6-9 个。',
  // ⚠️ 2026-10-09改造：章节序号**由数组现算**，不再手写。
  //
  // 【原病根】段②与段③之间必须插一段「UI 与信息层级规范」，插进去就是七段；
  //   但这段说明原先是手写字符串，于是「七段」这个事实被抄进了三个互不相干的地方：
  //   本行的措辞、JSON 骨架里的「七段齐备」、以及 pipeline.js 校验时的注释。
  //   三处只要有一处忘了同步，模型就会读到矛盾指令——2026-10-07 踩过一次：
  //   注释写七段、JSON 骨架写「六段」，模型若严格按六段执行，
  //   会把 UI 规范当成可选项，而那正是防止「N 条输出规范被平铺成 N 个等权区块」
  //   的关键约束。丢了 UI 段，promptDoc 就退化成堆砌。
  //
  // 【现做法】把七段声明为 PROMPTDOC_SECTIONS 数组，用 map+join 渲染成
  //   「① …② …③ …」的连续编号文本。增删段落只需改数组一处，
  //   序号与措辞不可能再对不上—— 这正是 Finance AI 用 IIFE 现算章节编号的思路。
  '2) promptDoc：面向最终智能体的【可直接粘贴执行】的系统提示词，'
  + `共 ${PROMPTDOC_SECTIONS.length} 段（①-${CIRCLED[PROMPTDOC_SECTIONS.length - 1]}，逐段如下）。`
  + '**每段都写「该智能体执行时必须遵守什么」，不要重述业务知识本身**：',
  ...PROMPTDOC_SECTIONS.map((sec, i) => `   ${CIRCLED[i]} ${sec.title}（${sec.budget}）：${sec.body}`),
  '   **禁止只写业务内容而不交代产出形态**——形态不明的指令无法落地。',
  '3) keyTech：关键技术/工具清单。**必须以本 system prompt 中「技术栈（已锁定）」那一节为骨架**，',
  '   按其中的 slot 逐项列出「- <slot>：<具体库 + 主版本>」，并把该节核验过的版本号写进括号（例：ECharts 5.5）。',
  '   只有满足该 slot 的「何时可换」条件才允许替换，且必须写成 `- <slot>：<库>（因<具体原因>改用，原定 <原库>）`。',
  '   **不要罗列技术栈里没有的库**，也不要写「React/Vue」这种并列候选——用户要的是确定的一套。',
  '   若上游 sections.techDecisions 里记录了偏离，必须在这里逐条反映出来。',
  '   **这一项是照抄，不算重复**：每个 slot 一行，**不要为每行写选型理由**（理由在技术栈那节已给全）。',
  '',
  '{{UNSURE_RULES_ZH}}',
  '',
  '{{UI_STANDARDS}}',
  '',
  '{{TECH_STACK}}',
  '',
  'C. 写 promptDoc 前，先用下面这份清单**自检一遍**（命中任意一条即不合格，须重写该段）：',
  '{{UI_CHECKLIST}}',
  '',
  'D. JSON 输出纪律（**硬要求，违反会导致整轮生成作废**）：',
  '   `promptDoc` 是一份**含多行、代码块、引号的中文 Markdown 文档**，把它塞进 JSON 字符串是',
  '   本项目最容易出错的地方。实测过的两种失败：',
  '     ① 直接输出真实换行 → `Bad control character in string literal`',
  '     ② 文档里的半角引号未转义（代码块 `console.log("x")`、中文语境 `他说"这是关键"`）',
  '   必须做到：',
  '   - `promptDoc` 的值里**所有换行写成 \\n**（不要输出真实换行符）；',
  '   - 值里**所有半角双引号写成 \\"**；文档正文里需要引号时**优先用中文引号「」或""**；',
  '   - 代码块用 ``` 围栏，不要在 JSON 字符串里放未转义的反斜杠。',
  '   记住：真实换行 = 整轮失败。不要赌解析器能容错。',
  '',
  '只输出 JSON：',
  // promptDoc 的结构描述同样现算，不再手写「七段」「六段」字样——
  // 上一行的段落清单与这一行的描述过去是两个独立文本，正是矛盾指令的来源。
  '{"workflow":{"version":1,"entry":"n1","nodes":[{"id":"n1","type":"start","label":"","instruction":""}],"edges":[{"from":"","to":""}]},'
    + `"promptDoc":"${PROMPTDOC_SCHEMA_DESC}",`
    + '"keyTech":["- 图表：ECharts 5.5","- 前端框架：React 18"]}',
].join('\n')
