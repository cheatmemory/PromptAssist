/**
 * 访谈记录导出（两种形态共用）
 * ------------------------------------------------------------------
 * ## 为什么需要它
 *
 * 2026-10-06 踩过的坑：评估产物时手里**只有产物，没有访谈记录**，
 * 于是把「用户在选项 note 里给的判据被 AI 顶掉」误判成「用户手输的自由文本被降级」，
 * 整个根因找错了方向（真实根因是选项 label/note 在送进模型时被丢掉）。
 * 用户随后澄清：「除了最后要自己发挥的部分，我都是选的选项。」
 *
 * **产物无法反推输入。** 所以必须能在访谈结束时把「输入侧」完整导出，
 * 否则每次评估都在猜。这是测试基础设施的必需品，不是锦上添花。
 *
 * ## 导出内容（缺一不可）
 *   ① 工作事项（brief）——「定义你要解决的工作事项」那 7 个字段。
 *      用户明确要求包含：它决定形态与领域，是全链路的输入源头，
 *      只导出会话不导 brief 等于只导了一半。
 *   ② 段① 专业知识调研：题表 + 用户选中的选项 label/note + 委托项
 *   ③ 段② 智能体形态调研：同上
 *   ④ 两段的 plan（题数建议与理由）
 *
 * ## 为什么导出的是「label + note」而不是 value
 * 因为 value 往往是 `k3` 这种 id，人读不了；而 note 恰恰是**用户实际读到的、
 * 往往最有信息量的那段文字**——2026-06 那个事故里丢失的正是它。
 * 导出格式必须让人（和我）能看出「用户到底认可了什么」。
 *
 * ## 格式
 * 默认 Markdown（人读 + 后续投喂给模型都方便），另附 JSON（程序读）。
 * 纯函数、无 DOM 依赖，两形态都能直接调用。
 */

const BRIEF_FIELDS = [
  ['teamName', '使用团队'],
  ['agentName', '智能体名称'],
  ['domain', '领域'],
  ['deliverable', '交付形态'],
  ['taskBackground', '任务背景'],
  ['goals', '目标'],
  ['painPoints', '痛点'],
  ['skillLibrary', '可选技能库 / 参考资料'],
]

const UNSURE_LABEL = '🤷 不清楚，交给 AI 决定'

function fmtText(v) {
  if (v === undefined || v === null) return ''
  if (Array.isArray(v)) return v.map(x => fmtText(x)).filter(Boolean).join(' / ')
  return String(v)
}

/** 把一题的作答还原成「题号 + 题面 + 用户选的 label + 该 label 的 note」。 */
function renderOneAnswer(q, raw) {
  const lines = []
  const title = String(q?.label || '').trim()
  const vals = (Array.isArray(raw) ? raw : [raw]).filter(v => v !== undefined && v !== null && v !== '')
  // 题号必须带上：评估产物时要说清「k3 那条被判成什么了」，光有题面不好引用。
  // 括注形式而非独立行——不打断 Markdown 的标题层级。
  const head = q?.id ? `### ${title}　【${q.id}】` : `### ${title}`

  if (!title) return lines

  if (q.type === 'text') {
    lines.push(head)
    lines.push('')
    lines.push(String(vals[0] ?? ''))
    lines.push('')
    return lines
  }
  if (q.type === 'boolean') {
    lines.push(head)
    lines.push('')
    lines.push(`- 用户选择：${vals.map(v => (v === true ? '是' : v === false ? '否' : String(v))).join(' / ')}`)
    lines.push('')
    return lines
  }

  const byValue = new Map((q.options || []).map(o => [o.value, o]))
  const picked = vals.map(v => byValue.get(v)).filter(Boolean)

  lines.push(head)
  lines.push('')
  if (!picked.length) {
    // 题表里没有的 value：照实显示，不静默丢——否则导出会掩盖真实输入
    lines.push(`- 用户选择：${vals.join(' / ')}（⚠️ 与题表不匹配，题表可能在访谈后被重新生成过）`)
    lines.push('')
    return lines
  }
  for (const o of picked) {
    const unsure = o.value === '__unsure__'
    lines.push(`- 用户选择：**${o.label}**${o.recommended ? '（推荐项）' : ''}${unsure ? '　← 委托 AI 决定' : ''}`)
    if (o.note) lines.push(`  - 选它的理由（用户读到并认可）：${o.note}`)
  }
  lines.push('')
  return lines
}

function renderStage(md, title, questions, answers, plan) {
  md.push(`## ${title}`)
  md.push('')
  if (plan && (plan.rationale || plan.count)) {
    md.push(`**AI 的出题计划**：拟问 ${plan.count ?? '?'} 题`)
    if (plan.rationale) md.push('')
    if (plan.rationale) md.push(`> ${String(plan.rationale).replace(/\n/g, '\n> ')}`)
    md.push('')
  }
  const answered = (questions || []).filter(q => {
    const raw = answers ? answers[q.id] : undefined
    if (raw === undefined) return false
    if (Array.isArray(raw)) return raw.length > 0
    return true
  })
  md.push(`共 ${answered.length} 题已作答${answered.length < (questions || []).length
    ? `（另有 ${(questions || []).length - answered.length} 题未作答）` : ''}。`)
  md.push('')
  if (!answered.length) {
    md.push('（无作答记录）')
    md.push('')
    return
  }
  for (const q of answered) {
    md.push(...renderOneAnswer(q, answers[q.id]))
  }
}

/**
 * 导出为 Markdown。
 * @param {object} input
 * @param {object} input.form 工作事项（brief）
 * @param {Array}  input.interviewQuestions 段①题表
 * @param {object} input.answers 段①答案
 * @param {object} input.plan 段①出题计划
 * @param {Array}  input.interactionQuestions 段②题表
 * @param {object} input.interaction 段②答案
 * @param {object} input.interactionPlan 段②出题计划
 * @param {string} [input.resultDir] 产物目录（若有）
 * @returns {string}
 */
export function exportInterviewMarkdown(input = {}) {
  const {
    form = {}, interviewQuestions = [], answers = {}, plan = null,
    interactionQuestions = [], interaction = {}, interactionPlan = null,
    resultDir = '',
  } = input

  const md = []
  md.push('# 访谈记录')
  md.push('')
  md.push(`> 导出时间：${new Date().toLocaleString('zh-CN')}`)
  md.push('')

  md.push('## 一、定义你要解决的工作事项')
  md.push('')
  md.push('| 字段 | 内容 |')
  md.push('| --- | --- |')
  for (const [key, label] of BRIEF_FIELDS) {
    const v = fmtText(form[key]).replace(/\n/g, '<br>')
    md.push(`| ${label} | ${v || '（未填）'} |`)
  }
  md.push('')

  renderStage(md, '二、专业知识调研（段①）', interviewQuestions, answers, plan)
  renderStage(md, '三、智能体形态调研（段②）', interactionQuestions, interaction, interactionPlan)

  if (resultDir) {
    md.push('## 四、产物位置')
    md.push('')
    md.push('```')
    md.push(resultDir)
    md.push('```')
    md.push('')
  }

  md.push('---')
  md.push('')
  md.push('## 复盘用要点')
  md.push('')
  const delegated = []
  for (const [qs, as, stage] of [
    [interviewQuestions, answers, '段①'],
    [interactionQuestions, interaction, '段②'],
  ]) {
    for (const q of qs || []) {
      const raw = as ? as[q.id] : undefined
      const vals = Array.isArray(raw) ? raw : [raw]
      if (vals.some(v => v === '__unsure__')) delegated.push(`${stage} ${q.id}：${q.label || ''}`)
    }
  }
  md.push(`- **委托 AI 决定的题共 ${delegated.length} 项**${delegated.length ? '：' : '（无）'}`)
  delegated.forEach(d => md.push(`  - ${d}`))
  md.push('- 「选它的理由」各条即用户在选项里认可的内容，**产物应原样采用，不许用通用值替代**。')
  md.push('')
  return md.join('\n')
}

/**
 * 导出为 JSON（程序读，便于 diff 与批量回归）。
 * 结构里保留 value / label / note 三者，避免丢 note。
 */
export function exportInterviewJSON(input = {}) {
  const {
    form = {}, interviewQuestions = [], answers = {}, plan = null,
    interactionQuestions = [], interaction = {}, interactionPlan = null,
    resultDir = '',
  } = input
  const pack = (questions, as) => (questions || []).map(q => {
    const raw = as ? as[q.id] : undefined
    const vals = (Array.isArray(raw) ? raw : [raw]).filter(v => v !== undefined && v !== null && v !== '')
    const byValue = new Map((q.options || []).map(o => [o.value, o]))
    return {
      id: q.id,
      type: q.type,
      label: q.label,
      dimension: q.dimension || '',
      answered: vals.length > 0,
      // value 形态：便于复现真实输入（模型当时看到的就是这个）
      values: vals,
      // label + note 形态：便于人核对「用户到底认可了什么」
      picked: vals.map(v => {
        const o = byValue.get(v)
        return o
          ? { value: o.value, label: o.label, note: o.note || '', recommended: !!o.recommended }
          : { value: v, label: '', note: '', matched: false }
      }),
    }
  })
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    brief: Object.fromEntries(BRIEF_FIELDS.map(([k]) => [k, fmtText(form[k])])),
    resultDir,
    plan,
    interactionPlan,
    interview: pack(interviewQuestions, answers),
    interaction: pack(interactionQuestions, interaction),
  }, null, 2)
}

/** 触发浏览器下载。两形态共用。 */
export function downloadText(filename, text) {
  // BOM：让 Windows 上的记事本正确识别 UTF-8，否则中文会变乱码
  const blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 一次导出两份（md 给人读、json 给程序读）。 */
export function exportBoth(input = {}) {
  const base = (input.form?.domain || input.form?.agentName || 'interview')
    .toString().replace(/[^\w一-龥-]+/g, '_').slice(0, 40) || 'interview'
  const md = exportInterviewMarkdown(input)
  const json = exportInterviewJSON(input)
  downloadText(`访谈记录_${base}.md`, md)
  setTimeout(() => downloadText(`访谈记录_${base}.json`, json), 300)
  return { md, json }
}
