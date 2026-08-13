# ProMentor

> 把任意开源项目转成 MIT 风格的动手工程课程 在实践中学习

ProMentor 是一个 **AI Coding Agent Skill**。装上它，你的 AI 编程助手立刻化身为导师——扫描项目架构、生成阶梯式 Chapter、带你手写核心逻辑、自动判题、AI Code Review。

**学的不是算法题，是一个真实系统的架构设计能力。**

## 安装

### ① DSH Web GUI 内置 Dashboard（DSH 专用，先看这里）

> **为什么 DSH 要多装一步**：Codex / Claude Code 等其他 Agent 的 Dashboard 是技能包自带的
> 静态网页（技能包解压即用）；而 **DSH（DeepSeek Harness）的 Dashboard 是集成进 Web GUI
> 的插件**，需要安装注册一次。装好后点按钮即开，无需任何本地服务，体验反而更好。
> 插件以**预构建产物**随 Release 压缩包分发（仓库本身不含构建产物，见文末"发版"）。

**前置条件**

- DSH Web GUI 已安装并能运行（无论 `npm i -g @deepseek-ai/dsh` 还是源码方式），
  且**成功启动过至少一次**（用于生成配置文件）
- 已获得 `dsh-plugin/` 目录（见下）

**获取 dsh-plugin（二选一）**

- **方式 A（推荐，免构建）**：从 [Releases](https://github.com/Lyn-77/ProMentor/releases)
  下载 `promentor.zip`（内含预构建的 dashboard 与 `dsh-plugin/dist/`），解压后
  得到 `promentor/` 目录。
- **方式 B（源码）**：`git clone` 本仓库（仓库不含构建产物），按下方"发版"
  章节构建 `dsh-plugin/dist/`，或直接构建后使用 `dsh-plugin/`。

**安装（一条命令）**

```bash
# 方式 A：在解压出的 promentor/ 目录内
cd <解压目录>/promentor
bash dsh-plugin/install.sh

# 方式 B：在仓库根目录
cd /path/to/ProMentor
bash dsh-plugin/install.sh
```

脚本是幂等的（可重复执行），只做两件事：

1. **安装插件包**：把 `dsh-plugin/dist/` 里的两个预构建包
   （`@deepseek-ai/dsh-host-promentor` 数据网关 + `@deepseek-ai/dsh-client-ui-promentor`
   面板 UI）拷贝进 `~/.dsh/profiles/node_modules/@deepseek-ai/`。DSH 启动时
   会重建该目录的内置软链，但**不会删除外部加入的包**，因此跨重启持久生效。
   （若你是从 DSH 源码运行且该包已由内置闭包管理为软链，脚本会识别并保持不动。）
2. **写入注册行**：把两行插件注册幂等写入 `~/.dsh/profiles/web/cordis.patch.yml`
   （自动处理模板 `[]` 合并，可自愈历史损坏文件）。

然后**重启 GUI**：Ctrl+C 停掉 `dsh web`，重新运行启动命令，刷新浏览器页面。

**验证**：刷新后，在【已初始化 `.promentor/` 课程的会话】输入框上方会出现
**ProMentor** 按钮（无课程的工作区不显示按钮），点击打开 Dashboard——面板跟随
当前会话的工作目录，直接读取 `.promentor/` 课程数据，无需任何本地服务。

**更新插件**：重新下载 Release 包（或重新构建后），再次运行
`bash dsh-plugin/install.sh` 覆盖安装，重启 GUI 即可。

**卸载**：

```bash
bash dsh-plugin/uninstall.sh      # 移除插件包与注册行，重启 GUI 后插件不再加载
```

**常见问题**

| 现象 | 处理 |
|------|------|
| 报错"没有找到 DSH 配置文件目录" | 先成功启动过一次 `dsh web` 再运行安装脚本 |
| 报错"找不到预构建产物" | 你用的是源码方式但还没构建：见文末"发版"，或改下 Release zip |
| 启动报错 `Cannot find package '@deepseek-ai/dsh-*-promentor'` | 注册行还在但插件包解析不到（如源码目录被移走/软链悬空）：重跑 `bash dsh-plugin/install.sh` 覆盖安装（会自动清除悬空软链），或先卸载再安装 |
| 没有出现 ProMentor 按钮 | 确认已重启 GUI、浏览器强刷（Cmd/Ctrl+Shift+R）、当前会话工作区已 `/promentor init` |
| 面板打不开 | 重新运行 `install.sh` 后重启 GUI；仍不行可查看 GUI 启动日志 |

**发版（维护者，仓库不含任何构建产物）**

```bash
make build        # 或直接 make：构建一切（dashboard + DSH 插件 dist）
make release      # 打 zip 到 release/promentor.zip（缺失的产物自动构建）
```

- 发版流程：`make build && make release`，然后把 `release/promentor.zip`
  上传到 GitHub Releases（可重命名为 `promentor-skill-<版本>.zip`）。
- `release/` 目录不入库（.gitignore），是发版输出专用文件夹。
- DSH 插件源码：deepseek-harness 仓库（`packages/host/promentor` +
  `packages/client/ui-promentor`，分支 `feat/promentor-dashboard-plugin`），
  并镜像在本仓库 `dsh-plugin/src/`（源码入库，构建产物不入库）。
- `make release` 底层调用 `pack-release.sh`：自动调用
  `dsh-plugin/rebuild-dist.sh`（需要 `DSH_HARNESS` 指向 deepseek-harness）
  与 dashboard 构建（需要 Node/pnpm）；产物已存在则跳过。
- `make clean` 删除全部构建产物与 `release/` 输出。

### ② 其他 Agent：从 Release 解压（推荐）

1. 前往 [Releases](https://github.com/Lyn-77/ProMentor/releases) 下载最新 `promentor.zip`（或 `promentor-skill-<版本>.zip`）
2. 解压后把 `promentor/` 放到 `.{YourAgent}/skills/promentor`
   （DSH 用户：`promentor/dsh-plugin/` 即插件的完整目录，见上方 ①）

### ③ 其他 Agent：从源码构建

需要 Node.js 与 pnpm：

```bash
cd dashboard
pnpm install
pnpm build:dashboard
```

然后，将整个 `skills/promentor/` 目录复制到 `.{YourAgent}/skills/promentor`
（构建产物会自动输出到 `skills/promentor/dashboard/`）

运行时仅需 Python 3 标准库

### ④ 同步到本机已安装副本（Codex）

仓库 `skills/promentor/` 是唯一事实来源。修改后同步到 Codex 技能目录：

```bash
rsync -a --delete skills/promentor/ ~/.agents/skills/promentor/
```

## 使用

在 DSH（DeepSeek Harness）、Codex、Claude Code 等支持 `/promentor` 命令的 AI 编程助手中打开你的项目，然后：

### 1. 生成课程

```
/promentor init
```

AI 自动扫描你的项目，分析架构，生成课程大纲。你确认后，逐 Chapter 生成讲义、Lab、行为测试。

### 2. 学习

```
/promentor learn ch01
```

AI 讲解讲义、带你读标注过的源码、引导你手写核心逻辑。

### 3. 测试

```
/promentor test
```

AI 运行行为测试，告诉你哪些通过了、哪些失败了、为什么。

### 4. 获取提示

```
/promentor hint
```

AI 读了你的代码和测试结果，给你**针对当前错误的、分层的**提示。从方向到思路，不直接给答案。

### 5. 提交

```
/promentor submit
```

全量测试 + 锁定成绩。代码保存到提交历史。

### 6. AI Code Review

```
/promentor review
```

AI 对比你的实现 vs 原始源码，解释设计决策、"为什么这样做"、你可以如何改进。

### 7. 查看进度

```
/promentor         # 课程面板
/promentor progress # 详细进度
```

### 8. 查看仪表盘（网页 Dashboard）

```
/promentor dashboard
```

**DSH Web GUI 内置面板（推荐）**：点击会话输入框上方的 `ProMentor` 按钮，
面板跟随当前会话的工作目录，直接读取 `.promentor/` 课程数据——无需任何本地服务。
安装教程见上方 **① DSH Web GUI 内置 Dashboard**（一条命令 `bash dsh-plugin/install.sh`）。

**独立仪表盘（备用，供 Codex / Claude Code 等）**：自动读取 `.promentor/` 下生成的课程数据，浏览器网页与 Agent 对话双通道查看。

**功能**

- 主页概览：总体完成度、当前学习章节、已完成/学习中/未开始统计、每章状态/分数/尝试次数、内容完整性警告
- 章节独立页面：`/dashboard/chapters/<chapter_id>/` 直达任意章节，可刷新、可分享
- 左侧边栏：一键切换讲义（Lecture）与源码导读（Source）
- 主题切换：右上角按钮在浅色/深色模式间切换
- Markdown 增强渲染：代码语法高亮、Mermaid 图、数学公式、CJK 排版（Streamdown）

**自动启动**

`/promentor init` 结束与 `/promentor learn <ch>` 开始时，会提示打开 GUI 内置面板
（插件未安装时自动启动独立仪表盘并输出访问地址）。

**架构**

- DSH 插件模式：host 数据网关（`packages/host/promentor`）+ GUI 面板
  （`packages/client/ui-promentor`），位于 deepseek-harness 仓库，本仓库 `dsh-plugin/`
  目录负责注册（`install.sh` / `uninstall.sh`）
- 独立服务模式（备用）：全局单进程，重复启动复用已有进程；网页只存在于技能包
  `dashboard/` 内，不复制到项目目录；服务启动时读取项目根目录的 `.promentor/` 数据

使用方式（备用模式）：

```
cd /path/to/project
python3 <promentor-skill>/scripts/serve.py          # 启动并打开浏览器
python3 <promentor-skill>/scripts/serve.py status   # 查看运行进程
python3 <promentor-skill>/scripts/serve.py stop     # 停止
```

## 命令速查

| 命令 | 说明 |
|------|------|
| `/promentor init` | 分析项目，生成课程 |
| `/promentor` | 课程面板（目录 + 进度） |
| `/promentor learn <ch>` | 进入指定 Chapter 学习 |
| `/promentor test` | 运行行为测试 |
| `/promentor hint` | 动态生成分层提示 |
| `/promentor submit` | 正式提交，锁定成绩 |
| `/promentor review` | 对比实现 vs 原始源码 |
| `/promentor progress` | 查看总进度 |
| `/promentor dashboard` | 课程仪表盘（完成度 + 当前学习 + 内容完整性） |

## 学习模型

```
Learn Concept     （AI 讲解讲义）
    ↓
Read Source Code  （AI 带你读标注过的源码）
    ↓
Implement Lab     （手写核心逻辑）
    ↓
Run Tests         （/promentor test）
    ↓
Submit & Review   （/promentor submit → /promentor review）
    ↓
Master System Design
```

## 为什么是 ProMentor

- **比直接读源码有路线**：不是随机跳转，是有依赖关系的阶梯式学习路径
- **比视频课深入**：不是看别人写代码，是自己亲手实现核心逻辑
- **比博客系统化**：不是碎片化知识点，是完整理解一个系统的设计哲学
- **AI 原生**：课程由 AI 生成、AI 讲解、AI 判题、AI Review。零内容生产成本。
