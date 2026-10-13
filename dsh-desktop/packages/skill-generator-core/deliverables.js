/**
 * skill-generator-core · 交付形态画像
 * ------------------------------------------------------------------
 * 为什么需要它：用户在第一步表单已经选定了「最后要一个什么东西」，
 * 但这个选择如果只写进 brief 的一句话，模型在出交互题时很容易退回泛泛的
 * 「文字对话 / 表格 / 图表」——等于没约束。
 *
 * 本模块把每种交付形态翻译成**交互调研可直接落地的选项边界**：
 *   - interaction  该形态下用户实际会有的交互方式
 *   - output       该形态下说得通的输出/呈现形式
 *   - tech         该形态要求的技术栈方向
 *   - capabilities 该形态天然需要 / 天然做不到的能力
 *
 * 匹配方式是关键词包含（用户在 UI 选的是中文标签，如「浏览器 Web 页面」），
 * 匹配不到时回落到「暂不确定」画像——此时交互题应侧重让 AI 自己拿主意。
 *
 * 跨领域中立：这里描述的是**形态的物理约束**（浏览器里没有本地文件系统、
 * 小程序不能长连接常驻），不含任何行业知识。
 */

export const DELIVERABLE_PROFILES = [
  {
    id: 'web', order: 0,
    label: '浏览器 Web 页面',
    keywords: ['web', '浏览器', '网页', '前端页面', 'browser'],
    runtime: '浏览器（Chrome/Edge 等现代浏览器），有页面与后端服务',
    interaction: [
      '表单填写：用户录入参数/材料后由智能体计算',
      '上传文件或图片：解析后再分析',
      '对话式追问：边聊边补齐缺失信息',
      '筛选与排序：在结果列表中收敛候选',
      '点击查看明细：展开某个结论的推导过程与依据',
      '批量导入后一次性处理多条数据',
    ],
    output: [
      '页面内的结构化结论卡片（含判定与依据）',
      '可排序/可筛选的明细表格',
      '图表：趋势、对比、结构占比',
      '可下载/可导出的文件（Excel、CSV、PDF、Word）',
      '打印或分享用的整页报告',
    ],
    tech: [
      '前端框架（React / Vue）与构建工具',
      '图表库（ECharts 等）',
      '后端接口与数据库',
      '文件解析（PDF/图片 OCR/表格解析）',
      '模型调用与流式输出',
    ],
    capabilities: [
      '适合：需要图表、需要留痕复看、需要导出留档的场景',
      '受限于浏览器沙箱：不能直接读写本地任意文件，不能做系统级操作',
      '天然需要：后端服务与鉴权、多端一致的行为',
    ],
  },
  {
    id: 'desktop', order: 1,
    label: '桌面应用',
    keywords: ['桌面', '客户端', '本地安装', 'electron', 'desktop', '离线可用', '绿色版'],
    runtime: '用户本地操作系统（Windows / macOS），可访问本地文件与系统能力',
    interaction: [
      '本地文件拖入：直接读取硬盘上的材料',
      '选择目录批量处理整个文件夹',
      '对话式追问',
      '在本地应用中查看与筛选结果',
      '导出并保存到指定本地路径',
      '调用系统能力：剪贴板、截图、通知、拖到托盘',
    ],
    output: [
      '应用内的结果面板（结论 + 明细 + 依据）',
      '写回本地文件：报告、表格、结构化 JSON',
      '导出 Excel / PDF / Word',
      '可分享的单文件（一次生成、随处打开）',
    ],
    tech: [
      '桌面框架（Electron / Tauri）与打包签名',
      '本地文件读写与目录遍历',
      '本地模型或内网模型调用的可行性评估',
      '离线可用性（本地缓存、断网可用）',
      '系统权限申请（文件系统、网络）',
    ],
    capabilities: [
      '适合：材料在本地、需要离线、需要访问大量本地文件',
      '优势：可做本地推理、断网可用、批量处理本地目录',
      '代价：需安装、需处理系统权限与多平台差异、升级分发成本',
    ],
  },
  {
    id: 'mobile', order: 2,
    label: '移动端 App',
    keywords: ['移动', '手机', 'ios', 'android', 'app', '触屏', '小程序外'],
    runtime: 'iOS / Android 移动操作系统，触屏为主，随时中断',
    interaction: [
      '拍照或从相册选图：现场取材直接分析',
      '扫码识别：扫单据、条码、设备铭牌',
      '语音输入：现场口述信息',
      '逐项滑动确认：一次只确认一个判断',
      '推送提醒：有新任务或异常时通知',
      '分享进入：从微信/邮件链接直接发起任务',
    ],
    output: [
      '移动端卡片式结论（适合竖屏阅读）',
      '可分享的结果图片或卡片',
      '推送通知摘要 + 点击进入详情',
      '可保存到本地相册/文件',
    ],
    tech: [
      '移动端框架（React Native / Flutter / 原生）',
      '相机、相册、麦克风等设备能力接入',
      '推送（APNs / FCM）',
      '本地存储与弱网/断网策略',
      '应用商店发布与合规审核',
    ],
    capabilities: [
      '适合：现场作业、拍照取证、碎片化时间使用',
      '强约束：单次使用时间短、场景中断频繁、输入必须极简',
      '天然需要：设备能力授权、移动端性能预算',
    ],
    // 2026-10-06 新增：目标平台直接决定技术栈，而「移动端」这个词本身没回答它。
    // 此前 mobile 栈无条件锁 React Native，理由写的是「与本工具 JS/TS 同源」——
    // 那是**对我们这个生成器省事**，不是对用户好（产物里没有业务逻辑要跟 Web 共享），
    // 而本形态 runtime 明确写着「iOS / Android」，选 Kotlin 等于主动放弃 iOS。
    // 与 `__unsure__` 断链同族：**在规则里替用户做了用户没做的决定**。故改为必答题。
    platformQuestion: {
      id: 'platform_target',
      dimension: '技术约束',
      label: '这个移动端要上哪些平台？',
      help: '这会直接决定技术栈：双端、仅 Android、仅 iOS 用的语言和 UI 框架都不一样。',
      required: true,
    },
  },
  {
    id: 'miniapp', order: 3,
    label: '微信小程序',
    keywords: ['小程序', '微信', 'miniprogram', 'wechat'],
    runtime: '微信客户端内的沙箱环境，平台能力受微信限制',
    interaction: [
      '微信一键登录授权后使用',
      '扫码 / 扫一扫识别单据',
      '选择或上传图片（走微信聊天记录里的图）',
      '会话式追问（每次一问一问）',
      '转发给同事：把结果卡片分享出去',
      '订阅消息通知结果',
    ],
    output: [
      '小程序内的结论卡片',
      '可转发分享的卡片/图片',
      '订阅消息推送的摘要',
      '可保存到微信收藏或聊天记录',
    ],
    tech: [
      '小程序原生框架或 uni-app / Taro',
      '微信登录与授权流程',
      '微信云开发或自建后端',
      '订阅消息模板',
      '平台 API 使用限制与审核合规',
    ],
    capabilities: [
      '适合：面向已有微信生态的用户、扫码/拍照类任务、结果需转发扩散',
      '硬限制：不能长期后台常驻、无任意本地文件读写、API 与包体大小受限',
      '必须考虑：分享链路与冷启动首屏',
    ],
  },
  {
    id: 'cli', order: 4,
    label: '命令行工具 / 脚本',
    keywords: ['命令行', 'cli', '脚本', '终端', 'shell', 'command'],
    runtime: '用户终端，可与其他程序组合',
    interaction: [
      '命令行参数与子命令',
      '标准输入管道（stdin 传入内容）',
      '指定输入文件或目录作为参数',
      '读取配置文件 / 环境变量获取默认参数',
      '交互式向导模式（一问一答回车确认）',
      '与现有脚本串联（作为流水线中的一步）',
    ],
    output: [
      '标准输出的纯文本结论',
      '结构化结果输出到 stdout（可被管道消费）',
      '写出结果文件（JSON / CSV / Markdown 报告）',
      '退出码与 stderr 提示（供脚本判断成败）',
    ],
    tech: [
      '参数解析库与命令行框架',
      '标准输入输出与管道友好设计',
      '配置文件与环境变量管理',
      '日志（stderr）与退出码规范',
      '打包分发（npm / 单文件 / 免安装）',
    ],
    capabilities: [
      '适合：技术人员使用、需要批处理、需要与既有流程集成',
      '强约束：输出必须纯文本、无富交互、不能等用户点按钮',
      '天然需要：清晰的 --help、稳定的退出码、可脚本化',
    ],
  },
  {
    id: 'api', order: 5,
    label: '后端服务 / 接口',
    keywords: ['后端', '接口', 'api', '服务', '后端服务', 'server', '微服务'],
    runtime: '服务器端，由其他程序调用',
    interaction: [
      '被上游系统调用：无用户交互，输入来自请求',
      '异步任务提交与结果回调',
      ' webhook 通知完成',
      '供其他程序订阅进度',
      '供人工在管理后台查看与干预',
    ],
    output: [
      '标准 JSON 接口响应（含状态码与错误码）',
      '异步任务的结果对象 / 结果文件下载链接',
      '结构化日志与链路追踪',
      '给上游系统直接消费的结构化字段',
    ],
    tech: [
      'Web 框架（Fastify / Express / Spring 等）与接口契约（OpenAPI）',
      '鉴权与访问控制',
      '并发、超时、限流与重试',
      '队列 / 定时任务（长耗时工作）',
      '数据库与迁移、缓存',
    ],
    capabilities: [
      '适合：被既有系统集成、批量异步处理、无终端用户在场',
      '强约束：契约稳定、必须处理错误与幂等、不能依赖交互式澄清',
      '天然需要：鉴权、审计日志、可观测性',
    ],
  },
  {
    id: 'unspecified', order: 6,
    label: '暂不确定（由 AI 建议）',
    keywords: ['暂不确定', '不确定', '待定', '未确定', '由 ai', '建议'],
    runtime: '尚未确定；由 AI 结合领域特性建议，并说明为什么这样建议',
    interaction: [
      '先给一个默认建议（AI 选最合适的一种），并说明理由',
      '用户可在这一步直接改选其它形态',
    ],
    output: ['按 AI 建议的形态给出典型输出形态，供用户确认或否决'],
    tech: ['先不定技术栈，等形态确定后再给建议'],
    capabilities: [
      '这一形态下不要罗列固定技术选项，一律改为「AI 建议 + 理由」',
      '交互题应多给一句：帮用户判断哪种形态最合适',
    ],
  },
]

/** 按用户在表单里选的标签匹配画像；匹配不到时回落到 unspecified。 */
/**
 * 按用户在表单里选的标签匹配画像。
 *
 * 匹配用「特异性打分」而不是数组顺序：早期版本按数组顺序找第一个命中项，
 * 而 web 的 keywords 里含 'app'，导致「移动端 App」被误判成 web。
 * 现在每个候选算出最长命中关键词的长度，取最长者——特异词（小程序/命令行）
 * 天然比通用词（app/web）长，天然赢；同长度时用 order 字段稳定决胜。
 */
export function matchProfile(deliverable) {
  const text = String(deliverable || '').toLowerCase()
  if (!text) return profileById('unspecified')
  let best = null
  let bestLen = 0
  for (const p of DELIVERABLE_PROFILES) {
    for (const k of p.keywords) {
      const key = k.toLowerCase()
      if (!text.includes(key)) continue
      const len = key.length
      if (len > bestLen || (len === bestLen && best && p.order < best.order)) {
        best = p
        bestLen = len
      }
    }
  }
  return best || profileById('unspecified')
}

/**
 * 按 id 取交付形态定义。
 * ⚠️ `matchProfile` 只认 keywords（「移动端」「app」…），**不认 id 本身**——
 *    `matchProfile('mobile')` 会返回 `unspecified`。所以凡是手上已经是 id 的场合
 *    （如 `profile.id`）必须直接用 `profileById`，别再过一遍 `matchProfile`。
 *    我曾把已归一的 id 又套进 `matchProfile`，导致平台题静默不注入而断言假通过。
 */
export function profileById(id) {
  return DELIVERABLE_PROFILES.find(p => p.id === id) || DELIVERABLE_PROFILES[0]
}

/**
 * 移动端目标平台的受控词表（2026-10-06）。
 *
 * 为什么要受控而不是让模型自由命名：平台 → 技术栈是**一对一映射**，
 * 模型如果自造词（「跨端优先」「原生为主」），就没法确定该锁哪套栈，
 * 产物也无法按平台聚合与复用。跟 ARCHETYPES 必须受控是同一个道理。
 *
 * `stackId` 指向 `tech-stacks.js` 里的实际栈 id。
 *
 * ⚠️ 这里**不存整句关键词**，只存「平台名」；单端/双端由 `matchMobilePlatform`
 * 里的排除词现判。踩过的坑：早先把「仅android」写成无空格的整句关键词，
 * 而注入的选项 label 是「仅 Android」（中文与英文之间有空格），
 * `includes('仅android')` 恒为 false → 单端答案全部提取不到，**静默退回双端栈**。
 * 穷举同义短语永远补不全（用户还可以写「只做安卓端」「就上安卓」）。
 */
export const MOBILE_PLATFORMS = [
  {
    id: 'cross',
    label: 'iOS + Android 双端',
    platforms: ['ios', 'android'],
    stackId: 'mobile-cross',
  },
  {
    id: 'android',
    label: '仅 Android',
    platforms: ['android', '安卓'],
    stackId: 'mobile-android',
  },
  {
    id: 'ios',
    label: '仅 iOS',
    platforms: ['ios', 'iphone', '苹果'],
    stackId: 'mobile-ios',
  },
]

// 表示「两端都要」的明确词。这是**唯一无歧义**的意图信号，必须最先判。
// 曾用过的「排除词」（仅/只/单端）已删除：它无法与双端词共存时定优先级，
// 而且「只做安卓」这种句式已被「只出现一个平台名」这条弱信号覆盖，不需要额外词表。
const BOTH = ['双端', '两端', '跨端', '全平台', 'both', 'cross']

/**
 * 从段②答案里推断移动端目标平台。
 *
 * 判定顺序（每一步都有存在理由，顺序不能换）：
 *   1. 命中明确的双端词（双端/跨端/全平台）→ cross
 *   2. 只出现一个平台名 → 该端（用户写「做安卓」通常就是不做 iOS）
 *   3. 两个平台名都出现、没有排除词 → cross
 *   4. 什么都没命中 → null
 *
 * ⚠️ 顺序踩过的两个坑（都是**先单端后双端**这条错误顺序造成的）：
 *   - 「iOS + Android 双端」被判成 android：选项 label 里 `android` 排在
 *     `ios` 词表之前，先命中就 return 了，后面的双端词永远走不到。
 *   - 「不只做安卓，双端都要」被判成 android：同上，且它同时含排除词与双端词。
 * 修正：**双端词必须最先判**，因为它是显式、无歧义的意图表达；
 * 单端只能靠「缺失另一个平台」这个弱信号推断。
 *
 * 第 4 步返回 null 而不是猜：调用方据此交给 `__unsure__` 规则，
 * 由模型给出取值 + 依据 + 记入 assumptions，而不是在这里默默定成双端。
 */
export function matchMobilePlatform(answers) {
  const text = Object.values(answers || {})
    .flatMap(v => (Array.isArray(v) ? v : [v]))
    .filter(v => typeof v === 'string')
    .join(' ')
    .toLowerCase()
  if (!text.trim()) return null
  // ① 显式双端词优先——它是唯一无歧义的意图信号
  for (const k of BOTH) {
    if (text.includes(k)) return MOBILE_PLATFORMS[0]
  }
  // ② 统计出现了哪几端；只出现一端即按该端判
  const hit = MOBILE_PLATFORMS.filter(p => p.id !== 'cross' && p.platforms.some(n => text.includes(n)))
  if (hit.length === 1) return hit[0]
  // ③ 两端都出现（无排除词）→ 双端
  if (hit.length >= 2) return MOBILE_PLATFORMS[0]
  return null
}

/**
 * 平台 → 栈摘要。用在出题时的选项说明里，让模型知道每项对应什么。
 * 这里刻意**不复用 tech-stacks.js 的 summary 字段**：
 * 那是给「已经锁定了这个形态」看的完整描述，会把 13 个 slot 的话也带进来；
 * 出题只需要一句「选它意味着用什么」，短且无歧义。两边同源但粒度不同，故各写一份。
 */
const PLATFORM_STACK_SUMMARY = {
  'mobile-cross': 'Kotlin Multiplatform 或 React Native / Flutter，一套代码出双端',
  'mobile-android': 'Kotlin + Jetpack Compose，仅 Android 时比跨端方案更小更快',
  'mobile-ios': 'Swift + SwiftUI，仅 iOS 时直接用官方栈',
}

/** 该形态是否需要问「目标平台」。目前只有移动端需要。 */
export function needsPlatformQuestion(deliverable) {
  return profileById(deliverable).id === 'mobile'
}

/** 把画像渲染成可直接内联进 meta-prompt 的文本。 */
export function renderProfile(profile) {
  if (!profile) return ''
  const lines = []
  lines.push(`用户已选定的交付形态：${profile.label}`)
  lines.push(`运行环境：${profile.runtime}`)
  lines.push('该形态下真实可行的【交互方式】：')
  profile.interaction.forEach(x => lines.push(`  - ${x}`))
  lines.push('该形态下真实可行的【输出/呈现形式】：')
  profile.output.forEach(x => lines.push(`  - ${x}`))
  lines.push('该形态要求的关键技术方向：')
  profile.tech.forEach(x => lines.push(`  - ${x}`))
  lines.push('该形态的能力边界（出题时必须尊重，不要许诺做不到的事）：')
  profile.capabilities.forEach(x => lines.push(`  - ${x}`))
  if (profile.platformQuestion) {
    lines.push('')
    lines.push('**本题形态有一道必答题，不许省掉：**')
    lines.push(`  ${profile.platformQuestion.label}`)
    lines.push(`  ${profile.platformQuestion.help}`)
    lines.push('  选项必须落在这三项内，且每项都要写清适用场景：')
    for (const p of MOBILE_PLATFORMS) {
      const s = PLATFORM_STACK_SUMMARY[p.stackId]
      lines.push(`  - ${p.label} —— ${s || p.stackId}`)
    }
    lines.push('  **不要自己另造选项**（如「跨端优先」「原生为主」）：平台与栈是一对一映射，')
    lines.push('  选项不受控就锁不住技术栈，产物也无法按平台复用。')
  }
  return lines.join('\n')
}
