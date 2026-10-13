import { defineConfig } from 'electron-vite'

// 主进程与 preload 一律输出 CommonJS：Electron 的主进程 API（app/BrowserWindow/
// contextBridge 等）本质是 CJS，ESM 输出下具名导入会拿不到（"does not provide an
// export named ..."），default import 也会得到 undefined。源码可以照常写 ESM，
// rollup 会转成 require 并正确 interop。
export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: 'src/main/index.js',
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: 'src/preload/index.mjs',
        output: { format: 'cjs', entryFileNames: '[name].cjs' },
      },
    },
  },
  renderer: {
    root: 'src/renderer',
    build: {
      rollupOptions: { input: 'src/renderer/index.html' },
    },
  },
})
