/**
 * skill-generator-core · 公共入口
 * ------------------------------------------------------------------
 * 「规则」的唯一事实来源，被两种形态共同引用：
 *   - 独立应用   prompt-forge/src/main/engine.js
 *   - Harness 插件 dsh-plugin-skill-generator/index.js
 *
 * 运行时差异（模型调用方式、凭据来源、落盘根目录）由各形态自行注入，
 * 本包不含任何形态特定代码，也不 import electron 或 harness 的包。
 */

export {
  DEFAULT_MODEL,
  MAX_TOKENS,
  SYSTEM_INTERVIEW,
  SYSTEM_INTERACTION,
  SYSTEM_STEP2,
  SYSTEM_STEP3,
  ARCHETYPES,
  ARCHETYPE_COUNT,
  UNSURE_VALUE,
  UNSURE_LABEL,
  archetypeTable,
  fill,
} from './prompts.js'

export {
  DELIVERABLE_PROFILES,
  matchProfile,
  profileById,
  renderProfile,
  MOBILE_PLATFORMS,
  matchMobilePlatform,
  needsPlatformQuestion,
} from './deliverables.js'

export {
  SPACING_SCALE,
  TYPE_SCALE,
  CONTRAST,
  BREAKPOINTS,
  UI_FORM_PROFILES,
  HYBRID_LAYOUT,
  ASSERTIVE_RULES,
  HARD_FAILS,
  renderUIStandards,
  renderUIChecklist,
  renderUIFieldsHint,
  matchUIForms,
} from './ui-standards.js'

export {
  TECH_STACKS,
  VERSION_POLICY,
  NEVER_USE,
  stackById,
  renderTechStack,
} from './tech-stacks.js'

export {
  UNSURE_RULES_EN,
  UNSURE_RULES_ZH,
  collectUnsure,
  renderUnsureNotice,
} from './unsure.js'

export { renderSkillBody, sectionsDescription } from './render.js'

export { slugify, compileSkill } from './compile.js'

export { extractJSON, generateJSON } from './json.js'

export { resilientCallModel, isRetryable } from './retry.js'

export { briefText, formOf } from './brief.js'

export {
  ARCHETYPE_SKELETONS,
  ARCHETYPE_CARDS,
  suggestArchetype,
  orderCardsForSuggestion,
  SKELETON_BY_ID,
  isValidArchetype,
  renderSkeleton,
} from './archetypes.js'

export {
  stepInterview,
  suggestArchetypeByAI,
  stepInteraction,
  stepSkill,
  stepWorkflow,
  runPipeline,
  resolveArchetype,
  normalizeQuestions,
  extractFreeform,
  renderAnswers,
  injectPlatformQuestion,
  validateSections,
  validateWorkflow,
} from './pipeline.js'
