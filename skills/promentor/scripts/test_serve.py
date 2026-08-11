#!/usr/bin/env python3
"""serve.py 的轻量单元测试（标准库 unittest，不触碰端口/进程）。"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import serve


class ParseArgsTest(unittest.TestCase):
    """命令行参数解析"""

    def test_default_command_is_start(self):
        args = serve.parse_args([])
        self.assertEqual(args.command, "start")

    def test_all_commands(self):
        for cmd in ("start", "status", "stop", "kill", "shutdown"):
            args = serve.parse_args([cmd])
            self.assertEqual(args.command, cmd)

    def test_port_flag(self):
        args = serve.parse_args(["start", "--port", "4000"])
        self.assertEqual(args.port, 4000)

    def test_no_open_flag(self):
        self.assertTrue(serve.parse_args(["start", "--no-open"]).no_open)

    def test_foreground_flag(self):
        self.assertTrue(serve.parse_args(["start", "--foreground"]).foreground)

    def test_base_path_flag(self):
        args = serve.parse_args(["start", "--base-path", "/dash"])
        self.assertEqual(args.base_path, "/dash")


class AssetsDirTest(unittest.TestCase):
    """构建产物定位"""

    def test_assets_dir_points_to_bundled_dashboard(self):
        assets = serve.assets_dir()
        self.assertTrue(assets.is_dir())
        self.assertEqual(assets.name, "dashboard")
        self.assertTrue((assets / "index.html").is_file())


class ProjectRootTest(unittest.TestCase):
    """项目根识别"""

    def test_missing_promentor_exits(self):
        with tempfile.TemporaryDirectory() as tmp:
            old_cwd = Path.cwd()
            try:
                os.chdir(tmp)
                with self.assertRaises(SystemExit):
                    serve.project_root()
            finally:
                os.chdir(old_cwd)


if __name__ == "__main__":
    unittest.main()
