import { CheckCircle2, Circle, PlayCircle } from "lucide-react"

import type { ChapterStatus } from "@/lib/prom"

export const STATUS_VIEW: Record<
  ChapterStatus,
  {
    label: string
    variant: "success" | "warning" | "muted"
    icon: typeof CheckCircle2
  }
> = {
  completed: { label: "已完成", variant: "success", icon: CheckCircle2 },
  in_progress: { label: "学习中", variant: "warning", icon: PlayCircle },
  not_started: { label: "未开始", variant: "muted", icon: Circle },
}
