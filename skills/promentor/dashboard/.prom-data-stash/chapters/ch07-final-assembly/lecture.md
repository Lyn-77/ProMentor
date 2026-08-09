# Ch 7（Final）：组装 WakeUp

## 这一章学什么

把前六章学到的所有模式组装成一个端到端可运行的工具：内存 Store + 模态状态机 + 异步批量唤醒 + 页面委托。这是全书的总复习。

```
设备列表 ──enter──▶ 唤醒确认 ──y──▶ 异步发送 ──结果消息──▶ 反馈弹窗
    │
    ├──space──▶ 多选 ──enter──▶ 批量确认 ──y──▶ 并发唤醒 ──聚合──▶ 统计
    │
    └──dd──▶ 删除确认 ──y──▶ 删除 ──▶ 数据更新
```

## 为什么这一章值得学

单独每个模式都简单。难的是**组合**：状态机里藏异步，异步结果再回状态机，数据层贯穿全程。组装章让你看见"架构如何承载复杂度" —— 当 N 个模式叠加时，代码为什么还保持扁平。

## 回顾：你要组装的五件事

### 1. 内存 Store（Ch 2 简化版）

```go
type Store struct {
    mu      sync.RWMutex
    devices []Device
}
```

这里的 Store 不需要落盘（Ch 2 已教），只需要**并发安全的增删查**。App 通过指针共享它。

### 2. 模态状态机（Ch 4 完整版）

```go
const (
    ModeNormal Mode = iota
    ModeConfirm
    ModeWakeConfirm
    ModeMultiSelect
    ModeBatchWakeConfirm
)
```

五个状态。每个状态一个 keymap，互不干扰。**dd 双键、space 多选、enter 语境化** —— Ch 4 的全套。

### 3. 异步唤醒（Ch 1 + Ch 5）

```go
return m, func() tea.Msg {
    err := m.wake(dev.MAC, dev.Address, dev.Port)
    return WakeMsg{Err: err, Name: dev.Name}
}
```

`wake` 是注入的 `WakeFunc` —— 测试注入 fake，真实环境注入 `wol.SendMagicPacket`。**依赖注入让网络代码可测**。

### 4. 批量并发（Ch 5）

```go
var wg sync.WaitGroup
for i, d := range targets {
    wg.Add(1)
    go func(idx int, dev Device) {
        defer wg.Done()
        results[idx] = WakeResult{Name: dev.Name, Err: m.wake(dev.MAC, dev.Address, dev.Port)}
    }(i, d)
}
wg.Wait()
return BatchWakeMsg{Results: results}
```

### 5. 结果回环（Ch 0 + Ch 5）

关键的一步：异步结果作为**消息**回到 Update：

```go
case WakeMsg:
    if msg.Err == nil {
        m.wakeCount++
    }
    m.mode = ModeNormal
    return m, nil
```

副作用去一个方向，结果走消息回来。**App 的 Update 既处理按键，也处理异步完成** —— 这是整本书反复出现的闭环。

## 设计决策

**为什么 `wake` 是注入的而不是 App 直接调 `wol`？**

解耦。App 只关心"我要唤醒这台设备"，不关心"怎么发网络包"。注入 `WakeFunc` 后：
- 测试注入 fake，验证调用次数和流程
- 真实运行注入 `wol.SendMagicPacket`
- App 不 import wol 包，依赖方向清晰

这就是**依赖倒置**：高层模块（App）定义抽象，低层模块（wol）实现它。

**为什么 Store 用指针而 App 用值？**

Store 是共享数据，被 Delete/List 多处访问，必须共享 —— 指针。App 是每帧快照，Bubble Tea 的值语义要求它不可变 —— 值。**指针给数据，值给状态**。

## 源码导读入口

把全书的导读串起来：`main.go:79-107`（组装）+ `ui/list.go:168-304`（状态机）+ `ui/list.go:608-662`（异步）。你的 App 就是它们三个的合体。

## Lab 指引

实现端到端工具（package `app`）：

```
type Device struct{ Name, MAC, Address string; Port int }
type WakeFunc func(mac, addr string, port int) error
type Mode int
const ( ModeNormal Mode = iota; ModeConfirm; ModeWakeConfirm; ModeMultiSelect; ModeBatchWakeConfirm )

type Store struct{ ... }
func NewStore() *Store
func (s *Store) Add(d Device) error
func (s *Store) Delete(idx int) error
func (s *Store) FindByIndex(idx int) (Device, error)
func (s *Store) List() []Device
func (s *Store) Count() int

type WakeMsg struct{ Err error; Name string }
type WakeResult struct{ Name string; Err error }
type BatchWakeMsg struct{ Results []WakeResult }

type App struct{ ... }
func NewApp(s *Store, wake WakeFunc) App
func (m App) Init() tea.Cmd
func (m App) Update(msg tea.Msg) (tea.Model, tea.Cmd)
func (m App) View() string
func (m App) Cursor() int
func (m App) Mode() Mode
func (m App) Items() []string       // 设备名称列表
func (m App) WakeCount() int         // 处理成功的唤醒结果数
func (m App) DeletedCount() int      // 删除的设备数
```

行为契约：
- 普通：j/k 移动，enter→唤醒确认，space→多选，dd→删除确认，q→退出
- 唤醒确认：y/enter 触发异步唤醒（Cmd 闭包），n/esc 取消
- 多选：space 切换选中，enter→批量确认，q/esc 返回
- 批量确认：y/enter 并发唤醒全部选中，n/esc 取消
- 删除确认：y/enter 删除，n/esc 取消
- `WakeMsg`/`BatchWakeMsg` 回到 Update 时累加 `WakeCount`（仅成功）

写完 `go test -v ./...`。全部通过 —— 你就是 WakeUp 的架构师了。
