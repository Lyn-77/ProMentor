#!/usr/bin/env bash
# ============================================================================
# ProMentor Dashboard —— DSH Web GUI 插件卸载脚本（幂等）
#
# 移除：profiles/node_modules 软链 + cordis.patch.yml 注册行。
# 用法：bash dsh-plugin/uninstall.sh
# ============================================================================
set -euo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/web"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
NM_DIR="$DSH_HOME/profiles/node_modules/@deepseek-ai"

HOST_NAME="@deepseek-ai/dsh-host-promentor"
CLIENT_NAME="@deepseek-ai/dsh-client-ui-promentor"

echo "▶ ProMentor Dashboard 插件卸载"

# 1) 移除插件包（rm -rf 同时兼容旧版软链与新版拷贝两种安装方式）
for name in "$HOST_NAME" "$CLIENT_NAME"; do
  if [ -e "$NM_DIR/$name" ] || [ -L "$NM_DIR/$name" ]; then
    rm -rf "$NM_DIR/$name"
    echo "  ✓ 移除插件包: $name"
  fi
done

# 2) 移除注册行（剥掉 ProMentor 块：从块标记注释到所属的最后一行注册）
if [ -f "$PATCH_FILE" ]; then
  if grep -q '^# ProMentor Dashboard 插件' "$PATCH_FILE"; then
    while grep -q '^# ProMentor Dashboard 插件' "$PATCH_FILE"; do
      sed -i '' "/^# ProMentor Dashboard 插件/,/^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE" 2>/dev/null \
        || sed -i "/^# ProMentor Dashboard 插件/,/^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE"
    done
    # 清理旧版脚本剥块时残留的孤立行（行 id 与包名全局唯一，精确删除安全）
    sed -i '' "/^    - id: promentor\$/d; /^    - id: ui-promentor\$/d; /^      name: '@deepseek-ai\/dsh-host-promentor'\$/d; /^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE" 2>/dev/null \
      || sed -i "/^    - id: promentor\$/d; /^    - id: ui-promentor\$/d; /^      name: '@deepseek-ai\/dsh-host-promentor'\$/d; /^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE"
    # 压平删除产生的连续空行
    cat -s "$PATCH_FILE" > "$PATCH_FILE.tmp" && mv "$PATCH_FILE.tmp" "$PATCH_FILE"
    # 若文件里已没有任何顶层条目，补回模板的空列表 `[]`，保持文件可解析
    if ! grep -q '^- ' "$PATCH_FILE" && ! grep -qx '\[\]' "$PATCH_FILE"; then
      printf '\n[]\n' >> "$PATCH_FILE"
    fi
    echo "  ✓ 已移除注册行: $PATCH_FILE"
  else
    echo "  ✓ 未找到注册行（已卸载）"
  fi
fi

echo
echo "✅ 卸载完成。重启 GUI（或下次启动）后插件不再加载。"
