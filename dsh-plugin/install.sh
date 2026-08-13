#!/usr/bin/env bash
# ============================================================================
# ProMentor Dashboard —— DSH Web GUI 插件一键安装（幂等，可重复执行）
#
# 不需要 deepseek-harness 源码、不需要 Node/pnpm、不需要编译：
# 预构建产物在 dsh-plugin/dist/（不入库，随 Release zip 分发或本地构建），本脚本只做两件事：
#   1. 把两个插件包拷贝进 ~/.dsh/profiles/node_modules/@deepseek-ai/
#      （DSH 启动时会自动重建该目录里的内置软链，但不会删除外部加入的
#        包，所以拷贝会跨重启持久生效）
#   2. 把注册行幂等写入 ~/.dsh/profiles/web/cordis.patch.yml
#
# 用法：
#   bash dsh-plugin/install.sh
#   DSH_HOME=/path/to/.dsh bash dsh-plugin/install.sh   # 自定义 DSH_HOME
# ============================================================================
set -euo pipefail

DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILE_DIR="$DSH_HOME/profiles/web"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
NM_DIR="$DSH_HOME/profiles/node_modules"
DIST_DIR="$(cd "$(dirname "$0")" && pwd)/dist"

HOST_NAME="@deepseek-ai/dsh-host-promentor"
CLIENT_NAME="@deepseek-ai/dsh-client-ui-promentor"

echo "▶ ProMentor Dashboard 插件一键安装"
echo "  DSH_HOME: $DSH_HOME"

[ -d "$DSH_HOME/profiles" ] || {
  echo "错误：没有找到 DSH 配置文件目录（$DSH_HOME/profiles）。"
  echo "请先安装并成功启动过一次 DSH Web GUI（任意项目启动一次即可），再运行本脚本。"
  exit 1
}
[ -d "$DIST_DIR/$HOST_NAME" ] && [ -d "$DIST_DIR/$CLIENT_NAME" ] || {
  echo "错误：找不到预构建产物 $DIST_DIR/{$HOST_NAME,$CLIENT_NAME}"
  echo "请确认本脚本位于 ProMentor 仓库的 dsh-plugin/ 目录内（或 release 包完整解压）。"
  exit 1
}

# 1) 安装插件包。
#    若是软链：说明该名字由 DSH 源码安装的内置依赖闭包管理（heal 每次启动
#    重建，且要求该路径必须是软链），保持不动即可——它始终指向源码里的
#    最新构建。
#    否则（npm 安装的 DSH）：拷贝预构建产物为真实目录；DSH 启动时不会删除
#    闭包之外的包，因此跨重启持久生效。
mkdir -p "$NM_DIR"
for name in "$HOST_NAME" "$CLIENT_NAME"; do
  if [ -L "$NM_DIR/$name" ]; then
    echo "  ✓ 已由 DSH 源码安装管理（软链，自动跟随源码构建）: $name"
  else
    rm -rf "$NM_DIR/$name"
    cp -R "$DIST_DIR/$name" "$NM_DIR/$name"
    echo "  ✓ 安装: $name"
  fi
done

# 2) 幂等写入注册行（先剥掉旧块再重写，可自愈历史损坏的 patch 文件）。
#    模板文件以一行 `[]` 结尾（完整 YAML 文档），直接追加会变成第二个文档
#    导致解析失败；因此：有 `[]` 就替换它，没有就追加到列表末尾。
ROWS_SOURCE="$DIST_DIR/../cordis.patch.yml"
ROWS_FILE="$(mktemp)"
printf '%s\n' '# ProMentor Dashboard 插件（dsh-plugin/install.sh 安装）' > "$ROWS_FILE"
grep -v '^[[:space:]]*#' "$ROWS_SOURCE" | sed '/^[[:space:]]*$/d' >> "$ROWS_FILE"

mkdir -p "$PROFILE_DIR"
if [ -f "$PATCH_FILE" ]; then
  # 剥掉旧块：从块标记注释到所属的最后一行注册（name: ...ui-promentor）。
  # 循环执行以兼容历史上可能残留的多个块。
  while grep -q '^# ProMentor Dashboard 插件' "$PATCH_FILE"; do
    sed -i '' "/^# ProMentor Dashboard 插件/,/^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE" 2>/dev/null \
      || sed -i "/^# ProMentor Dashboard 插件/,/^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE"
  done
  # 清理历史上旧版脚本剥块时残留的孤立行（行 id 与包名全局唯一，精确删除安全）
  sed -i '' "/^    - id: promentor\$/d; /^    - id: ui-promentor\$/d; /^      name: '@deepseek-ai\/dsh-host-promentor'\$/d; /^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE" 2>/dev/null \
    || sed -i "/^    - id: promentor\$/d; /^    - id: ui-promentor\$/d; /^      name: '@deepseek-ai\/dsh-host-promentor'\$/d; /^      name: '@deepseek-ai\/dsh-client-ui-promentor'\$/d" "$PATCH_FILE"
  # 压平删除产生的连续空行
  cat -s "$PATCH_FILE" > "$PATCH_FILE.tmp" && mv "$PATCH_FILE.tmp" "$PATCH_FILE"
  awk -v rowsfile="$ROWS_FILE" '
    /^\[\]$/ { while ((getline line < rowsfile) > 0) print line; close(rowsfile); replaced = 1; next }
    { print }
    END { if (!replaced) { print ""; while ((getline line < rowsfile) > 0) print line } }
  ' "$PATCH_FILE" > "$PATCH_FILE.tmp"
  mv "$PATCH_FILE.tmp" "$PATCH_FILE"
else
  cat "$ROWS_FILE" > "$PATCH_FILE"
fi
rm -f "$ROWS_FILE"
echo "  ✓ 已写入注册行: $PATCH_FILE"

echo
echo "✅ 安装完成。"
echo "   - 若 GUI 正在运行：重启它（Ctrl+C 后重新运行启动命令），然后刷新浏览器页面。"
echo "   - 刷新后，在【已初始化 .promentor/ 课程的会话】输入框上方会出现 ProMentor 按钮。"
echo "   - 更新插件：重新下载/更新 ProMentor 后，再次运行本脚本即可覆盖安装。"
echo
echo "卸载：bash dsh-plugin/uninstall.sh"
