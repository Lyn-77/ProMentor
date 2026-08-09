# Ch 5：异步任务与批量唤醒

## 这一章学什么

把副作用包装成 `tea.Cmd`（返回消息的闭包），用 `sync.WaitGroup` 并发扇出批量唤醒，把结果聚合成一条消息回到 Update。

这是"UI 永不阻塞"的落地章。前面学的状态机、委托，在这里接入真实世界：网络、磁盘、并发。

## 为什么这一章值得学

Bubble Tea 的 Update 是纯函数 —— **它绝不能阻塞**。发送 WOL 包要等网络，最坏情况几秒。如果在 Update 里同步发，界面冻结，用户以为死了。

解法：副作用不进 Update，进 Cmd。Cmd 是 `func() tea.Msg`，由运行时在**后台**执行，完成后把结果作为消息送回 Update。

```go
return m, func() tea.Msg {
    err := wol.SendMagicPacket(dev.MAC, dev.Address, dev.Port)
    return WOLResultMsg{Err: err, DeviceMAC: dev.MAC}
}
```

## 核心概念

### 1. tea.Cmd：函数即命令

`tea.Cmd` 就是一个 `func() tea.Msg`。它描述"要做什么"，运行时决定"何时做"。

```go
func WakeCmd(names []string, wake WakeFunc) tea.Cmd {
    return func() tea.Msg {
        results := BatchWake(names, wake)     // 在后台执行
        return BatchMsg{Results: results}     // 结果作为消息
    }
}
```

关键链路：

```
Update 返回 Cmd ──▶ 运行时后台执行 ──▶ Cmd 返回 Msg ──▶ Update 再收到 Msg
```

副作用去一个方向，结果走消息回来。**UI 线程从没碰过网络**。

### 2. 并发扇出：WaitGroup

唤醒 10 台设备不必串行等 10 次网络超时。用 WaitGroup 并发：

```go
var wg sync.WaitGroup
results := make([]Result, len(targets))
for i, dev := range targets {
    wg.Add(1)
    go func(idx int, d Device) {
        defer wg.Done()
        err := wol.SendMagicPacket(d.MAC, d.Address, d.Port)
        results[idx] = Result{Name: d.Name, Err: err}
    }(i, dev)
}
wg.Wait()
return BatchWOLResultMsg{Results: results}
```

三个要点：

1. **`wg.Add(1)` 在 goroutine 外面** —— 保证计数先于 Wait，不会漏加
2. **`defer wg.Done()` 立即跟在函数开头** —— 无论中间怎么 return，计数都递减
3. **闭包按值传参 `(i, dev)`** —— 避免循环变量捕获陷阱（Go 1.22 前）

### 3. 结果按序聚合成一条消息

`results[i]` 对应 `targets[i]`，**位置对齐**。并发写不同索引不需要锁 —— 每个 goroutine 只写自己的槽位。

聚合之后，UI 只收到**一条** `BatchMsg`，在 Update 里统一统计成败：

```go
case BatchWOLResultMsg:
    var ok, fail int
    for _, r := range msg.Results {
        if r.Err != nil { fail++ } else { ok++ }
    }
```

## 设计决策

**为什么不直接 `go` 一个 goroutine 然后往 channel 里塞？**

两种都行。但 `tea.Cmd` 的契约是"返回消息"，运行时管理生命周期。直接开 goroutine 的话，谁负责把结果送回 Update？Channel 要自己接线。**Cmd 把这个接线标准化了** —— 这就是框架存在的意义。

**为什么 `BatchWake` 拆出来而不是全塞在 Cmd 闭包里？**

可测性。`BatchWake` 是纯逻辑（给定名字和 wake 函数，返回结果列表），可以同步测试。`WakeCmd` 只是它外面的一层消息包装。**把可测逻辑和框架粘合代码分开** —— 这是全书反复出现的分层思想。

## Lab 指引

实现批量异步唤醒（package `batch`）：

```
type WakeFunc func(name string) error
type Result struct{ Name string; Err error }
type BatchMsg struct{ Results []Result }

func BatchWake(names []string, wake WakeFunc) []Result
func WakeCmd(names []string, wake WakeFunc) tea.Cmd
```

行为契约：
- `BatchWake` **并发**执行所有 wake（测试会验证并发度），结果与输入**位置对齐**
- `WakeCmd` 返回的 Cmd 执行后产生 `BatchMsg`，其 `Results` 与 `BatchWake` 一致
- 某个失败不影响其他成功

写完 `go test -v ./...`。
