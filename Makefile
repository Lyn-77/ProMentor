# ProMentor 构建 / 发版统一入口
#
#   make               构建一切需要构建的东西（dashboard + DSH 插件 dist）
#   make build         同上
#   make release       打 Release zip 到 release/promentor.zip（缺失的产物自动构建）
#   make clean         删除全部构建产物与 release 输出
#
# 依赖：
#   - dashboard 构建需要 Node.js + pnpm
#   - DSH 插件 dist 需要 deepseek-harness 仓库（默认
#     ~/CODE/project/deepseek-harness，可用 DSH_HARNESS=/path/to/harness 覆盖）
#
# 产物全部不入库（.gitignore 排除）：发版流程 = make build && make release，
# 然后把 release/promentor.zip 上传到 GitHub Releases。

.DEFAULT_GOAL := build

.PHONY: build release clean

build:
	cd dashboard && pnpm install && pnpm build:dashboard
	bash dsh-plugin/rebuild-dist.sh

release:
	bash pack-release.sh

clean:
	rm -rf skills/promentor/dashboard dsh-plugin/dist release
