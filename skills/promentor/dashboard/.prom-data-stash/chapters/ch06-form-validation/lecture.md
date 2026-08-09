# Ch 6：表单与双重校验

## 这一章学什么

实现表单的**双重校验**：实时宽松校验（不打断输入）+ 提交时严格校验（拦截非法值）。外加焦点管理和默认值替换。

这是 WakeUp 里"用户体验"的最后一环。store 的纯校验函数（Ch 2）在这里被赋予了两套调用时机。

## 为什么这一章值得学

表单是错误处理最密集的地方。一个字段可能有四种状态：

```
正在输入（不能报错！）     输入完成且合法（✓）
输入了非法内容（⚠ 红字）   提交时必填但为空（✗ 拦截）
```

如果只在提交时校验，用户输到一半就会看到刺眼的红字 —— 因为他们"还没输完"。如果只实时校验，用户就能提交非法数据。**两套校验各管一段**。

## 核心概念

### 1. 双重校验：两套函数，两个时机

```go
// 实时宽松校验：每敲一个键调用一次，不阻塞输入
func (m *FormModel) validateField(idx int) {
    // 空值不报错 —— 用户还在打字
    // MAC 未完成（ErrMACPartial）静默
    // 其他错误立即显示
}

// 严格校验：Enter 切换字段/提交时调用，拦截非法值
func (m *FormModel) validateFieldStrict(idx int) error {
    // 必填项为空 → 报错并停留
}
```

关键区分在**错误粒度**：

| 情况 | 宽松校验 | 严格校验 |
|------|---------|---------|
| 字段为空 | 不报错（还在打字） | 必填项报错 |
| 输入未完成 | 不报错 | 报错 |
| 格式非法 | 报错 | 报错 |

同一个 `ValidateMAC`，宽松时把 `ErrMACPartial` 当"还没输完"静默，严格时把空值当错误。**用错误类型表达语义，而不是靠 if 堆叠**。

### 2. 错误只显示，不阻塞输入

```go
m.inputs[m.focusIdx], cmd = m.inputs[m.focusIdx].Update(msg)
m.validateField(m.focusIdx)   // 每个按键后重新校验
```

输入永远被接受（`textinput.Update`），校验只决定"红字显不显示"。**用户不会因为报错而输不了字** —— 这是表单的第一原则。

### 3. 默认值替换

```go
portStr := m.inputs[2].Value()
if portStr == "" {
    portStr = "9"                // 空端口 → 默认 9
}
address := m.inputs[3].Value()
if address == "" {
    address = "255.255.255.255"  // 空地址 → 默认广播地址
}
```

空值在**提交时**替换为默认值，而不是强制用户填。必要的字段（名称、MAC）严格拦截，可选的字段（端口、地址）给默认 —— **校验策略按字段重要性分级**。

### 4. 焦点管理

```go
case "tab", "enter":
    return m.nextField()     // 先严格校验当前字段，过了才移焦

func (m FormModel) nextField() (tea.Model, tea.Cmd) {
    if err := m.validateFieldStrict(m.focusIdx); err != nil {
        m.errors[m.focusIdx] = err.Error()   // 校验不过：停留 + 红字
        return m, nil
    }
    m.inputs[m.focusIdx].Blur()
    m.focusIdx++
    m.inputs[m.focusIdx].Focus()
    return m, nil
}
```

焦点移动 = 校验关卡。**当前字段不过关，光标不动** —— 用焦点位置天然引导用户先修前面的错。

## 设计决策

**为什么校验分两个函数，而不是一个带布尔参数？**

`validateField`（宽松）和 `validateFieldStrict`（严格）的判定逻辑**真的不一样**：宽松把空值当合法，严格把空值当错误。如果合并成一个带 `strict bool` 的函数，每个分支都要 if 一次 `strict`，读起来全是歧义。**两个职责不同的函数，就该是两个函数**。

**为什么空值在严格校验时才报错？**

实时校验的空值报错会造成"刚聚焦就报红"的糟糕体验。用户在空字段上还没打字，就看到"不能为空" —— 这谁都知道，不需要程序说。**只在离开该字段时提醒必填**，尊重用户的输入节奏。

## 源码导读入口

读 `ui/form.go:254-416`：宽松校验、严格校验、`save()` 里的默认值替换。再看 `ui/form.go:171-203` 的 `handleKey` —— 注意它如何在**同一次按键里**完成"输入 + 重新校验"。

## Lab 指引

实现一个两字段表单（package `form`，字段 0=名称，1=端口）：

```
type Model struct{ ... }

func New() Model
func (m Model) Init() tea.Cmd
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd)
func (m Model) View() string
func (m Model) Value(i int) string     // 第 i 个字段的当前值
func (m Model) Error(i int) string     // 第 i 个字段的当前错误（无错为空串）
func (m Model) Focus() int             // 当前聚焦字段
func (m Model) Submitted() bool        // 是否已提交
func (m Model) SubmittedPort() int     // 提交时的端口（含默认值 9）
```

行为契约：
- 输入字符追加到聚焦字段，`backspace` 删除
- 名称字段：实时校验空值**不报错**；Enter 时空值**报错**并停留
- 端口字段：实时校验非法字符/超范围**立即报错**；空值 Enter 时**用默认 9 提交**
- Enter/tab 移动焦点：当前字段校验不过就停留
- 最后一个字段 Enter → 提交，`Submitted()` 置真

写完 `go test -v ./...`。
