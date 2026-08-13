# ProMentor Dashboard —— DSH Web GUI 插件注册层

本目录把 ProMentor Dashboard 从"本地挂 Python 静态服务"（`scripts/serve.py`）
升级为 **DSH Web GUI 内置插件**：

- 插件代码（host 数据服务 + client 面板 UI）位于 deepseek-harness 仓库：
  - `packages/host/promentor`（`@deepseek-ai/dsh-host-promentor`）
  - `packages/client/ui-promentor`（`@deepseek-ai/dsh-client-ui-promentor`）
- 本目录只负责**注册**：`cordis.patch.yml` 是注册行的唯一事实来源，
  `install.sh` 把它幂等地写入 `~/.dsh/profiles/web/cordis.patch.yml`
  （**注意**：写入后需重启 GUI——Ctrl+C 停掉 `dsh web` 后重新启动——再刷新浏览器才能生效）。

## 界面

- 会话输入框上方会出现一个 **ProMentor** 按钮（composer dock）。
- 点击打开全屏 Dashboard 面板，展示**当前会话工作目录**的 `.promentor/`
  课程：总体进度、章节表格、讲义与源码导读（Markdown 渲染）。
- 面板右上角可刷新 / 关闭。

## 安装（一条命令）

```sh
DSH_HARNESS=/path/to/deepseek-harness bash plugin/install.sh
```

或直接：

```sh
bash plugin/install.sh        # 默认找 ~/CODE/project/deepseek-harness
```

脚本幂等：可重复执行。完成后**重启 GUI**（Ctrl+C 后重新运行启动命令）并刷新
`http://127.0.0.1:3080` 页面，即可看到 dock 按钮。

## 卸载

```sh
bash plugin/uninstall.sh      # 从 profiles/node_modules 移除软链、从 patch 层移除注册行
```

## 文件

| 文件 | 作用 |
|------|------|
| `cordis.patch.yml` | 注册行的唯一事实来源（host + client 两行） |
| `install.sh` | 构建插件包 → 软链进 `~/.dsh/profiles/node_modules` → 幂等写入 patch 层 |
| `uninstall.sh` | 逆操作 |

## 原理

1. `dsh web` 的 profile 配置树根在 `~/.dsh/profiles/web/`，
   `cordis.patch.yml` 在启动时被读取；**修改后需要重启 GUI 才生效**（当前
   版本的进程内热监听不可靠，安装/卸载脚本均按"重启"设计）。
2. 插入的两行让 loader 挂载两个新插件；`dsh-client-modules` 的增量扫描
   把 `dsh.client` 包合入 `window.__DSH_BOOT__` 入口图，刷新页面后生效。
3. 模块解析锚点是 `~/.dsh/profiles/node_modules`（启动时从安装锚点 BFS
   出的软链目录）；`install.sh` 为当前进程补齐两个新包的软链，下次启动
   该目录会被自动重建（因为两个包已声明为 `dsh-web-app` 的依赖）。
4. 浏览器端 UI 通过 `/promentor/data?ws=<workspace>&p=<rel>` 读取课程数据，
   该路由由 host 插件注册，读取被严格限制在 `<workspace>/.promentor/` 内。
