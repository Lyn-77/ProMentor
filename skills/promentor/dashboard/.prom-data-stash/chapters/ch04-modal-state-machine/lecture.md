# Ch 4：模态状态机

## 这一章学什么

用一个 `mode` 字段驱动整个界面的行为切换：浏览、多选、确认删除、结果弹窗。核心是 **dd 双键序列** 和 **键位语义消除**。

这是 WakeUp 交互层的心脏。列表页 662 行里有三分之一是在做"当前是什么模式，这个键在这个模式下什么意思"。

## 为什么这一章值得学

一个程序只有两三种状态的时候，`if` 就够了。但当你有一堆按键和一堆状态：

```
j=移动  k=移动  a=新增  e=编辑  d=？(dd 删除)  enter=唤醒  space=多选  q=退出
```

问题来了：**同一个键在不同状态下含义不同**。`space` 在普通模式是"进入多选"，在多选模式是"切换选中"，在确认弹窗里……不该出现。`enter` 在普通模式是"唤醒"，在确认弹窗是"确认"。

用一串 `if (mode == X && key == Y)` 会写成什么？一堆纠缠的分支，改一个键要排查所有组合。这就是**脆弱性（Fragility）**。

正确的解法：把模式变成**显式状态机**。

## 核心概念

### 1. 模式即字段

```go
const (
    ModeNormal      = iota // 0 浏览
    ModeMultiSelect        // 1 多选
    ModeConfirm            // 2 确认删除
    ...
)

type Model struct {
    ...
    mode int   // 当前模态 —— 状态机的当前状态
}
```

模式是 Model 的一个字段，跟 `cursor` 一样普通。**状态存在哪里，逻辑就长在哪里**。

### 2. 每个模式一个键位表

```go
switch m.mode {
case ModeConfirm:
    // 只有 y/enter 和 n/esc 有意义
case ModeMultiSelect:
    // space 切换选中，j/k 移动，q/esc 退出
case ModeNormal:
    // 全部键
}
```

外层 switch 模式，内层 switch 按键。每个模式只需要关心**自己**的按键 —— 别的模式按键组合根本不会进入这个分支。这就是"特殊情况被结构消灭"。

### 3. dd 双键序列：一个字节的前缀状态

```go
if key != "d" && m.pendingD {
    m.pendingD = false   // 按了别的键，前缀作废
}
switch key {
case "d":
    if m.pendingD {      // 第二次 d
        m.pendingD = false
        return m.triggerDeleteConfirm()
    }
    m.pendingD = true    // 第一次 d：记录前缀
}
```

`pendingD` 就是"我刚才按了 d 吗"这一个 bit。它是微型的输入缓冲：

- 第一次 `d` → 置位，什么都不做
- 第二次 `d` → 触发删除确认
- 中间按任何别的键 → 作废前缀

**用状态位把"两次按键"编码成一个动作**，而不是把删除绑定在单个键上误伤用户。

### 4. 消除键位语义重叠

看 `handleKey` 里普通模式的两个 case：

```go
case "enter":
    // 进入唤醒确认
    m.mode = ModeWakeConfirm
case " ":
    // 进入多选模式
    m.mode = ModeMultiSelect
```

为什么是 `enter` 唤醒、`space` 多选，而不是都用 `enter`？

因为如果 `enter` 既唤醒又进多选，程序就得判断"当前有没有选中项"这种隐式状态 —— 那就是补丁。**给两个动作分配两个键，是消除分支最直接的方式**。键位语义清晰，代码就不需要猜。

## 设计决策

**为什么用整数常量而非字符串模式？**

整数 `iota` 常量编译期检查、无分配、可比较。字符串模式在 switch 里也能跑，但打错字编译器不报错。**用类型系统抓住错误，而不是靠运行时**。

**为什么 modal 状态改变不拆成多个子 Model？**

可以拆（每个模式一个结构体），但模式之间共享太多状态（cursor、selected、items）。拆开会让共享状态无处安放。**一个 Model + 一个 mode 字段** 是共享状态和逻辑清晰之间的最佳平衡。

## 源码导读入口

读 `ui/list.go:168-304`（`handleKey` 的外层 mode switch）和 `ui/ui.go:28-36`（7 个模态常量）。注意帮助栏 `bindings()` 也按 mode 分支 —— 状态机不仅驱动行为，还驱动 UI 提示。

## Lab 指引

实现一个模态列表（package `modal`）：

```
type Mode int
const ( ModeNormal Mode = iota; ModeMultiSelect; ModeConfirm )

type Model struct{ items []string; cursor int; mode Mode; selected map[int]bool; pendingD bool }

func New(items []string) Model
func (m Model) Init() tea.Cmd
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd)
func (m Model) View() string
func (m Model) Cursor() int
func (m Model) Mode() Mode
func (m Model) Selected() []int     // 已选索引，升序
func (m Model) Items() []string
```

行为契约：
- 普通模式：j/k 移动（两端钳制）；`space` 进多选并选中当前；`d` `d` 进确认；`q` 退出
- 多选模式：`space` 切换当前选中；j/k 移动；`q`/`esc` 回普通（保留选中）
- 确认模式：`y`/`enter` 删除当前项并回普通；`n`/`esc` 回普通不删
- `dd` 前缀被其他键中断则作废

写完 `go test -v ./...`。
