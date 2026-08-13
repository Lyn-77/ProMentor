#!/usr/bin/env bash
# ============================================================================
# ProMentor Release 打包脚本（维护者发版用）
#
# 产出：skills/promentor.zip —— 完整技能包压缩包，上传到 GitHub Releases 分发。
#   包内结构：
#     promentor/                   技能包（SKILL.md、agents、references、scripts、
#                                  预构建 dashboard/）
#     promentor/dsh-plugin/        DSH 插件目录（install/uninstall 脚本 + 预构建 dist/）
#
# 仓库本身不存放任何构建产物（.gitignore 排除）；本脚本在发版时负责
# 构建并打包：
#   - dashboard 构建需要 Node.js + pnpm（dashboard/ 目录内构建）
#   - DSH 插件 dist 需要 deepseek-harness 仓库（见 dsh-plugin/rebuild-dist.sh）
#
# 用法：
#   bash pack-release.sh                 # 产物缺失时自动构建
#   DSH_HARNESS=/path/to/harness bash pack-release.sh
# ============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ZIP="skills/promentor.zip"
SKILL_DIR="skills/promentor"
DASHBOARD_MARKER="$SKILL_DIR/dashboard/_next"
DIST_MARKER="dsh-plugin/dist/@deepseek-ai/dsh-host-promentor/package.json"

echo "▶ ProMentor Release 打包"
echo "  输出: ${ZIP}"

# 1) dashboard 构建产物（缺失则构建）
if [ ! -d "$DASHBOARD_MARKER" ]; then
  echo "▶ 构建 dashboard …"
  (cd dashboard && pnpm install >/dev/null 2>&1 || true)
  (cd dashboard && pnpm build:dashboard)
fi

# 2) DSH 插件 dist（缺失则构建；需要 deepseek-harness，见脚本内提示）
if [ ! -f "$DIST_MARKER" ]; then
  echo "▶ 构建 DSH 插件 dist …"
  bash dsh-plugin/rebuild-dist.sh
fi

# 3) 组装 zip：promentor/ = 技能包 + dsh-plugin/（含预构建产物）
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -R "$SKILL_DIR" "$TMP/promentor"
cp -R dsh-plugin "$TMP/promentor/dsh-plugin"
# 排除本地开发数据与垃圾文件
rm -rf "$TMP/promentor/.promentor"
find "$TMP/promentor" -name '__pycache__' -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$TMP/promentor" -name '*.pyc' -delete 2>/dev/null || true
find "$TMP/promentor" -name '.DS_Store' -delete 2>/dev/null || true

rm -f "$ZIP"
(cd "$TMP" && zip -r -X "$ROOT/$ZIP" promentor >/dev/null)
echo "✅ 已生成: ${ZIP}（$(du -sh "$ZIP" | cut -f1)）"
echo "  下一步：把 ${ZIP} 上传到 GitHub Releases（可重命名为 promentor-skill-<版本>.zip）。"
