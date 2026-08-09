# ProMentor

> 把任意开源项目转成 MIT 风格的动手工程课程 在实践中学习

ProMentor 是一个 **AI Coding Agent Skill**。装上它，你的 AI 编程助手立刻化身为导师——扫描项目架构、生成阶梯式 Chapter、带你手写核心逻辑、自动判题、AI Code Review。

**学的不是算法题，是一个真实系统的架构设计能力。**

## 安装

将 `skills/promentor/` 整个目录复制到 `.{YourAgent}/skills/promentor`
（包含 `SKILL.md`、`serve.py` 与构建好的 `dashboard/` 静态站点，不含 Next.js 源码）

不需要安装任何依赖。不需要数据库。ProMentor 只是告诉 AI 怎么当一个好老师。

## 使用

在 Claude Code 中打开你的项目，然后：

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

自动读取 `.promentor/` 下生成的课程数据，浏览器网页与 Agent 对话双通道查看。

**功能**

- 主页概览：总体完成度、当前学习章节、已完成/学习中/未开始统计、每章状态/分数/尝试次数、内容完整性警告
- 章节独立页面：`/dashboard/chapters/<chapter_id>/` 直达任意章节，可刷新、可分享
- 左侧边栏：一键切换讲义（Lecture）与源码导读（Source）
- 主题切换：右上角按钮在浅色/深色模式间切换
- Markdown 增强渲染：代码语法高亮、Mermaid 图、数学公式、CJK 排版（Streamdown）

**自动启动**

`/promentor init` 结束与 `/promentor learn <ch>` 开始时，会自动启动仪表盘并输出访问地址——Agent 对话与浏览器网页都能查看。

**架构**

- 全局单进程：重复启动复用已有进程，在另一个项目学习时自动切换
- 网页只存在于技能包内，不复制到项目目录；服务启动时读取项目根目录的 `.promentor/` 数据

使用方式：

```
cd /path/to/project
python3 <promentor-skill>/serve.py          # 启动并打开浏览器
python3 <promentor-skill>/serve.py status   # 查看运行进程
python3 <promentor-skill>/serve.py stop     # 停止
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
