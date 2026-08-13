# dsh-plugin —— DSH（DeepSeek Harness）专用目录

> **⚠️ 本目录只对 DSH（DeepSeek Harness）用户有用。**
> Codex / Claude Code 等其他 Agent 完全不需要它——它们的 Dashboard 是技能包
> 自带的静态网页（`skills/promentor/dashboard/` + `scripts/serve.py`）。

本目录把 ProMentor Dashboard 从"本地挂 Python 静态服务"（`scripts/serve.py`）
升级为 **DSH Web GUI 内置插件**，包含三部分：

| 路径 | 内容 |
|------|------|
| `dist/@deepseek-ai/dsh-*-promentor/` | **预构建插件包**（安装用，随仓库提交） |
| `src/host-promentor/` | **插件源码镜像**：host 数据网关（对应 deepseek-harness `packages/host/promentor`） |
| `src/client-ui-promentor/` | **插件源码镜像**：面板 UI（对应 deepseek-harness `packages/client/ui-promentor`） |

插件源码的权威位置是 deepseek-harness 仓库的分支
`feat/promentor-dashboard-plugin`；`src/` 是与 `dist/` 一起提交的同步镜像
（供查阅，构建仍需 harness 工作区，见 `rebuild-dist.sh`）。

## 界面

- 会话输入框上方会出现一个 **ProMentor** 按钮（composer dock），
  **仅当当前会话工作区存在 `.promentor/` 课程时显示**（每 10 秒自动探测：
  `init` 生成课程后按钮自动出现，删除 `.promentor/` 后自动消失）。
- 点击打开全屏 Dashboard 面板，展示**当前会话工作目录**的 `.promentor/`
  课程：总体进度、章节表格、讲义与源码导读（Markdown 渲染）。
- 面板右上角可刷新 / 关闭。

## 安装（一条命令）

```sh
bash dsh-plugin/install.sh
```

脚本幂等、可重复执行；支持 `DSH_HOME=/path/to/.dsh bash dsh-plugin/install.sh`
自定义 DSH 配置目录。完成后**重启 GUI**（Ctrl+C 后重新运行启动命令）并刷新
`http://127.0.0.1:3080` 页面，即可看到 dock 按钮。

安装逻辑：

1. 把 `dist/@deepseek-ai/dsh-*-promentor/` 拷贝进
   `~/.dsh/profiles/node_modules/@deepseek-ai/`（DSH 启动时重建该目录的内置
   软链但不会删除外部加入的包，拷贝跨重启持久生效）。若该包名已由 DSH 源码
   安装的内置闭包管理为软链，则保持不动（自动跟随源码构建）。
2. 把注册行（来自 `cordis.patch.yml`，剥离注释后）合并进
   `~/.dsh/profiles/web/cordis.patch.yml`：替换模板的 `[]` 或追加到列表
   末尾；先剥旧块再重写，幂等且可自愈历史损坏文件。

## 卸载

```sh
bash dsh-plugin/uninstall.sh      # 移除插件包与注册行（恢复模板 []），重启 GUI 后不再加载
```

## 文件

| 文件 | 作用 |
|------|------|
| `dist/@deepseek-ai/dsh-*-promentor/` | 预构建插件包（随仓库提交；更新请运行 `rebuild-dist.sh`） |
| `src/` | 插件源码镜像（host + client，随仓库提交） |
| `cordis.patch.yml` | 注册行的唯一事实来源（install.sh 剥离注释后取用） |
| `install.sh` | 一键安装：拷贝预构建包 + 幂等合并注册行 |
| `uninstall.sh` | 逆操作 |
| `rebuild-dist.sh` | 维护者专用：从 deepseek-harness 插件源码重新构建 `dist/` 并同步 `src/` |

## 原理

1. `dsh web` 的 profile 配置树根在 `~/.dsh/profiles/web/`，
   `cordis.patch.yml` 在启动时被读取；**修改后需要重启 GUI 才生效**（当前
   版本的进程内热监听不可靠，安装/卸载脚本均按"重启"设计）。
2. 插入的两行让 loader 挂载两个新插件；`dsh-client-modules` 的增量扫描
   把 `dsh.client` 包合入 `window.__DSH_BOOT__` 入口图，刷新页面后生效。
3. 模块解析锚点是 `~/.dsh/profiles/node_modules`（启动时从安装锚点 BFS
   出的软链目录，仅增不删）；`install.sh` 拷贝进去的预构建包不在 DSH
   内置闭包内，因此**跨重启持久**；若是源码安装且包已在闭包内，则保持
   其软链由 DSH 管理。
4. 浏览器端 UI 通过 `/promentor/data?ws=<workspace>&p=<rel>` 读取课程数据，
   该路由由 host 插件注册，读取被严格限制在 `<workspace>/.promentor/` 内。
