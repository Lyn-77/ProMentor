#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==========================================================================
 ProMentor Dashboard
--------------------------------------------------------------------------
 自动读取 .promentor/ 下生成的课程数据：
   - 扫描 chapters/ 发现全部章节
   - 合并 course.json / progress.json 的元信息与进度
   - 展示完成度、当前学习章节、每章内容完整性
 零依赖：仅 Python 标准库，无第三方包。
--------------------------------------------------------------------------
 用法:
   python3 dashboard.py                # 当前目录
   python3 dashboard.py <项目路径>     # 指定项目
   python3 dashboard.py --html         # 生成 .promentor/dashboard.html
==========================================================================
"""

import argparse
import html
import json
import re
import sys
from pathlib import Path


# 章节状态 -> 面板符号
STATUS_ICON = {
    "completed": "✓",
    "in_progress": "▶",
    "not_started": "-",
}

# 每章必须存在的内容文件（test 为前缀匹配 lab_test.*）
REQUIRED_FILES = (
    ("lecture", "lecture.md"),
    ("source", "source.md"),
    ("lab", "lab.json"),
    ("test", "lab_test"),
)


def parse_args(argv):
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="ProMentor 课程仪表盘：读取 .promentor/ 并展示进度"
    )
    parser.add_argument("path", nargs="?", default=".", help="项目路径（默认当前目录）")
    parser.add_argument("--html", action="store_true", help="生成 .promentor/dashboard.html")
    return parser.parse_args(argv)


def locate_prom(start):
    """定位 .promentor/ 数据根目录"""
    root = Path(start)
    if root.name == ".promentor":
        return root
    prom = root / ".promentor"
    return prom if prom.is_dir() else None


def load_json(path):
    """读取 JSON，缺失或损坏时返回空字典"""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def read_chapter(path, num, slug):
    """读取一章：标题/难度来自 lab.json，检查内容完整性"""
    lab = load_json(path / "lab.json")
    files = {p.name for p in path.iterdir() if p.is_file()}
    has = {
        label: any(name.startswith(prefix) for name in files)
        for label, prefix in REQUIRED_FILES
    }
    return {
        "id": f"{num}-{slug}",
        "num": num,
        "slug": slug,
        "title": lab.get("title") or slug.replace("-", " ").title(),
        "difficulty": lab.get("difficulty", "-"),
        "files": has,
    }


def discover_chapters(prom):
    """扫描 chapters/ 目录，自动发现已生成的章节"""
    chapters_dir = prom / "chapters"
    if not chapters_dir.is_dir():
        return []
    found = []
    for entry in sorted(chapters_dir.iterdir()):
        if not entry.is_dir():
            continue
        match = re.fullmatch(r"(ch\d+)-(.+)", entry.name)
        if match:
            found.append(read_chapter(entry, match.group(1), match.group(2)))
    return found


def enrich(chapters, course, progress):
    """合并 course.json 元信息与 progress.json 进度"""
    course_map = {ch["id"]: ch for ch in course.get("chapters", [])}
    progress_map = progress.get("chapters", {})
    for ch in chapters:
        meta = course_map.get(ch["id"], {})
        ch["title"] = meta.get("title", ch["title"])
        ch["difficulty"] = meta.get("difficulty", ch["difficulty"])
        ch["progress"] = progress_map.get(ch["id"], {"status": "not_started"})
    return chapters


def find_current(chapters, progress):
    """当前学习章节：显式指定优先，其次第一个进行中"""
    current = progress.get("current_chapter")
    for ch in chapters:
        if ch["id"] == current:
            return ch
    for ch in chapters:
        if ch["progress"].get("status") == "in_progress":
            return ch
    return None


def summarize(chapters, current):
    """总体进度：完成章节数 / 总章节数"""
    total = len(chapters)
    done = sum(
        1 for ch in chapters
        if ch["progress"].get("status") == "completed"
    )
    percent = done * 100.0 / total if total else 0.0
    return {"total": total, "completed": done, "percent": percent, "current": current}


def missing_files(chapters):
    """列出内容不完整的章节"""
    return [
        f"{ch['id']} 缺 {label}"
        for ch in chapters
        for label, ok in ch["files"].items()
        if not ok
    ]


def build_data(course, progress, chapters):
    """组装仪表盘数据"""
    current = find_current(chapters, progress)
    return {
        "name": course.get("project") or progress.get("project_name") or "ProMentor Course",
        "language": course.get("language", "-"),
        "chapters": chapters,
        "current": current,
        "summary": summarize(chapters, current),
        "missing": missing_files(chapters),
    }


def fmt_score(ch):
    """章节分数显示：完成才显示百分比"""
    if ch["progress"].get("status") != "completed":
        return "-"
    return f"{ch['progress'].get('score', 0):.1f}%"


def render_text(data):
    """终端文本面板"""
    lines = [
        f"ProMentor: {data['name']}  ({data['language']})",
        "",
    ]
    for ch in data["chapters"]:
        icon = STATUS_ICON.get(ch["progress"].get("status"), "-")
        parts = [
            f"  {ch['num']}: {ch['title']} [{ch['difficulty']}]",
            f"{icon} {fmt_score(ch)}",
        ]
        if ch["progress"].get("attempts"):
            parts.append(f"x{ch['progress']['attempts']}")
        lines.append(" ".join(parts))
    summary = data["summary"]
    lines.append(
        f"\n  Overall: {summary['completed']}/{summary['total']} chapters · "
        f"{summary['percent']:.1f}% complete"
    )
    if data["current"]:
        cur = data["current"]
        lines.append(f"  当前学习: {cur['id']} {cur['title']} [{cur['difficulty']}]")
    else:
        lines.append("  当前学习: -")
    if data["missing"]:
        lines.append("\n  内容不完整:")
        lines.extend(f"    ! {item}" for item in data["missing"])
    return "\n".join(lines)


def status_badge(status):
    """HTML 状态徽标"""
    styles = {
        "completed": "b-ok",
        "in_progress": "b-warn",
        "not_started": "b-muted",
    }
    labels = {
        "completed": "已完成",
        "in_progress": "学习中",
        "not_started": "未开始",
    }
    cls = styles.get(status, "b-muted")
    label = labels.get(status, status)
    return f'<span class="badge {cls}">{label}</span>'


def html_row(ch):
    """章节表格行"""
    is_current = ch["progress"].get("status") == "in_progress"
    cls = ' class="current"' if is_current else ""
    attempts = ch["progress"].get("attempts", 0)
    dots = "".join(
        f'<span class="{"ok" if ok else "warn"}">{"●" if ok else "○"}</span>'
        for ok in ch["files"].values()
    )
    return (
        f"<tr{cls}>"
        f"<td>{html.escape(ch['id'])}</td>"
        f"<td>{html.escape(ch['title'])}</td>"
        f"<td>{html.escape(ch['difficulty'])}</td>"
        f"<td>{status_badge(ch['progress'].get('status', 'not_started'))}</td>"
        f"<td>{html.escape(fmt_score(ch))}</td>"
        f"<td>{attempts}</td>"
        f"<td>{dots}</td>"
        f"</tr>"
    )


def render_html(data):
    """自包含 HTML 仪表盘（无外部依赖）"""
    name = html.escape(data["name"])
    language = html.escape(data["language"])
    summary = data["summary"]
    rows = "\n".join(html_row(ch) for ch in data["chapters"])
    missing = (
        f'<div class="missing">内容不完整：{"；".join(html.escape(item) for item in data["missing"])}</div>'
        if data["missing"]
        else ""
    )
    current = data["current"]
    current_txt = (
        f"{html.escape(current['id'])} · {html.escape(current['title'])}"
        if current
        else "-"
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{name} · ProMentor Dashboard</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", sans-serif;
       background: #f1f5f9; color: #0f172a; margin: 0; padding: 40px 16px; }}
.wrap {{ max-width: 860px; margin: 0 auto; }}
h1 {{ font-size: 26px; margin: 0 0 4px; }}
.meta {{ color: #64748b; font-size: 14px; margin-bottom: 8px; }}
.bar {{ height: 12px; background: #e2e8f0; border-radius: 6px; overflow: hidden; margin: 12px 0 20px; }}
.bar i {{ display: block; height: 100%; background: #22c55e; border-radius: 6px; }}
.card {{ background: #fff; border-radius: 12px; padding: 8px 20px; box-shadow: 0 1px 3px rgba(15, 23, 42, .08); }}
table {{ width: 100%; border-collapse: collapse; font-size: 14px; }}
th {{ text-align: left; color: #64748b; font-weight: 500; padding: 12px 8px; border-bottom: 1px solid #e2e8f0; }}
td {{ padding: 12px 8px; border-bottom: 1px solid #f1f5f9; }}
tr.current td {{ background: #f0f9ff; }}
.badge {{ display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; }}
.b-ok {{ background: #dcfce7; color: #166534; }}
.b-warn {{ background: #fef3c7; color: #92400e; }}
.b-muted {{ background: #f1f5f9; color: #64748b; }}
.ok {{ color: #22c55e; }}
.warn {{ color: #f59e0b; }}
.missing {{ margin-top: 16px; color: #b45309; font-size: 13px; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>{name}</h1>
  <div class="meta">{language} · {summary['completed']}/{summary['total']} 章节完成 · 当前学习: {current_txt}</div>
  <div class="bar"><i style="width:{summary['percent']:.1f}%"></i></div>
  <div class="card">
    <table>
      <tr><th>章节</th><th>标题</th><th>难度</th><th>状态</th><th>分数</th><th>尝试</th><th>内容</th></tr>
      {rows}
    </table>
  </div>
  {missing}
</div>
</body>
</html>"""


def main(argv=None):
    """入口：定位数据、渲染面板、可选生成 HTML"""
    args = parse_args(argv)
    prom = locate_prom(args.path)
    if prom is None:
        print(f"未找到 .promentor/（{args.path}）")
        return 1
    course = load_json(prom / "course.json")
    progress = load_json(prom / "progress.json")
    chapters = enrich(discover_chapters(prom), course, progress)
    data = build_data(course, progress, chapters)
    print(render_text(data))
    if args.html:
        out = prom / "dashboard.html"
        out.write_text(render_html(data), encoding="utf-8")
        print(f"\nHTML 仪表盘已生成: {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
