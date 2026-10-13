/**
 * PromptAssist · 工作台界面
 * ------------------------------------------------------------------
 * 菜单引导式：欢迎页 → 工作事项表单 → AI 访谈提问 → 生成结果
 * 视觉参考 Claude：暖白底、橙棕强调色、大留白、居中窄栏。
 * 独立应用不依赖 harness 的 CSS 变量，故自带 light/dark 两套色板。
 */

import React, { useState, useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { exportBoth } from './interview-export.js'

const h = React.createElement
const api = window.forge

const T = {
  tab: '技能生成器',
  // ---- 开始菜单 ----
  menuTitle: '选择你要生成什么',
  menuSub: '选一个方向，我们把它做成可复用的提示词资产',
  dirAgent: 'Agent 智能体生成 Prompt',
  dirAgentD: '生成符合 Agent 技能规范的三件套（SKILL.md / workflow.json / 提示词指令），可直接安装调用。',
  dirSoon: '敬请期待',
  changeDir: '换个方向',
  // ---- 交付形态 ----
  deliverable: '交付形态',
  deliverableHint: '你要生成的东西最终以什么形式交付？这决定了流程、约束与验收标准。',
  dWeb: '浏览器 Web 页面',
  dWebD: '打开网址即用',
  dApp: '桌面应用',
  dAppD: '本地安装、可离线',
  dMobile: '移动端 App',
  dMobileD: 'iOS / Android 触屏',
  dMini: '微信小程序',
  dMiniD: '微信内运行，有平台限制',
  dCli: '命令行工具 / 脚本',
  dCliD: '终端执行，可管道组合',
  dApi: '后端服务 / 接口',
  dApiD: '被其他程序调用',
  dUndecided: '暂不确定',
  dUndecidedD: '由 AI 按领域特性建议',
  welcomeTitle: '把一句话，变成一个能干活的智能体',
  welcomeSub: '回答几个问题，我们把它沉淀成可复用的专业技能包',
  feat1: '不靠运气的产出',
  feat1d: '每份技能包都带执行流程、判定阈值和常见陷阱，不是一段泛泛的提示词。',
  feat2: '专业需求问得清',
  feat2d: 'AI 先读懂你的场景，再出 10-15 道专业选择题，把真实需求摸透。',
  feat3: '装上就能用',
  feat3d: '产出符合 Agent 技能规范，落盘即被识别，可以直接调用。',
  start: '开始',
  step1Title: '第一步：定义你要解决的工作事项',
  step1Sub: '给智能体起个名字，定义它要帮你解决的一个具体工作任务',
  whatIs: '什么是「工作事项智能体」？',
  whatIsD: '它专注帮你解决某个领域的一件具体工作——不是全能助手。比如你要做跨境选品决策，就做一个「跨境选品分析师」，只做这件事。',
  focus: '聚焦单一任务目标',
  focusD: '好的任务目标应当是一项可以清晰定义、有明确完成标准的单项任务。「自动核查发票合规性」是好目标；「帮我财务部做所有事」不是。',
  team: '你的名字 / 团队名称',
  teamPh: '填你的姓名或小组名称即可',
  agent: '给智能体起个名字',
  agentPh: '名字最好能一眼看出它要解决什么工作事项',
  domain: '专业领域',
  domainPh: '例：跨境电商选品 / 医疗影像辅助诊断 / 制造业质量检验 / 人力资源招聘筛选',
  background: '任务背景',
  backgroundPh: '谁在做、依据什么材料、目前是怎么做的',
  goals: '目标',
  goalsPh: '这个智能体要帮使用者做到什么',
  pain: '痛点',
  painPh: '当前哪里慢、哪里不稳定、哪里无法复用',
  back: '返回',
  next: '下一步',
  // ---- 第二步：专业知识调研 ----
  step2Title: '第二步：确认你的专业需求',
  step2Sub: '下面是针对你场景的专业调研题',
  // ---- 第三步：智能体交互调研 ----
  step3Title: '第三步：确认智能体的样子',
  step3Sub: '专业需求已经清楚了，现在确定这个智能体怎么做、怎么用',
  qOf: '第 {i} / {n} 题',
  planWhy: 'AI 判断本题需要 {n} 道：{why}',
  planNone: 'AI 判断这个场景问这些就够了',
  unsureHint: '看不懂的选项可以选最后一项「交给 AI 决定」',
  archTitle: '选择工作形态',
  archSub: '这一步决定后续工作流的骨架，请选最贴近的一项',
  archWhy: '工作形态决定后续工作流怎么走。',
  archWhyD: '例如「监测预警」会生成「盯指标 → 触达阈值 → 预警 → 跟踪处置」这样的骨架，而「分析报告」会生成「口径定义 → 取数 → 分析 → 成稿」。选错了后面全歪，所以值得先想清楚。',
  archRec: '推荐',
  archEg: '例如',
  errorArch: '请先选择一个工作形态',
  fillRec: '一键采纳推荐',
  clearRec: '取消选择',
  clear: '清空',
  skip: '跳过这题',
  otherPh: '选填：还有上面没提到的要求？写在这里，没有就跳过',
  build: '生成技能包',
  nextSurvey: '进入下一步调研',
  generating: '正在生成调研题…',
  generatingSub: 'AI 正在基于你的场景设计专业调研题，通常需要十几秒',
  generating2: '正在设计智能体形态…',
  generating2Sub: '会结合你上面选的交付形态和专业答案，给出可行的交互方式',
  building: '正在生成技能包…',
  buildingSub: '会依次产出方法论、工作流和最终指令文档，可能需要一到两分钟',
  doneTitle: '技能包已生成',
  doneSub: '已写入技能目录，可被 DeepSeek Harness 直接加载调用',
  files: '包含文件',
  again: '再生成一个',
  includeAgents: '附带 AGENTS.md（可选，需安装 Git）',
  agentsMdTitle: '关于 AGENTS.md（可选交付物）',
  agentsMdD: '这是给在本项目里工作的 AI 编码助手看的工作约定：要求它先把 AGENTS.md 写入项目根目录、把项目初始化成 Git 仓库、每次改动后都 git commit，便于版本追踪与回滚。需要本机已安装 Git；若你不想用 Git 管理，可直接删除该文件，不影响技能本身使用。',
  view: '打开所在文件夹',
  exportRecord: '导出访谈记录',
  exportHelp: '含工作事项、两段访谈的题与你的选择（含每项理由），用于后续排查与回归测试',
  settings: '设置',
  close: '关闭',
  apiKey: 'DeepSeek API Key',
  apiKeyPh: 'sk-…',
  apiKeyHelp: '留空则自动读取已配置的 ~/.dsh/.credentials.yaml',
  outputDir: '输出目录',
  outputDirHelp: '技能包写入位置，默认 ~/.dsh/skills',
  change: '更改',
  save: '保存',
  saved: '已保存',
  needKey: '未配置 API Key，请先在「设置」中填写',
  errorEmpty: '请先填写带 * 的必填项',
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:#F5F4EF;color:#2E2E2B;font-family:system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
@media (prefers-color-scheme: dark){
  body{background:#1F1E1D;color:#EDEAE4}
  .sg{--sg-bg:#1F1E1D;--sg-surface:#262624;--sg-border:#3D3C39;--sg-text:#EDEAE4;--sg-dim:#A3A099;--sg-accent:#D97757;--sg-accent-h:#C2603F;--sg-err:#E07A5F;--sg-hover:rgba(255,255,255,.05)}
  .sg-opt.on{background:rgba(217,119,87,.12)}
  .sg-note-info{background:rgba(217,119,87,.1);border-color:rgba(217,119,87,.3)}
  .sg-note-warn{background:rgba(217,170,60,.1);border-color:rgba(217,170,60,.3)}
  .sg-btn-ghost:hover{background:rgba(255,255,255,.06)}
}
.sg{--sg-bg:#F5F4EF;--sg-surface:#fff;--sg-border:#E5E3DC;--sg-text:#2E2E2B;--sg-dim:#6B6B65;--sg-accent:#C96442;--sg-accent-h:#B0523A;--sg-err:#C0392B;--sg-hover:rgba(0,0,0,.04);color:var(--sg-text);max-width:820px;margin:0 auto;padding:0 28px 56px}
.sg-hero{text-align:center;padding:64px 0 44px}
.sg-hero h1{font-size:31px;line-height:1.3;font-weight:600;margin:0 0 12px;letter-spacing:-.01em}
.sg-hero p{font-size:15px;color:var(--sg-dim);margin:0 0 30px}
.sg-btn{appearance:none;font:inherit;font-size:14px;font-weight:500;border:1px solid transparent;border-radius:8px;padding:9px 20px;cursor:pointer;background:var(--sg-accent);color:#fff;transition:background .15s}
.sg-btn:hover:not(:disabled){background:var(--sg-accent-h)}
.sg-btn:disabled{opacity:.45;cursor:default}
.sg-btn-ghost{background:transparent;color:var(--sg-text);border-color:var(--sg-border)}
.sg-btn-ghost:hover:not(:disabled){background:var(--sg-hover)}
.sg-btn-sm{padding:6px 13px;font-size:13px}
/* ⚠️ 这里原本还有一版 .sg-cards / .sg-card 旧规则（3 列 auto-fit + .sg-card b/span），
   2026-10-11 已删除。原因有二：
     ① 与新规则并存，同名选择器靠「后者胜」生效，**极难排查**；
     ② .sg-card span 会命中图标容器里的文字，导致选中态图标样式异常。 */
.sg-h2{font-size:21px;font-weight:600;margin:0 0 4px;letter-spacing:-.01em}
.sg-sub{font-size:14px;color:var(--sg-dim);margin:0 0 22px}
.sg-note{border-radius:10px;padding:14px 16px;margin-bottom:14px;font-size:13px;line-height:1.6}
.sg-note b{display:block;margin-bottom:5px;font-size:13.5px}
.sg-note-info{background:rgba(201,100,66,.07);border:1px solid rgba(201,100,66,.22)}
.sg-note-warn{background:rgba(201,150,40,.09);border:1px solid rgba(201,150,40,.28)}
.sg-field{margin-bottom:17px}
.sg-field label{display:block;font-size:13.5px;font-weight:600;margin-bottom:6px}
.sg-req{color:var(--sg-accent);margin-left:2px}
.sg-field input,.sg-field textarea{width:100%;border:1px solid var(--sg-border);border-radius:8px;background:var(--sg-surface);color:var(--sg-text);font:inherit;font-size:14px;padding:10px 12px;outline:none;transition:border-color .15s}
.sg-field input:focus,.sg-field textarea:focus{border-color:var(--sg-accent)}
.sg-field textarea{resize:vertical;min-height:66px;line-height:1.55}
.sg-help{font-size:12.5px;color:var(--sg-dim);margin-top:5px}
.sg-check{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sg-dim);margin:14px 0 2px;cursor:pointer;user-select:none}
.sg-check input{width:16px;height:16px;accent-color:var(--sg-accent);cursor:pointer}
.sg-bar{display:flex;align-items:center;gap:10px;margin:28px 0 20px;font-size:12px;color:var(--sg-dim)}
.sg-bar i{width:28px;height:3px;border-radius:2px;background:var(--sg-border);display:block}
.sg-bar i.on{background:var(--sg-accent)}
.sg-q{border:1px solid var(--sg-border);border-radius:12px;padding:20px;background:var(--sg-surface)}
.sg-q-t{font-size:15.5px;font-weight:600;margin-bottom:4px;line-height:1.5}
.sg-q-h{font-size:12.5px;color:var(--sg-dim);margin-bottom:14px}
.sg-dim{display:inline-block;margin-bottom:8px;font-size:11.5px;line-height:1.7;color:var(--sg-accent);border:1px solid var(--sg-accent);border-radius:20px;padding:0 9px}
.sg-text{width:100%;border:1px solid var(--sg-border);border-radius:8px;background:var(--sg-surface);color:var(--sg-text);font:inherit;font-size:14px;padding:10px 12px;outline:none;resize:vertical;min-height:70px;line-height:1.55;transition:border-color .15s}
.sg-text:focus{border-color:var(--sg-accent)}
.sg-opt{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--sg-border);border-radius:8px;margin-bottom:8px;cursor:pointer;font-size:14px;line-height:1.5;transition:border-color .12s,background .12s}
.sg-opt:hover{border-color:var(--sg-accent)}
.sg-opt.on{border-color:var(--sg-accent);background:rgba(201,100,66,.06)}
.sg-opt input{margin:3px 0 0;flex:none;accent-color:var(--sg-accent)}
.sg-opts{max-height:330px;overflow-y:auto;padding-right:4px;margin:-2px 0}

/* ---- 工作形态卡片 · 独立步骤（2026-10-11 第二版）----
 * 用户实测反馈第一版「很丑、字太多、眼花缭乱」——根因是卡片正文取了
 * 模型生成的 note，模型会写 3-4 行长句。第二版改法：
 *   ① 只用我们自己的短字段（icon / keyword / example），长度固定可控
 *   ② 4 列网格 → 12 张卡一屏看完，不再滚动
 *   ③ 例子收进 hover 浮层 → 默认状态视觉干净，需要时才出现
 *   ④ 卡片区不设 max-height（加了滚动就失去「一屏看完」的意义）
 */
.sg-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0 18px}
/* 3 张卡的网格：4 列网格放 3 张卡会空一列、整体左偏（Welcome 特性卡踩过的坑） */
.sg-cards.sg-cards-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.sg-card{appearance:none;font:inherit;text-align:left;cursor:pointer;position:relative;
  border:1px solid var(--sg-border);border-radius:12px;padding:14px 14px 13px;
  background:var(--sg-surface);color:var(--sg-text);
  transition:border-color .15s,box-shadow .15s,transform .15s}
.sg-card:hover{border-color:var(--sg-accent);box-shadow:0 4px 14px rgba(180,110,80,.14);transform:translateY(-2px)}
.sg-card.on{border-color:var(--sg-accent);background:#fdf6f2;box-shadow:0 0 0 1px var(--sg-accent)}
/* focus-visible 保留键盘可达性，不能被 outline:none 抹掉 */
.sg-card:focus-visible{outline:2px solid var(--sg-accent);outline-offset:2px}
.sg-card-ico{width:30px;height:30px;border-radius:8px;background:#f4ece6;display:flex;
  align-items:center;justify-content:center;font-size:16px;margin-bottom:9px;line-height:1}
/* ⚠️ 不要用 filter: brightness(0) invert(1) 把 emoji 图标「染白」——
   那会把彩色 emoji 变成纯白块（用户反馈「图标会变白」），因为 emoji 是位图不受 currentColor 控制。
   正确做法：保持图标原样，只换图标容器的底色（浅橘底 + 原有彩色图标依然可辨）。 */
.sg-card.on .sg-card-ico{background:#f4dcd0}
.sg-card-t{font-size:13.5px;font-weight:600;margin:0 0 5px;letter-spacing:.01em;line-height:1.35}
.sg-card-kw{font-size:12px;color:var(--sg-dim);line-height:1.5;margin:0}
/* 例子：默认隐藏，hover 卡片时在卡片上方浮出（放上方是因为卡片区在页面中部，
   下方浮出会被视口底部裁掉） */
.sg-card-ex{position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%) scale(.97);
  background:#2b2724;color:#f5f1ec;border-radius:8px;padding:7px 11px;font-size:11.5px;
  line-height:1.5;width:200px;opacity:0;pointer-events:none;transition:all .16s;z-index:20;
  box-shadow:0 6px 20px rgba(0,0,0,.22)}
.sg-card-ex b{color:#e8a87c;font-weight:600}
.sg-card:hover .sg-card-ex{opacity:1;transform:translateX(-50%) scale(1)}
/* ⚠️ 原本写 .sg-card.on .sg-card-ex{opacity:0}，导致**选中后 hover 就不再显示例子**
   （用户反馈）。已删除该规则：卡片选中与否都应能看例子——那正是解释「这形态干什么活」的关键信息。 */
.card-rec{position:absolute;top:11px;right:11px}
.sg-card.on .card-rec .sg-rec{background:var(--sg-accent);color:#fff}
@media (max-width:900px){.sg-cards{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:640px){.sg-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
.sg-opts::-webkit-scrollbar{width:8px}
.sg-opts::-webkit-scrollbar-thumb{background:var(--sg-border);border-radius:4px}
.sg-opt-txt{flex:1;min-width:0}
.sg-opt-txt small{display:block;margin-top:3px;font-size:12px;line-height:1.45;color:var(--sg-dim)}
.sg-opt.rec{border-color:var(--sg-accent);background:rgba(201,100,66,.05)}
.sg-rec{display:inline-block;margin-left:7px;font-size:11px;line-height:1.6;color:var(--sg-accent);border:1px solid var(--sg-accent);border-radius:20px;padding:0 7px;white-space:nowrap;vertical-align:1px}
.sg-foot{display:flex;justify-content:space-between;gap:12px;margin-top:22px;align-items:center}
.sg-msg{font-size:13px;margin:0}
.sg-err{color:var(--sg-err)}
.sg-center{text-align:center;padding:72px 0}
.sg-spin{width:26px;height:26px;border:2.5px solid var(--sg-border);border-top-color:var(--sg-accent);border-radius:50%;margin:0 auto 18px;animation:sg-rot .7s linear infinite}
@keyframes sg-rot{to{transform:rotate(360deg)}}
.sg-ok{width:48px;height:48px;border-radius:50%;background:rgba(52,168,83,.13);color:#2E9E4F;font-size:25px;display:flex;align-items:center;justify-content:center;margin:0 auto 16px}
.sg-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;background:var(--sg-bg);border:1px solid var(--sg-border);border-radius:8px;padding:11px 13px;word-break:break-all;text-align:left;color:var(--sg-dim);margin:14px 0 20px}
/* 欢迎页方向卡片：max-width 与 margin:auto 让它在容器内居中。
   用户实测「界面不正、偏左」——原因是 auto-fit 在宽容器里按 minmax 下限排布，
   列数由宽度决定，右侧留下大片空白而左侧紧贴内容。改为固定 3 列 + 显式居中。 */
/* ⭐ 布局统一（2026-10-11，用户三次反馈「界面不正、偏左」后定位的真根因）：
   之前 .sg-top 撑满 .sg 内容区（764px）做 space-between，而 .sg-dirs 只有 max-width:660px
   且自带 margin:0 auto —— **两者宽度不同，各自居中后就错位了**，
   顶栏在 764 的中心、卡片在 660 的中心，视觉上就是歪的。
   修法：**统一宽度，都撑满父容器**，居中交给父级 .sg（max-width:820 + margin:auto），
   这样内部所有区块天然对齐，不再依赖每个子元素各自居中。 */
.sg-dirs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;text-align:left}
/* 分发版只剩一个入口时，auto-fit 会让单卡铺满 660px 显得空旷。
   限制成 380px 并居中，观感接近原来「两卡并列」时的宽度。 */
.sg-dirs:has(> :only-child){grid-template-columns:minmax(0,380px);justify-content:center}
.sg-dir{appearance:none;font:inherit;text-align:left;cursor:pointer;border:1px solid var(--sg-border);border-radius:12px;padding:16px 18px;background:var(--sg-surface);color:var(--sg-text);transition:border-color .14s,background .14s}
.sg-dir:not(:disabled):hover{border-color:var(--sg-accent)}
.sg-dir-h{display:flex;align-items:center;gap:8px;margin-bottom:5px}
.sg-dir-h b{font-size:14.5px;font-weight:500}
.sg-dir p{margin:0;font-size:13px;color:var(--sg-dim);line-height:1.55}
.sg-dir.off{opacity:.5;cursor:default}
.sg-tag{margin-left:auto;font-size:11.5px;color:var(--sg-dim);border:1px solid var(--sg-border);border-radius:20px;padding:1px 9px;white-space:nowrap}
.sg-dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.sg-dl-item{appearance:none;font:inherit;cursor:pointer;text-align:left;border:1px solid var(--sg-border);border-radius:9px;padding:9px 11px;background:var(--sg-surface);color:var(--sg-text);transition:border-color .12s,background .12s}
.sg-dl-item:hover{border-color:var(--sg-accent)}
.sg-dl-item.on{border-color:var(--sg-accent);background:rgba(201,100,66,.07)}
.sg-dl-item b{display:block;font-size:13px;font-weight:500;margin-bottom:2px}
.sg-dl-item span{font-size:11.5px;color:var(--sg-dim)}
.sg-files{text-align:left;margin:0 0 20px}
.sg-files div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 13px;border:1px solid var(--sg-border);border-radius:8px;margin-bottom:7px;font-size:13.5px;background:var(--sg-surface)}
.sg-files button{appearance:none;font:inherit;font-size:12.5px;background:transparent;border:none;color:var(--sg-accent);cursor:pointer;padding:0}
.sg-top{display:flex;justify-content:space-between;align-items:center;padding:18px 0 0}
.sg-top b{font-size:14px;font-weight:600;letter-spacing:-.01em}
.sg-mask{position:fixed;inset:0;background:rgba(0,0,0,.32);display:flex;align-items:flex-start;justify-content:center;padding-top:12vh;z-index:50}
.sg-modal{background:var(--sg-surface);border:1px solid var(--sg-border);border-radius:14px;width:min(520px,92vw);padding:22px}

/* ---- 页面切换动画（2026-10-08）----
 * 为什么必须用 key 而不是纯 CSS transition：
 *   React 切 view 是**直接把旧 DOM 换掉**，浏览器没有「旧页淡出」这个中间状态，
 *   所以 transition 对它无效。必须给每次切换生成一个递增 key，
 *   让 React 认为「换了个新元素」，重新挂载并触发 CSS animation。
 *
 * 方向感：next = 新页从右滑入（像向前推进）；back = 从左滑入（像往回走）。
 * 只做位移+淡入，不做花哨翻转 —— 工作台是长时间盯着的界面，动效要克制。
 */
.sg-view{animation:sg-in .22s cubic-bezier(.2,.7,.3,1) both}
.sg-view.sg-back{animation-name:sg-in-back}
@keyframes sg-in{from{opacity:0;transform:translate3d(10px,0,0)}to{opacity:1;transform:none}}
@keyframes sg-in-back{from{opacity:0;transform:translate3d(-10px,0,0)}to{opacity:1;transform:none}}
/* 设置弹层也走淡入 */
.sg-mask{animation:sg-fade .16s ease-out both}
@keyframes sg-fade{from{opacity:0}to{opacity:1}}
/* ⚠️ 前庭功能障碍/动效敏感的用户：关掉动画（WCAG 2.3.3 Motion Animation） */
@media (prefers-reduced-motion:reduce){
  .sg-view,.sg-view.sg-back,.sg-mask{animation:none}
  .sg-spin{animation:none}
}
.sg-modal h3{margin:0 0 16px;font-size:16px;font-weight:600}
.sg-row{display:flex;gap:8px;align-items:center}
.sg-row input{flex:1}
:disabled{opacity:.5}
:focus-visible{outline:2px solid var(--sg-accent);outline-offset:2px}
`

// ---------------- 视图 ----------------

// ---- 开始菜单：方向选择 ----
const DELIVERABLES = [
  ['dWeb', 'dWebD'], ['dApp', 'dAppD'], ['dMobile', 'dMobileD'],
  ['dMini', 'dMiniD'], ['dCli', 'dCliD'], ['dApi', 'dApiD'], ['dUndecided', 'dUndecidedD'],
]
// 分发版只保留真正能用的入口。
// 「工作流 / 自动化 Prompt」「分析报告 Prompt」两项是占位（enabled: false），
// 界面上显示为灰色「敬请期待」卡片——分发给别人时，**不能给用户看到点不动的按钮**：
// 它会被当成「这软件坏了」或「他连这个都没做」，直接影响可信度。
// 需要恢复时把这两项加回来即可（连同 T.dirSoon 文案与 .sg-dir.off 样式）。
const DIRECTIONS = [
  { id: 'agent-skill', labelKey: 'dirAgent', descKey: 'dirAgentD', enabled: true },
]

function StartMenu({ onPick, onSettings, hasKey }) {
  return h('div', null,
    h('div', { className: 'sg-top' },
      h('b', null, 'PromptAssist'),
      h('button', { className: 'sg-btn sg-btn-ghost sg-btn-sm', onClick: onSettings }, T.settings)),
    !hasKey ? h('div', { className: 'sg-note sg-note-warn', style: { marginTop: '18px' } },
      h('b', null, T.needKey),
      h('button', { className: 'sg-btn sg-btn-sm', style: { marginTop: '8px' }, onClick: onSettings }, T.settings)) : null,
    h('div', { className: 'sg-hero' },
      h('h1', null, T.menuTitle),
      h('p', null, T.menuSub),
      h('div', { className: 'sg-dirs' },
        DIRECTIONS.map(d => h('button', {
          key: d.id,
          className: 'sg-dir' + (d.enabled ? '' : ' off'),
          disabled: !d.enabled,
          onClick: () => d.enabled && onPick(d.id),
        },
          h('div', { className: 'sg-dir-h' },
            h('b', null, d.labelKey ? T[d.labelKey] : d.label),
            !d.enabled ? h('span', { className: 'sg-tag' }, T.dirSoon) : null),
          h('p', null, d.descKey ? T[d.descKey] : d.desc)))),
    ),
  )
}

function Welcome({ onStart, onBack, onSettings, hasKey }) {
  const feats = [[T.feat1, T.feat1d], [T.feat2, T.feat2d], [T.feat3, T.feat3d]]
  return h('div', null,
    h('div', { className: 'sg-top' },
      h('b', null, 'PromptAssist'),
      h('button', { className: 'sg-btn sg-btn-ghost sg-btn-sm', onClick: onSettings }, T.settings),
    ),
    !hasKey ? h('div', { className: 'sg-note sg-note-warn', style: { marginTop: '18px' } }, h('b', null, T.needKey),
      h('button', { className: 'sg-btn sg-btn-sm', style: { marginTop: '8px' }, onClick: onSettings }, T.settings)) : null,
    h('div', { className: 'sg-hero' },
      h('h1', null, T.welcomeTitle),
      h('p', null, T.welcomeSub),
      // ⭐ 3 张特性卡必须用 3 列（.sg-cards 是 4 列，给形态步 12 张卡用的）：
      //   4 列 × 3 张卡 = 第 4 列空着 → 卡片整体左偏、右侧留白。
      //   用户四次反馈「界面偏左」的真根因就是这个 —— 我前三次修的全是别的组件
      //   （StartMenu 的 .sg-dirs 和形态步），Welcome 一次都没碰过。
      h('div', { className: 'sg-cards sg-cards-3' },
        feats.map(([b, s], i) => h('div', { className: 'sg-card', key: i }, h('b', null, b), h('span', null, s)))),
      h('div', { style: { marginTop: '32px', display: 'flex', gap: '10px', justifyContent: 'center' } },
        h('button', { className: 'sg-btn sg-btn-ghost', onClick: onBack }, T.changeDir),
        h('button', { className: 'sg-btn', onClick: onStart, disabled: !hasKey }, T.start)),
    ),
  )
}

function TaskForm({ form, setForm, onBack, onNext, busy, error, includeAgentsMd, setIncludeAgentsMd }) {
  const patch = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const field = (key, label, help, placeholder, multiline) => h('div', { className: 'sg-field', key },
    h('label', null, label, h('span', { className: 'sg-req' }, '*')),
    multiline
      ? h('textarea', { value: form[key], placeholder, onChange: e => patch(key, e.target.value) })
      : h('input', { value: form[key], placeholder, onChange: e => patch(key, e.target.value) }),
    help ? h('div', { className: 'sg-help' }, help) : null)
  return h('div', null,
    h('div', { className: 'sg-bar' }, h('i', { className: 'on' }), h('i', { className: 'on' }), h('i'), h('i')),
    h('h2', { className: 'sg-h2' }, T.step1Title),
    h('p', { className: 'sg-sub' }, T.step1Sub),
    h('div', { className: 'sg-note sg-note-info' }, h('b', null, T.whatIs), T.whatIsD),
    h('div', { className: 'sg-note sg-note-warn' }, h('b', null, T.focus), T.focusD),
    h('div', { className: 'sg-field' },
      h('label', null, T.deliverable, h('span', { className: 'sg-req' }, '*')),
      h('div', { className: 'sg-dl' },
        DELIVERABLES.map(([k, d]) => h('button', {
          key: k,
          type: 'button',
          className: 'sg-dl-item' + (form.deliverable === T[k] ? ' on' : ''),
          onClick: () => patch('deliverable', T[k]),
        },
          h('b', null, T[k]),
          h('span', null, T[d])))),
      h('div', { className: 'sg-help' }, T.deliverableHint)),
    field('teamName', T.team, T.teamPh, '', false),
    field('agentName', T.agent, T.agentPh, '', false),
    field('domain', T.domain, null, T.domainPh, false),
    field('taskBackground', T.background, null, T.backgroundPh, true),
    field('goals', T.goals, null, T.goalsPh, true),
    field('painPoints', T.pain, null, T.painPh, true),
    h('label', { className: 'sg-check', title: T.agentsMdD },
      h('input', { type: 'checkbox', checked: includeAgentsMd, onChange: e => setIncludeAgentsMd(e.target.checked) }),
      h('span', null, T.includeAgents)),
    h('div', { className: 'sg-foot' },
      h('button', { className: 'sg-btn sg-btn-ghost', onClick: onBack, disabled: busy }, T.back),
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        error ? h('p', { className: 'sg-msg sg-err' }, error) : null,
        h('button', { className: 'sg-btn', onClick: onNext, disabled: busy }, T.next))),
  )
}

/**
 * 访谈组件（两段共用）
 * - stage：knowledge | interaction，决定标题文案与进度条位置
 * - text 题渲染为输入框（选填）
 * - 选择题支持「一键采纳推荐」
 * - 展示 AI 给的题数建议与理由（plan.rationale）
 */
/**
 * 工作形态卡片（2026-10-11）
 *
 * ## 为什么单独做组件而不是复用列表
 * 那道「工作形态」题有 12 个选项（受控词表全量），纵向列表要滚很久。
 * 卡片网格一屏能看完，且每张卡能放「一句话说明」——列表里放不下这些。
 *
 * ## ⚠️ 识别方式：按「选项数 ≥ 10」判断，不硬编码 archetype id
 * 若按 id 数组判断，一旦模型少给两项（违反 prompt 规则 a），界面就会退化成
 * 12 张卡变 10 张卡 + 一段孤立列表，视觉断裂。**用数量特征判断，
 * 模型少给就自动退回普通列表**，这是更稳的降级。
 */
/**
 * 工作形态数据（2026-10-11）
 *
 * ⚠️ **为什么在这里硬编码，而不是从 core 动态取**：
 * core 是 Node 模块，renderer 是浏览器环境，无法 import（插件端更严格——
 * 它是 __ModuleLoader__ 的 factory 形式）。这份数据是**静态词表**（12 项不会变），
 * 内联两处成本可接受；真正需要「唯一事实来源」的是 core 里的骨架与推荐逻辑。
 * 两处一致性由 `.verify/check-archetype-cards.mjs` 断言保证。
 *
 * ⚠️ icon/keyword/example 是**我们自己维护的短字段**，不用模型生成的 note ——
 * 用户实测反馈第一版「很丑、字太多、眼花缭乱」，根因就是 note 长度不受控
 * （模型会写 3-4 行长句，见真实截图）。
 */
const ARCH_CARDS = [{"id":"role_audit","label":"审计核查","icon":"🔍","keyword":"按准则取证、出结论意见","example":"盘点存货并出具盘点报告"},{"id":"role_estimation","label":"测算评估","icon":"📐","keyword":"定量测算、给适用条件","example":"测算新设备投资回收期"},{"id":"role_compliance","label":"合规核查","icon":"✓","keyword":"逐条比对规则、标差距","example":"核查发票合规性并列出问题"},{"id":"role_report","label":"分析报告","icon":"📊","keyword":"从数据出结论与图表","example":"输出季度经营分析报告"},{"id":"role_decision","label":"决策支持","icon":"⚖","keyword":"比选方案、给建议条件","example":"比选三套设备采购方案"},{"id":"role_control","label":"流程控制","icon":"⚙","keyword":"定标准、跟状态、处理异常","example":"跟踪合同审批进度并催办"},{"id":"role_data","label":"数据处理","icon":"🗂","keyword":"加工原始数据、对质量负责","example":"清洗订单数据并输出台账"},{"id":"role_content","label":"内容生产","icon":"✎","keyword":"把素材做成结构化成稿","example":"起草一份项目立项报告"},{"id":"role_eval","label":"评估打分","icon":"⭐","keyword":"按指标体系打分定级","example":"按评分表给供应商评级"},{"id":"role_design","label":"设计创作","icon":"◨","keyword":"从需求到具体设计并自检","example":"设计一套报账流程界面"},{"id":"role_monitor","label":"监测预警","icon":"◉","keyword":"持续盯指标、触达即预警","example":"盯股价跌破预警线并提醒"},{"id":"role_dev","label":"开发实现","icon":"⚑","keyword":"把需求变成可运行实现","example":"实现一个对账脚本工具"}]

/** 形态推荐关键词（与 core/archetypes.js 的 ARCHETYPE_HINTS 保持一致） */
const ARCH_HINTS = {
  role_audit: ['审计', '盘点', '取证', '复核', '鉴证', '底稿'],
  role_estimation: ['测算', '评估', '估价', '定量', '金额', '成本'],
  role_compliance: ['合规', '监管', '法规', '内控', '制度', '规范', '条例', '年检'],
  role_report: ['报告', '分析', '报表', '总结', '梳理', '汇报', '洞察'],
  role_decision: ['决策', '建议', '选型', '比选', '方案', '取舍', '拍板'],
  role_control: ['流程', '审批', '流转', '跟踪', '进度', '催办', '状态'],
  role_data: ['数据', '清洗', '录入', '台账', '整理', '转换', '字段'],
  role_content: ['撰写', '起草', '文案', '成稿', '编制'],
  role_eval: ['评分', '打分', '评级', '评估表', '考核'],
  role_design: ['设计', '界面', '原型', '布局', '视觉'],
  role_monitor: ['监控', '预警', '盯', '监测', '告警', '看板'],
  role_dev: ['开发', '实现', '代码', '脚本', '自动化', '工具', '小程序'],
  // ⚠️ 2026-11用户反馈「进入工作形态里以后没有推荐」。实测根因：
  //   用户填的「财务」这类**领域名**不在任何形态的词表里 → suggestArchetype 返回 null
  //   → 12 张卡按词表原序铺开，没有任何推荐标记。
  //   词表原来只覆盖「做什么」（动词+宾语），没覆盖「哪个领域」。
  //   补一批「领域 → 默认形态」的弱映射：权重低（len=2），只在没有更强命中时兜底。
  role_data: ['财务', '记账', '账单', '报销', '应收', '应付', '台账', '对账', '清单'],
  role_report: ['运营', '市场', '销售', '经营', '统计'],
  role_eval: ['人事', '绩效', '招聘', '考核'],
  role_content: ['宣传', '文案', '编辑', '内容运营'],
}

/**
 * 从已填的工作事项启发式推荐形态。
 * ⚠️ 这是**兜底推荐，不是模型判断** —— 形态选择提前到问卷之前，
 * 此时问卷答案还不存在，只能靠关键词匹配。它的作用是给用户一个默认落点，
 * 而不是替用户决定；匹配不上就不推荐（宁可盲选也不给错的默认项）。
 * 计分 = 所有命中词长度求和（只取最长词会让「多词命中」输给「单词命中」）。
 */
function suggestArchetype(form) {
  const text = [form && form.domain, form && form.agentName, form && form.taskBackground,
    form && form.goals, form && form.painPoints, form && form.skillLibrary]
    .filter(Boolean).join(' ').toLowerCase()
  if (!text.trim()) return null
  let best = null
  let bestScore = 0
  for (const c of ARCH_CARDS) {
    let score = 0
    for (const k of ARCH_HINTS[c.id] || []) {
      if (text.includes(k.toLowerCase())) score += k.length
    }
    if (score > bestScore) { best = c; bestScore = score }
  }
  return best ? best.id : null
}

/**
 * 工作形态独立步骤（2026-10-11）
 *
 * ## 为什么要单独一步（而不是问卷第 1 题）
 * 用户明确要求：形态选择独立成一步，**不放进问卷**。
 * 好处很实在：12 张卡不再挤在「1/9 题」的位置里，用户点下一步第一眼就是它；
 * 而且形态定了之后，后面的问卷可以基于它收敛。
 *
 * ## ⚠️ 代价：推荐能力被削弱，必须诚实对待
 * 原来 prompt 里要求「根据前面各题的用户回答判断最贴近的一项」——
 * 独立成步时问卷答案还不存在，那条能力必然丢失。
 * 替代方案是 `suggestArchetype(form)`：从**已填的 brief**（领域/背景/目标/痛点）
 * 做关键词匹配。**这是启发式不是模型判断**，准确率有限，只作为默认落点。
 *
 * ## ⚠️ 推荐项必须置顶（用户硬要求）
 * 12 张卡里推荐项若排在第 8 位，用户会先滚动去找它，等于没有推荐。
 * 所以 `orderCards()` 把推荐项提到第一位，其余保持词表原序。
 */
function orderCards(cards, suggestedId) {
  if (!suggestedId) return cards
  const hit = cards.find(c => c.id === suggestedId)
  return hit ? [hit, ...cards.filter(c => c.id !== suggestedId)] : cards
}

function ArchetypeStep({ form, value, onPick, onBack, onNext, busy, error, aiSuggestion }) {
  // ⭐ 推荐优先用 **AI** 的判断（用户要求：以前就是 AI 推荐的，别退回启发式）。
  // AI 不可用时才用本地启发式兜底 —— 两者都拿不到就不推荐，绝不硬猜。
  const aiId = aiSuggestion && aiSuggestion.id
  const suggested = aiId || suggestArchetype(form)
  const aiReason = aiSuggestion && !aiSuggestion.fallback ? aiSuggestion.reason : ''
  // 推荐项置顶；无推荐时保持词表原序
  const cards = orderCards(ARCH_CARDS, suggested)
  return h('div', null,
    h('div', { className: 'sg-bar' },
      h('i', { className: 'on' }), h('i', { className: 'on' }), h('i', { className: 'on' })),
    h('h2', { className: 'sg-h2' }, T.archTitle),
    h('p', { className: 'sg-sub' }, T.archSub),
    h('div', { className: 'sg-note sg-note-info' },
      h('b', null, T.archWhy), T.archWhyD,
      // AI 推荐时把理由也说出来，用户才能判断该不该采纳
      aiReason ? h('div', { style: { marginTop: '6px' } },
        h('b', null, 'AI 推荐：'), aiReason) : null),
    h('div', { className: 'sg-cards' },
      cards.map(c => {
        const on = value === c.id
        const isRec = c.id === suggested
        return h('button', {
          key: c.id,
          type: 'button',
          className: 'sg-card' + (on ? ' on' : ''),
          onClick: () => onPick(c.id),
          'aria-pressed': on,
        },
          isRec ? h('span', { className: 'sg-rec' }, T.archRec) : null,
          h('div', { className: 'sg-card-ico' }, c.icon),
          h('p', { className: 'sg-card-t' }, c.label),
          h('p', { className: 'sg-card-kw' }, c.keyword),
          h('div', { className: 'sg-card-ex' }, T.archEg, h('b', null, c.example)))
      })),
    h('div', { className: 'sg-foot' },
      h('button', { className: 'sg-btn sg-btn-ghost', onClick: onBack, disabled: busy }, T.back),
      h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
        error ? h('p', { className: 'sg-msg sg-err' }, error) : null,
        h('button', { className: 'sg-btn', onClick: onNext, disabled: busy || !value }, T.next))))
}

function Interview({ stage, title, sub, plan, questions, answers, setAnswers, onBack, onDone, onSkip, busy, error }) {
  const [idx, setIdx] = useState(0)
  const q = questions[idx]
  if (!q) return null
  const set = v => setAnswers(a => ({ ...a, [q.id]: v }))
  const multi = q.type === 'multiple'
  const isText = q.type === 'text'
  const current = answers[q.id]
  const answered = isText
    ? typeof current === 'string' && current.trim().length > 0
    : multi ? Array.isArray(current) && current.length > 0 : current !== undefined
  const toggle = (value, on) => {
    const list = Array.isArray(current) ? current : []
    set(on ? list.concat([value]) : list.filter(v => v !== value))
  }
  const options = q.type === 'boolean'
    ? [true, false].map(v => h('label', { className: 'sg-opt' + (current === v ? ' on' : ''), key: String(v) },
        h('input', { type: 'radio', name: q.id, checked: current === v, onChange: () => set(v) }),
        h('span', null, v ? '是' : '否')))
    : (q.options || []).map(o => {
        const on = multi ? (Array.isArray(current) ? current : []).indexOf(o.value) !== -1 : current === o.value
        return h('label', { className: 'sg-opt' + (on ? ' on' : '') + (o.recommended ? ' rec' : ''), key: o.value },
          h('input', { type: multi ? 'checkbox' : 'radio', name: q.id, checked: on, onChange: () => (multi ? toggle(o.value, !on) : set(o.value)) }),
          h('div', { className: 'sg-opt-txt' },
            h('span', null, o.label, o.recommended ? h('span', { className: 'sg-rec' }, '推荐') : null),
            o.note ? h('small', null, o.note) : null))
      })

  const isLast = idx === questions.length - 1
  const isLong = (q.options || []).length > 6
  // 工作形态题（12 项受控词表全量）走卡片；其余题走列表。
  // 判据是「选项数 ≥ 10」而非 id 硬编码 —— 模型少给几项时自动退回列表，不视觉断裂。
  const isArchetypeQ = !multi && (q.options || []).length >= 10
  const hasUnsure = (q.options || []).some(o => o.value === '__unsure__')
  // 一键采纳：单选取 recommended 项；多选取所有 recommended，没有则全选
  const canFill = q.type !== 'boolean' && !isText &&
    (multi || (q.options || []).some(o => o.recommended))
  // 一键采纳 / 再点一次取消（2026-10-08）
  //
  // 三个问题，与插件端 `client.js` 的同名函数保持一致（两份逻辑必须同步）：
  // ① 多选时 `opts.map(o => o.value)` 把兜底项 `🤷不清楚，交给 AI 决定` 也勾上了 ——
  //    它语义上与其他选项**互斥**（选了它等于说「我不懂，你替我定」，同时又勾一堆
  //    具体项就是自相矛盾），必须排除。
  // ② 无 recommended 时退化成「全选」，兜底项同样被勾上 —— 更糟，用户会以为 AI
  //    推荐了全部。改为：**无推荐项时只排除兜底项，不要全选**。
  // ③ 点第二次是幂等的 set(同样的值)，用户按了没反应 → 改成「再点一次清空」。
  const fillRecommended = () => {
    const opts = q.options || []
    const unsureVal = '__unsure__'
    if (!multi) {
      const rec = opts.find(o => o.recommended)
      if (!rec) return
      set(current === rec.value ? undefined : rec.value)
      return
    }
    // ⚠️ 兜底项永远排除：它与所有具体项互斥
    const pool = opts.filter(o => o.value !== unsureVal)
    const recs = pool.filter(o => o.recommended).map(o => o.value)
    const target = recs.length ? recs : pool.map(o => o.value)
    const cur = Array.isArray(current) ? current : []
    const same = cur.length === target.length && target.every(v => cur.includes(v))
    set(same ? [] : target)
  }

  // 当前选择是否已等于「一键采纳」的目标（用于按钮文案切换）
  const isRecApplied = () => {
    const opts = q.options || []
    const rec = opts.find(o => o.recommended)
    if (!rec) return false
    if (!multi) return current === rec.value
    const pool = opts.filter(o => o.value !== '__unsure__')
    const recs = pool.filter(o => o.recommended).map(o => o.value)
    const target = recs.length ? recs : pool.map(o => o.value)
    const cur = Array.isArray(current) ? current : []
    return cur.length === target.length && target.every(v => cur.includes(v))
  }
  return h('div', null,
    h('div', { className: 'sg-bar' },
      h('i', { className: 'on' }), h('i', { className: 'on' }),
      h('i', { className: stage === 'knowledge' ? 'on' : '' }),
      h('i', { className: stage === 'interaction' ? (isLast ? 'on' : '') : '' }),
      h('i', { className: stage === 'interaction' && isLast ? 'on' : '' })),
    h('h2', { className: 'sg-h2' }, title),
    h('p', { className: 'sg-sub' }, sub + '　·　' + T.qOf.replace('{i}', idx + 1).replace('{n}', questions.length)),
    plan && plan.rationale
      ? h('div', { className: 'sg-note sg-note-info' },
          h('b', null, T.planWhy.replace('{n}', String(plan.count || questions.length)).replace('{why}', plan.rationale)))
      : null,
    h('div', { className: 'sg-q' },
      q.dimension ? h('div', { className: 'sg-dim' }, q.dimension) : null,
      h('div', { className: 'sg-q-t' }, q.label, q.required && !isText ? h('span', { className: 'sg-req' }, '*') : null),
      q.help ? h('div', { className: 'sg-q-h' }, q.help) : null,
      isText
        ? h('textarea', {
            className: 'sg-text',
            value: current || '',
            placeholder: T.otherPh,
            onChange: e => set(e.target.value),
          })
        : h('div', null,
            canFill && !isArchetypeQ
              ? h('button', {
                className: 'sg-btn sg-btn-ghost sg-btn-sm',
                style: { marginBottom: '10px' },
                onClick: fillRecommended,
                // 文案随状态切换：再点一次会清空，按钮必须说对它在做什么
              }, isRecApplied() ? T.clearRec : T.fillRec)
              : null,
            // 形态题用卡片（note 作卡片正文），其余用列表
            isArchetypeQ
              ? h(ArchetypeCards, { options: q.options, value: current, onPick: set })
              : h('div', { className: isLong ? 'sg-opts' : '' }, options)),
      hasUnsure ? h('div', { className: 'sg-help', style: { marginTop: '8px' } }, T.unsureHint) : null,
    ),
    error ? h('p', { className: 'sg-msg sg-err', style: { marginTop: '12px' } }, error) : null,
    h('div', { className: 'sg-foot' },
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', { className: 'sg-btn sg-btn-ghost', disabled: idx === 0 || busy, onClick: () => setIdx(idx - 1) }, '←'),
        onSkip ? h('button', { className: 'sg-btn sg-btn-ghost', disabled: busy, onClick: onSkip }, T.skip) : null),
      h('button', { className: 'sg-btn', disabled: !answered || busy, onClick: () => (isLast ? onDone() : setIdx(idx + 1)) },
        isLast ? (stage === 'knowledge' ? T.nextSurvey : T.build) : T.next)),
  )
}

function Busy({ title, sub }) {
  return h('div', { className: 'sg-center' },
    h('div', { className: 'sg-spin' }),
    h('h2', { className: 'sg-h2' }, title),
    h('p', { className: 'sg-sub' }, sub))
}

function Done({ result, onAgain, onReveal, onExport }) {
  const [ex, setEx] = useState(false)
  return h('div', { className: 'sg-center', style: { paddingTop: '52px' } },
    h('div', { className: 'sg-ok' }, '✓'),
    h('h2', { className: 'sg-h2' }, T.doneTitle),
    h('p', { className: 'sg-sub' }, T.doneSub),
    h('div', { className: 'sg-path' }, result.dir),
    h('div', { style: { textAlign: 'left', fontSize: '13px', color: 'var(--sg-dim)', marginBottom: '8px' } }, T.files),
    h('div', { className: 'sg-files' },
      (result.files || []).map(f => h('div', { key: f },
        h('span', null, f),
        h('button', { onClick: () => onReveal(result.dir) }, T.view)))),
    // 可选交付物 AGENTS.md：明确用途 + 告知需安装 Git + 说明可选可删
    result.files && result.files.includes('AGENTS.md')
      ? h('div', { className: 'sg-note sg-note-info', style: { marginTop: '14px', textAlign: 'left' } },
          h('b', null, T.agentsMdTitle),
          h('div', { style: { marginTop: '4px' } }, T.agentsMdD))
      : null,
    onExport ? h('div', { style: { marginTop: '20px' } },
      h('button', {
        className: 'sg-btn',
        onClick: () => { onExport(); setEx(true) },
      }, T.exportRecord),
      h('p', { className: 'sg-sub', style: { marginTop: '8px', fontSize: '12px' } },
        ex ? '已导出两份文件：Markdown（人读）与 JSON（程序读）' : T.exportHelp)) : null,
    h('button', { className: 'sg-btn', onClick: onAgain }, T.again))
}

function Settings({ status, onClose, onSaved }) {
  const [key, setKey] = useState('')
  const [dir, setDir] = useState(status.skillsRoot)
  const [msg, setMsg] = useState('')
  useEffect(() => { api.settings().then(s => { if (s?.apiKey) setKey('••••••' + s.apiKey.slice(-4)) }) }, [])
  const save = async () => {
    const patch = { targetDir: dir }
    if (key && !key.startsWith('••')) patch.apiKey = key.trim()
    await api.saveSettings(patch)
    setMsg(T.saved)
    setTimeout(() => { onSaved(dir); onClose() }, 600)
  }
  return h('div', { className: 'sg-mask', onClick: e => { if (e.target.classList.contains('sg-mask')) onClose() } },
    h('div', { className: 'sg-modal' },
      h('h3', null, T.settings),
      h('div', { className: 'sg-field' },
        h('label', null, T.apiKey),
        h('input', { type: 'password', value: key, placeholder: T.apiKeyPh, onChange: e => setKey(e.target.value) }),
        h('div', { className: 'sg-help' }, T.apiKeyHelp + (status.keyPreview ? `（当前：${status.keyPreview}）` : ''))),
      h('div', { className: 'sg-field' },
        h('label', null, T.outputDir),
        h('div', { className: 'sg-row' },
          h('input', { value: dir, readOnly: true }),
          h('button', { className: 'sg-btn sg-btn-ghost sg-btn-sm', onClick: async () => {
            const d = await api.pickDir(); if (d) setDir(d)
          } }, T.change)),
        h('div', { className: 'sg-help' }, T.outputDirHelp)),
      h('div', { className: 'sg-foot' },
        h('button', { className: 'sg-btn sg-btn-ghost', onClick: onClose }, T.close),
        h('button', { className: 'sg-btn', onClick: save }, msg || T.save))))
}

// ---------------- 主应用 ----------------

function App() {
  const [view, setViewRaw] = useState('menu')
  // 页面切换动画的两个状态（2026-10-08）：
  //   viewSeq 递增 → 作为 key 让 React 重新挂载节点，触发 CSS animation
  //   viewDir       → 1 = 前进（右滑入），-1 = 后退（左滑入）
  //
  // ⚠️ 为什么统一用 `goto` 接管，而不是在每个 setView 调用点手动加：
  //   方向判断要看「目标 view 在流程里的位置」，若散落在 10 个调用点，
  //   必然有漏判的（一旦漏判就变成「点了返回却向右滑」这种别扭动效）。
  //   位置表是唯一事实来源，加新步骤只需改这一处。
  const VIEW_ORDER = ['menu', 'welcome', 'form', 'archetype', 'interview', 'interaction', 'working', 'done']
  const [archetype, setArchetype] = useState(null)
  // AI 推荐的形态（2026-10-11）：进形态步时异步获取，不阻塞卡片展示
  const [aiSuggestion, setAiSuggestion] = useState(null)
  const [viewSeq, setViewSeq] = useState(0)
  const [viewDir, setViewDir] = useState(1)
  const setView = (next) => {
    const from = VIEW_ORDER.indexOf(view)
    const to = VIEW_ORDER.indexOf(next)
    // 位置后退（index 变小）或目标不在表里（如 error 回退）→ 当作「后退」
    setViewDir(to >= 0 && from >= 0 && to < from ? -1 : 1)
    setViewRaw(next)
    setViewSeq(s => s + 1)
  }
  const [status, setStatus] = useState({ hasKey: false, skillsRoot: '' })
  const [form, setForm] = useState({ teamName: '', agentName: '', domain: '', deliverable: '', taskBackground: '', goals: '', painPoints: '' })
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [plan, setPlan] = useState(null)
  const [iq, setIq] = useState([])
  const [ia, setIa] = useState({})
  const [iplan, setIplan] = useState(null)
  const [result, setResult] = useState(null)
  const [targetDir, setTargetDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  // 可选交付物 AGENTS.md 的开关（默认勾选；取消则不生成该文件）
  const [includeAgentsMd, setIncludeAgentsMd] = useState(true)

  const refresh = () => api.status().then(s => {
    setStatus(s)
    if (s && s.skillsRoot) setTargetDir(cur => cur || s.skillsRoot)
  })
  useEffect(() => { refresh() }, [])

  const required = ['teamName', 'agentName', 'domain', 'deliverable', 'taskBackground', 'goals', 'painPoints']

  // 段① 专业知识调研
  const startInterview = async () => {
    if (required.some(k => !form[k].trim())) { setError(T.errorEmpty); return }
    if (!archetype) { setError(T.errorArch); return }   // 形态是必填：决定 workflow 骨架
    setBusy(true); setError(null)
    // ⚠️ archetype 必须随 payload 传给 core —— 它不在 form 里（form 是「工作事项」表单），
    // 但 `resolveArchetype()` 会优先读 input.archetype，缺了就退化成「扫答案找 id」，
    // 而形态题已从问卷里移出，答案里根本没有 archetype id → 会返回 null → 骨架丢失。
    const r = await api.interview({ ...form, archetype })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    if (!r.data.questions?.length) { setError('没有生成出题目，请重试'); return }
    setQuestions(r.data.questions)
    setPlan(r.data.plan || null)
    setAnswers({})
    setView('interview')
  }

  // 段② 智能体交互调研：依赖段①答案 + 交付形态
  const startInteraction = async () => {
    setBusy(true); setError(null)
    const r = await api.interaction({ form, answers })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    if (!r.data.questions?.length) { setError('没有生成出题目，请重试'); return }
    setIq(r.data.questions)
    setIplan(r.data.plan || null)
    setIa({})
    setView('interaction')
  }

  const generate = async () => {
    setBusy(true); setError(null); setView('working')
    const payload = {
      ...form,
      interview: answers,
      interaction: ia,
      interviewQuestions: questions,
      interactionQuestions: iq,
    }
    if (targetDir) payload.targetDir = targetDir
    payload.includeAgentsMd = includeAgentsMd
    const r = await api.generate(payload)
    setBusy(false)
    if (!r.ok) { setError(r.error); setView('interaction'); return }
    setResult(r.data)
    setView('done')
  }

  const reset = () => {
    setView('welcome')
    setForm({ teamName: '', agentName: '', domain: '', deliverable: '', taskBackground: '', goals: '', painPoints: '' })
    setQuestions([]); setAnswers({}); setPlan(null)
    setIq([]); setIa({}); setIplan(null)
    setArchetype(null); setAiSuggestion(null); setResult(null); setError(null)
  }

  let body
  if (view === 'menu') {
    body = h(StartMenu, {
      hasKey: status.hasKey,
      onSettings: () => setShowSettings(true),
      onPick: () => setView('welcome'),
    })
  } else if (view === 'welcome') {
    body = h(Welcome, {
      hasKey: status.hasKey,
      onSettings: () => setShowSettings(true),
      onStart: () => setView('form'),
      onBack: () => setView('menu'),
    })
  } else if (view === 'form') {
    body = h('div', null,
      busy ? h(Busy, { title: T.generating, sub: T.generatingSub }) : null,
      !busy ? h(TaskForm, {
        form, setForm, busy, error, includeAgentsMd, setIncludeAgentsMd,
        onBack: () => { setError(null); setView('welcome') },
        onNext: () => {
      setView('archetype')
      // ⭐ 形态推荐交回 AI 做：本地关键词匹配追不上自然语言，只作为兜底。
      // 失败不阻塞 —— 卡片照常展示，启发式兜底或不给推荐。
      const brief = { ...form }
      setAiSuggestion(null)
      api.suggestArchetype(brief).then(r => {
        if (r && r.ok && r.data) setAiSuggestion(r.data)
      }).catch(() => { /* 静默：无推荐时界面仍可手动选 */ })
    },
      }) : null)
  } else if (view === 'archetype') {
    // ⭐ 生成段①题目要走十几秒的模型调用，必须像 form/interview 视图一样切到
    //   Busy 转圈页——之前 busy 只把「下一步」按钮变灰，用户以为卡死（实测反馈）。
    body = h('div', null,
      busy ? h(Busy, { title: T.generating, sub: T.generatingSub }) : null,
      !busy ? h(ArchetypeStep, {
        form, value: archetype, onPick: setArchetype, aiSuggestion,
        busy, error,
        onBack: () => { setError(null); setView('form') },
        onNext: startInterview,
      }) : null);
  } else if (view === 'interview') {
    body = h('div', null,
      busy ? h(Busy, { title: T.generating2, sub: T.generating2Sub }) : null,
      !busy ? h(Interview, {
        stage: 'knowledge', title: T.step2Title, sub: T.step2Sub, plan,
        questions, answers, setAnswers, busy, error,
        onBack: () => { setError(null); setView('archetype') },
        onDone: startInteraction,
      }) : null)
  } else if (view === 'interaction') {
    body = h(Interview, {
      stage: 'interaction', title: T.step3Title, sub: T.step3Sub, plan: iplan,
      questions: iq, answers: ia, setAnswers: setIa, busy, error,
      onSkip: generate,
      onBack: () => { setError(null); setView('interview') },
      onDone: generate,
    })
  } else if (view === 'working') {
    body = h(Busy, { title: T.building, sub: T.buildingSub })
  } else {
    body = h('div', null,
      error ? h('p', { className: 'sg-msg sg-err', style: { marginBottom: '12px' } }, error) : null,
      h(Done, {
        result: result || {},
        onAgain: reset,
        onReveal: dir => api.reveal(dir),
        // 把「输入侧」完整带走：工作事项 + 两段题表 + 两段答案（含选项 label/note）
        onExport: () => exportBoth({
          form,
          interviewQuestions: questions, answers, plan,
          interactionQuestions: iq, interaction: ia, interactionPlan: iplan,
          resultDir: (result || {}).dir || '',
        }),
      }))
  }

  return h('div', { className: 'sg' },
    view !== 'menu' && view !== 'welcome' ? h('div', { className: 'sg-top' },
      h('b', null, 'PromptAssist'),
      h('button', { className: 'sg-btn sg-btn-ghost sg-btn-sm', onClick: () => setShowSettings(true) }, T.settings)) : null,
    // key={viewSeq} 是页面动画的关键：每次 view 变化都会换 key → React 重新挂载
    // 这个节点 → CSS animation 重新触发。不加 key 的话 DOM 节点被复用，动画只播一次。
    h('div', { className: 'sg-view' + (viewDir < 0 ? ' sg-back' : ''), key: viewSeq }, body),
    showSettings ? h(Settings, {
      status,
      onClose: () => setShowSettings(false),
      onSaved: dir => { if (dir) setTargetDir(dir); refresh() },
    }) : null)
}

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

createRoot(document.getElementById('root')).render(h(App))
