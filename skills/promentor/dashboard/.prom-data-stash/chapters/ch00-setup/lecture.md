# Ch 0：环境搭建与最小 TUI

## 这一章学什么

跑通第一个可运行的 Bubble Tea 程序，理解它的核心循环：

```
Model（状态） ──接收 Msg──▶ Update（纯函数）──返回──▶ Model + Cmd
    ▲                                                        │
    └──────────────────── View（渲染）◀──────────────────────┘
```

这是整个 WakeUp 的地基。后面的页面路由、模态状态机、异步任务全部建立在这套循环之上。

## 为什么这个架构值得学

传统命令行程序是**命令式**的：`for { read key; do something; print }`。状态散落在全局变量里，按键处理、业务逻辑、渲染搅在一起。

Bubble Tea 采用 **Elm 架构**（前端函数式架构的移植）：

1. **状态** 是一个值（struct），不是一堆全局变量
2. **消息**（`tea.Msg`）是状态变化的唯一触发器
3. **Update** 是纯函数：`(状态, 消息) → (新状态, 命令)`
4. **副作用** 不直接执行，而是包装成 `tea.Cmd`（一个返回消息的闭包），由运行时执行

```go
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    // 纯函数：输入 (m, msg)，输出 (新 m, cmd)
    // 没有打印，没有网络，没有文件写入 —— 这些全在 Cmd 里
}
```

关键理解：**Update 不做事，只决定做什么**。真正的工作（发送网络包、写文件）放进 `func() tea.Msg` 闭包返回给运行时。

## 核心概念

### 1. Model —— 状态即值

Model 就是你的整个 UI 状态。在 WakeUp 里，列表页的 Model 持有光标位置、当前模态、选中集合：

```go
type Model struct {
    count int  // 本 Lab 的玩具状态
}
```

值语义很重要：Update 返回**新的** Model，旧的不变。这保证了可预测性 —— 相同输入永远相同输出，测试也就简单了。

### 2. Msg —— 状态变化的触发器

按键、窗口尺寸变化、异步任务完成……一切事件都是 `tea.Msg`。运行时把终端输入翻译成消息喂给 Update：

```go
if key, ok := msg.(tea.KeyMsg); ok && key.String() == "q" {
    return m, tea.Quit
}
```

类型断言 `msg.(tea.KeyMsg)` 是消息路由的标准手法 —— 用 Go 的类型系统做分发，不需要 switch 一个字符串 ID。

### 3. Cmd —— 副作用的描述，不是执行

`tea.Quit` 是一个特殊 Cmd。任何你想做的副作用都写成闭包：

```go
func() tea.Msg {
    err := wol.SendMagicPacket(mac, addr, port)
    return WOLResultMsg{Err: err, DeviceMAC: mac}  // 结果再作为消息回到 Update
}
```

这是全书的精髓：**副作用去一个方向（进去），结果走另一个方向（消息回来）**。UI 逻辑永远不被阻塞。

## 设计决策

**为什么 Update 返回 `(tea.Model, tea.Cmd)` 而不是直接改状态？**

如果 Update 直接改字段然后返回，你就无法把"发生了什么"和"接下来做什么"分开。返回新值让每个消息的处理成为原子变换，可以轻松测试、回放、调试。

## 源码导读入口

读 `main.go:36-73` —— 顶层 Model 的 Update：全局键捕获 + 委托给页面。看它如何用类型断言吃掉全局消息，其余全部交给 `m.page.Update(msg)`。

## Lab 指引

你要实现一个最小计数器程序（package `tuikit`）：

```
func New() Model
func (m Model) Count() int          // 供测试观察状态
func (m Model) Init() tea.Cmd
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd)
func (m Model) View() string
```

行为契约：
- `j` / `down` → count +1
- `q` → 返回 `tea.Quit`
- 其他键 → 无变化
- `View()` 渲染出当前计数值

写完后用 `go test` 跑 `lab_test.go`。全部通过再进入 Ch 1。
