# .promentor/ 数据格式（完整规范）

> 从 SKILL.md §1 下沉的详细字段规范。读写 course.json / progress.json / lab.json 等课程数据时阅读。

## 目录

- [1.1 目录结构](#11-目录结构)
- [1.2 course.json](#12-coursejson)
- [1.3 progress.json](#13-progressjson)
- [1.4 lab.json](#14-labjson)
- [1.5 lecture.md 规范](#15-lecturemd-规范)
- [1.6 source.md 规范](#16-sourcemd-规范)

## 1.1 目录结构

```
.promentor/
├── course.json                  # 课程元信息
├── progress.json                # 学习进度
├── chapters/
│   ├── ch01-<slug>/
│   │   ├── lecture.md           # 讲义（Markdown）
│   │   ├── source.md            # 源码阅读指南（标注关键行）
│   │   ├── lab.json             # Lab 定义：接口签名、要求
│   │   └── lab_test.<ext>       # 行为测试（学生不可改）
│   └── ch02-<slug>/
└── submissions/
    └── ch01-<slug>/
        ├── attempt_1.<ext>
        └── attempt_2.<ext>
```

## 1.2 course.json

```json
{
  "project": "gin",
  "language": "go",
  "generated_at": "2026-07-31T10:00:00Z",
  "chapters": [
    {
      "id": "ch01-http-server",
      "title": "HTTP Server 基础",
      "difficulty": "mid",
      "prerequisites": [],
      "learning_goals": [
        "理解 net/http Server 的生命周期",
        "掌握 Handler 接口的设计意图"
      ],
      "source_files": ["gin.go:1-120"],
      "lab_interface": {
        "package": "httpserver",
        "exports": ["NewServer", "Server.ServeHTTP"]
      }
    }
  ]
}
```

字段说明：
- `id`: 格式 `ch<NN>-<slug>`，两位数序号 + 短横线 + 英文 slug
- `difficulty`: `easy` | `mid` | `hard`
- `prerequisites`: 前置 Chapter 的 id 列表
- `source_files`: 原始项目中与该 Chapter 相关的源文件及行号
- `lab_interface`: 学生需要实现的公开接口

## 1.3 progress.json

```json
{
  "project_name": "gin",
  "current_chapter": "ch02-router",
  "chapters": {
    "ch01-http-server": {
      "status": "completed",
      "score": 95.0,
      "attempts": 3,
      "hint_level_reached": 1,
      "completed_at": "2026-07-30T15:04:05Z"
    },
    "ch02-router": {
      "status": "in_progress",
      "score": 0,
      "attempts": 5,
      "hint_level_reached": 2
    }
  }
}
```

- `status`: `not_started` | `in_progress` | `completed`
- `score`: 0-100，submit 后才有分数
- `attempts`: submit 次数
- `hint_level_reached`: 学生在此 Chapter 中达到的最高提示层级

## 1.4 lab.json

```json
{
  "chapter_id": "ch02-router",
  "title": "Router 设计",
  "description": "实现一个支持路径参数和 HTTP 方法匹配的路由器",
  "language": "go",
  "package": "router",
  "files": [
    {
      "path": "router.go",
      "description": "路由器的核心实现"
    }
  ],
  "interface": {
    "types": [
      {
        "name": "Router",
        "kind": "struct",
        "doc": "HTTP 路由器，存储路由表并提供查找"
      },
      {
        "name": "Handler",
        "kind": "type",
        "doc": "type Handler func(w http.ResponseWriter, req *http.Request)"
      }
    ],
    "functions": [
      {
        "signature": "func NewRouter() *Router",
        "doc": "创建一个新的 Router 实例"
      },
      {
        "signature": "func (r *Router) AddRoute(method, path string, handler Handler)",
        "doc": "注册一个路由规则。path 可包含 :param 参数段"
      },
      {
        "signature": "func (r *Router) FindRoute(method, path string) (Handler, map[string]string)",
        "doc": "查找匹配的路由。返回 handler 和路径参数。无匹配时 handler 为 nil"
      }
    ]
  },
  "test_command": "cd .promentor/chapters/ch02-router && go test -v -json ./..."
}
```

- `interface.functions` 中的 `signature` 是学生必须严格遵循的函数签名
- `test_command` 是运行测试的 shell 命令，`{chapter_dir}` 会被替换为实际的 chapter 目录

## 1.5 lecture.md 规范

讲义是 Markdown 文件。写作要求：

1. **开门见山**：第一段说清楚"这个 Chapter 学什么、为什么重要"
2. **核心概念拆解**：每个概念一小节，配代码片段说明
3. **设计决策解释**：重点解释"为什么这样设计而不是那样"，对比替代方案
4. **与 Lab 的衔接**：结尾指明"接下来你要实现什么，对应讲义中的哪些概念"
5. **行数控制**：单 Chapter 讲义不超过 300 行，聚焦核心

## 1.6 source.md 规范

源码阅读指南，标注原始代码的关键行：

```markdown
# 源码导读：Router 设计

## 核心文件：`gin.go:45-120`

### 数据结构（:45-:60）
[解释 Router 的核心数据结构，为什么选这个结构]

### 路由注册（:62-:85）
[解释 AddRoute 的注册逻辑]

### 路由查找（:87-:120）
[解释 FindRoute 的查找算法，标注关键行]
```

- 只标注和本 Chapter 概念相关的代码
- 每段标注必须带行号
- 解释"为什么"而不是"是什么"
