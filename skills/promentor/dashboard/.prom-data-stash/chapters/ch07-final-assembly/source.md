# 源码导读：组装 WakeUp

## 入口组装：`main.go:79-107`

```go
func main() {
    home, _ := os.UserHomeDir()
    dataDir := filepath.Join(home, ".wakeup")

    s, err := store.New(dataDir)             // ① 持久化层
    if err != nil { ... os.Exit(1) }

    m := model{
        page:   ui.NewListModel(s, 80, 24),  // ② 列表页（主交互）
        store:  s,
        width:  80,
        height: 24,
    }
    p := tea.NewProgram(m, tea.WithAltScreen())
    p.Run()
}
```

组装顺序就是依赖顺序：**先数据层，后 UI，再启动**。main 只做接线，不写业务逻辑。

## 状态机：`ui/list.go:168-304`

（Ch 4 已详细导读。这里看它如何**承载异步**。）

唤醒确认触发异步：

```go
case ModeWakeConfirm:
    switch key {
    case "y", "Y", "enter":
        return m.executeWake()   // 返回 (Model, Cmd) —— Cmd 是异步
    ...
```

注意 executeWake 的返回值在 `case "y"` 里被**直接返回** —— 模态模式切换的返回值里夹着一个异步命令，Bubble Tea 的 Update 签名 `(tea.Model, tea.Cmd)` 天生支持这种组合。

## 异步实现：`ui/list.go:608-662`

单设备（:608-:626）与批量（:629-:662）已在 Ch 5 导读。组装章补一个视角：**两个 execute 函数都是"改状态 + 返回 Cmd"两段式**：

```go
func (m ListModel) executeWake() (tea.Model, tea.Cmd) {
    dev, err := m.store.FindByIndex(m.targetIdx)   // ① 读数据（同步，快）
    ...
    m.mode = ModeNormal                             // ② 改状态（同步，快）
    m.setStatus("正在发送唤醒指令...", false)
    return m, func() tea.Msg {                       // ③ 返回异步（网络，慢）
        err := wol.SendMagicPacket(dev.MAC, dev.Address, dev.Port)
        return WOLResultMsg{Err: err, DeviceMAC: dev.MAC}
    }
}
```

同步段毫秒级完成，异步段交给运行时后台执行。**Update 永不阻塞** —— 这是全书的核心承诺。

## 结果回环：`ui/list.go:77-104`

```go
case WOLResultMsg:
    if msg.Err != nil {
        m.showResult("✗ 唤醒失败", fmt.Sprintf("%v", msg.Err), true)
    } else {
        m.showResult("✓ 唤醒成功", fmt.Sprintf("唤醒指令已发送 (%s)", msg.DeviceMAC), false)
    }
```

异步完成 → 消息回到 Update → UI 反馈。**一次异步旅程：Cmd 出发，Msg 归来**。

## 组装章视角：依赖倒置

真实代码里，ListModel 直接 import `wol` 调用 `SendMagicPacket`。你的 Lab 用注入的 `WakeFunc` 代替 —— 这是教学简化，但演示了同一个道理：

```
真实架构：                    Lab 架构：
UI ──▶ wol.SendMagicPacket    App ──▶ wake WakeFunc（注入）
        （低层依赖）                    （抽象依赖）
```

真实代码直接依赖具体实现，Lab 依赖抽象。**前者简单但难测，后者多一层注入但可测**。工程里权衡取舍，教学里展示原理。

## 这一章对应你的 Lab

你的 `App` 是 `ListModel` + `Store` + `WakeFunc` 的组合。测试验证完整旅程：
- 单设备：enter → y → cmd 执行 → WakeMsg 回环 → WakeCount 累加
- 批量：space 多选 → enter → y → BatchWakeMsg 回环 → WakeCount 累加
- 删除：dd → y → 数据收缩
- 空 store 防崩：所有操作在无数据时静默降级
