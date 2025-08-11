"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { urlUtils } from "@/lib/client/utils"

export default function HeroStats() {
  const [liveServers, setLiveServers] = useState<number | null>(null)

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

  const Stat = ({
    label,
    value,
    loading,
  }: {
    label: string
    value: string | number | null
    loading?: boolean
  }) => (
    <Card className="border bg-background rounded-md p-0 gap-0">
      <CardContent className="px-6 py-6">
        <div className="text-sm font-medium text-muted-foreground mb-3">
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <div className="text-2xl font-bold font-mono tracking-tight">
            {value ?? "—"}
          </div>
        )}
      </CardContent>
    </Card>
  )

  const isLoading = liveServers === null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-6xl mx-auto px-4 md:px-6">
      <Stat label="Live Servers" value={liveServers} loading={isLoading} />
      <Stat label="Tools" value={1293} loading={isLoading} />
      <Stat label="Transactions" value={218} loading={isLoading} />
    </div>
  )
}
