# PromptAssist · 专业提示词生成器

把一句话变成一个能干活的智能体。独立桌面应用，**不依赖 DeepSeek Harness**，双击即用。

---

## 快速开始

双击 **`启动 PromptAssist.bat`**。

首次运行会自动装依赖（约 3-5 分钟，需联网），之后秒开。

也可以用命令行：

```bash
npm install --ignore-scripts   # 见下方「安装踩坑」
npm run build
npx electron .
```

---

## 免安装绿色版

```bash
npm run pack        # = build + electron-builder --win --dir
```

产物：

| 路径 | 说明 |
|---|---|
| `dist/win-unpacked/` | 免安装目录（353 MB），拷走即可用 |
| `dist/PromptAssist-portable-0.1.0.zip` | 压缩包（139 MB），解压即用 |

解压后有两种启动方式，**推荐第一种**：

- **`PromptAssist.exe`** —— 直接双击
- **`启动 PromptAssist.bat` / `start.bat`** —— 保险版，会先清两个环境变量再启动

### 为什么需要那个 bat

两个环境变量会让打包后的应用**直接退出（exit code 3）或窗口永不出现**：

| 变量 | 症状 | 成因 |
|---|---|---|
| `ELECTRON_RUN_AS_NODE=1` | 窗口不出现 | electron 以纯 Node 模式运行 |
| `NODE_OPTIONS=--require=...node-language-shim.cjs` | 启动即退出 | 某些终端（如 WorkBuddy）会注入 Node 启动 shim，打包应用加载它就崩 |

从资源管理器双击 exe 走的是干净的 explorer 进程，通常不受影响；但**从终端启动**（包括在 WorkBuddy 里点开）就可能被注入。bat 做的就是把这两个变量清掉。

---

## 界面流程

```
欢迎页  →  ① 工作事项表单  →  ② AI 访谈提问  →  生成中  →  完成
          名字/团队/智能体名/领域        10-15 道专业选择题
          背景/目标/痛点                单选 / 多选 / 是否
```

**关于第二步**：AI 先读懂你写的工作事项，再出 10-15 道**专业颗粒度**的选择题把真实需求摸透，
而不是让你用一段话描述需求。题目规则写死在 `src/main/prompts.js` 的 `SYSTEM_INTERVIEW`：

- 覆盖会实质改变技能设计的维度（业务模式、判定口径、数据可信度、合规边界、时效…）
- 每题 3-5 个选项，**禁止"高质量/一般"这类空泛档位**，必须写出实际判断依据或数值区间
- 至少 3 题锁定该领域的**核心判定口径与阈值**
- 至少 1 题覆盖该领域最常见的例外或高风险误区

> 将来接专业数据库时，只需替换 `SYSTEM_INTERVIEW` 的取材来源（当前靠模型自身领域知识），
> 题目生成逻辑与 UI 都不必改动。

---

## 凭据

**默认不用配置**。启动时会自动读取已存在的 DeepSeek key：

1. 环境变量 `DEEPSEEK_API_KEY`
2. 应用内设置（存于 Electron userData）
3. `~/.dsh/.credentials.yaml` 的 `refs.DEEPSEEK_API_KEY`
4. `%APPDATA%/dsh-desktop-dev/harness/.credentials.yaml`

都找不到时，在应用内点右上角「设置」填入即可。

---

## 产物落盘

默认写入 **`~/.dsh/skills/<slug>/`**，与 Harness 的技能发现路径一致——所以生成结果在
DeepSeek Harness 里同样能加载调用（无需在应用和 harness 之间来回复制）。

可在「设置」里改输出目录。

三件套：

| 文件 | 内容 |
|---|---|
| `SKILL.md` | 角色设定 / 核心原则 / 触发条件 / 执行流程 / 专项模块 / 常见陷阱 / 输出规范 |
| `workflow.json` | 可执行工作流有向图 |
| `prompt-instructions.md` | 可直接粘贴给任意大模型的六段式系统提示词 |

---

## 技术要点

| 项 | 说明 |
|---|---|
| 主进程 / preload | **必须输出 CommonJS**。Electron 主进程 API（app/BrowserWindow）是 CJS，ESM 输出下具名导入拿不到、`app` 会是 undefined。源码可写 ESM，rollup 负责转 |
| `electron` 导入 | 用 `import electron from 'electron'` + 解构，不要用具名导入 |
| `__dirname` | CJS 输出下是原生全局，**不要重新声明**（会自引用报错） |
| `ELECTRON_RUN_AS_NODE` | 若该变量残留为 `1`，Electron 会以纯 Node 模式运行（表现为窗口永不出现）。启动脚本已自动清除 |
| renderer | 纯 `React.createElement`，不引 JSX，因此不需要 `plugin-react` |
| 模型调用 | 直连 DeepSeek 的 OpenAI 兼容 `/chat/completions`（SSE 流式），不经 harness |
| `maxTokens` | 封顶的是**思考 + 回答合计**。推理模型给太小会导致正文为空、JSON 解析失败，且与输入长度无关 |

---

## 安装踩坑（Windows + 中文路径）

`npm install` 若在 esbuild/rollup 的 postinstall 阶段报 `spawnargs` 错误，或构建时报
`Cannot find module '@rollup/rollup-win32-x64-msvc'`，按顺序执行：

```bash
npm install --ignore-scripts --no-audit --no-fund
npm install @esbuild/win32-x64 --no-save --ignore-scripts
npm install @rollup/rollup-win32-x64-msvc --no-save --ignore-scripts
node node_modules/electron/install.js      # ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

`启动 PromptAssist.bat` 已把这四步全部自动化。

---

## 验证脚本

```bash
node ../.verify/check-engine.mjs   # 引擎逻辑：凭据读取/章节渲染/编译落盘（29 项断言）
node ../.verify/check-live.mjs     # 真实调用 DeepSeek 跑一次访谈环节
```

---

## 与 Harness 插件版的关系

两者共享公共包 **`dsh-desktop/packages/skill-generator-core/`**，改动规则只改那一处：

```
skill-generator-core/          ← 规则唯一事实来源
├── prompts.js                 meta-prompt（访谈/方法论/工作流）、MAX_TOKENS、fill
├── render.js                  renderSkillBody、sectionsDescription
├── compile.js                 slugify、compileSkill
├── json.js                    extractJSON、generateJSON（重试 + 诊断）
├── brief.js                   briefText、formOf
└── pipeline.js                三段流程（callModel 由调用方注入）
```

两种形态各自只保留**运行时适配层**：

| | 独立应用（本项目） | Harness 插件 |
|---|---|---|
| 适配层 | `src/main/engine.js` | `packages/dsh-plugin-skill-generator/index.js` |
| 模型调用 | `fetch` + SSE | `ctx.llm.stream` |
| 凭据来源 | 读本地 `~/.dsh/.credentials.yaml` | 复用 harness 凭据 |
| 落盘根目录 | `~/.dsh/skills` | `dshHomePath('skills')` |
| UI | `src/renderer/app.js` | `client.js`（`settings.plugins.tab`） |

core 不 import `electron`、不 import harness 的包，因此两侧都能干净引用。
产物格式一致，任一形态生成的技能包两边都能加载。
