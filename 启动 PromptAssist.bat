@echo off
cd /d "%~dp0"
chcp 65001 >nul
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

REM harness 的 node 入口会设置这个变量，残留时 electron 会以纯 Node 模式运行
REM （表现为 require("electron") 返回字符串、窗口永远不出现）。每次启动先清掉。
set ELECTRON_RUN_AS_NODE=

echo ==========================================
echo   PromptAssist - 专业提示词生成器
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 Node.js，请先安装 Node.js 24。
  pause
  exit /b 1
)

REM ---- 1. 依赖 ----
if not exist "node_modules\electron\package.json" (
  echo [1/4] 首次运行，正在安装依赖（约 3-5 分钟）...
  call npm install --ignore-scripts --no-audit --no-fund
  if errorlevel 1 goto :fail
)

REM ---- 2. 原生包（--ignore-scripts 会跳过平台二进制，必须单独补）----
if not exist "node_modules\@esbuild\win32-x64" (
  echo [2/4] 补装 esbuild 平台包...
  call npm install @esbuild/win32-x64 --no-save --ignore-scripts --no-audit --no-fund
)
if not exist "node_modules\@rollup\rollup-win32-x64-msvc" (
  echo [2/4] 补装 rollup 平台包...
  set ROLLUP_VER=
  for /f "delims=" %%v in ('node -e "console.log(require('./node_modules/rollup/package.json').version)"') do set ROLLUP_VER=%%v
  call npm install @rollup/rollup-win32-x64-msvc@!ROLLUP_VER! --no-save --ignore-scripts --no-audit --no-fund
)

REM ---- 3. Electron 二进制 ----
if not exist "node_modules\electron\dist\electron.exe" (
  echo [3/4] 下载 Electron 运行时（约 200MB，走镜像）...
  call node node_modules\electron\install.js
  if not exist "node_modules\electron\dist\electron.exe" goto :fail
)

REM ---- 4. 构建 ----
if not exist "out\main\index.cjs" (
  echo [4/4] 构建应用...
  call npm run build
  if not exist "out\main\index.cjs" goto :fail
)

echo.
echo [RUN] 启动中...
echo.
call npx electron .
echo.
echo [EXIT] 已退出。
pause
exit /b 0

:fail
echo.
echo [ERROR] 准备失败，请把上面的红色错误信息发给我。
pause
exit /b 1
