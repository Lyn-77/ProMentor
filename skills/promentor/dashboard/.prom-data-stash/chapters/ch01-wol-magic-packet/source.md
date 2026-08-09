# 源码导读：WOL 魔术包协议

## 核心文件：`wol/wol.go:1-74`（全文）

这是全书最短的源码文件，但每一行都有讲究。

### 协议常量（:28-:32）

```go
const (
    magicPacketLen = 102
    syncStreamLen  = 6
    macRepeatCount = 16
)
```

三个常量就是协议的规格说明书。魔术数字进入命名常量，既是文档又是编译器检查。

### 输入校验（:38-:46）

```go
hwAddr, err := net.ParseMAC(mac)
if err != nil {
    return fmt.Errorf("解析 MAC 地址失败: %w", err)
}
if len(hwAddr) != 6 {
    return fmt.Errorf("MAC 地址长度错误: 期望 6 字节，实际 %d 字节", len(hwAddr))
}
```

第二段检查是**防御性的**：`net.ParseMAC` 不仅接受 MAC-48（6 字节），还接受 EUI-64（8 字节）、InfiniBand（20 字节）。魔术包只认 6 字节，所以必须显式拦下非 6 字节的输入。这就是"边界情况用检查消灭，而不是靠运气"。

### 包构造（:48-:55）

```go
packet := make([]byte, magicPacketLen)
for i := 0; i < syncStreamLen; i++ {
    packet[i] = 0xFF
}
for i := 0; i < macRepeatCount; i++ {
    copy(packet[syncStreamLen+i*6:], hwAddr)
}
```

构造是**纯操作**：不碰网络、不碰文件，只操作字节。`make` 先分配整包空间，前 6 字节写 0xFF，然后 `copy` 把 6 字节 MAC 填进 16 个等距切片。

### UDP 发送（:57-:71）

```go
target := net.JoinHostPort(address, fmt.Sprintf("%d", port))
conn, err := net.Dial("udp", target)
if err != nil {
    return fmt.Errorf("建立 UDP 连接失败: %w", err)
}
defer conn.Close()

n, err := conn.Write(packet)
if err != nil {
    return fmt.Errorf("发送魔术包失败: %w", err)
}
if n != magicPacketLen {
    return fmt.Errorf("魔术包发送不完整: 期望 %d 字节，实际 %d 字节", magicPacketLen, n)
}
return nil
```

- `net.JoinHostPort` 正确处理 IPv6 的 `[addr]:port` 语法
- `defer conn.Close()` —— 资源释放紧跟获取，绝不迟到
- 每个失败点都带上下文包装错误
- `n != magicPacketLen` 防半包：UDP Write 理论上要么全写要么报错，但防御不亏

## 设计精髓

整个函数是**线性流水线**：校验 → 构造 → 发送 → 校验结果。没有分支嵌套，没有状态。每一步失败都立即返回带上下文的错误。这就是"纯函数"的形态 —— 读一遍，全懂。

## 这一章对应你的 Lab

你写的是同一个 `SendMagicPacket`。测试会用本地 UDP 监听你的输出字节，逐字节校验：
- 前 6 字节 = 0xFF
- 中间 96 字节 = MAC × 16
- 总长 102

另外记得处理 `ParseMAC` 接受但协议不认的**非 6 字节**输入 —— 那是隐藏的边界测试。
