/**
 * skill-generator-core · 交付形态 → 具体技术栈
 * ------------------------------------------------------------------
 * 为什么单独建这个模块：
 *   `deliverables.js` 的 `tech` 字段给的是**技术方向**（「前端框架（React / Vue）
 *   与构建工具」），不是**技术栈**。方向意味着每次生成都可以挑不同的库——
 *   于是同一个交付形态，十次生成得到十套技术栈，用户无法预期、无法复用、
 *   也无法预先装好依赖。这与 UI 那次是同一类毛病：**给了约束的方向，没给约束的取值**。
 *
 * 设计取舍：
 *   1. **主栈锁死 + 有条件替换**，而不是完全锁死或完全放开。
 *      完全锁死会在特殊场景下逼出错误选择；完全放开就回到原问题。
 *      规则是：默认必须用主栈；换必须满足 `swapIf` 条件并在产物里显式声明理由。
 *   2. **每项都给「为什么选它」**。模型在遇到主栈不适配的场景时，
 *      能靠理由反推出该换什么，而不是凭感觉乱换。
 *   3. **版本锁主版本，不锁补丁号**。锁死 `19.1.0` 意味着半年后必然过时；
 *      锁主版本（如 React 18）既阻止了跨代升级（React 19 生态差异大），
 *      又留了补丁更新的余地。
 *   4. **显式反选清单**。模型偏爱选「听说过」的库（jQuery / moment / axios 全家桶），
 *      必须点名禁用，否则它一定会选。
 *   5. **跨领域中立**：只讲形态的工程约束，不含任何行业知识。
 *
 * 与 `ui-standards.js` 的联动：
 *   Web / 桌面形态的样式层**刻意不选成套 UI 组件库**，只给 headless 方案 +
 *   自建组件。因为 UI 规范要求「同屏强色块 ≤ 2 个」「按钮层级 ≤ 3」这类具体约束，
 *   而 shadcn/ui / Ant Design 这类成套库自带一整套视觉风格，装上就会和 UI 规范打架
 *   ——模型通常会直接用库的默认样式，把规范架空。这一点必须写死在栈里，
 *   否则 UI 规范会被库默认值覆盖掉。
 */

/**
 * 版本策略：生成时必须核验，但不得偏离主版本。
 *
 * ⚠️ 例子必须用**中性占位符**，不能硬编码 `React 18` 这类具体库。
 * 这段会注入到全部 7 种形态的 prompt 里，若示例写成 React，
 * CLI / 小程序 / 移动端形态的模型会看到「React 18 → 19」并据此选型——
 * 这是「跨领域中立」被自己的举例破坏掉的典型失效（2026-10-05 验证时实测命中）。
 */
export const VERSION_POLICY = [
  '**必须先核验实际最新稳定版本**再写进产物——版本号写错会让照着装的用户直接失败。',
  '锁的是**主版本**不是补丁号：写 `<库名> <主版本>`（如 `16`），不写 `<主版本>.<补丁>.<修订>`。',
  '禁止跨主版本升级（框架、语言、运行时都算）。跨大版本的生态与 API 差异会直接改变写法。',
  '在产物的技术清单里注明「版本已于 <生成日期> 核验」——技术栈有时效性，不注明等于免责。',
]

/** 通用反选清单：跨形态通用的「别选这些」。 */
export const NEVER_USE = [
  '**jQuery** —— 无论什么形态都不用。DOM 操作已由框架接管，它只会增加体积与全局污染。',
  '**moment.js** —— 已进入维护模式。用 date-fns / dayjs / Temporal，体积差一个数量级。',
  '**axios** —— 现代 fetch 已支持超时、取消、拦截器。除非需要特定的 axios 独有插件，不要选。',
  '**lodash（全量）** —— 现代 JS（可选链、空值合并、Object.fromEntries）覆盖了大部分用法。确需引入时用 `lodash-es` 按需导入具体函数。',
  '**新建项目不要用 Webpack** —— Vite 生态已是默认选择，除非项目明确依赖某 webpack 专属 loader。',
  '**不要选已停止维护的库**。选型前先确认：最近一次发布在 6 个月内、无公开的弃用公告。',
]

/**
 * 七种交付形态的具体技术栈。
 * 每项：`{ slot, pick, why, swapIf? }`
 *   - pick     主栈取值（含主版本号）
 *   - why      为什么选它 —— 模型据此判断何时该偏离
 *   - swapIf   允许替换的条件；不满足时**必须**用 pick
 */
export const TECH_STACKS = [
  // ==================================================================
  {
    id: 'web',
    label: '浏览器 Web 页面',
    summary: 'React 18 + TypeScript + Vite + Tailwind CSS + ECharts',
    slots: [
      { slot: '语言', pick: 'TypeScript 5.x（strict 模式）', why: '本工具产出的技能含大量判定规则与数据结构，any 会让规则里的字段名写错也发现不了' },
      { slot: '框架', pick: 'React 18', why: '生态最全：图表、表格、状态、虚拟滚动都有成熟方案；招人也好招', swapIf: '用户或团队已明确锁定 Vue 3 / Svelte —— 此时用 Vue 3 + Vite + Pinia，但要在产物里写明「因团队技术栈锁定 Vue」' },
      { slot: '构建', pick: 'Vite 5', why: '冷启动秒级、HMR 快、配置量最小' },
      { slot: '路由', pick: 'React Router 6', why: '事实标准，仅需单页路由时不必引入更重的方案' },
      { slot: '样式', pick: 'Tailwind CSS 3.4 + CSS 变量做设计令牌', why: '原子类天然约束间距（默认 4 的倍数，与 8pt grid 对齐），且**不会自带视觉风格**——这点比选成套组件库更重要，见下方「样式层禁止」', swapIf: '需要与既有设计系统对齐且该系统基于 CSS-in-JS → 改用该既有系统，但仍不要引入成套组件库' },
      { slot: '组件', pick: '**自建组件**（shadcn/ui 的 copy 模式可借鉴，但不整包安装）', why: 'UI 规范要求同屏强色块 ≤ 2、按钮层级 ≤ 3、圆角统一 8px 等具体阈值，成套 UI 库自带一整套视觉风格，装上就会和这些约束冲突，模型随后会直接用库默认样式把规范架空', swapIf: '无 —— 组件层一律自建，这是 UI 规范能否落地的前提' },
      { slot: '图表', pick: 'ECharts 5', why: '趋势/对比/构成/分布全套现成，Canvas 渲染性能好，数据量大时也不卡' },
      { slot: '服务端状态', pick: 'TanStack Query 5', why: '缓存、失效、重试、乐观更新全免费，不用自己写一遍' },
      { slot: '客户端状态', pick: 'Zustand 4', why: '比 Redux 样板少一个数量级；不要为了简单表单引入 Redux Toolkit' },
      { slot: '表格', pick: 'TanStack Table 8（headless）', why: 'headless 只管状态与排序筛选，渲染仍归自建组件，UI 规范才能生效', swapIf: '数据量上万且需虚拟滚动 → 加 TanStack Virtual' },
      { slot: '数据校验', pick: 'Zod 3', why: '同一份 schema 同时用于前端表单校验、后端入参校验与生成 TypeScript 类型，三处不漂移' },
      { slot: '日期', pick: 'date-fns 3', why: '按函数导入时树摇友好；配合原生的 Temporal 更佳但兼容性未及' },
      { slot: 'HTTP / 流式', pick: '原生 fetch + ReadableStream 读 SSE', why: '大模型流式输出需要逐块读取，fetch 原生支持；不引额外库', swapIf: '需拦截器统一处理鉴权刷新 → 引 ky（fetch 的轻封装），不要用 axios' },
      { slot: '后端', pick: 'Node.js 20 + TypeScript + Fastify 4', why: '与前端同语言，schema 可与 Zod 共享；Fastify 比 Express 自带 schema 校验与更好的性能', swapIf: '已有后端 → 只交付前端 + API 契约（OpenAPI），不要重复造后端' },
      { slot: '数据库', pick: 'PostgreSQL 16 + Drizzle ORM 0.33', why: 'Drizzle 的 schema 即 TypeScript 类型，与 Zod 可互校验；迁移脚本可回滚', swapIf: '纯个人本地使用、不需要多端 → 用 SQLite（better-sqlite3）+ Drizzle' },
      { slot: '缓存 / 队列', pick: 'Redis 7', why: '会话、限流、异步任务共用一个实例，减少运维面', swapIf: '单机且无并发压力 → 跳过 Redis，不要为将来而引入' },
      { slot: '模型调用', pick: '官方 SDK（openai / anthropic 对应包）并统一走服务端代理', why: '**API Key 绝不能进前端包**。浏览器里必须由后端转发，前端只拿自己的会话 token' },
      { slot: '文件导出', pick: 'SheetJS(xlsx) + html-to-image', why: 'Excel 导出与图表转 PNG 各一个成熟库，覆盖绝大多数交付需求' },
      // ⚠️ 这两个槽位是2026-10-09 补的。此前本形态只有「文件导出」（输出侧），
      //   没有输入侧的解析槽位 —— 于是模型遇到「读取 PDF 回单/ 扫描件」时无从依据，
      //   实测产物里出现了两处自相矛盾：一处写「扫描件转服务端 OCR 队列」，
      //   另一处在 keyTech 里写「具体 OCR 库选型待定，不预置未核验依赖」。
      //   根因不是模型偷懒，而是词表里根本没有这个槽位。
      { slot: 'PDF 文本层抽取', pick: 'pdfjs-dist 4（Node 侧）', why: '**电子 PDF 自带文本层，直接抽取比 OCR 准且快**，且能输出带坐标的文本项，可按位置结构化出金额、流水号、日期。系统与财务系统导出的 PDF、账单几乎都是电子件，**先走文本层、确认没有文本层再考虑 OCR**', swapIf: '只需读取表格型 PDF 且不需要坐标结构化 → 可改用 pdf-parse（更轻，但拿不到坐标）' },
      { slot: 'OCR（仅扫描件兜底）', pick: 'RapidOCR（Node 原生）或 PaddleOCR 3.x 服务化', why: '**中文票据/对账场景实测：PaddleOCR 95-98%、RapidOCR 接近、Tesseract.js 仅 70-85%**；扫描件银行对账单上 Tesseract 只有 64%，而金额与流水号认错一位就会让对账出错（0↔O、1↔l）。因此 OCR 只作兜底路径，且**输出必须校验、低置信度字段转人工复核**，不可直接采信', swapIf: '不想自建模型与运维 → 改用云 OCR（百度/腾讯/阿里），准确率 97-99% 且无需 GPU，但按量计费；数据敏感时优先本地' },
      { slot: '测试', pick: 'Vitest（单元）+ Playwright（端到端）', why: 'Vitest 与 Vite 共用配置，端到端用 Playwright —— 判定逻辑与界面交互都要测' },
      { slot: '部署', pick: '静态资源 + Node 服务（Vercel / Netlify / Nginx 均可）', why: '前端纯静态 + 后端服务是最少组件的部署形态' },
    ],
  },

  // ==================================================================
  {
    id: 'desktop',
    label: '桌面应用',
    summary: 'Electron + electron-vite + electron-builder 免安装绿色版 + React 18',
    slots: [
      { slot: '桌面框架', pick: 'Electron（**不要选 Tauri**）', why: 'Tauri 要额外装 Rust 工具链、体积小但生态与调试链路更薄；本项目已有 Electron 实战与踩坑经验（主进程 CJS 输出、渲染进程 GPU 沙箱），换框架等于推倒已积累的经验', swapIf: '用户明确要求小体积（< 10MB）且能接受 Rust 环境 → 改用 Tauri 2' },
      { slot: '主进程输出格式', pick: '**CommonJS（.cjs）**', why: 'Electron 主进程必须 CJS；若打包为 ESM 会导致 `app` / `BrowserWindow` 为 undefined，启动即崩。这是已验证的高频坑', swapIf: '无 —— 不可协商' },
      { slot: '打包构建', pick: 'electron-vite 3', why: '主进程 / 预加载 / 渲染三层分别构建，与 Electron 官方推荐结构一致' },
      { slot: '前端', pick: '与 Web 形态相同：React 18 + TypeScript + Vite + Tailwind + 自建组件', why: '渲染进程就是一个网页，UI 规范与技术栈应当一致，不要两套' },
      { slot: '打包分发', pick: 'electron-builder，**目标含免安装绿色版（portable / 免安装 zip）**', why: '免安装绿色版免去安装器与管理员权限，拷走即用，是这类工具最实用的分发形态', swapIf: '需上架应用商店 → 追加 NSIS / Mac App Store target' },
      { slot: '二进制与依赖下载', pick: 'Electron 镜像：ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/', why: '直连下载 Electron 二进制可能长时间无进展（实测 8 分钟 0 字节），国内必须走镜像（约 30 秒）', swapIf: '无 —— 国内分发一律加镜像' },
      { slot: '本地存储', pick: 'better-sqlite3（同步 API）+ userData 路径', why: '桌面端用同步 API 最省心智；数据放 userData 而非安装目录，否则升级会被覆盖' },
      { slot: '文件读写', pick: 'Node 内置 `node:fs` / `node:path` / `node:os`', why: '主进程是完整 Node 运行时，不需要额外文件库；**不要用 renderer 直接读文件**，必须走 IPC', swapIf: '无' },
      { slot: 'IPC 契约', pick: '`contextBridge.exposeInMainWorld` + `ipcRenderer.invoke`，渲染进程开 `contextIsolation:true`、`nodeIntegration:false`', why: '这是 Electron 的安全基线。开着 nodeIntegration 等于把 Node 直接暴露给页面' },
      { slot: '凭据', pick: '系统钥匙串（keytar）或加密配置文件', why: 'API Key 不能明文放用户目录', swapIf: '无' },
      { slot: '离线可用', pick: 'Service Worker + 本地缓存双层', why: '断网仍可打开并查看历史数据，是桌面形态相对 Web 的核心优势，不能浪费' },
      { slot: '自动更新', pick: 'electron-updater（或跳过）', why: '免安装绿色版天然靠「换个文件夹」升级，updater 反而破坏免安装特性', swapIf: '走安装器分发时必选 updater' },
      { slot: '模型调用', pick: '主进程调用官方 SDK，Key 存钥匙串', why: '渲染进程不应持有 Key', swapIf: '需要局域网共用一个 Key → 走本地 HTTP 服务转发' },
      { slot: '测试', pick: 'Vitest（主进程逻辑）+ Playwright（`_electron.launch` 跑 E2E）', why: 'Playwright 支持 Electron，能测真实的主进程-渲染进程链路' },
    ],
  },

  // ==================================================================
  {
    id: 'mobile',
    label: '移动端 App',
    // ⚠️ 2026-10-06：目标平台（双端 / 仅 Android / 仅 iOS）决定用哪套栈，
    //    而「移动端」这个词本身没回答它。真正的三套栈是下面 mobile-cross /
    //    mobile-android / mobile-ios；这个 id 保留下来当**双端默认**，
    //    是为了不破坏既有 `stackById('mobile')` 与历史产物的引用。
    summary: 'React Native 0.76 + Expo SDK 52 + TypeScript',
    aliasOf: 'mobile-cross',
    slots: [
      { slot: '框架', pick: 'React Native 0.76 + Expo SDK 52', why: '与本工具的 JS/TS 技术栈同源，技能包的类型定义与业务逻辑可与 Web 形态共享；Expo 把相机、相册、推送、构建这些苦活打包好了', swapIf: '要求极致性能或重度图形 → Flutter；要求最小体积且团队熟悉 Kotlin/Swift → 原生' },
      { slot: '语言', pick: 'TypeScript 5.x（strict 模式）', why: '移动端同样有大量判定规则与接口契约，any 会让字段名写错也过不了编译' },
      { slot: '导航', pick: 'React Navigation 7（native-stack）', why: '事实标准；用 native-stack 而非 JS stack，保留原生转场性能' },
      { slot: '样式', pick: 'StyleSheet + 设计令牌（间距 4 的倍数，取 8 的倍数子集）', why: 'RN 没有 CSS，原子类方案不适用；设计令牌仍需保持同一套间距与对比度规则' },
      { slot: '组件', pick: '自建组件（参考 React Native Paper / Tamagui 的 API 设计，但**不整包安装**）', why: '同 Web：成套库的默认样式会架空 UI 规范', swapIf: '无' },
      { slot: '设备能力', pick: 'expo-camera / expo-image-picker / expo-file-system', why: 'Expo 模块有统一的权限与降级处理', swapIf: '需后台定位等 Expo 未覆盖的能力 → 写原生模块并用 Expo prebuild' },
      { slot: '本地存储', pick: 'expo-sqlite（大量数据）/ AsyncStorage（少量偏好）', why: '两档存储，不要用一个方案硬扛' },
      { slot: '状态', pick: 'Zustand 4 + TanStack Query 5', why: '同 Web，认知成本最低' },
      { slot: '列表性能', pick: 'FlatList（默认）/ FlashList（万级数据）', why: '长列表不用 ScrollView 渲染全部项，否则卡顿与内存问题' },
      { slot: '推送', pick: 'expo-notifications 开发期；生产需 APNs / FCM 原生凭证', why: 'Expo 推送在生产环境必须自有凭证，不能长期依赖 Expo 共享通道', swapIf: '无' },
      { slot: '图表', pick: 'react-native-svg + 手写图表，或 react-native-gifted-charts', why: 'RN 无内置图表；图表种类少时手写 svg 反而比引库更可控', swapIf: '图表需求复杂 → gifted-charts' },
      { slot: '构建分发', pick: 'EAS Build（云端构建，无需本地装 Xcode/Android Studio）', why: '省掉本地环境搭建这一大坑', swapIf: '需完全掌控构建流水线 → 本地原生构建' },
      { slot: '测试', pick: 'Jest + React Native Testing Library + Maestro（E2E）', why: 'Maestro 用 YAML 写 E2E，比写测试代码省事' },
      { slot: '性能预算', pick: '首屏渲染 < 1.5s、包体 < 50MB、列表滚动 60fps', why: '移动端场景中断频繁、随时被打断，性能问题直接等于功能不可用' },
    ],
  },

  // ==================================================================
  // 移动端三套栈（2026-10-06）。选用哪套由段②「目标平台」题的答案决定，
  // 见 deliverables.js 的 MOBILE_PLATFORMS / matchMobilePlatform。
  // 上面那个 `mobile` id 等价于 mobile-cross，保留是为了向后兼容。
  // ==================================================================
  {
    id: 'mobile-cross',
    label: '移动端 App（iOS + Android 双端）',
    summary: 'React Native 0.76 + Expo SDK 52 + TypeScript（双端一套代码）',
    slots: [
      { slot: '框架', pick: 'React Native 0.76 + Expo SDK 52', why: '一套代码出双端，且 Expo 把相机、相册、推送、构建打包好了；双端时它的成本优势最大', swapIf: '团队是 Flutter 背景且更熟 → Flutter（Dart）；需要重度图形/自绘引擎 → Flutter' },
      { slot: '语言', pick: 'TypeScript 5.x（strict 模式）', why: '移动端同样有大量判定规则与接口契约，any 会让字段名写错也过不了编译' },
      { slot: 'UI 框架', pick: 'react-native-reanimated + 自建组件（参考 Tamagui / React Native Paper 的 API 设计，但**不整包安装**）', why: '成套组件库的默认样式会架空 UI 规范的硬阈值（强色块 ≤2、间距 8 的倍数）；reanimated 走原生线程，动画不卡 JS 线程' },
      { slot: '导航', pick: 'React Navigation 7（native-stack）', why: '事实标准；用 native-stack 而非 JS stack，保留原生转场性能' },
      { slot: '样式', pick: 'StyleSheet + 设计令牌（间距取 8 的倍数）', why: 'RN 没有 CSS，原子类方案不适用；**不要整套套用 NativeBase / Tamagui 默认主题**——默认色与字号会架空「同屏色相 ≤3、正文对比度 ≥4.5:1」的硬阈值，只取其无障碍与 RTL 处理；令牌仍与其它形态保持同一套间距与对比度规则' },
      { slot: '设备能力', pick: 'expo-camera / expo-image-picker / expo-file-system', why: 'Expo 模块有统一的权限申请与降级处理，不必各平台各写一套', swapIf: '需后台定位等 Expo 未覆盖的能力 → 写原生模块并用 Expo prebuild' },
      { slot: '本地存储', pick: 'expo-sqlite（大量结构化数据）/ AsyncStorage（少量偏好）', why: '两档存储，不要用一个方案硬扛' },
      { slot: '状态与网络', pick: 'Zustand 4 + TanStack Query 5', why: '状态与请求缓存分离，弱网下 TanStack Query 的重试/失效策略直接可用' },
      { slot: '列表性能', pick: 'FlatList（默认）/ FlashList（万级数据）', why: '长列表不用 ScrollView 渲染全部项，否则掉帧与内存问题' },
      { slot: '推送', pick: 'expo-notifications 开发期；生产需自建 APNs / FCM 凭证', why: '生产环境必须自有凭证，不能长期依赖 Expo 共享通道', swapIf: '无' },
      { slot: '图表', pick: 'react-native-svg 手写，或 react-native-gifted-charts', why: 'RN 无内置图表；图表种类少时手写 svg 比引库更可控', swapIf: '图表需求复杂 → gifted-charts' },
      { slot: '构建分发', pick: 'EAS Build（云端构建，无需本地装 Xcode / Android Studio）', why: '省掉本地环境搭建这一大坑；双端都需要原生工具链时收益最大', swapIf: '需完全掌控构建流水线 → 本地原生构建' },
      { slot: '测试', pick: 'Jest + React Native Testing Library + Maestro（E2E）', why: 'Maestro 用 YAML 写 E2E，比写测试代码省事' },
      { slot: '性能预算', pick: '首屏渲染 < 1.5s、包体 < 50MB、列表滚动 60fps', why: '移动端场景中断频繁，性能问题直接等于功能不可用' },
    ],
  },
  {
    id: 'mobile-android',
    label: '移动端 App（仅 Android）',
    summary: 'Kotlin 2.x + Jetpack Compose（仅 Android，直接用官方栈）',
    slots: [
      { slot: '语言', pick: 'Kotlin 2.x', why: '仅 Android 时没有跨端需求，Kotlin 就是官方首选；比任何跨端方案包体更小、启动更快' },
      { slot: 'UI 框架', pick: 'Jetpack Compose（**不要用 XML 布局**）', why: '声明式，与 UI 规范（8pt 间距令牌、单一主按钮、七态组件）天然对得上；XML 布局手写冗长且难以统一令牌' },
      { slot: '架构', pick: '单 Activity + Compose Navigation', why: 'Compose 官方推荐；多 Activity 会让状态传递与返回栈处理变复杂' },
      { slot: '设计令牌', pick: '自建 Design System（间距/字号/圆角/色板集中在 tokens.kt）', why: '**不要整套引入 Material 3 默认主题**：它的默认色板与字号会架空「同屏色相 ≤3、正文对比度 ≥4.5:1」这些硬阈值；只取其无障碍与 RTL 处理' },
      { slot: '网络', pick: 'Retrofit + OkHttp + kotlinx.serialization', why: '官方生态标配；kotlinx.serialization 是 Kotlin 官方序列化方案，不必引 Jackson/Gson' },
      { slot: '本地存储', pick: 'Room（结构化数据）+ DataStore（少量偏好）', why: 'Room 是官方 ORM，编译期校验 SQL；DataStore 替代 SharedPreferences（后者不支持异步与类型安全）' },
      { slot: '设备能力', pick: 'CameraX（拍照/扫码）+ Accompanist 权限封装', why: 'CameraX 是官方相机库；权限在 Compose 里必须显式申请，不能沿用已废弃的自动授予假设' },
      { slot: '异步', pick: 'Kotlin Coroutines + Flow', why: '官方并发方案；网络与存储一律挂协程作用域，不要手写线程' },
      { slot: '依赖注入', pick: 'Hilt', why: '官方推荐；编译期生成代码，作用域清晰。规模很小（<5 个模块）时可用手写构造注入，但不要为此引 Koin' },
      { slot: '列表性能', pick: 'LazyColumn（默认）/ LazyVerticalGrid（网格）', why: 'Compose 内置，按需组合；不要用 Column + verticalScroll 渲染全部项' },
      { slot: '推送', pick: 'Firebase Cloud Messaging', why: 'Android 官方推送通道' },
      { slot: '图表', pick: 'Compose Canvas 手写（Vico 2 可选）', why: '图表种类少时手写 Canvas 完全够用且不引包体；不要引重量级图表库' },
      { slot: '打包分发', pick: 'Gradle + App Bundle（.aab）', why: 'Google Play 强制 aab；APK 无法覆盖按设备语言/分辨率切分，体积反而更大' },
      { slot: '测试', pick: 'JUnit + kotlinx-coroutines-test + Compose UI Test', why: 'Compose UI Test 可对语义树断言，不依赖像素' },
      { slot: '性能预算', pick: '冷启动 < 1.5s、包体（AAB 下载量）< 30MB、列表滚动 60fps', why: '原生栈基线就该优于跨端方案，若没达到说明实现有问题' },
      { slot: '包名与签名', pick: 'applicationId 用公司域名反写 + 上传密钥妥善备份', why: '**包名一旦上架不可更改**；签名密钥丢失则无法更新应用' },
    ],
  },
  {
    id: 'mobile-ios',
    label: '移动端 App（仅 iOS）',
    summary: 'Swift 5.x + SwiftUI（仅 iOS，直接用官方栈）',
    slots: [
      { slot: '语言', pick: 'Swift 5.x', why: '仅 iOS 时 Swift 就是唯一选择，没有跨端取舍问题' },
      { slot: 'UI 框架', pick: 'SwiftUI（复杂表单可用 UIKit 嵌入）', why: '声明式，与 UI 规范天然对得上；SwiftUI 至今覆盖不到的场景（部分复杂手势）可局部嵌 UIKit 视图' },
      { slot: '设计令牌', pick: '自建 Design System（间距/字号/圆角/色板集中在 DesignTokens.swift）', why: '**不要整套套用系统默认主题**：默认色与字号同样会架空「同屏色相 ≤3、对比度 ≥4.5:1」的硬阈值' },
      { slot: '架构', pick: 'SwiftUI App + Observation（@Observable）+ NavigationStack', why: 'Observation 是 iOS 17+ 官方状态方案，比 ObservableObject 更轻；NavigationStack 是官方导航' },
      { slot: '网络', pick: 'URLSession（async/await）+ Codable', why: '**不引第三方网络库**：URLSession 的 async/await 已足够，Codable 处理 JSON 无需再引序列化框架' },
      { slot: '本地存储', pick: 'SwiftData（iOS 17+）/ Core Data（需兼容更低版本时）', why: 'SwiftData 是官方新栈；需支持 iOS 16 及以下则用 Core Data' },
      { slot: '设备能力', pick: 'AVFoundation（相机）+ PhotosPicker（相册）', why: '均为官方框架；PhotosPicker 不需要额外申请相册权限' },
      { slot: '推送', pick: 'APNs + UserNotifications', why: 'iOS 推送必须走 APNs，需 Apple 开发者账号与证书' },
      { slot: '列表性能', pick: 'List（默认）/ LazyVStack（自定义布局）', why: 'List 自带滚动复用；不要用 VStack 塞进 ScrollView 渲染全部项' },
      { slot: '图表', pick: 'Swift Charts（iOS 16+）', why: '**Apple 官方框架，不引第三方**；仅需极简柱状/折线时它完全够用' },
      { slot: '打包分发', pick: 'Xcode Archive + 上传 App Store Connect', why: '官方流程；需付费开发者账号（每年 99 美元）' },
      { slot: '测试', pick: 'XCTest + ViewInspector（Compose/SwiftUI 语义断言）', why: 'ViewInspector 可对 SwiftUI 视图树断言，不依赖快照对比' },
      { slot: '性能预算', pick: '冷启动 < 1s、包体 < 40MB、列表滚动 60fps', why: 'iOS 设备性能基线更高，预算可以比 Android 再紧一点' },
      { slot: '兼容性', pick: '最低版本按实际用户分布定（iOS 17 / 16 / 15），不要默认只支持最新版', why: '默认只支持最新版会把大量老设备用户直接排除，且 Apple 审核会问最低版本理由' },
    ],
  },

  // ==================================================================
  {
    id: 'miniapp',
    label: '微信小程序',
    summary: '微信小程序原生 + TypeScript + miniprogram-ci（**不要先选 uni-app / Taro**）',
    slots: [
      { slot: '框架', pick: '**微信小程序原生**（WXML + WXSS + TS）', why: '原生才能用全平台能力且无编译层；uni-app / Taro 的抽象在小程序侧能力覆盖不全，真遇到平台特性时反而要绕过框架。**跨端需求明确时再选 uni-app**', swapIf: '必须同时发布 H5/App，且能接受平台特性受限 → uni-app（Vue 系）或 Taro（React 系）；选 Taro 时沿用 React + TS' },
      { slot: '语言', pick: 'TypeScript（用 miniprogram-ci 的 npm 构建产物类型）', why: '小程序逻辑复杂度不比 Web 低，无类型会很难维护' },
      { slot: '样式', pick: 'WXSS + 设计令牌（rpx 与 px 的换算：750rpx = 屏幕宽）', why: 'WXSS 是 CSS 子集，Tailwind 不可用；令牌仍按 8pt grid 定义（以 rpx 表达）' },
      { slot: '组件', pick: '自建 + WeUI 基础样式参考', why: '小程序组件必须自建或用 wx.open-type 体系，没有成熟组件库', swapIf: '无' },
      { slot: '图表', pick: 'Canvas 2D 手写（`<canvas type="2d">`）或 ECharts for Weixin', why: 'ECharts for Weixin 包体较大，图表需求简单时手写 Canvas 更快更可控', swapIf: '图表复杂且包体预算够 → echarts-for-weixin' },
      { slot: '登录', pick: 'wx.login → code 换 openid/session_key → 自建后端换自定义 token', why: '**不要把 session_key 交给前端，也不要在前端解 code**', swapIf: '无' },
      { slot: '后端', pick: '微信云开发（CloudBase）或自建后端 + HTTPS 域名白名单', why: '云开发免运维，适合工具类；自建可控。请求域名必须在 MP 后台配白名单', swapIf: '无' },
      { slot: '消息推送', pick: '订阅消息（用户主动授权，一次授权一次下发）', why: '小程序不能长期后台常驻，只能靠订阅消息，且必须写清申请理由，否则会被拒', swapIf: '无' },
      { slot: '分享', pick: '`onShareAppMessage` + `onShareTimeline`', why: '分享是小程序的主要扩散链路，必须显式设计分享卡片标题与配图', swapIf: '无' },
      { slot: '包体控制', pick: '主包 ≤ 2MB，总包（含分包）≤ 20MB', why: '平台硬限制，超了无法上传', swapIf: '无 —— 硬限制' },
      { slot: '上传发布', pick: 'miniprogram-ci（一条命令上传，不用点开发者工具）', why: '可脚本化才能进 CI；手工上传不可复现' },
      { slot: '冷启动', pick: '首屏渲染 < 1s，优先加载最关键数据', why: '从分享链接进入时冷启动体验决定成败，这是小程序区别于其它形态的核心指标' },
      { slot: '测试', pick: 'miniprogram-simulate（单测）+ 真机预览（必做）', why: '模拟器与真机行为差异不小，涉及授权与分享的逻辑**必须真机验证**' },
    ],
  },

  // ==================================================================
  {
    id: 'cli',
    label: '命令行工具 / 脚本',
    summary: 'Node.js 20 + TypeScript + commander + chalk/ora（**纯文本输出，无任何 GUI**）',
    slots: [
      { slot: '运行时', pick: 'Node.js 20 LTS', why: '与本工具同栈；需要更低兼容时降 Node 18', swapIf: '环境受限（必须 Python/Ruby）→ 换成对应语言实现，判定逻辑不变' },
      { slot: '语言', pick: 'TypeScript 5.x（tsc 编译为 ESM 或 CJS）', why: '判定逻辑复杂，类型是主要防线' },
      { slot: '参数解析', pick: 'commander 12', why: '子命令、选项、帮助文本生成都是开箱即用；`--help` 不用自己写', swapIf: '想要零依赖且选项很少 → 手写 `process.argv` 解析（不超过 5 个选项时确实更轻）' },
      { slot: '校验', pick: 'Zod 3', why: '与其它形态共用同一份 schema，避免同一规则在 CLI 与 Web 两处漂移' },
      { slot: '配置', pick: '配置优先级：命令行参数 > 环境变量 > 配置文件（`.xxxrc.json`）> 默认值', why: '这是 CLI 的通用约定，顺序错了会让人意外', swapIf: '无' },
      { slot: '颜色', pick: 'chalk 5（注意 ESM-only）', why: '事实标准；**输出重定向到文件时要自动禁用颜色**', swapIf: '无' },
      { slot: '进度显示', pick: 'ora 8', why: '长耗时任务给 spinner；**注意非 TTY 环境要关掉**，否则日志里全是转义符' },
      { slot: '表格输出', pick: 'cli-table3（仅当用户未指定输出格式时）', why: '给人看的表格；机器消费走 JSON', swapIf: '无' },
      { slot: '结构化输出', pick: '原生 JSON.stringify（不引库）', why: '管道消费时输出必须**只有 JSON**，不能混入任何提示文字', swapIf: '无' },
      { slot: '日志', pick: '所有诊断信息走 **stderr**，结果走 **stdout**', why: '这是管道能用的前提。混进 stdout 就 `| jq` 就废了', swapIf: '无 —— 硬约定' },
      { slot: '退出码', pick: '0 成功 / 1 通用失败 / 2 参数错误 / 3 判定不通过（如未达阈值）', why: '给脚本判断成败；约定必须固定并写进 `--help`', swapIf: '无' },
      { slot: '输入方式', pick: 'stdin 管道 + `--input` 文件路径 + 交互式向导三种都支持', why: '这是形态画像里明确要求的；检测到非 TTY 时必须自动关闭向导', swapIf: '无' },
      { slot: '模型调用', pick: '官方 SDK，支持流式', why: 'API Key 从环境变量或配置文件读，**不要硬编码**', swapIf: '无' },
      { slot: '分发', pick: 'npm 包（bin 声明）或 Node 单文件打包（`node --experimental-sea-config`）', why: '免安装场景用单文件；需分发到 npm 则标准发布' },
      { slot: '测试', pick: 'Vitest（单元）+ 快照测试（--help 输出必须快照断言）', why: '改库导致 `--help` 变了是破坏性变更，快照能立刻发现', swapIf: '无' },
    ],
  },

  // ==================================================================
  {
    id: 'api',
    label: '后端服务 / 接口',
    summary: 'Node.js 20 + TypeScript + Fastify 4 + PostgreSQL 16 + Drizzle + Redis 7',
    slots: [
      { slot: '运行时', pick: 'Node.js 20 LTS', why: '与前端同语言，schema 可共享' },
      { slot: '语言', pick: 'TypeScript 5.x（strict）', why: '接口契约就是类型，类型即文档' },
      { slot: '框架', pick: 'Fastify 4', why: '基于 schema 自动做入参校验与序列化，性能优于 Express', swapIf: '团队已统一 Spring Boot / Go 栈 → 跟随团队，不要为「更现代」引入新技术栈', swapIfNote: '跟随既有技术栈永远优先于选「更先进」的' },
      { slot: '接口契约', pick: 'Zod schema → 导出 OpenAPI 3 文档', why: '一份 schema 同时用于入参校验、类型定义与文档，不会三处不一致' },
      { slot: '数据库', pick: 'PostgreSQL 16 + Drizzle ORM 0.33', why: 'Drizzle 的 schema 即 TS 类型，迁移可回滚' },
      { slot: '连接池', pick: 'postgres.js（或 pg + 连接池）', why: '服务端场景必须显式限流，否则模型调用高峰会打爆连接' },
      { slot: '缓存 / 队列', pick: 'Redis 7 + BullMQ 5', why: '长耗时任务必须异步化，**接口不能同步等模型生成**', swapIf: '任务不需排队且量小 → 跳过队列，但要在接口文档里写明同步执行与超时上限' },
      { slot: '鉴权', pick: 'API Key（服务端间）或 JWT（带终端用户）', why: '二选一取决于调用方有没有终端用户', swapIf: '无' },
      { slot: '幂等', pick: '请求级 `Idempotency-Key` + 唯一索引', why: '模型调用有重试，**重复请求会产生重复计费与重复写入**。这是接口形态最容易被漏掉的一条', swapIf: '无 —— 硬要求' },
      { slot: '限流与超时', pick: '令牌桶限流 + 全链路超时（模型调用单独设更长的）', why: '上游超时要能透传给调用方，不能无限等待' },
      // 同 web 形态的理由：接口形态接收上传文件时，也必须区分「电子件」与「扫描件」两条路径。
      { slot: '文件解析与 OCR', pick: 'pdfjs-dist 4 抽 PDF 文本层 → 仅对无文本层的扫描件用 RapidOCR / PaddleOCR 3.x', why: '**电子 PDF 有文本层就直接抽取，比 OCR 准且快**；OCR 只兜底扫描件，且中文票据场景 Tesseract.js 准确率仅 70-85%（扫描件对账单约 64%），金额与流水号认错一位即导致对账出错，**输出必须校验、低置信度字段转人工**', swapIf: '纯 API 不接收文件 → 删掉本槽位，不要预置用不到的依赖' },
      { slot: '异步回调', pick: 'Webhook（带签名校验与重试退避）', why: '回调地址是调用方给的，必须签名校验，否则任何人都能伪造完成通知', swapIf: '仅内部系统 → 直接返回结果，不做回调' },
      { slot: '可观测性', pick: 'OpenTelemetry + 结构化 JSON 日志（含 traceId 与 token 消耗）', why: '模型调用链路慢且多段，**没有 traceId 无法定位是哪一段慢**；token 消耗是主要成本项，必须记' },
      { slot: '成本控制', pick: '按调用方限流 + 每日 token 配额 + 超额拒绝', why: '模型调用是直接成本，无限流就是无上限亏损' },
      { slot: '凭据', pick: '环境变量 / 密钥管理服务（不要落库、不要进仓库）', why: '密钥落库或进仓库等于永久泄露，事后清理代价极高；这是安全底线不是优化项', swapIf: '无' },
      { slot: '测试', pick: 'Vitest + nock（mock 模型调用）+ 契约测试', why: '模型输出不确定，必须 mock；契约测试保证升级不破坏调用方' },
    ],
  },

  // ==================================================================
  {
    id: 'unspecified',
    label: '暂不确定（由 AI 建议）',
    summary: '先给形态建议 + 理由，形态定了才给栈',
    slots: [
      { slot: '处理方式', pick: '**本形态不给技术栈**', why: '形态未定就选栈必然返工。此时应给出「建议采用哪种形态 + 理由 + 若选它则大致用什么」，让用户先确认形态' },
      { slot: '建议时的默认基线', pick: '若判断不出特殊需求，倾向推荐 **Web（浏览器页面）**', why: '它零安装、零审核、跨平台，返工成本最低' },
      { slot: '明确劝退的情况', pick: '若用户强需求子「本地文件 / 断网可用 / 装在自己电脑」→ 劝其选桌面；若强需求「拍照 / 扫码 / 现场」→ 劝其选移动端', why: '形态决定能力边界，选错代价很高，值得先问清' },
    ],
  },
]

/** 按 id 取栈定义。 */
export function stackById(id) {
  return TECH_STACKS.find(s => s.id === id) || TECH_STACKS.find(s => s.id === 'unspecified')
}

/**
 * 把栈定义渲染成可内联进 meta-prompt 的文本。
 * @param {object} opts
 * @param {string} opts.deliverable 交付形态 id
 * @param {boolean} [opts.compact] true = 只给 summary + summary 行（STEP2 用，避免 prompt 膨胀）
 * @param {string} [opts.platformStackId] 目标平台对应的栈 id（2026-10-06）。
 *        移动端三套栈由段②「目标平台」题的答案决定；不给时按 `deliverable` 原样取，
 *        对 mobile 而言等价于双端（向后兼容既有行为）。
 */
export function renderTechStack({ deliverable = 'unspecified', compact = false, platformStackId = null } = {}) {
  const useId = platformStackId && TECH_STACKS.some(s => s.id === platformStackId)
    ? platformStackId
    : deliverable
  const st = stackById(useId)
  if (!st) return ''
  const lines = []

  if (st.id === 'unspecified') {
    lines.push('## 技术栈（形态未定，暂不给栈）')
    lines.push('')
    lines.push('用户还没确定交付形态。**此时不要罗列技术栈**，先做形态建议：')
    st.slots.forEach(s => {
      lines.push(`- **${s.slot}**：${s.pick}`)
      if (s.why) lines.push(`  - 理由：${s.why}`)
    })
    lines.push('')
    return lines.join('\n')
  }

  lines.push('## 技术栈（已锁定，不要自由发挥）')
  lines.push('')
  lines.push(`**${st.label}默认栈：${st.summary}**`)
  lines.push('')
  lines.push('以下每一项都已定好。**默认必须照用**，只有满足「何时可换」的条件才能换；')
  lines.push('换了必须在产物的技术清单里写明「因<具体原因>改用<具体库>」。')
  lines.push('')

  if (compact) {
    // STEP2 只需要知道大致用什么来设计方法论，展开全部理由会显著拉长 prompt
    // 并推高推理模型的思考量、挤压正文输出额度（见 MAX_TOKENS 注释里的 maxTokens 陷阱）。
    st.slots.forEach(s => lines.push(`- **${s.slot}**：${s.pick}`))
    lines.push('')
    lines.push('（详细选型理由与「何时可换」条件在生成最终技术清单的那一步给出，此处不必展开。）')
    lines.push('')
  } else {
    st.slots.forEach(s => {
      lines.push(`- **${s.slot}**：${s.pick}`)
      if (s.why) lines.push(`  - 为什么：${s.why}`)
      if (s.swapIf) lines.push(`  - 何时可换：${s.swapIf}`)
    })
    lines.push('')
  }

  lines.push('**版本策略**：')
  VERSION_POLICY.forEach(v => lines.push(`- ${v}`))
  lines.push('')
  lines.push('**一律不要选（跨形态通用）**：')
  NEVER_USE.forEach(v => lines.push(`- ${v}`))
  lines.push('')
  lines.push('**样式层特别提醒**：不要整包安装成套 UI 组件库（Ant Design / Element Plus / MUI /')
  lines.push('shadcn-ui 整包 / Naive UI 等）。它们自带一整套视觉风格与默认间距，会直接架空')
  lines.push('「同屏强色块 ≤ 2、按钮层级 ≤ 3、圆角统一 8px、间距为 8 的倍数」这些硬约束。')
  lines.push('正确做法：选 headless 方案（TanStack Table、Radix 无样式原语）或用原子类（Tailwind），')
  lines.push('组件外观自己实现。')
  lines.push('')
  return lines.join('\n')
}
