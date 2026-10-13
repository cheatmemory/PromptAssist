// `electron` 是 CJS 包：必须 default import + 解构（见 electron.vite.config.mjs 注释）。
import electron from 'electron'

const { contextBridge, ipcRenderer } = electron

contextBridge.exposeInMainWorld('forge', {
  status: () => ipcRenderer.invoke('forge:status'),
  saveSettings: patch => ipcRenderer.invoke('forge:saveSettings', patch),
  settings: () => ipcRenderer.invoke('forge:settings'),
  interview: form => ipcRenderer.invoke('forge:interview', form),
  suggestArchetype: form => ipcRenderer.invoke('forge:suggestArchetype', form),
  interaction: payload => ipcRenderer.invoke('forge:interaction', payload),
  generate: payload => ipcRenderer.invoke('forge:generate', payload),
  pickDir: () => ipcRenderer.invoke('forge:pickDir'),
  reveal: dir => ipcRenderer.invoke('forge:reveal', dir),
})
