/**
 * skill-generator-core · 模型调用的传输层弹性
 * ------------------------------------------------------------------
 * 与「内容层」重试（`json.js` 的 generateJSON，靠回灌诊断重发 prompt 修格式）互补：
 *
 *   - 本文件只管**传输类瞬时失败**：网络抖动 / 限流 429 / 5xx / 连接中断 / 超时 /
 *     上游取消。失败不重发 prompt、不加诊断，纯快速退避重试。
 *   - generateJSON 管**内容失败**：JSON 解析出错或字段校验不过——这类必须回灌，
 *     让模型改格式/补字段，不能在这里被静默吞掉。
 *
 * ## 为什么必须有这一层（2026-10-12 实测）
 * 用户反馈「进入第二步调研偶尔一次失败、重试就好了」——典型瞬时限流/抖动。
 * 旧代码对传输失败**没有任何专门处理**：generateJSON 在 callModel 抛错后只是
 * **立刻**重发同样的 prompt（无退避）。若那一次正好是限流窗口（通常几秒），
 * 连续 3 次会全失败 → 用户看到红字。加了退避后，限流窗口会被让过去，
 * 第一次调用往往能在透明重试内恢复，用户根本看不到错误。
 *
 * 同理，生成阶段若中途遭遇一次瞬断，旧逻辑会用「全量重发 + 重新思考」来兜底，
 * 把本来 2 分钟的一轮变成 4-6 分钟。退避重试让这种偶发抖动只多花几秒。
 *
 * ## 不可重试的情况
 *   - 上游主动取消（用户取消 / 退出应用 / HTTP 断开）→ 立刻抛回，绝不重试。
 *   - 认证类错误（401 / 无效 key）→ 重试无意义，立刻抛回。
 */

/** 判定一个错误是否属于「传输类瞬时失败」，值得退避重试。 */
export function isRetryable(error) {
  const msg = (error?.message || String(error))
  if (/401|authentication|unauthorized|invalid.*key|api key/i.test(msg)) return false
  return /429|rate limit|quota|503|502|500|504|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket|network|fetch failed|timeout|aborted|timed out/i.test(msg)
}

/**
 * 给任意 callModel 包一层「退避重试 + 超时」。
 * @param {(system,userText,maxTokens,signal)=>Promise<{text,reasoningChars?,finish?}>} callModel
 * @param {object} [opts]
 * @param {number} [opts.retries=2]   瞬时失败后最多再试几次（总尝试 = retries+1）
 * @param {number} [opts.baseDelay=2000] 首次退避毫秒，之后指数翻倍（2s → 4s）
 * @param {number} [opts.timeoutMs=360000] 单次调用硬超时（毫秒）。防真·挂死（连接不释放）。
 *        设到 360s：简单项目单轮 ~90s，复杂项目可达 ~250s，360s 给足余量，
 *        只为拦住「连接彻底挂住、永不返回」的病理情况，不误杀正常慢生成。
 */
export function resilientCallModel(callModel, opts = {}) {
  const retries = opts.retries ?? 2
  const baseDelay = opts.baseDelay ?? 2000
  const timeoutMs = opts.timeoutMs ?? 360000
  const sleep = (ms) => new Promise(r => setTimeout(r, ms))

  return async (system, userText, maxTokens, signal) => {
    let lastErr
    for (let attempt = 0; attempt <= retries; attempt++) {
      // 组合「内部超时」与「上游取消」：任一 abort 都立即终止本次尝试。
      const ctrl = new AbortController()
      const onUpstream = () => ctrl.abort()
      if (signal) {
        if (signal.aborted) ctrl.abort()
        else signal.addEventListener('abort', onUpstream, { once: true })
      }
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const r = await callModel(system, userText, maxTokens, ctrl.signal)
        clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onUpstream)
        return r
      } catch (err) {
        clearTimeout(timer)
        if (signal) signal.removeEventListener('abort', onUpstream)
        lastErr = err
        // 上游主动取消（用户取消 / 退出 / HTTP 断开）→ 不可重试，立刻抛回。
        if (signal?.aborted) throw err
        if (!isRetryable(err) || attempt === retries) throw err
        const delay = baseDelay * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
    throw lastErr
  }
}
