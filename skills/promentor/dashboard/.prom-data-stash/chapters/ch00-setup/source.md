# 源码导读：环境搭建与最小 TUI

## 核心文件：`main.go:36-73`

顶层 Model 是整个程序的"总开关"。它只做三件事，其余全委托。

### Model 定义（:37-:42）

```go
type model struct {
    page   tea.Model   // 当前页面 —— 接口类型
    store  *store.Store
    width  int
    height int
}
```

注意 `page` 是 `tea.Model` 接口。这就是"委托模式"的种子：顶层不关心页面具体类型，只认接口。

### Update 的分层委托（:48-:69）

三层判断，顺序是经过设计的：

```go
if wsm, ok := msg.(tea.WindowSizeMsg); ok {   // 1. 全局：窗口尺寸
    ...
}
if key, ok := msg.(tea.KeyMsg); ok && key.String() == "ctrl+c" {
    return m, tea.Quit                         // 2. 全局：强制退出
}
if _, ok := msg.(ui.SaveResultMsg); ok {       // 3. 全局：静默吞掉保存结果
    return m, nil
}
newPage, cmd := m.page.Update(msg)             // 4. 其余一切 → 委托页面
m.page = newPage
return m, cmd
```

思考：为什么 `SaveResultMsg` 要在这里**静默消费**而不是透传给页面？

因为保存是 store 层的内部机制，页面不需要知道。顶层把它拦截，是"消除特殊情况"的第一课 —— 不是每个页面都去 if 一遍 `SaveResultMsg`，而是让这个特殊情况在顶层消失。

### Init 与 View 的直通（:44-:73）

```go
func (m model) Init() tea.Cmd { return m.page.Init() }
func (m model) View() string  { return m.page.View() }
```

直接透传。顶层模型是透明的信封，页面才是内容。

## 核心文件：`ui/ui.go:28-36`

Vim 模态常量，全书的状态机基石：

```go
const (
    ModeNormal      = iota
    ModeInsert
    ModeConfirm
    ModeWakeConfirm
    ModeResult
    ModeMultiSelect
    ModeBatchWakeConfirm
)
```

这是一个 7 状态的有限状态机。注意它用 `iota` 自增 —— 状态之间没有等级关系，只是互斥的标签。

## 启动流程：`main.go:79-107`

```go
home, _ := os.UserHomeDir()
dataDir := filepath.Join(home, ".wakeup")     // 数据目录
s, err := store.New(dataDir)                   // 初始化持久化层
m := model{
    page:   ui.NewListModel(s, 80, 24),       // 初始页面：列表页
    ...
}
p := tea.NewProgram(m, tea.WithAltScreen())    // Alt Screen：终端缓冲区切换
p.Run()                                        // 事件循环，阻塞直到 Quit
```

三个关键点：
1. 数据目录固定在 `~/.wakeup/`
2. 初始页面直接是**列表页**（而不是菜单）—— 设计决策：最常用的操作直达
3. `tea.WithAltScreen()` —— 进入独立屏幕缓冲区，退出时终端不留痕迹

## 这一章对应你的 Lab

你的 `tuikit.Model` 就是上面 `model` 的微缩版：一个状态值 + 纯 Update + 渲染 View。先跑通这个最小的，你就能看懂顶层模型为什么这么瘦。
