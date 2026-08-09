# 源码导读：Store 持久化层

## 核心文件：`store/store.go:1-274`（全文）

### 数据模型与错误哨兵（:33-:53）

```go
type Device struct {
    Name    string `json:"name"`
    MAC     string `json:"mac"`
    Port    int    `json:"port"`
    Address string `json:"address"`
}
```

JSON tag 与字段同名 —— 显式声明，防重构时破坏持久化格式。

错误哨兵放在数据模型正下方，形成"领域语言"的第一屏。调用方 match 错误时读到的全是人话："设备名称已存在，请重新输入"。

### 初始化（:67-:83）

```go
func New(dataDir string) (*Store, error) {
    if err := os.MkdirAll(dataDir, 0755); err != nil { ... }
    s := &Store{ devices: make([]Device, 0), path: filepath.Join(dataDir, "devices.json") }
    if err := s.load(); err != nil {
        s.devices = make([]Device, 0)   // 文件损坏 → 空数据，不崩溃
    }
    return s, nil
}
```

注意容错哲学：数据文件损坏**不返回错误**，而是重置为空数据继续运行。这是一个交互式工具 —— 宁可丢数据，不可让程序起不来。

### load 的三种情况（:90-:103）

```go
func (s *Store) load() error {
    data, err := os.ReadFile(s.path)
    if err != nil {
        if os.IsNotExist(err) {
            return s.flush()   // 首次运行：创建空文件
        }
        return err
    }
    if len(data) == 0 {
        return s.flush()       // 空文件：写初始状态
    }
    return json.Unmarshal(data, &s.devices)
}
```

`os.IsNotExist` 区分"文件不存在"和"读失败" —— 这是 Go 错误处理的精髓：**不是所有 error 都该被上层看到，只有真正意外的才向上传**。

### CRUD 的一致性（:131-:176）

```go
func (s *Store) Add(d Device) error {
    s.mu.Lock()
    defer s.mu.Unlock()
    for _, existing := range s.devices {
        if strings.EqualFold(existing.Name, d.Name) {
            return ErrNameDuplicate   // 唯一性校验：大小写不敏感
        }
    }
    s.devices = append(s.devices, d)
    return nil
}
```

`strings.EqualFold` —— 名字唯一性对大小写宽容（"NAS" 和 "nas" 冲突）。每个方法都是：**加锁 → 校验 → 修改 → 返回**，锁的持有时间被压缩到最短。

### MAC 标准化（:229-:245）

```go
func ValidateMAC(s string) (string, error) {
    hex := macHexRe.ReplaceAllString(s, "")   // 正则剥掉一切非十六进制字符
    if len(hex) < 12 {
        return "", ErrMACPartial              // 输入未完成 —— 实时校验时静默
    }
    if len(hex) > 12 {
        return "", ErrMACInvalid              // 超出长度 —— 格式错误
    }
    parts := make([]string, 6)
    for i := 0; i < 6; i++ {
        parts[i] = strings.ToUpper(hex[i*2 : i*2+2])
    }
    return strings.Join(parts, ":"), nil
}
```

`macHexRe = regexp.MustCompile(`[^0-9A-Fa-f]`)` —— 匹配一切**非**十六进制字符，直接剥掉。四种输入格式因此统一：去掉分隔符后都是 12 个 hex 字符。

关键设计：`ErrMACPartial`（未完成）和 `ErrMACInvalid`（格式错）是**两个不同的错误**。表单在输入过程中把 partial 当"还在打字"静默处理，把 invalid 当"真错了"红字提示。**用错误类型的粒度表达业务语义**。

## 设计精髓

store 层展示了两条反直觉的智慧：
1. **容错**：宁可数据空，不可程序死
2. **错误即业务**：预定义错误哨兵让调用方用 `==` 精确分支，而不是字符串匹配

## 这一章对应你的 Lab

你的 Store 要满足黑盒契约：CRUD 语义、持久化重载、并发安全（测试会同时写 100 条）、纯校验。最容易被测试抓住的坑：
- `Update` 排除自身的名字唯一性检查
- `List` 返回副本而非内部 slice
- 并发写入不丢数据
