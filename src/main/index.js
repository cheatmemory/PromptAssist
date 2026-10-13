// 构建输出为 CommonJS（见 electron.vite.config.mjs），源码仍用 ESM 写法，由 rollup 转换。
// `electron` 是 CJS 包：ESM 输出下具名导入会拿不到，default import 又会得到
// undefined；只有在 CJS 输出 + default import + 解构时 interop 才正确。
import electron from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { readDeepSeekKey, stepInterview, stepInteraction, runPipeline, skillsRoot, suggestArchetype } from './engine.js'

const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme } = electron

// 注意：构建输出为 CJS，__dirname 由 CJS 模块环境原生提供，勿再声明（会自引用）。

/** 用户在应用内填写的 key（存在 electron userData 下），优先于系统凭据。 */
function localSettingsPath() {
  return join(app.getPath('userData'), 'settings.json')
}

function readLocalSettings() {
  try {
    const p = localSettingsPath()
    return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {}
  } catch {
    return {}
  }
}

function writeLocalSettings(patch) {
  const next = { ...readLocalSettings(), ...patch }
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(localSettingsPath(), JSON.stringify(next, null, 2), 'utf8')
  return next
}

function activeKey() {
  return process.env.DEEPSEEK_API_KEY || readLocalSettings().apiKey || readDeepSeekKey()
}

function engineContext(extra = {}) {
  const apiKey = activeKey()
  if (!apiKey) {
    throw new Error('NO_API_KEY')
  }
  const settings = readLocalSettings()
  return {
    apiKey,
    baseUrl: settings.baseUrl,
    model: settings.model,
    targetDir: settings.targetDir || undefined,
    ...extra,
  }
}

function friendlyError(error) {
  const message = error?.message || String(error)
  if (message === 'NO_API_KEY') {
    return '未找到 DeepSeek API Key。请在左下角「设置」中填写，或确认已配置 ~/.dsh/.credentials.yaml。'
  }
  if (/401|authentication|unauthorized/i.test(message)) {
    return 'API Key 无效或已过期，请在「设置」中更新。'
  }
  if (/429|rate limit|quota/i.test(message)) {
    return '请求过于频繁或额度不足，请稍后重试。'
  }
  return message
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 920,
    minWidth: 720,
    minHeight: 620,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1F1E1D' : '#F5F4EF',
    title: 'PromptAssist · 专业提示词生成器',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.once('ready-to-show', () => win.show())
  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return win
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function registerIpc() {
  ipcMain.handle('forge:status', () => {
    const key = activeKey()
    return {
      hasKey: Boolean(key),
      keyPreview: key ? `${key.slice(0, 6)}…${key.slice(-4)}` : null,
      model: readLocalSettings().model || 'deepseek-v4-flash',
      baseUrl: readLocalSettings().baseUrl || 'https://api.deepseek.com',
      skillsRoot: skillsRoot(),
    }
  })

  ipcMain.handle('forge:saveSettings', (_e, patch) => {
    const next = writeLocalSettings(patch || {})
    return { ok: true, apiKey: next.apiKey, targetDir: next.targetDir }
  })

  ipcMain.handle('forge:settings', () => readLocalSettings())

  // AI 推荐工作形态（2026-10-11）：形态成独立一步后改回模型推荐，启发式仅兜底。
  // 失败**不报错**——返回 ok:true + fallback 标记，让界面能继续显示卡片而不是卡住。
  ipcMain.handle('forge:suggestArchetype', async (_e, form) => {
    try {
      return { ok: true, data: await suggestArchetype(engineContext(), form || {}) }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    }
  })

  ipcMain.handle('forge:interview', async (_e, form) => {
    try {
      return { ok: true, data: await stepInterview(engineContext(), form || {}) }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    }
  })

  ipcMain.handle('forge:interaction', async (_e, payload) => {
    try {
      const { form, answers } = payload || {}
      return { ok: true, data: await stepInteraction(engineContext(), form || {}, answers || {}) }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    }
  })

  ipcMain.handle('forge:generate', async (_e, payload) => {
    try {
      return { ok: true, data: await runPipeline(engineContext(), payload || {}) }
    } catch (error) {
      return { ok: false, error: friendlyError(error) }
    }
  })

  ipcMain.handle('forge:pickDir', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('forge:reveal', (_e, dir) => {
    if (dir && existsSync(dir)) shell.openPath(dir)
    return true
  })
}
