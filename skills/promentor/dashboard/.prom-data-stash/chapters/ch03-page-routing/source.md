# 源码导读：页面路由 · Update 返回下一页

## 核心文件：`main.go:36-73`

### Model 与接口抽象（:37-:42）

```go
type model struct {
    page   tea.Model   // 当前页面 —— 只认接口，不认具体类型
    store  *store.Store
    width  int
    height int
}
```

`page tea.Model` 是委托的支点。因为页面类型（列表/菜单/表单）都实现了 `Init/Update/View`，顶层可以完全不认识它们。

### 分层 Update（:48-:69）

```go
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    if wsm, ok := msg.(tea.WindowSizeMsg); ok {
        m.width, m.height = wsm.Width, wsm.Height
    }
    if key, ok := msg.(tea.KeyMsg); ok && key.String() == "ctrl+c" {
        return m, tea.Quit                       // 全局强制退出
    }
    if _, ok := msg.(ui.SaveResultMsg); ok {
        return m, nil                            // 全局静默：保存结果不透传
    }
    newPage, cmd := m.page.Update(msg)           // 一切其他消息 → 委托
    m.page = newPage
    return m, cmd
}
```

三层判断的顺序是设计过的：
1. 窗口尺寸是布局全局事实，任何页面都要 —— 顶层先记
2. `ctrl+c` 是强制逃生舱，任何页面都必须响应 —— 顶层拦截
3. `SaveResultMsg` 是 store 内部机制 —— 顶层静默吞掉，页面不被打扰

第 4 步才是日常路径：委托。注意 `m.page = newPage` —— **接受页面自己选择的下一页**。顶层不做任何"应该去哪"的判断。

### 直通 View 与 Init（:44-:73）

```go
func (m model) Init() tea.Cmd { return m.page.Init() }
func (m model) View() string  { return m.page.View() }
```

完全透传。顶层模型是零逻辑的信封。

## 核心文件：`ui/menu.go:144-167`

### 页面返回下一页

```go
func (m MenuModel) goToList(hint string) (tea.Model, tea.Cmd) {
    l := NewListModel(m.store, m.width, m.height)  // 构造下一页
    l.hint = hint                                   // 跳转时携带上下文
    return l, nil                                   // 直接返回
}

func (m MenuModel) handleSelect() (tea.Model, tea.Cmd) {
    switch m.cursor {
    case 0: return m.goToList("")
    case 1: return NewFormModel(m.store, m.width, m.height, -1), nil
    case 2: return m.goToList("选择一个设备，按 e 进入编辑")
    case 4: return m.goToList("选择一个设备，按 Enter 发送唤醒包")
    case 5: return m, tea.Quit
    default: return m, nil
    }
}
```

`goToList` 让菜单的三四个选项共用"去列表页"的逻辑，还能带上 `hint`（如"按 e 编辑"）—— **跳转带参不需要全局状态，参数从返回值里带出去**。

## 对比：集中式路由 vs 委托式

```
❌ 集中式：                          ✅ 委托式：
m.page = route(msg)                 newPage, cmd := m.page.Update(msg)
switch msg.page {                   m.page = newPage   // 页面自己说去哪
case "list": ...
case "form": ...
}
顶层认识所有页面                   顶层只认接口
加页面 = 改路由表                  加页面 = 新增类型
```

## 这一章对应你的 Lab

你的 `Top` 是 `main.go` 的微缩版，`PageA`/`PageB` 是页面。测试会验证：
1. 初始页面正确
2. `n`/`p` 在页面间往返切换（**页面自决**）
3. 顶层 `q` 全局退出
4. `j`/`k` 被委托到**正确的页面**（验证委托方向）
