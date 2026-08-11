# 代码扫描与课程生成（完整规范）

> 从 SKILL.md §4 下沉的详细生成方法。执行 `/promentor init` 时阅读。示例语言仅作演示，规范本身与语言无关。

## 目录

- [4.1 四轮扫描法](#41-四轮扫描法)
- [4.2 大项目裁剪（>200 文件）](#42-大项目裁剪200-文件)
- [4.3 难度评级](#43-难度评级)
- [4.4 Chapter 生成规范](#44-chapter-生成规范)
- [4.5 测试生成规范](#45-测试生成规范)
- [4.6 跨章 lab 依赖解耦](#46-跨章-lab-依赖解耦)

## 4.1 四轮扫描法

**第一轮：结构探测**

```
目标：弄清项目规模、语言、模块边界

操作：
• 获取文件树（跳过 .gitignore、vendor、node_modules、test 目录）
• 搜索 main 函数 / 入口文件
• 搜索 package / namespace / module 声明
• 统计文件数、代码行数

产出：项目元信息（语言、规模、入口点、一级模块列表）
```

**第二轮：核心类型识别**

```
目标：找到项目的核心数据结构和抽象

操作：
• 搜索 type / class / interface 声明
• 对关键类型，读取完整源码
• 识别嵌入 / 继承 / 组合关系
• 标记公开接口 vs 内部实现

产出：核心类型清单 + 关系图
```

**第三轮：调用链追踪**

```
目标：理解请求/数据的完整生命周期

操作：
• 从入口点出发，读取关键函数体
• 追踪调用关系（搜索函数名引用）
• 识别调用链深度、关键分支
• 标记扩展点（interface 实现、回调注册、插件机制）

产出：核心流程的调用链 + 关键方法列表
```

**第四轮：架构归纳**

```
目标：识别设计模式，拟定教学路线

操作：
• 将前三轮发现归纳为架构层次
• 识别设计模式（中间件链、路由树、上下文传递、工厂模式等）
• 标记精妙设计决策（"为什么用 A 而不是 B"）
• 拟定 Chapter 边界和教学顺序

产出：课程大纲 + 每个 Chapter 的教学重点
```

## 4.2 大项目裁剪（>200 文件）

当项目超过 200 文件时，应用聚焦策略：

**拓扑排序**：从入口点 BFS 扩散
- 前 3 层：核心 —— 完整阅读源码
- 4-6 层：辅助 —— 读签名 + 注释
- 7 层+：跳过（依赖库、工具函数）

**功能去重**：
- 多个 Controller 只有路由不同 → 选一个深入
- 多个 middleware 只有逻辑不同 → 选一个深入
- 其余给文件名 + 一句话描述

**标记优先级**：
- P0：入口文件、核心类型、入口方法体
- P1：核心算法实现、关键调用链
- P2：辅助工具、配置、常量
- 排除：test、mock、vendor、generated

## 4.3 难度评级

| 难度 | 特征 |
|------|------|
| `easy` | 概念直白，代码短小（<100 行），标准惯用写法 |
| `mid` | 涉及 1-2 个设计决策，代码量中等，需要一定前置知识 |
| `hard` | 包含项目最精妙的设计，涉及不直观的架构决策，需要 2+ 前置概念 |

一个 Chapter 标记为 `hard` 的条件：
- 涉及一个并不直观的架构决策，需要解释"为什么 A 而不是 B"
- 包含非平凡的数据结构选择
- 理解这段代码需要 2 个以上前置概念
- 这段代码如果写错了，整个系统会以隐蔽的方式崩溃

## 4.4 Chapter 生成规范

**lecture.md 生成**：

输入：该 Chapter 相关的原始源码 + 课程大纲上下文

要求：
1. 开篇一句话概括这个 Chapter 学什么
2. 解释它在整个系统中的位置
3. 拆解核心概念，每概念一小节
4. 每个概念配原始代码片段（标注关键行）
5. 重点解释设计决策："为什么这样设计"
6. 结尾说明 Lab 要实现什么

**source.md 生成**：

输入：该 Chapter 相关的原始源码文件

要求：
1. 列出关键文件和行号范围
2. 每段标注解释"这段代码在做什么、为什么这样做"
3. 标注关键数据结构定义、核心算法逻辑、精妙 trick
4. 只标注和本 Chapter 概念相关的内容

**lab.json 生成**：

输入：原始源码中的核心接口

要求：
1. 定义学生需要实现的类型和函数签名
2. 签名必须精确（参数名、类型、返回值）
3. 包含 `test_command`，确保测试可运行

**lab_test.<ext> 生成**：

输入：原始源码的核心逻辑

要求：
1. 黑盒测试：不关心实现，只关心输入输出
2. 用目标语言的原生测试框架
3. 覆盖：正常路径、边界情况、错误处理
4. 测试代码中 import 学生的包路径
5. 测试文件放在 `.promentor/chapters/{chapter_id}/` 下
6. 测试必须能独立编译和运行

**可运行入口生成（Final/组装章）**：

Final 章组装出顶层组件后，必须额外生成一个可运行入口，让课程"学完即能跑"：

1. 入口文件放在课程根目录（`.promentor/main.go`、`main.py`、`index.js` 等，按目标语言惯例命名），不放入章节目录，避免与章节主包/模块冲突
2. 入口只做三件事：初始化数据层、构造顶层组件、启动运行时（CLI/TUI/Web 按项目实际选择框架）
3. 在 `lab.json` notes 中给出运行命令（如 `go run .promentor`、`python3 .promentor/main.py`、`node .promentor/index.js`）
4. 生成后用目标语言可用的构建或语法检查（如 `go build`、`python3 -m py_compile`、`tsc --noEmit`）验证入口可用，确保课程结束后项目可运行

## 4.5 测试生成规范

**黑盒原则**：不关心学生怎么实现，只关心输入输出是否正确。

**Go 示例**：

```go
package router_test

import (
    "testing"
    student "github.com/user/project/.promentor/chapters/ch02-router"
)

func TestStaticRoute(t *testing.T) {
    r := student.NewRouter()
    var called bool
    r.AddRoute("GET", "/users", func(w http.ResponseWriter, req *http.Request) {
        called = true
        w.WriteHeader(200)
    })
    handler, _ := r.FindRoute("GET", "/users")
    if handler == nil {
        t.Fatal("GET /users: 未找到路由处理函数")
    }
}
```

**Python 示例**：

```python
import pytest
import sys
sys.path.insert(0, ".promentor/chapters/ch02-router")
from router import Router

def test_static_route():
    r = Router()
    called = False
    def handler(request):
        nonlocal called
        called = True
        return {"status": 200}
    r.add_route("GET", "/users", handler)
    h, params = r.find_route("GET", "/users")
    assert h is not None, "GET /users: 未找到路由处理函数"
```

**关键约束**：
- 测试文件和学生的实现放在不同包/模块，通过 import 引入
- 测试覆盖：正常路径、参数路径、错误方法、边界输入、嵌套参数
- 测试名称清晰描述测试场景

## 4.6 跨章 lab 依赖解耦

课程章节按依赖顺序学习时，后章的包在学生完成前不存在（如 Ch4 依赖 Ch2 的 store 包，而 Ch4 学习时 Ch5 的 form 包尚未实现）。生成 lab 时遵守：

1. **前置依赖只指向已完成章节**：`prerequisites` 必须真实反映模块/包依赖关系；学生实现只能引用前置章节的代码。
2. **暂缺依赖用 notes 声明**：后章能力尚未实现时，当前章的相关入口在 `lab.json` notes 中说明"先返回自身/占位"，测试不得覆盖该行为。
3. **跨模块消息/类型由课程模块导出**：组件间传递的自定义消息或类型定义在学生当前实现的模块中，避免测试依赖真实项目源码。
4. **禁止循环依赖**：若 A 章要实现"进入 B 章页面"、B 章要实现"返回 A 章页面"，两者会互相引用。只保留单向依赖（A→B），B 的返回行为退回自身或占位，完整闭环作为挑战题写入 notes。
5. **测试断言与真实行为对齐**：黑盒断言不得与原始设计冲突（如删除成功后结果提示仍显示设备名），否则会误杀正确实现。
