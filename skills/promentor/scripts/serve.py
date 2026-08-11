#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==========================================================================
 ProMentor Dashboard Server
--------------------------------------------------------------------------
 挂载并管理 ProMentor Dashboard 进程：
   - start:   直接服务技能包内产物 + 项目根数据、后台启动、打开浏览器
   - status:  显示运行中的服务进程（PID/端口/URL）
   - stop:    停止服务（kill / shutdown 同义）
 无状态：不写 JSON、不写日志，仅用 PID 文件定位进程。
 零依赖：仅 Python 标准库。
--------------------------------------------------------------------------
 用法（在项目根目录运行）:
   python3 <promentor-skill>/scripts/serve.py                 # 启动
   python3 <promentor-skill>/scripts/serve.py status          # 查看状态
   python3 <promentor-skill>/scripts/serve.py stop            # 停止
   python3 <promentor-skill>/scripts/serve.py kill            # 同 stop
   python3 <promentor-skill>/scripts/serve.py shutdown        # 同 stop
   python3 <promentor-skill>/scripts/serve.py start --port 4000
   python3 <promentor-skill>/scripts/serve.py start --no-open # 启动但不打开浏览器
   python3 <promentor-skill>/scripts/serve.py start --foreground
==========================================================================
"""

import argparse
import errno
from functools import partial
import http.server
import os
import re
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import unquote, urlsplit

DEFAULT_PORT = 3000
BASE_PATH = "/dashboard"
PID_PATH = "/tmp/promentor-dashboard.pid"


class ProMentorServer(http.server.ThreadingHTTPServer):
    """双栈 HTTP 服务器：同时监听 IPv6(::) 与 IPv4，localhost 两种解析都可达"""

    address_family = socket.AF_INET6
    allow_reuse_address = True


class ProMentorHandler(http.server.SimpleHTTPRequestHandler):
    """双根静态服务器：
    - /dashboard/*  -> 技能包内的构建产物（不向项目复制任何文件）
    - /.promentor/* -> 当前项目根目录的课程数据
    - 章节路由 SPA fallback：产物中不存在的路径返回主页壳
    """

    def __init__(self, *args, assets=None, project=None, base_path=BASE_PATH, **kwargs):
        self.assets = Path(assets).resolve()
        self.project = Path(project).resolve()
        self.base_path = base_path
        super().__init__(*args, **kwargs)

    def _safe(self, root: Path, rel: str) -> str:
        """将相对路径解析到 root 内，防止路径穿越"""
        target = (root / rel).resolve()
        if not str(target).startswith(str(root)):
            return str(root)
        return str(target)

    def translate_path(self, path):
        path = unquote(urlsplit(path).path)
        if path.startswith(f"{self.base_path}/"):
            rel = path[len(self.base_path):].lstrip("/")
            return self._safe(self.assets, rel)
        if path.startswith("/.promentor/"):
            rel = path[len("/.promentor/"):]
            return self._safe(self.project / ".promentor", rel)
        return self._safe(self.assets, path.lstrip("/"))

    def _redirect_home(self):
        if self.path in ("/", self.base_path):
            self.send_response(302)
            self.send_header("Location", f"{self.base_path}/")
            self.end_headers()
            return True
        return False

    def _spa_fallback(self):
        if self.path.startswith(f"{self.base_path}/_next/"):
            return
        if os.path.isfile(self.translate_path(self.path)):
            return
        if self.path == "/" or self.path.startswith(f"{self.base_path}/"):
            self.path = f"{self.base_path}/index.html"

    def do_GET(self):
        if self._redirect_home():
            return
        self._spa_fallback()
        super().do_GET()

    def do_HEAD(self):
        if self._redirect_home():
            return
        self._spa_fallback()
        super().do_HEAD()


def parse_args(argv):
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description="挂载并管理 ProMentor Dashboard")
    parser.add_argument(
        "command",
        nargs="?",
        default="start",
        choices=["start", "status", "stop", "kill", "shutdown"],
        help="start | status | stop（kill / shutdown 同义）",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"起始端口（默认 {DEFAULT_PORT}，被占用时自动向下找最小可用端口）",
    )
    parser.add_argument(
        "--base-path",
        default=BASE_PATH,
        help=f"部署子路径，需与构建产物一致（默认 {BASE_PATH}）",
    )
    parser.add_argument(
        "--foreground",
        action="store_true",
        help="前台运行（调试用），不写 PID 文件",
    )
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="启动后不自动打开浏览器",
    )
    return parser.parse_args(argv)


def project_root() -> Path:
    """项目根：当前工作目录，必须包含 .promentor/"""
    root = Path.cwd()
    if not (root / ".promentor").is_dir():
        print(f"错误：未找到 .promentor/（{root}）")
        print("请先在项目根目录运行 /promentor init 生成课程")
        sys.exit(1)
    return root


def assets_dir() -> Path:
    """构建产物：技能包 dashboard/"""
    assets = Path(__file__).resolve().parent.parent / "dashboard"
    if not assets.is_dir():
        print(f"错误：未找到构建产物（{assets}）")
        sys.exit(1)
    return assets


def free_port(start: int) -> int:
    """从起始端口向下找最小可用端口（到 65535）"""
    port = start
    while port <= 65535:
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as sock:
            # 与服务器一致：允许复用 TIME_WAIT 端口，保证选到真正的最小可用端口
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("::", port))
                return port
            except OSError as exc:
                if exc.errno == errno.EPERM:
                    print(
                        "错误：端口绑定被系统沙箱拒绝，请以授权方式运行",
                        flush=True,
                    )
                    sys.exit(1)
                port += 1
    print("错误：没有可用端口", flush=True)
    sys.exit(1)


def daemonize() -> int:
    """fork 脱离当前会话，stdout/stderr 丢弃，返回子进程 PID"""
    pid = os.fork()
    if pid > 0:
        return pid
    os.setsid()
    devnull = os.open(os.devnull, os.O_WRONLY)
    os.dup2(devnull, sys.stdout.fileno())
    os.dup2(devnull, sys.stderr.fileno())
    return 0


def handle_term(_signum, _frame):
    """SIGTERM -> 优雅退出，触发 finally 清理 PID 文件"""
    raise KeyboardInterrupt


def open_browser(url: str) -> None:
    """用系统默认浏览器打开 URL，失败静默"""
    if sys.platform == "darwin":
        command = ["open", url]
    elif sys.platform.startswith("linux"):
        command = ["xdg-open", url]
    else:
        return
    try:
        subprocess.Popen(
            command,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        pass


def load_pid():
    """读取 PID 文件，缺失或损坏返回 None"""
    try:
        return int(Path(PID_PATH).read_text(encoding="utf-8").strip())
    except (FileNotFoundError, ValueError):
        return None


def clear_pid() -> None:
    """清理 PID 文件"""
    Path(PID_PATH).unlink(missing_ok=True)


def is_alive(pid) -> bool:
    """进程是否存活"""
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def process_port(pid) -> int | None:
    """从进程本身查询监听端口（lsof 不可用时返回 None）"""
    try:
        output = subprocess.run(
            ["lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", str(pid)],
            capture_output=True,
            text=True,
            timeout=3,
        ).stdout
        for line in output.splitlines():
            match = re.search(r"TCP .*?:(\d+) \(LISTEN\)", line)
            if match:
                return int(match.group(1))
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def process_cwd(pid) -> str | None:
    """从进程本身查询工作目录（lsof 不可用时返回 None）"""
    try:
        output = subprocess.run(
            ["lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"],
            capture_output=True,
            text=True,
            timeout=3,
        ).stdout
        for line in output.splitlines():
            if line.startswith("n/"):
                return line[1:]
    except (OSError, subprocess.TimeoutExpired):
        pass
    return None


def print_status(pid, base_path: str) -> None:
    """打印服务进程信息：PID、从进程查询的端口、URL"""
    print(f"  PID:   {pid}", flush=True)
    port = process_port(pid)
    if port:
        print(f"  端口:  {port}", flush=True)
        print(f"  URL:   http://localhost:{port}{base_path}/", flush=True)
    project = process_cwd(pid) or str(Path.cwd())
    print(f"  项目:  {project}", flush=True)


def cmd_status(args) -> int:
    """显示当前服务状态"""
    pid = load_pid()
    if not pid or not is_alive(pid):
        if pid:
            clear_pid()
        print("ProMentor Dashboard: 未运行", flush=True)
        return 0
    print("ProMentor Dashboard: 运行中", flush=True)
    print_status(pid, args.base_path)
    return 0


def cmd_stop() -> int:
    """停止服务进程"""
    pid = load_pid()
    if not pid or not is_alive(pid):
        if pid:
            clear_pid()
        print("ProMentor Dashboard: 未运行，无需停止", flush=True)
        return 0
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        clear_pid()
        print(f"ProMentor Dashboard: 已停止（PID {pid}）", flush=True)
        return 0
    for _ in range(30):
        if not is_alive(pid):
            break
        time.sleep(0.1)
    clear_pid()
    if is_alive(pid):
        print(f"警告：进程 {pid} 未在 3 秒内退出，请手动 kill -9 {pid}", flush=True)
        return 1
    print(f"ProMentor Dashboard: 已停止（PID {pid}）", flush=True)
    return 0


def cmd_start(args) -> int:
    """启动服务：部署产物、找端口、后台运行、打开浏览器"""
    signal.signal(signal.SIGTERM, handle_term)

    existing = load_pid()
    if existing and is_alive(existing):
        current_project = process_cwd(existing)
        if current_project and current_project != str(Path.cwd()):
            print(
                f"仪表盘正在服务其他项目（{current_project}）",
                flush=True,
            )
            print("自动切换为当前项目（停止旧进程并重新启动）", flush=True)
            cmd_stop()
        else:
            print("ProMentor Dashboard: 已在运行", flush=True)
            print_status(existing, args.base_path)
            return 0

    project = project_root()
    assets = assets_dir()
    port = free_port(args.port)
    url = f"http://localhost:{port}{args.base_path}/"

    handler = partial(
        ProMentorHandler,
        assets=assets,
        project=project,
        base_path=args.base_path,
    )
    try:
        httpd = ProMentorServer(("::", port), handler)
    except OSError as exc:
        print(f"错误：无法绑定端口 {port}（{exc}）", flush=True)
        sys.exit(1)

    if args.foreground:
        print(f"ProMentor Dashboard: {url}", flush=True)
        print("按 Ctrl+C 停止服务", flush=True)
        httpd.serve_forever()
        return 0

    pid = daemonize()
    if pid > 0:
        # 父进程：报告进程信息并打开浏览器
        print("ProMentor Dashboard: 运行中", flush=True)
        print(f"  PID:   {pid}", flush=True)
        print(f"  端口:  {port}", flush=True)
        print(f"  URL:   {url}", flush=True)
        if not args.no_open:
            open_browser(url)
        return 0

    # 子进程：写 PID 并持续服务
    Path(PID_PATH).write_text(str(os.getpid()))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        clear_pid()
    return 0


def main(argv=None):
    """入口：按命令分发 start / status / stop"""
    args = parse_args(argv)
    if args.command in ("stop", "kill", "shutdown"):
        return cmd_stop()
    if args.command == "status":
        return cmd_status(args)
    return cmd_start(args)


if __name__ == "__main__":
    sys.exit(main())
