# 源码导读：表单与双重校验

## 核心文件：`ui/form.go:254-331`

### 宽松校验：每敲一个键跑一次（:258-:311）

```go
func (m *FormModel) validateField(idx int) {
    val := m.inputs[idx].Value()

    switch idx {
    case 0: // 名称
        if val == "" {
            m.errors[idx] = ""        // 空值不报错 —— 还在打字
        } else if err := store.ValidateName(val); err != nil {
            m.errors[idx] = err.Error()
        } else {
            m.errors[idx] = ""
        }

    case 1: // MAC
        if val == "" {
            m.errors[idx] = ""
            return
        }
        _, err := store.ValidateMAC(val)
        if err == store.ErrMACPartial {
            m.errors[idx] = ""        // 未完成 —— 静默，不给用户添堵
        } else if err != nil {
            m.errors[idx] = err.Error()
        } else {
            m.errors[idx] = ""
        }
    ...
}
```

三个微妙之处：
1. **空值单独处理** —— 不落入通用校验，避免"空字符串报格式错"
2. **`ErrMACPartial` 被静默** —— 用户输到第 9 个字符，不能让他看到红字
3. **`validateField` 用指针接收者 `*FormModel`** —— 直接改 errors 数组，因为它是"内部补丁"而非纯函数

### 严格校验：Enter 时跑一次（:313-:331）

```go
func (m *FormModel) validateFieldStrict(idx int) error {
    val := m.inputs[idx].Value()

    switch idx {
    case 0:
        return store.ValidateName(val)     // 空名 → ErrNameEmpty
    case 1:
        if val == "" {
            return store.ErrMACInvalid     // 必填，空即错
        }
        _, err := store.ValidateMAC(val)
        return err
    case 2, 3:
        // 端口和地址可空，提交时填默认值
        return nil
    }
    return nil
}
```

对比宽松版：严格版**返回 error**（调用方决定怎么用），宽松版**直接写 errors**（副作用）。同样的校验逻辑，两套形态。

### 提交时的默认值替换（:356-:373）

```go
portStr := m.inputs[2].Value()
if portStr == "" {
    portStr = "9"                        // 端口默认 9
}
port, err := strconv.Atoi(portStr)
if err != nil || store.ValidatePort(port) != nil {
    m.errors[2] = store.ErrPortInvalid.Error()
    return m, nil
}

address := m.inputs[3].Value()
if address == "" {
    address = "255.255.255.255"          // 地址默认广播
}
if err := store.ValidateIP(address); err != nil {
    m.errors[3] = err.Error()
    return m, nil
}
```

**可空字段**（端口/地址）提交时填空即补默认；**必填字段**（名称/MAC）提前被严格校验拦住。每个字段的校验强度 = 它的业务重要性。

### 焦点关卡（:209-:252）

```go
func (m FormModel) nextField() (tea.Model, tea.Cmd) {
    if err := m.validateFieldStrict(m.focusIdx); err != nil {
        m.errors[m.focusIdx] = err.Error()   // 校验不过：停留 + 红字
        return m, nil
    }
    if m.focusIdx == 3 {
        return m.save()                       // 最后一个字段 → 提交
    }
    m.inputs[m.focusIdx].Blur()
    m.focusIdx++
    m.inputs[m.focusIdx].Focus()
    return m, nil
}
```

Enter 兼具"过焦点关卡"和"提交"两个角色 —— 在最后一个字段上自动从"移动"切换为"提交"。**没有显式模式，靠位置自然决定**。

## 核心文件：`ui/form.go:171-203`

```go
func (m FormModel) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
    key := msg.String()
    switch key {
    case "tab", "enter":
        return m.nextField()          // 导航键：先校验再移动
    case "shift+tab":
        return m.prevField()
    case "esc":
        return m.goBack(), nil
    case "ctrl+c":
        return m, tea.Quit
    default:
        var cmd tea.Cmd
        m.inputs[m.focusIdx], cmd = m.inputs[m.focusIdx].Update(msg)  // 输入
        m.validateField(m.focusIdx)                                   // 实时校验
        return m, cmd
    }
}
```

注意 `default` 分支的编排：**先输入，后校验**。即使当前值非法，输入仍然被接受 —— 校验只负责显示错误，不负责阻止输入。

## 这一章对应你的 Lab

你的 `form.Model` 是三字段表单的 2 字段微缩版。测试验证的正是双重校验的分界：
- 名称空值：实时不报错，Enter 才报错
- 端口非法：实时就报错，修复后自动消错
- 空端口 Enter → 默认 9 提交
- 焦点被错误"卡住"在未通过字段
