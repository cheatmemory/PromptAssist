/**
 * PromptAssist · 形态适配层
 * ------------------------------------------------------------------
 * 本文件只保留「独立应用」特有的东西：
 *   - 凭据读取（复用已配置的 DeepSeek key）
 *   - 模型调用（fetch + SSE，直连 DeepSeek，不经 harness）
 *   - 落盘根目录（~/.dsh/skills）
 *
 * 所有生成规则（meta-prompt / 章节渲染 / 产物编译 / 三段流程）来自公共包
 *   dsh-desktop/packages/skill-generator-core/（已随本仓库内嵌，
 *   源自 dataelement/dsh-desktop，MIT 许可证）
 * 改规则请改 core，不要在这里改——否则两种形态会分叉。
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import {
  MAX_TOKENS,
  compileSkill,
  renderSkillBody,
  sectionsDescription,
  slugify,
  resilientCallModel,
  stepInterview as coreStepInterview,
  suggestArchetypeByAI as coreSuggestArchetype,
  stepInteraction as coreStepInteraction,
  stepSkill as coreStepSkill,
  stepWorkflow as coreStepWorkflow,
  runPipeline as coreRunPipeline,
} from '../../dsh-desktop/packages/skill-generator-core/index.js'

// ======================================================================
// 凭据：复用已安装 DSH / WorkBuddy 写下的 DeepSeek key
// ======================================================================

export function readDeepSeekKey(extraPaths = []) {
  const candidates = [
    ...extraPaths,
    join(homedir(), '.dsh', '.credentials.yaml'),
    join(homedir(), 'AppData', 'Roaming', 'dsh-desktop-dev', 'harness', '.credentials.yaml'),
    join(homedir(), '.workbuddy', '.credentials.yaml'),
  ]
  for (const p of candidates) {
    try {
      if (!existsSync(p)) continue
      const raw = readFileSync(p, 'utf8')
      const m = raw.match(/^\s*DEEPSEEK_API_KEY:\s*(\S+)\s*$/m)
      if (m) {
        const key = m[1].replace(/^["']|["']$/g, '')
        if (key && key.length > 8) return key
      }
    } catch {
      /* 换下一个 */
    }
  }
  return null
}

export function skillsRoot() {
  return join(homedir(), '.dsh', 'skills')
}

// ======================================================================
// 模型调用适配器：fetch + SSE → core 期望的 { text, reasoningChars, finish }
// ======================================================================

const DEFAULT_BASE_URL = 'https://api.deepseek.com'

function makeCallModel({ apiKey, baseUrl, model }) {
  return async (system, userText, maxTokens, signal) => {
    const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model || 'deepseek-v4-flash',
        messages: [{ role: 'system', content: system }, { role: 'user', content: userText }],
        max_tokens: maxTokens,
        stream: true,
      }),
      signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`模型服务返回 ${res.status}：${body.slice(0, 300)}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let text = ''
    let reasoningChars = 0
    let finish = 'unknown'

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') { finish = 'stop'; continue }
        try {
          const json = JSON.parse(payload)
          const choice = json.choices?.[0]
          const delta = choice?.delta ?? {}
          if (typeof delta.content === 'string') text += delta.content
          if (typeof delta.reasoning_content === 'string') reasoningChars += delta.reasoning_content.length
          if (choice?.finish_reason) finish = choice.finish_reason
        } catch {
          /* 跳过无法解析的分片 */
        }
      }
    }
    return { text, reasoningChars, finish }
  }
}

/** 给模型调用加「瞬时失败退避重试 + 超时」，见 core/retry.js。两形态共用。 */
function resilient(ctx) {
  return resilientCallModel(makeCallModel(ctx))
}

// ======================================================================
// 对外接口：签名与抽包前保持一致，内部委托 core
// ======================================================================

export { compileSkill, renderSkillBody, sectionsDescription, slugify, MAX_TOKENS }

/** AI 推荐工作形态（2026-10-11）：形态独立成步后，改回由模型推荐，启发式仅作兜底 */
export async function suggestArchetype(ctx, form) {
  return coreSuggestArchetype(resilient(ctx), form)
}

export async function stepInterview(ctx, form, signal) {
  return coreStepInterview(resilient(ctx), form, signal)
}

export async function stepInteraction(ctx, form, knowledgeAnswers, signal) {
  return coreStepInteraction(resilient(ctx), form, knowledgeAnswers, signal)
}

// freeform（用户手输的补充需求）是第 4 个业务参数，位置在 signal 之前——
// core 的签名是 (…, answers, skill, freeform, signal)，少传会把 signal 落到 freeform 上。
export async function stepSkill(ctx, form, answers, freeform, signal) {
  return coreStepSkill(resilient(ctx), form, answers, freeform, signal)
}

export async function stepWorkflow(ctx, form, answers, skill, freeform, signal) {
  return coreStepWorkflow(resilient(ctx), form, answers, skill, freeform, signal)
}

export async function runPipeline(ctx, input, signal) {
  const { out, skill, workflow, freeform } = await coreRunPipeline(
    resilient(ctx), input, input.targetDir || skillsRoot(),
  )
  return { ...out, interactionOptions: skill.interactionOptions, workflow: workflow.workflow, freeform: freeform || [] }
}