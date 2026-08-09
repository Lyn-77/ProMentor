# Ch 2：Store 持久化层

## 这一章学什么

实现设备数据的存储层：**内存缓存是唯一真相源**，JSON 文件只是异步投影。包含并发安全的 CRUD 和纯校验函数。

这是全书唯一真正"持有数据"的模块。后面所有章节的 UI 都在消费它。

## 为什么这一章值得学

大多数程序把"存数据"做成 DB 连接 + 一大堆 SQL。这里只有三样东西：

1. **内存 slice + 读写锁** —— 简单到无可简化
2. **异步落盘** —— 写操作不阻塞 UI 线程
3. **纯校验函数** —— 每个校验只做一件事，返回 error

它演示了一个重要哲学：**数据层不该有花哨的东西，该有的是清晰的边界**。

## 核心概念

### 1. 唯一真相源（Single Source of Truth）

```go
type Store struct {
    mu      sync.RWMutex
    devices []Device   // 内存缓存 —— 唯一真相
    path    string     // JSON 文件绝对路径
}
```

所有读操作从 `devices` 读，所有写操作先改 `devices` 再异步写文件。文件**不是**另一份数据，只是缓存的快照。这就是"唯一真相源"：只有一个可变的地方，其他地方都是只读投影。

### 2. 并发安全：读写锁

```go
func (s *Store) Add(d Device) error {
    s.mu.Lock()        // 写操作：排他锁
    defer s.mu.Unlock()
    ...
}

func (s *Store) List() []Device {
    s.mu.RLock()       // 读操作：共享锁，多个读者不互斥
    defer s.mu.RUnlock()
    ...
}
```

- 写多读少的场景，`RWMutex` 让并发读不互相阻塞
- 锁的粒度是**整个方法** —— 对这个小数据量来说足够，别过度设计

### 3. 异步落盘

```go
// Add 只改内存，不碰磁盘
func (s *Store) Add(d Device) error {
    s.mu.Lock()
    ...
    s.devices = append(s.devices, d)
    return nil
}

// Save 由 UI 层在 goroutine / tea.Cmd 中调用
func (s *Store) Save() error {
    s.mu.RLock()
    defer s.mu.RUnlock()
    return s.flush()
}
```

写入立即生效（内存），落盘延迟到 UI 空闲时。**用户操作永远不被磁盘 IO 阻塞**。

### 4. 错误哨兵（Sentinel Errors）

```go
var (
    ErrNameDuplicate = errors.New("设备名称已存在，请重新输入")
    ErrMACInvalid    = errors.New("MAC 地址格式错误")
    ErrNotFound      = errors.New("未查询到对应设备")
)
```

预定义错误作为包级变量，调用方用 `==` 或 `errors.Is` 精确匹配：

```go
if err := s.Add(d); err == store.ErrNameDuplicate {
    // 精确知道失败原因
}
```

### 5. 纯校验函数

```go
func ValidateMAC(s string) (string, error) {
    hex := macHexRe.ReplaceAllString(s, "")  // 提取十六进制字符
    if len(hex) < 12 { return "", ErrMACPartial }
    if len(hex) > 12 { return "", ErrMACInvalid }
    ...
}
```

校验函数**无副作用**：不写状态，不碰网络，输入字符串输出结果。这让它可以被实时调用（每敲一个键校验一次）而不产生副作用。

### 6. 标准化（Normalization）

用户可能输入四种 MAC 格式：

```
AA:BB:CC:DD:EE:FF    AA-BB-CC-DD-EE-FF
AABB.CCDD.EEFF       AABBCCDDEEFF
```

`ValidateMAC` 把四种全部归一化为 `XX:XX:XX:XX:XX:XX`。**数据进入系统的第一刻就标准化**，之后所有代码都只处理一种格式 —— 这消除了全系统几百处的格式判断。

## 设计决策

**为什么写操作不直接落盘，要拆成 Add + Save？**

因为"改数据"和"落盘"是两个时刻的事。改数据是业务操作（可能失败回滚），落盘是持久化（可能被 UI 批量触发）。拆开让每一层只做一个决策，且落盘可以被合并（多次 Add 只 flush 一次）。

## Lab 指引

实现完整 Store（package `store`）：

```
type Device struct{ Name, MAC string; Port int; Address string }
type Store struct{ ... }

func New(dataDir string) (*Store, error)
func (s *Store) Add(d Device) error        // 名称唯一，大小写不敏感
func (s *Store) Update(idx int, d Device) error
func (s *Store) Delete(idx int) error
func (s *Store) FindByName(name string) (Device, int, error)
func (s *Store) FindByIndex(idx int) (Device, error)
func (s *Store) List() []Device            // 只读副本
func (s *Store) Count() int
func (s *Store) Save() error

func ValidateMAC(s string) (string, error)
func ValidatePort(port int) error
func ValidateIP(ip string) error
func ValidateName(name string) error
```

错误哨兵：`ErrNameDuplicate` `ErrNameEmpty` `ErrMACInvalid` `ErrMACPartial` `ErrPortInvalid` `ErrIPInvalid` `ErrNotFound`

黑盒测试覆盖：CRUD、持久化重载、并发写入、校验函数全部格式。写完 `go test -v ./...`。
