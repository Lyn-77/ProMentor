# 源码导读：异步任务与批量唤醒

## 核心文件：`ui/list.go:608-662`

### 单设备唤醒：副作用进 Cmd（:608-:626）

```go
func (m ListModel) executeWake() (tea.Model, tea.Cmd) {
    dev, err := m.store.FindByIndex(m.targetIdx)
    if err != nil {
        m.setStatus(err.Error(), true)
        return m, nil
    }

    m.mode = ModeNormal
    m.setStatus("正在发送唤醒指令...", false)

    return m, func() tea.Msg {          // ← 关键：闭包是 tea.Cmd
        err := wol.SendMagicPacket(dev.MAC, dev.Address, dev.Port)
        return WOLResultMsg{            // 结果变成消息
            Err:       err,
            DeviceMAC: dev.MAC,
        }
    }
}
```

注意节奏：
1. **同步段**（FindByIndex、设 mode/status）快如闪电
2. **异步段**（发送网络包）包进闭包
3. UI 立刻显示"正在发送..."，不卡死

### 结果回到 Update（:77-:82）

```go
case WOLResultMsg:
    if msg.Err != nil {
        m.showResult("✗ 唤醒失败", fmt.Sprintf("%v", msg.Err), true)
    } else {
        m.showResult("✓ 唤醒成功", fmt.Sprintf("唤醒指令已发送 (%s)", msg.DeviceMAC), false)
    }
```

异步完成 → 消息回来 → 弹窗反馈。**同一个 Update，既能处理按键，也能处理异步结果** —— 都是 Msg，一视同仁。

### 批量唤醒：WaitGroup 扇出（:629-:662）

```go
func (m ListModel) executeBatchWake() (tea.Model, tea.Cmd) {
    devices := m.store.List()
    targets := make([]store.Device, 0, len(m.selected))
    for idx := range m.selected {
        if idx < len(devices) {
            targets = append(targets, devices[idx])   // 收集选中设备
        }
    }

    return m, func() tea.Msg {
        var wg sync.WaitGroup
        results := make([]WOLSingleResult, len(targets))
        for i, dev := range targets {
            wg.Add(1)
            go func(idx int, d store.Device) {
                defer wg.Done()
                err := wol.SendMagicPacket(d.MAC, d.Address, d.Port)
                results[idx] = WOLSingleResult{       // 按索引写槽位
                    DeviceName: d.Name,
                    MAC:        d.MAC,
                    Err:        err,
                }
            }(i, dev)
        }
        wg.Wait()
        return BatchWOLResultMsg{Results: results}
    }
}
```

注意 `(i, dev)` 显式传参 —— 循环变量捕获的正确姿势。**并发写不同数组槽位，零锁零竞争**。

### 批量结果聚合（:84-:104）

```go
case BatchWOLResultMsg:
    var ok, fail int
    var details []string
    for _, r := range msg.Results {
        if r.Err != nil {
            fail++
            details = append(details, fmt.Sprintf("%s: %v", r.DeviceName, r.Err))
        } else {
            ok++
        }
    }
    if fail == 0 {
        m.showResult("✓ 批量唤醒完成", fmt.Sprintf("已向 %d 台设备发送唤醒指令", ok), false)
    } else {
        body := fmt.Sprintf("成功 %d 台，失败 %d 台", ok, fail)
        ...
    }
```

一条聚合消息，UI 一次处理：成功统计 + 失败详情列表。**让 UI 处理 N 条消息，不如让它处理 1 条内含 N 条结果的消息**。

## 消息类型定义：`ui/ui.go:256-272`

```go
type WOLResultMsg struct {
    Err       error
    DeviceMAC string
}

type WOLSingleResult struct {
    DeviceName string
    MAC        string
    Err        error
}

type BatchWOLResultMsg struct {
    Results []WOLSingleResult
}
```

消息类型就是异步接口的"返回值签名"。定义消息类型 = 定义异步契约。

## 这一章对应你的 Lab

你的 `BatchWake` 对应上面的 WaitGroup 扇出，`WakeCmd` 对应 `func() tea.Msg` 闭包。测试用注入的 fake wake 函数验证：
- 结果按序对齐
- 并发度 > 1（证明不是串行）
- 部分失败不影响整体返回
