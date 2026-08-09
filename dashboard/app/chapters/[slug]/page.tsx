import { ChapterPage } from "@/components/dashboard/chapter-page"
import { readdirSync } from "node:fs"
import path from "node:path"

// 静态导出时数据在运行时才可知，无法预生成真实章节页面。
// - 开发：从 public/prom-data 读取真实章节，让动态路由可直达/刷新
// - 构建：数据被隔离（产物不内嵌课程），回退占位参数满足 output export 校验；
//   真实章节路由由 serve.py 的 SPA fallback 返回主页壳，客户端按路径渲染详情
export function generateStaticParams() {
  try {
    const dataDir = path.join(process.cwd(), "public", "prom-data", "chapters")
    const slugs = readdirSync(dataDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
    if (slugs.length > 0) {
      return slugs.map((slug) => ({ slug }))
    }
  } catch {
    // 构建时数据目录不存在，走占位回退
  }
  return [{ slug: "placeholder" }]
}

export default async function ChapterRoute({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="mx-auto max-w-5xl p-6">
      <ChapterPage chapterId={slug} />
    </main>
  )
}
