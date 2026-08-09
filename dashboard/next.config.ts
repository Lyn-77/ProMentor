import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // 静态导出：产物可直接由任意静态服务器托管
  output: "export",
  // 部署子路径：产物复制到项目根 dashboard/ 目录后，
  // 访问 http://localhost:8000/dashboard/，数据从 /.promentor/ 读取
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "/dashboard",
  trailingSlash: true,
}

export default nextConfig
