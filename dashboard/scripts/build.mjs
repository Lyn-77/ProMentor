#!/usr/bin/env node
/**
 * ==========================================================================
 * ProMentor Dashboard 构建脚本
 * --------------------------------------------------------------------------
 * 1. next build 静态导出（basePath 可配，默认 /dashboard）
 * 2. 产物复制到 skills/promentor/assets/dashboard/ —— 只分发构建产物，不含源码
 *
 * 用法:
 *   node scripts/build.mjs                      # basePath=/dashboard
 *   node scripts/build.mjs --base-path=/dash    # 自定义部署子路径
 * ==========================================================================
 */

import { execSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outDir = path.join(root, "out")
const targetDir = path.resolve(root, "../skills/promentor/assets/dashboard")

const basePathArg = process.argv.find((arg) => arg.startsWith("--base-path="))
const basePath = basePathArg ? basePathArg.split("=")[1] : "/dashboard"

console.log(`▶ 构建 dashboard（部署子路径: ${basePath}）`)

// 开发数据目录（public/prom-data）不进构建产物：产物不内嵌课程数据
// 暂存目录必须放在 public 之外，否则 Next 会把暂存数据一并复制进产物
const devData = path.join(root, "public", "prom-data")
let stashDir = null
if (fs.existsSync(devData)) {
  stashDir = fs.mkdtempSync(path.join(os.tmpdir(), "prom-data-"))
  fs.renameSync(devData, path.join(stashDir, "prom-data"))
}

try {
  execSync("pnpm exec next build", {
    cwd: root,
    env: { ...process.env, NEXT_PUBLIC_BASE_PATH: basePath },
    stdio: "inherit",
  })
} finally {
  if (stashDir) {
    fs.renameSync(path.join(stashDir, "prom-data"), devData)
  }
}

fs.rmSync(targetDir, { recursive: true, force: true })
fs.cpSync(outDir, targetDir, { recursive: true })

console.log(`✅ 构建产物已输出: ${targetDir}`)
