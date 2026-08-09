# 源码导读：模态状态机

## 核心文件：`ui/list.go:168-304`

### handleKey 的骨架：外层 switch 模式

```go
func (m ListModel) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
    key := msg.String()

    switch m.mode {

    // ---- 删除确认：Enter/y 确认，n/ESC 取消 ----
    case ModeConfirm:
        switch key {
        case "y", "Y", "enter":
            return m.executeDelete()
        case "n", "N", "esc":
            m.mode = ModeNormal
            ...
        }

    // ---- 普通模式：Vim 导航 ----
    case ModeNormal:
        if key != "d" && m.pendingD {
            m.pendingD = false
        }
        switch key {
        case "d":
            if m.pendingD {
                m.pendingD = false
                return m.triggerDeleteConfirm()
            }
            m.pendingD = true
        case "j", "down":
            m.moveCursor(1)
        case "a":
            return NewFormModel(...)   // 跳转表单页
        case "enter":
            m.mode = ModeWakeConfirm
        case " ":
            m.mode = ModeMultiSelect
        case "q", "ctrl+c":
            return m, tea.Quit
        }

    // ---- 多选模式 ----
    case ModeMultiSelect:
        switch key {
        case " ":
            if m.selected[m.cursor] {
                delete(m.selected, m.cursor)
            } else {
                m.selected[m.cursor] = true
            }
        case "enter":
            m.mode = ModeBatchWakeConfirm
        case "q", "esc":
            m.mode = ModeNormal
            ...
        }
    }
    return m, nil
}
```

注意几个设计点：

1. **模式切换是普通赋值** —— `m.mode = ModeMultiSelect`。状态迁移就是改字段，没有中间件、没有事件总线。
2. **键位在每个模式下局部化** —— `enter` 在普通模式进唤醒确认，在多选模式进批量确认，在确认模式执行删除。同一个键，三种语义，各自写在各自的 case 里，**互不干扰**。
3. **`pendingD` 的作废逻辑在 switch 之前** —— `if key != "d" && m.pendingD { m.pendingD = false }`。一次检查覆盖所有"非 d 键"，不需要在每个 case 里清。

### 弹窗渲染也按模式分支（:153-:157）

```go
if m.mode == ModeConfirm || m.mode == ModeWakeConfirm ||
    m.mode == ModeBatchWakeConfirm || m.mode == ModeResult {
    b.WriteString("\n")
    b.WriteString(m.renderPopup())
}
```

渲染层同样由模式驱动 —— 弹窗只在确认/结果模式出现。**状态机同时约束行为和渲染**，一个字段两个作用。

### 帮助栏跟随模式（:310-:339）

```go
func (m ListModel) bindings() []KeyBinding {
    switch m.mode {
    case ModeMultiSelect:
        return []KeyBinding{{"j/k", "移动"}, {"Space", "选中/取消"}, ...}
    case ModeResult:
        return []KeyBinding{{"任意键", "关闭"}}
    default:
        return []KeyBinding{{"j/k", "移动"}, {"Enter", "唤醒"}, ...}
    }
}
```

用户看到的帮助提示永远描述**当前模式**的键位。状态机的收益外溢到 UI：帮助栏零重复逻辑，只是模式的一个投影。

## 核心文件：`ui/ui.go:28-36`

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

7 个状态。注意顺序：普通模式在前，各确认弹窗居中，多选在后 —— `iota` 只保证唯一，不隐含优先级。

## 这一章对应你的 Lab

你的 `modal.Model` 是三状态的微缩版（Normal/MultiSelect/Confirm）。测试会验证：
- dd 双键的完整生命周期（成功触发、被其他键中断）
- 确认删除真的删了项，取消则不删
- 多选选中集合的增删
- 光标两端钳制
