#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
==========================================================================
 ProMentor Dashboard Server
--------------------------------------------------------------------------
 将技能包内的构建产物挂载到当前项目：
   1. 复制产物到项目根 dashboard/（已存在则复用）
   2. 自动选择空闲端口并启动静态服务器
   3. 输出访问 URL
 零依赖：仅 Python 标准库。
--------------------------------------------------------------------------
用法（在项目根目录运行）:
   python3 <promentor-skill>/serve.py
   python3 <promentor-skill>/serve.py --daemon  # 后台运行，日志见 /tmp
   python3 <promentor-skill>/serve.py --force    # 强制刷新产物
   python3 <promentor-skill>/serve.py --port 3000  # 起始端口（默认 3000）
   python3 <promentor-skill>/serve.py --base-path=/dash
==========================================================================
"""

import argparse
import errno
import http.server
import os
import shutil
import signal
import socket
import sys
from pathlib import Path

DEFAULT_PORT = 3000
BASE_PATH = "/dashboard"
LOG_PATH = "/tmp/promentor-dashboard.log"
PID_PATH = "/tmp/promentor-dashboard.pid"


class ProMentorServer(http.server.ThreadingHTTPServer):
    """双栈 HTTP 服务器：同时监听 IPv6(::) 与 IPv4，localhost 两种解析都可达"""

    address_family = socket.AF_INET6
    allow_reuse_address = True


def parse_args(argv):
    """解析命令行参数"""
    parser = argparse.ArgumentParser(description="挂载 ProMentor Dashboard")
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"起始端口（默认 {DEFAULT_PORT}，被占用时自动向下找最小可用端口）",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="强制刷新项目中的 dashboard 产物",
    )
    parser.add_argument(
        "--base-path",
        default=BASE_PATH,
        help=f"部署子路径，需与构建产物一致（默认 {BASE_PATH}）",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="后台运行：进程脱离会话持续服务，URL 写入日志",
    )
    parser.add_argument(
        "--log",
        default=LOG_PATH,
        help=f"后台运行时的日志文件（默认 {LOG_PATH}）",
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
    """构建产物：脚本同目录下的 dashboard/"""
    assets = Path(__file__).resolve().parent / "dashboard"
    if not assets.is_dir():
        print(f"错误：未找到构建产物（{assets}）")
        sys.exit(1)
    return assets


def deploy(project: Path, assets: Path, force: bool) -> Path:
    """复制产物到项目根 dashboard/，已存在且非 force 时直接复用"""
    target = project / "dashboard"
    if target.is_dir() and not force:
        return target
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(assets, target)
    print(f"已部署产物: {target}")
    return target


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
    print("错误：没有可用端口")
    sys.exit(1)


def daemonize(log_path: str) -> int:
    """fork 脱离当前会话，父进程退出，返回子进程 PID"""
    pid = os.fork()
    if pid > 0:
        return pid
    os.setsid()
    log_fd = open(log_path, "w")
    os.dup2(log_fd.fileno(), sys.stdout.fileno())
    os.dup2(log_fd.fileno(), sys.stderr.fileno())
    return 0


def handle_term(_signum, _frame):
    """SIGTERM -> 优雅退出，触发 finally 清理 PID 文件"""
    raise KeyboardInterrupt


def main(argv=None):
    """入口：部署产物、启动服务器、输出 URL"""
    args = parse_args(argv)
    signal.signal(signal.SIGTERM, handle_term)
    project = project_root()
    deploy(project, assets_dir(), args.force)
    port = free_port(args.port)
    url = f"http://localhost:{port}{args.base_path}/"

    handler = http.server.SimpleHTTPRequestHandler
    try:
        httpd = ProMentorServer(("::", port), handler)
    except OSError as exc:
        print(f"错误：无法绑定端口 {port}（{exc}）", flush=True)
        sys.exit(1)

    if args.daemon:
        pid = daemonize(args.log)
        if pid > 0:
            print(f"服务已后台启动: PID={pid}", flush=True)
            print(f"日志: {args.log}", flush=True)
            print("读取日志获取访问 URL", flush=True)
            sys.exit(0)
        Path(PID_PATH).write_text(str(os.getpid()))
        print(f"ProMentor Dashboard: {url}", flush=True)
        print("停止服务: kill $(cat /tmp/promentor-dashboard.pid)", flush=True)
    else:
        print(f"ProMentor Dashboard: {url}", flush=True)
        print("如浏览器无法访问 localhost，请改用 127.0.0.1", flush=True)
        print("按 Ctrl+C 停止服务", flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        if args.daemon:
            Path(PID_PATH).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
