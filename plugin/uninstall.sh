#!/usr/bin/env bash
# ============================================================================
# ProMentor Dashboard —— DSH Web GUI 插件卸载脚本（幂等）
#
# 移除：profiles/node_modules 软链 + cordis.patch.yml 注册行。
# 用法：bash plugin/uninstall.sh
# ============================================================================
set -euo pipefail

PROFILE_DIR="$HOME/.dsh/profiles/web"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
NM_DIR="$HOME/.dsh/profiles/node_modules/@deepseek-ai"

HOST_NAME="@deepseek-ai/dsh-host-promentor"
CLIENT_NAME="@deepseek-ai/dsh-client-ui-promentor"

echo "▶ ProMentor Dashboard 插件卸载"

# 1) 移除软链
for name in "$HOST_NAME" "$CLIENT_NAME"; do
  if [ -L "$NM_DIR/$name" ]; then
    rm "$NM_DIR/$name"
    echo "  ✓ 移除软链: $name"
  fi
done

# 2) 移除注册行（从 "ProMentor Dashboard 插件" 注释到文件尾）
if [ -f "$PATCH_FILE" ]; then
  if grep -q "ProMentor Dashboard 插件" "$PATCH_FILE"; then
    sed -i '' '/^# ProMentor Dashboard 插件/,$d' "$PATCH_FILE" 2>/dev/null \
      || sed -i '/^# ProMentor Dashboard 插件/,$d' "$PATCH_FILE"
    echo "  ✓ 已移除注册行: $PATCH_FILE"
  else
    echo "  ✓ 未找到注册行（已卸载）"
  fi
fi

echo
echo "✅ 卸载完成。重启 GUI（或下次启动）后插件不再加载。"
