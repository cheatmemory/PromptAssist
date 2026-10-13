/**
 * skill-generator-core · 工作事项简报格式化
 */

/**
 * 双轨内容：截断版进 prompt，完整版留作产物/ 画布。
 * ------------------------------------------------------------------
 * 借鉴 Finance AI 的做法（design/index.html）：
 *   wfSkillContent = fullText.length > 2000
 *     ? fullText.substring(0, 2000) + '\n...(内容过长已截断)' : fullText;
 *   wfSkillObj.data = fullText;   // 完整内容另存，供工作流画布使用
 *
 * ## 为什么需要它
 * 一份长内容有两个去处，而两者的诉求相反：
 *   - 进 prompt：额度有限（推理模型的思考与正文共用 maxTokens），必须截断，
 *     否则正文被挤掉、整轮解析失败；
 *   - 落产物 / 上画布：要完整，截断等于缺信息。
 *
 * 过去我们只有一轨：`skillMethodology`（STEP2 的完整产物）整份塞进 STEP3 的 user 消息。
 * 它是STEP3 prompt 里最大的一块，也是最该按额度裁剪的——而我们此前**完全不裁**，
 * 靠 32768 的额度硬扛，属于「能跑但没有余量」的状态。
 *
 * ## 现在怎么做
 * 截断只动**进 prompt 的那一份**，落盘那份仍是全文（render.js/compile.js 拿的是sections 原始数据，
 * 不经过这里），所以截断不会造成产物缺失。
 *
 * @param {string} full完整文本
 * @param {number} limit 进 prompt 的字符上限
 * @returns {{ text: string, truncated: boolean, fullLength: number, full: string }}
 */
export function dualTrack(full, limit = 4000) {
  const text = typeof full === 'string' ? full : ''
  const fullLength = text.length
  if (fullLength <= limit) return { text, truncated: false, fullLength, full: text }
  return {
    text: `${text.substring(0, limit)}\n\n…（内容较长，此处为节选；完整判据见技能包的 SKILL.md 与 workflow.json）`,
    truncated: true,
    fullLength,
    full: text,
  }
}

/** 把工作事项表单拼成给模型看的简报文本（两种形态共用，保证模型看到的输入一致）。 */
export function briefText(form) {
  return [
    form.agentName ? `【智能体名称】${form.agentName}` : '',
    form.teamName ? `【使用团队】${form.teamName}` : '',
    `【领域】${form.domain || ''}`,
    // 交付形态是硬性前提：不知道要生成 APP 还是纯前端，写出来的流程与产物规范会落不了地。
    form.deliverable ? `【交付形态】${form.deliverable}` : '【交付形态】（未指定，须先问清或由模型建议）',
    `【任务背景】${form.taskBackground || ''}`,
    `【目标】${form.goals || ''}`,
    `【痛点】${form.painPoints || ''}`,
    form.skillLibrary ? `【可选技能库/参考资料】${form.skillLibrary}` : '',
  ].filter(Boolean).join('\n')
}

/** 从表单里挑出 skill-generator 各段共用的那几项。 */
export function formOf(input) {
  return {
    domain: input.domain,
    agentName: input.agentName,
    teamName: input.teamName,
    deliverable: input.deliverable,
    taskBackground: input.taskBackground,
    goals: input.goals,
    painPoints: input.painPoints,
    skillLibrary: input.skillLibrary,
  }
}
