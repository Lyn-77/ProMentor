#!/usr/bin/env bash
# ============================================================================
# ProMentor Dashboard —— 重建 dsh-plugin/dist 预构建产物（维护者专用）
#
# 普通用户不需要本脚本：dsh-plugin/dist 已提交进仓库，install.sh 直接使用。
# 只有当插件源码（deepseek-harness 仓库 packages/host/promentor 与
# packages/client/ui-promentor）有改动、需要重新发布时，才运行本脚本。
#
# 用法：
#   DSH_HARNESS=/path/to/deepseek-harness bash dsh-plugin/rebuild-dist.sh
#   bash dsh-plugin/rebuild-dist.sh          # 默认 ~/CODE/project/deepseek-harness
# ============================================================================
set -euo pipefail

HARNESS="${DSH_HARNESS:-$HOME/CODE/project/deepseek-harness}"
DIST="$(cd "$(dirname "$0")" && pwd)/dist"

HOST_PKG="packages/host/promentor"
CLIENT_PKG="packages/client/ui-promentor"
HOST_NAME="@deepseek-ai/dsh-host-promentor"
CLIENT_NAME="@deepseek-ai/dsh-client-ui-promentor"

echo "▶ 重建 ProMentor Dashboard 预构建产物"
echo "  harness: $HARNESS"
echo "  dist:    $DIST"

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

# 2) 复制产物到 dist
mkdir -p "$DIST/$HOST_NAME/lib" "$DIST/$CLIENT_NAME/lib"
cp "$HARNESS/$HOST_PKG/lib/index.js" "$DIST/$HOST_NAME/lib/index.js"
cp "$HARNESS/$CLIENT_PKG/lib/index.js" "$DIST/$CLIENT_NAME/lib/index.js"
cp "$HARNESS/$CLIENT_PKG/lib/client.js" "$DIST/$CLIENT_NAME/lib/client.js"
if [ -f "$HARNESS/$CLIENT_PKG/lib/client.js.map" ]; then
  cp "$HARNESS/$CLIENT_PKG/lib/client.js.map" "$DIST/$CLIENT_NAME/lib/client.js.map"
fi

# 3) 同步插件源码镜像到 src/（与 dist 一起提交，供查阅；构建仍需 harness 工作区）
mkdir -p "$DIST/../src"
rsync -a --delete \
  --exclude lib --exclude node_modules --exclude '*.tsbuildinfo' \
  "$HARNESS/$HOST_PKG/" "$DIST/../src/host-promentor/"
rsync -a --delete \
  --exclude lib --exclude node_modules --exclude '*.tsbuildinfo' \
  "$HARNESS/$CLIENT_PKG/" "$DIST/../src/client-ui-promentor/"

cat > "$DIST/$HOST_NAME/package.json" <<EOF
{
  "name": "$HOST_NAME",
  "description": "ProMentor course data gateway (DSH web plugin, prebuilt)",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./package.json": "./package.json"
  },
  "files": ["lib/index.js"],
  "license": "MIT"
}
EOF

cat > "$DIST/$CLIENT_NAME/package.json" <<EOF
{
  "name": "$CLIENT_NAME",
  "description": "ProMentor course dashboard in the DSH web GUI (prebuilt)",
  "version": "0.1.0",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js",
    "./package.json": "./package.json"
  },
  "dsh": {
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-ui-conversation",
        "@deepseek-ai/dsh-client-ui-layout"
      ],
      "platform": "web"
    }
  },
  "files": ["lib/client.js", "lib/index.js"],
  "license": "MIT"
}
EOF

echo
echo "✅ 已重建（dist + src 源码镜像）："
du -sh "$DIST/$HOST_NAME" "$DIST/$CLIENT_NAME" "$DIST/../src"
echo
echo "把 dsh-plugin/dist 与 dsh-plugin/src 提交进仓库后，用户即可用 dsh-plugin/install.sh 一键安装（无需 harness 源码）。"
