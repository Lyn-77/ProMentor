# Ch 1：WOL 魔术包协议

## 这一章学什么

构造并发送 Wake-on-LAN 魔术包：一个 **102 字节** 的 UDP 数据报。这是整个工具的核心动作 —— 其他所有页面、状态机、持久化，最终都是为了按下一个键发出这一个包。

## 为什么这一章值得学

WakeUp 的本质是"把一个字节序列正确送到网络上"。这章教会三件独立的事：

1. **字节级协议构造** —— 理解网络协议的本质是固定格式的字节流
2. **纯函数分离** —— 构造（无副作用）和发送（有副作用）分开，可测性大增
3. **Go 错误哲学** —— `error` 作为返回值一路向上传递，调用方决定怎么处理

## 核心概念

### 1. 魔术包格式（102 字节）

```
┌──────────────────┬────────────────────────────────────┐
│ 0xFF × 6 (6字节) │ 目标 MAC 重复 16 次 (16×6=96字节)   │
└──────────────────┴────────────────────────────────────┘
6 + 96 = 102 字节
```

- 前 6 字节全是 `0xFF`，称为**同步流**，用来唤醒正在监听网卡的芯片
- 接着目标设备的 MAC 地址（6 字节）重复 16 遍

```go
const (
    magicPacketLen = 102 // 魔术包总长度
    syncStreamLen  = 6   // 同步流长度
    macRepeatCount = 16  // MAC 地址重复次数
)
```

用常量命名魔法数字 —— 协议的可读性来自这里。

### 2. 构造与发送分离

原始设计里，构造是循环 + `copy`，发送是 UDP Dial + Write：

```go
packet := make([]byte, magicPacketLen)
for i := 0; i < syncStreamLen; i++ {
    packet[i] = 0xFF
}
for i := 0; i < macRepeatCount; i++ {
    copy(packet[syncStreamLen+i*6:], hwAddr)
}
```

关键计算：`packet[syncStreamLen+i*6:]` 每个 6 字节块恰好是第 `i` 份 MAC 拷贝。切片表达让"位置"自己说话，不需要临时变量。

### 3. 错误一路向上

```go
hwAddr, err := net.ParseMAC(mac)
if err != nil {
    return fmt.Errorf("解析 MAC 地址失败: %w", err)
}
```

- `%w` 包装底层错误 —— 保留错误链，`errors.Is`/`errors.As` 可用
- 中文前缀描述**业务上下文**，底层错误保留技术细节
- 函数不 panic，不吞错误 —— 全部返回给调用方

### 4. UDP 发送 —— 一次写，不等待回包

```go
conn, err := net.Dial("udp", target)   // UDP 的 Dial 不做握手
defer conn.Close()
n, err := conn.Write(packet)
```

UDP 是"发出去就不管"。`net.Dial("udp", ...)` 不建立连接，只是绑定地址。写完校验 `n != magicPacketLen` 防止半包。

## 设计决策

**为什么 `SendMagicPacket` 是包级纯函数，而不是方法或 interface？**

因为它**无状态**。不需要结构体持有配置，不需要依赖注入。参数齐了（MAC、地址、端口）就能干活，返回 error 让调用方处理。这是 Go 的惯用式："能写成纯函数就别搞对象"。

**为什么超时不由本层处理？**

注释明说：网络超时由调用方通过 context 控制。发送层保持纯粹 —— 不做它不该做的决定。

## Lab 指引

实现 `SendMagicPacket`（package `wol`）：

```go
const MagicPacketLen = 102
func SendMagicPacket(mac string, address string, port int) error
```

行为契约：
- 合法 MAC → 发出 102 字节包，返回 `nil`
- 非法 MAC 字符串（如 `GG:HH:...`）→ 返回错误
- **非 6 字节的地址**（如 EUI-64 的 8 字节）→ 返回错误（ParseMAC 会接受它）
- 测试会起一个本地 UDP 监听，校验你发出的字节序列

黑盒测试读 `lab_test.go`，理解它对字节结构的断言。写完 `go test -v ./...`。
