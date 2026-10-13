/**
 * skill-generator-core · 章节渲染
 * ------------------------------------------------------------------
 * 模板来自 golden sample：samples/newenergy-finance-analysis/SKILL.md
 * 章节顺序：角色设定 → 领域分类与工作形态 → 交付形态 → 核心原则 → 触发条件
 *          → 执行流程 → 专项模块 → 常见陷阱 → 输出规范
 */

import { ARCHETYPES } from './prompts.js'

/** 把段②的结构化章节渲染为 SKILL.md 正文。无结构化章节时回落到扁平 Markdown。 */
export function renderSkillBody(sections, fallback) {
  if (!sections) return fallback || ''
  const s = sections
  const out = []

  if (s.role) out.push(`## 角色设定\n\n${s.role}\n`)

  // 领域分类 + 工作形态：这是「按领域/按形态复用」的基础信息，
  // archetype 必须来自受控词表才能被聚合检索（见 prompts.js 的 ARCHETYPES）。
  // role_bg 也放这里：它与 category/archetype 同属「这技能是什么」的标识信息，
  // 分开放会让读者在正文里看不到「它服务于谁」。
  if (s.roleBg || s.category || s.archetype || s.coreWorkflow) {
    const arch = ARCHETYPES.find(a => a.id === s.archetype)
    const lines = []
    if (s.roleBg) lines.push(`- **角色背景**：${s.roleBg}`)
    if (s.category) lines.push(`- **领域分类**：${s.category}`)
    if (s.archetype) lines.push(`- **工作形态**：${s.archetype}${arch ? `（${arch.label}）` : ''}`)
    if (s.coreWorkflow) lines.push(`- **核心工作流**：${s.coreWorkflow}`)
    if (arch) lines.push(`- **骨架基线**：${arch.workflow}`)
    out.push(`## 领域分类与工作形态\n\n${lines.join('\n')}\n`)
  }

  // 实际采用的阶段清单——产物自带骨架，后续同类技能可直接对齐复用。
  // 优先用模型输出的 stagesUsed；没有则从 steps 的标题兜底提取。
  const stages = Array.isArray(s.stagesUsed) && s.stagesUsed.length
    ? s.stagesUsed
    : (Array.isArray(s.steps) ? s.steps.map(st => st && st.title).filter(Boolean) : [])
  if (stages.length) {
    out.push(`## 执行阶段清单\n\n${stages.map((st, i) => `${i + 1}. ${st}`).join('\n')}\n`)
  }

  // 交付形态是硬前提：不知道要生成 APP 还是纯前端，技能无法落地，故单列一节。
  if (s.deliverable) out.push(`## 交付形态\n\n${s.deliverable}\n`)

  if (Array.isArray(s.principles) && s.principles.length) {
    out.push(`## 核心原则\n\n${s.principles.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`)
  }

  if (Array.isArray(s.triggers) && s.triggers.length) {
    out.push(`## 触发条件\n\n当用户表达以下任一意图时，自动加载本技能：\n${s.triggers.map(t => `- ${t}`).join('\n')}\n`)
  }

  if (Array.isArray(s.steps) && s.steps.length) {
    const steps = s.steps.map((st, i) => {
      const qs = Array.isArray(st.questions) && st.questions.length
        ? `**信息采集（每次最多 3 问）**：\n\n${st.questions.map((q, j) => `- Filter ${j + 1}：${q}`).join('\n')}\n`
        : ''
      const done = Array.isArray(st.done) && st.done.length
        ? `**完成标准**：\n${st.done.map(d => `- [ ] ${d}`).join('\n')}\n`
        : ''
      return `### Step ${i + 1}：${st.title}\n\n**目标**：${st.goal || ''}\n\n${qs}\n${st.framework ? `${st.framework}\n` : ''}\n${done}`
    }).join('\n')
    out.push(`## 执行流程\n\n${steps}\n`)
  }

  if (s.specializations && Object.keys(s.specializations).length) {
    const sp = Object.entries(s.specializations).map(([k, v]) => `- **${k}**：${v}`).join('\n')
    out.push(`## 专项分析模块\n\n${sp}\n`)
  }

  if (Array.isArray(s.pitfalls) && s.pitfalls.length) {
    out.push(`## 常见陷阱（必须规避）\n\n${s.pitfalls.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n`)
  }

  if (Array.isArray(s.outputSpec) && s.outputSpec.length) {
    out.push(`## 输出规范\n\n${s.outputSpec.map(o => `- ${o}`).join('\n')}\n`)
  }

  // 技术选型：必须落盘，否则「锁了栈」只存在于生成那一刻，用户装到的是随手写的栈。
  // 同时它是唯一能看出「模型是否违背了锁定栈」的证据——比对 choice 与栈定义的差异。
  if (Array.isArray(s.techDecisions) && s.techDecisions.length) {
    const rows = s.techDecisions
      .filter(t => t && (t.slot || t.choice))
      .map(t => {
        const slot = t.slot || '未标注'
        const choice = t.choice || ''
        const reason = t.reason ? ` —— ${t.reason}` : ''
        return `- **${slot}**：${choice}${reason}`
      })
    if (rows.length) {
      out.push(`## 技术选型\n\n${rows.join('\n')}\n`)
    }
  }

  // AI 代用户做的决定：必须落盘且放在界面设计之前。
  // 这类条目本质是「在信息不足时替用户做的承诺」，用户事后要能一眼看出
  // 哪些项不是他定的、依据是什么，并据此推翻。缺了它就不可溯源。
  if (Array.isArray(s.assumptions) && s.assumptions.length) {
    const items = s.assumptions
      .filter(a => typeof a === 'string' && a.trim())
      .map(a => `- ${a.trim()}`)
    if (items.length) {
      out.push([
        '## AI 代为决定的事项',
        '',
        '以下各项在调研中由用户选择「交给 AI 决定」，是 AI 依据上文约束替用户做出的判断。',
        '**每一项都可被推翻** —— 若与实际需求不符，请直接指出哪一条需要改。',
        '',
        ...items,
        '',
      ].join('\n'))
    }
  }

  // 界面设计：必须在 STEP④ 生成 promptDoc 之前就落到 SKILL.md 里，
  // 否则 STEP④ 拿不到界面结构，只能凭空发挥——实测这正是「信息堆砌」的来源：
  // 段落①②③之间缺了「哪些常显、哪些折叠、谁是主角」这一层。
  if (s.uiDesign && typeof s.uiDesign === 'object') {
    const u = s.uiDesign
    const order = [
      ['视觉层级', u.hierarchy],
      ['布局骨架', u.layout],
      ['交互范式', u.interactionPatterns],
      ['状态定义', u.states],
      ['形态约束', u.constraints],
    ]
    const lines = order
      .filter(([, v]) => typeof v === 'string' && v.trim())
      .map(([k, v]) => `- **${k}**：${v.trim()}`)
    if (lines.length) out.push(`## 界面设计\n\n${lines.join('\n')}\n`)
  }

  return out.join('\n')
}

/**
 * 兜底描述：模型没给 description 时用角色 + 触发条件拼一个可发现的说明。
 * 绝不能落到 "<领域> 领域智能体技能" 这种无信息量占位串——description 决定
 * harness 何时加载该技能，写成那样会让技能几乎永不被发现。
 */
export function sectionsDescription(sections) {
  if (!sections) return ''
  const parts = []
  if (sections.role) parts.push(String(sections.role).replace(/\s+/g, ' ').trim().slice(0, 120))
  if (Array.isArray(sections.triggers) && sections.triggers.length) {
    parts.push(`适用于：${sections.triggers.slice(0, 4).join('；')}`)
  }
  return parts.join('。')
}
