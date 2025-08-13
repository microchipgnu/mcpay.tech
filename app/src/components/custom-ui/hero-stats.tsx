"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { urlUtils } from "@/lib/client/utils"
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "motion/react"
import { easeOut } from "motion"

export default function HeroStats() {
  const [liveServers, setLiveServers] = useState<number | null>(null)
  const prefersReduced = useReducedMotion()

  useEffect(() => {
    let mounted = true
    const fetchAnalytics = async () => {
      try {
        const res = await fetch(urlUtils.getApiUrl("/analytics/usage"))
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        if (mounted) setLiveServers(Number(data?.totalServers ?? 0))
      } catch {
        if (mounted) setLiveServers(0)
      }
    }
    fetchAnalytics()
    return () => {
      mounted = false
    }
  }, [])

  // Same motion + timings as hero secondary objects
  const fadeUp: Variants = useMemo(
    () => ({
      hidden: { opacity: 0, y: prefersReduced ? 0 : 8 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: prefersReduced ? 0 : 0.4, ease: easeOut },
      },
    }),
    [prefersReduced]
  )

  const container: Variants = useMemo(
    () => ({
      hidden: {},
      visible: {
        transition: {
          staggerChildren: prefersReduced ? 0 : 0.06,
        },
      },
    }),
    [prefersReduced]
  )

  const isLoading = liveServers === null

  const Stat = ({
    label,
    value,
    loading,
  }: {
    label: string
    value: string | number | null
    loading?: boolean
  }) => (
    <motion.div variants={fadeUp} layout>
      <Card className="border bg-background rounded-md p-0 gap-0" >
        <CardContent className="px-6 py-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            {label}
          </div>

          {/* Skeleton first, then value with a smooth crossfade/blur */}
          <AnimatePresence initial={false} mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0, y: prefersReduced ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: prefersReduced ? 0 : -4 }}
                transition={{ duration: prefersReduced ? 0 : 0.2, ease: easeOut }}
                layout
              >
                <Skeleton className="h-7 w-16" />
              </motion.div>
            ) : (
              <motion.div
                key="value"
                initial={{
                  opacity: 0,
                  y: prefersReduced ? 0 : 4,
                  filter: "blur(6px)",
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                }}
                exit={{
                  opacity: 0,
                  y: prefersReduced ? 0 : -4,
                  filter: "blur(6px)",
                }}
                transition={{ duration: prefersReduced ? 0 : 0.25, ease: easeOut }}
                layout
              >
                <div className="text-3xl font-semibold font-mono tracking-tight">
                  {value ?? "—"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-6xl mx-auto px-4 md:px-6"
      variants={container}
      initial="hidden"
      animate="visible" // animate immediately on mount
    >
      <Stat label="Live Servers" value={liveServers} loading={isLoading} />
      <Stat label="Tools" value={1293} loading={isLoading} />
      <Stat label="Transactions" value={218} loading={isLoading} />
    </motion.div>
  )
}
