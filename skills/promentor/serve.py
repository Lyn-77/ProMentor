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
   python3 <promentor-skill>/serve.py --force    # 强制刷新产物
   python3 <promentor-skill>/serve.py --port 9000
   python3 <promentor-skill>/serve.py --base-path=/dash
==========================================================================
"""

import argparse
import http.server
import shutil
import socket
import sys
from pathlib import Path

DEFAULT_PORT = 8000
BASE_PATH = "/dashboard"


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
        help=f"起始端口（默认 {DEFAULT_PORT}，自动向后找空闲端口）",
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
    """从起始端口向后找第一个空闲端口"""
    for port in range(start, start + 20):
        with socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("::", port))
                return port
            except OSError:
                continue
    print("错误：没有可用端口")
    sys.exit(1)


def main(argv=None):
    """入口：部署产物、启动服务器、输出 URL"""
    args = parse_args(argv)
    project = project_root()
    deploy(project, assets_dir(), args.force)
    port = free_port(args.port)
    url = f"http://localhost:{port}{args.base_path}/"

    print(f"ProMentor Dashboard: {url}", flush=True)
    print("按 Ctrl+C 停止服务", flush=True)

    handler = http.server.SimpleHTTPRequestHandler
    httpd = ProMentorServer(("::", port), handler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
