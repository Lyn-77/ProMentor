#!/usr/bin/env bash
# ============================================================================
# ProMentor Dashboard —— DSH Web GUI 插件安装脚本（幂等，可重复执行）
#
# 作用：把 ProMentor Dashboard 插件注册进 DSH Web GUI：
#   1. 确保插件包已构建（deepseek-harness 仓库内）
#   2. 把两个插件包软链进 ~/.dsh/profiles/node_modules/@deepseek-ai/（当前进程可解析）
#   3. 把注册行幂等写入 ~/.dsh/profiles/web/cordis.patch.yml（下次启动自动加载）
#
# 用法：
#   DSH_HARNESS=/path/to/deepseek-harness bash plugin/install.sh
#   bash plugin/install.sh                    # 默认 ~/CODE/project/deepseek-harness
# ============================================================================
set -euo pipefail

HARNESS="${DSH_HARNESS:-$HOME/CODE/project/deepseek-harness}"
PROFILE_DIR="$HOME/.dsh/profiles/web"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
NM_DIR="$HOME/.dsh/profiles/node_modules/@deepseek-ai"
ROWS_SOURCE="$(cd "$(dirname "$0")" && pwd)/cordis.patch.yml"

HOST_PKG="packages/host/promentor"
CLIENT_PKG="packages/client/ui-promentor"
HOST_NAME="@deepseek-ai/dsh-host-promentor"
CLIENT_NAME="@deepseek-ai/dsh-client-ui-promentor"

echo "▶ ProMentor Dashboard 插件安装"
echo "  harness:  $HARNESS"

[ -d "$HARNESS/$HOST_PKG" ] || { echo "错误：找不到 $HARNESS/$HOST_PKG —— 请先切换到包含插件的 deepseek-harness 分支（feat/promentor-dashboard-plugin）"; exit 1; }
[ -d "$HARNESS/$CLIENT_PKG" ] || { echo "错误：找不到 $HARNESS/$CLIENT_PKG"; exit 1; }

# 1) 构建（缺失时才构建，避免每次重复编译）
if [ ! -f "$HARNESS/$HOST_PKG/lib/index.js" ] || [ ! -f "$HARNESS/$CLIENT_PKG/lib/client.js" ]; then
  echo "▶ 构建插件包 …"
  (cd "$HARNESS" && pnpm install >/dev/null 2>&1 || true)
  (cd "$HARNESS" && pnpm exec tsc -b "$HOST_PKG" "$CLIENT_PKG")
  (cd "$HARNESS" && pnpm exec tsdown -c "$HOST_PKG/tsdown.config.ts")
  (cd "$HARNESS" && pnpm exec tsdown -c "$CLIENT_PKG/tsdown.config.ts")
fi

# 2) 软链到 profiles/node_modules（当前运行进程的解析路径；下次启动由 heal 自动重建）
mkdir -p "$NM_DIR"
for name in "$HOST_NAME" "$CLIENT_NAME"; do
  case "$name" in
    "$HOST_NAME") target="$HARNESS/$HOST_PKG" ;;
    "$CLIENT_NAME") target="$HARNESS/$CLIENT_PKG" ;;
  esac
  if [ -e "$NM_DIR/$name" ] || [ -L "$NM_DIR/$name" ]; then
    echo "  ✓ 已存在软链: $name"
  else
    ln -s "$target" "$NM_DIR/$name"
    echo "  ✓ 创建软链: $name -> $target"
  fi
done

# 3) 幂等写入注册行（若 patch 文件中没有这些行）
mkdir -p "$PROFILE_DIR"
if grep -q "$HOST_NAME" "$PATCH_FILE" 2>/dev/null; then
  echo "  ✓ 注册行已存在: $PATCH_FILE"
else
  printf '\n# ProMentor Dashboard 插件（plugin/cordis.patch.yml 安装）\n' >> "$PATCH_FILE"
  cat "$ROWS_SOURCE" >> "$PATCH_FILE"
  echo "  ✓ 已写入注册行: $PATCH_FILE"
fi

echo
echo "✅ 安装完成。"
echo "   - 若 GUI 正在运行：重启它（Ctrl+C 后重新运行启动命令），然后刷新浏览器页面。"
echo "   - 刷新后，会话输入框上方会出现 ProMentor 按钮，点击打开 Dashboard。"
echo
echo "卸载：bash plugin/uninstall.sh"
