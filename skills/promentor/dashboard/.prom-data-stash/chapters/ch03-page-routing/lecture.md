# Ch 3：页面路由 · Update 返回下一页

## 这一章学什么

顶层模型如何把消息委托给当前页面，页面如何用 **返回值** 决定下一页 —— 而不是靠一个集中式 router 的 switch 分发。

这是 WakeUp 全书最精妙的设计决策。看懂它，你就看懂了"如何让分支消失"。

## 为什么这一章值得学

大多数多页面程序写一个路由表：

```go
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    switch m.currentPage {
    case "list":
        return m.listPage.Update(msg)
    case "form":
        return m.formPage.Update(msg)
    case "menu":
        return m.menuPage.Update(msg)
    }
}
```

每加一个页面，switch 就多一个分支。页面 A 想跳去 B，需要上层知道"B 存在"。**页面不知道彼此，路由表知道一切** —— 这是僵化（Rigidity）的来源。

WakeUp 的做法完全不同：**没有路由表**。

## 核心概念

### 1. 顶层模型：透明的信封

```go
type model struct {
    page tea.Model   // 当前页面 —— 接口，不关心具体类型
    ...
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    // 1. 全局键：ctrl+c
    // 2. 全局消息：SaveResultMsg
    // 3. 其余一切 → 委托
    newPage, cmd := m.page.Update(msg)
    m.page = newPage
    return m, cmd
}
```

顶层只做三件事：窗口尺寸、强制退出、静默吞掉它不该关心的消息。**剩下的，原样递给页面**。

### 2. 页面自治：返回什么，就是什么

关键在这两行：

```go
newPage, cmd := m.page.Update(msg)
m.page = newPage
```

页面不是"请求"跳转，而是**直接返回**下一个页面：

```go
// 列表页按 a → 返回表单页
case "a":
    return NewFormModel(m.store, m.width, m.height, -1), nil

// 菜单页"查看设备" → 返回列表页
func (m MenuModel) goToList(hint string) (tea.Model, tea.Cmd) {
    l := NewListModel(m.store, m.width, m.height)
    l.hint = hint
    return l, nil
}
```

页面自己决定自己要去哪。**路由逻辑长在每个页面里，而不是集中在一张表里**。新增页面 = 新增一个实现了 `tea.Model` 的类型，不需要改任何路由代码。

### 3. 设计内核：返回模型，而不是发信号

想象一个"信号版"：页面发 `Msg{GoTo: "form"}`，顶层 switch 它跳转。那顶层又要知道所有页面，又要解析信号 —— 双重耦合。

直接返回 `tea.Model` 的做法，利用的是 Go 接口类型系统：`Update` 的返回值类型 `tea.Model` 允许任何实现。**跳转的"什么"和"怎么跳"在同一个地方** —— 不需要中间协议。

## 设计决策

**为什么值接收者（value receiver）而非指针？**

看 `main.go` 顶层：`m.page = newPage`。如果页面是指针，跳转就是换指针；如果是值，就是换值。两种都行。原代码全用**值接收者**，因为 Bubble Tea 的 Update 是纯函数 —— 值拷贝保证"旧状态不可变"，避免一个页面意外改到另一个页面的状态。

**顶层真的什么都不做吗？**

不做业务，但做**横切关注点**（cross-cutting concerns）：强制退出、窗口尺寸、静默消息。这些是"任何页面都需要但不想让每个页面重复 if 一遍"的事 —— 由顶层一次处理，页面代码保持纯净。

## 源码导读入口

读 `main.go:36-73`（顶层委托）和 `ui/menu.go:144-167`（页面返回下一页）。注意 `goToList` 如何携带 `hint` 上下文跳转 —— 跳转时还能带参数，不需要全局状态。

## Lab 指引

实现一个双页面委托系统（package `pages`）：

```
type Top struct{ ... }
type PageA struct{ visits int }
type PageB struct{ visits int }

func New() Top
func (m Top) Update(msg tea.Msg) (tea.Model, tea.Cmd)   // q 退出，其余委托
func (m Top) CurrentPage() string                        // "A" / "B"
func (m Top) PageAVisits() int                           // 当前是 A 时返回其 visits，否则 -1
func (m Top) PageBVisits() int
func (m PageA) Init() tea.Cmd
func (m PageA) Update(msg tea.Msg) (tea.Model, tea.Cmd)  // j → visits+1；n → 返回 PageB
func (m PageA) View() string
func (m PageB) Init() tea.Cmd
func (m PageB) Update(msg tea.Msg) (tea.Model, tea.Cmd)  // k → visits+1；p → 返回 PageA
func (m PageB) View() string
```

行为契约：
- `New()` 初始页面是 A
- 页面 A 收到 `n` → 返回 B；页面 B 收到 `p` → 返回 A
- 顶层收到 `q` → 退出；其他消息原样委托当前页面
- `j` 只在 A 上计数，`k` 只在 B 上计数（验证委托到正确的页面）

写完 `go test -v ./...`。
