/**
 * skill-generator-core · 产物编译与落盘
 * ------------------------------------------------------------------
 * 产出遵循"harness生成物契约.md"：SKILL.md + workflow.json + prompt-instructions.md
 * 落盘根目录由调用方传入（两种形态的技能目录不同），本模块不关心它在哪。
 *
 * 另含一个**可选**的 AGENTS.md：供在本项目里工作的 AI 编码助手遵循（先写本文件、
 * 初始化 Git、每次改动提交）。是否生成由 input.includeAgentsMd 控制（默认生成）。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderSkillBody, sectionsDescription } from './render.js'
import { ARCHETYPES } from './prompts.js'

export function slugify(value) {
  const s = (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return s || 'generated-skill'
}

/**
 * 编译并落盘三件套。
 * @param {object} input
 * @param {string} input.targetDir  落盘根目录（必填，由调用方决定）
 * @param {string} [input.slug]     模型给出的英文 kebab-case id（优先）
 * @param {string} input.domain      中文领域名（slug 兜底）
 * @returns {{skill: string, dir: string, files: string[]}}
 */
export function compileSkill(input) {
  // 中文领域名经 slugify 会退化成占位符，因此优先用模型给出的英文 slug。
  const slug = slugify(input.slug || input.skillName || input.domain)
  if (!input.targetDir) throw new Error('compileSkill 需要 targetDir')
  const dir = join(input.targetDir, slug)
  mkdirSync(dir, { recursive: true })

  const body = renderSkillBody(input.sections, input.skillMethodology || '')
  const description = (input.description || sectionsDescription(input.sections) || `${input.domain || slug} 领域智能体技能`)
    .replace(/\n/g, ' ')
    .trim()

  // frontmatter 的YAML 值不能含换行或冒号后接空格——那会让解析器读错字段。
  // 这里统一压成单行，与 harness 的 Skill 发现机制保持兼容。
  const fmValue = v => String(v == null ? '' : v).replace(/\s+/g, ' ').replace(/:\s+/g, '：').trim()

  // role_bg 与 core_workflow 借鉴 Finance AI 工作流程库的 frontmatter 设计
  //（实测样本：`role_bg: 立诚会计师事务所风险咨询部` / `core_workflow: ITGC一般控制审计`）。
  //
  // 为什么加这两个字段：
  //   role_bg       —— 角色背景。这个技能服务于**什么组织、什么位置**。
  //     跨领域尤其重要：同样是「合规核查」，律所合规与财务合规的判据完全不同，
  //     role_bg 让这个差异随产物落盘，后续同类技能能对齐复用或复用同一套判据。
  //   core_workflow —— 核心工作流名。一句话名义上的流程，跨阶段对齐用。
  //
  // 两者都可从 sections 派生（coreWorkflow 字段本来就有），缺失则留空而非编造。
  const arch = input.sections?.archetype
    ? ARCHETYPES.find(a => a.id === input.sections.archetype)
    : null

  writeFileSync(join(dir, 'SKILL.md'), [
    '---',
    `name: ${slug}`,
    `description: ${description}`,
    // 下面是借鉴来的两个字段。它们是**可选**的：没值就不写，
    // 绝不编造——空字段比缺字段更容易误导下游。
    ...(input.sections?.roleBg ? [`role_bg: ${fmValue(input.sections.roleBg)}`] : []),
    ...(input.sections?.coreWorkflow ? [`core_workflow: ${fmValue(input.sections.coreWorkflow)}`] : []),
    ...(arch ? [`archetype: ${fmValue(arch.id)}`] : []),
    ...(input.sections?.category ? [`category: ${fmValue(input.sections.category)}`] : []),
    '---',
    '',
    `# ${input.skillName || slug}`,
    '',
    body,
    // 用户手输的补充需求原文落盘。
    // 这些内容同时进了 STEP2/STEP3 的 prompt（要求模型逐条落实），但那是**隐式**的——
    // 模型可能读了没采纳，用户查不到。落在这里变成**显式**记录：
    // 事后能回答「用户当初到底提了什么额外要求」，也能核对模型有没有漏读。
    ...(Array.isArray(input.freeform) && input.freeform.length
      ? [
        '',
        '## 用户补充需求（访谈手输原文）',
        '',
        '以下需求由用户在调研中手动补充，不在固定选项内。技能实现**必须**逐条满足；',
        '若因交付形态限制确实无法满足，实现时须显式说明「本形态不支持：<原文>」。',
        '',
        ...input.freeform.map((f, i) =>
          `${i + 1}. **${f.question || '补充要求'}**：${f.answer}`),
      ]
      : []),
    '',
    '## 资源',
    '- 工作流定义：workflow.json',
    '- 最终提示词指令：prompt-instructions.md',
    '',
  ].join('\n'), 'utf8')

  writeFileSync(join(dir, 'workflow.json'), JSON.stringify(
    input.workflow || { version: 1, entry: 'n1', nodes: [], edges: [] }, null, 2), 'utf8')

  writeFileSync(join(dir, 'prompt-instructions.md'), [
    `# ${input.skillName || slug} · 最终提示词指令`,
    '',
    input.promptDoc || '',
    // 这里也带一份：promptDoc 由模型生成，模型可能没把用户手输要求写进去。
    // 原文附在末尾，最终智能体读文档时一定看得到，不依赖模型转述是否忠实。
    ...(Array.isArray(input.freeform) && input.freeform.length
      ? [
        '',
        '## 用户补充需求（访谈手输原文，必须遵守）',
        '',
        ...input.freeform.map((f, i) =>
          `${i + 1}. ${f.question || '补充要求'}：${f.answer}`),
      ]
      : []),
    '',
    '## 关键技术 / 工具清单',
    // ⚠️ 不要在这里给每行加 "- "。STEP3 的 keyTech 元素**本身已带"- " 前缀**
    //（prompts.js 里要求模型按「- <slot>：<库> <版本>」输出），再加一次会变成
    // 「- - 语言：TypeScript 5.x」的双前缀。这是实测生成的产物里发现的问题。
    // 只对极少数没带前缀的异常元素兜底。
    (input.keyTech && input.keyTech.length
      ? input.keyTech.map(t => (/^\s*[-*]\s+/.test(t) ? String(t).trim() : `- ${String(t).trim()}`)).join('\n')
      : '- （未提供）'),
    '',
  ].join('\n'), 'utf8')

  // ---- 可选交付物：AGENTS.md ----
  // 供在本项目里工作的 AI 编码助手阅读并遵循：先写入本文件、初始化 Git 仓库、
  // 每次改动后提交，便于版本追踪与回滚。是否生成由 input.includeAgentsMd 控制，
  // 默认生成（undefined 视为 true）；调用方传 false 可跳过。
  const files = ['SKILL.md', 'workflow.json', 'prompt-instructions.md']
  if (input.includeAgentsMd !== false) {
    writeFileSync(join(dir, 'AGENTS.md'), AGENTS_MD, 'utf8')
    files.push('AGENTS.md')
  }

  return { skill: slug, dir, files }
}

/**
 * AGENTS.md 内容（可选交付物）。
 * 三条工作约定源自用户要求：① 生成智能体前先把本文件写入项目根目录；
 * ② 将项目目录初始化为 Git 仓库；③ 每次改动后 git commit，便于回滚与追踪。
 * 同时写明前置要求（需安装 Git）与本文件为可选项（可删除）。
 */
const AGENTS_MD = [
  '# AGENTS.md',
  '',
  '本文件供在本项目（由 PromptAssist 生成的技能包）中工作的 AI 智能体（编码助手）阅读并遵循。',
  '',
  '## 工作约定',
  '1. **先写入本文件**：在基于本项目生成 / 构建智能体之前，先将本 `AGENTS.md` 写入项目根目录，作为项目初始化的第一步。',
  '2. **初始化 Git 仓库**：将本项目目录初始化为 Git 仓库（`git init`），便于版本管理。',
  '3. **每次改动后提交**：每次对代码或配置做出改动后，都执行 `git commit`，提交信息写明本次改动内容，便于追踪与回滚。',
  '',
  '## 前置要求',
  '- 本机需要安装 **Git**。若环境中尚未安装 Git，请先安装再执行上面的「初始化仓库」与「提交」步骤；未安装 Git 时，第 2、3 条约定暂时无法执行。',
  '',
  '## 说明',
  '- 这是一个**可选**的工作约定文件。若你（或使用者）不打算用 Git 管理该项目，可直接删除本文件，不影响技能包本身的使用。',
  '',
].join('\n')
