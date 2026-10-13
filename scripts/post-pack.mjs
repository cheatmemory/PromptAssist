/**
 * 打包后处理：让 `npm run pack` 一次产出可直接分发的绿色版。
 *
 * electron-builder 只负责产出 dist/win-unpacked，另外三件事必须补上，
 * 否则每次重新打包都会丢：
 *   1. 复制启动器（清 ELECTRON_RUN_AS_NODE / NODE_OPTIONS，否则双击没反应）
 *   2. 删除 %SystemDrive% 杂质（打包时运行应用留下的 Windows 兼容性缓存）
 *   3. 打成 zip（默认 pack 不会生成）
 *
 * 用法：node scripts/post-pack.mjs
 */
import { copyFileSync, existsSync, rmSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'dist', 'win-unpacked')
const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version

if (!existsSync(outDir)) {
  console.error('[post-pack] 未找到 dist/win-unpacked，请先运行 electron-builder')
  process.exit(1)
}

// ---- 1. 启动器 ----
const LAUNCHER = `@echo off
rem ==========================================================
rem  PromptAssist 启动器（免安装版）
rem
rem  必须清除两个环境变量，否则应用无法启动：
rem    ELECTRON_RUN_AS_NODE=1
rem        electron 以纯 Node 模式运行，窗口永不出现
rem    NODE_OPTIONS=--require=...node-language-shim.cjs
rem        某些终端（如 WorkBuddy）会注入 Node 启动 shim，
rem        打包后的应用加载它会直接退出（exit code 3）
rem ==========================================================
set ELECTRON_RUN_AS_NODE=
set NODE_OPTIONS=
cd /d "%~dp0"
start "" "PromptAssist.exe"
`
for (const name of ['启动 PromptAssist.bat', 'start.bat']) {
  writeFileSync(join(outDir, name), LAUNCHER, 'utf8')
}
console.log('[post-pack] 启动器已写入（中文名 + 英文名）')

// ---- 2. 清理杂质 ----
const junk = join(outDir, '%SystemDrive%')
if (existsSync(junk)) {
  rmSync(junk, { recursive: true, force: true })
  console.log('[post-pack] 已删除 %SystemDrive% 杂质')
}

// ---- 3. 打 zip ----
function walk(dir, base = dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, base, acc)
    else acc.push(full)
  }
  return acc
}

const files = walk(outDir)
const entries = []
for (const file of files) {
  const name = file.slice(outDir.length + 1).replace(/\\/g, '/')
  const raw = readFileSync(file)
  const deflated = deflateRawSync(raw, { level: 6 })
  const crc = crc32(raw)
  entries.push({ name, raw, deflated, crc })
}

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256)
    for (let i = 0; i < 256; i++) {
      c = i
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[i] = c
    }
    return t
  })())
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function dosTime(date) {
  const t = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() / 2)) & 0xffff
  const d = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff
  return { t, d }
}

const zipName = `PromptAssist-portable-${version}.zip`
const zipPath = join(root, 'dist', zipName)
const now = new Date()
const { t: dosT, d: dosD } = dosTime(now)

const locals = []
const centrals = []
let offset = 0
for (const e of entries) {
  const nameBuf = Buffer.from(e.name, 'utf8')
  const crc = e.crc
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0x0800, 6) // UTF-8 文件名
  local.writeUInt16LE(8, 8) // deflate
  local.writeUInt16LE(dosT, 10)
  local.writeUInt16LE(dosD, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(e.deflated.length, 18)
  local.writeUInt32LE(e.raw.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  locals.push(local, nameBuf, e.deflated)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(8, 10)
  central.writeUInt16LE(dosT, 12)
  central.writeUInt16LE(dosD, 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(e.deflated.length, 20)
  central.writeUInt32LE(e.raw.length, 24)
  central.writeUInt16LE(nameBuf.length, 28)
  central.writeUInt32LE(0, 38) // 外部属性
  central.writeUInt32LE(offset, 42)
  centrals.push(central, nameBuf)

  offset += local.length + nameBuf.length + e.deflated.length
}

const centralBuf = Buffer.concat(centrals)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(entries.length, 8)
end.writeUInt16LE(entries.length, 10)
end.writeUInt32LE(centralBuf.length, 12)
end.writeUInt32LE(offset, 16)

writeFileSync(zipPath, Buffer.concat([...locals, centralBuf, end]))
console.log(`[post-pack] ${zipName}  ${entries.length} 个文件  ${(statSync(zipPath).size / 1024 / 1024).toFixed(1)} MB`)
