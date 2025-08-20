"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  Copy,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Footer from "@/components/custom-ui/footer"
import { useTheme } from "@/components/providers/theme-context"
import { urlUtils } from "@/lib/client/utils"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from "@/components/ui/pagination"

/* ---------------- Types (API-ready) ---------------- */
type PaymentStatus = "success" | "pending" | "failed"

export interface ExplorerPayment {
  id: string
  status: PaymentStatus
  serverId: string
  serverName: string
  tool: string
  amountUSDC: number
  network: "base-sepolia" | "base" | string
  user: string
  timestamp: string
  txHash: string
}
type ApiArrayResponse = ExplorerPayment[]
type ApiObjectResponse = { items: ExplorerPayment[]; total: number }

/* 24 rows per page */
const PAGE_SIZE = 24

/* ---------------- Helpers ---------------- */
const formatUSDC = (n: number) => `$${n.toFixed(2)}`
const truncateHash = (h: string, left = 6, right = 7) =>
  h.length > left + right + 3 ? `${h.slice(0, left)}...${h.slice(-right)}` : h

const txExplorers: Record<string, (hash: string) => string> = {
  "base-sepolia": (h) => `https://sepolia.basescan.org/tx/${h}`,
  base: (h) => `https://basescan.org/tx/${h}`,
}
const getTxUrl = (network: string, hash: string) =>
  txExplorers[network]?.(hash) ?? `https://etherscan.io/tx/${hash}`

/* relative time with short units (secs, mins, hrs, days…) */
function formatRelativeShort(iso: string, now = Date.now()) {
  const diffMs = new Date(iso).getTime() - now
  const abs = Math.abs(diffMs)
  const sec = Math.round(abs / 1000)
  const min = Math.round(sec / 60)
  const hr = Math.round(min / 60)
  const day = Math.round(hr / 24)
  const month = Math.round(day / 30)
  const year = Math.round(day / 365)

  const value =
    sec < 60 ? { n: Math.max(1, sec), u: "secs" } :
      min < 60 ? { n: min, u: "mins" } :
        hr < 24 ? { n: hr, u: "hrs" } :
          day < 30 ? { n: day, u: "days" } :
            month < 12 ? { n: month, u: "mos" } :
              { n: year, u: "yrs" }

  return `${value.n} ${value.u} ${diffMs <= 0 ? "ago" : "from now"}`
}

/* Dummy data until API is ready */
const DUMMY_ROWS: ExplorerPayment[] = Array.from({ length: 120 }).map((_, i) => ({
  id: `row-${i + 1}`,
  status: "success",
  serverId: "mcpay-build",
  serverName: "MCPay Build",
  tool: "create_session",
  amountUSDC: 0.01,
  network: "base-sepolia",
  user: "Luís Freitas",
  timestamp: "2025-08-20T13:04:00.000Z",
  txHash: `0xf98dd4a0d4ca1b66c12a76b9a118c04a0b5c9f23${(1000 + i).toString(16)}`,
}))

export default function ClientExplorerPage() {
  const { isDark } = useTheme()
  const searchParams = useSearchParams()
  const router = useRouter()

  const pageFromQuery = Number(searchParams.get("page") || "1")
  const [page, setPage] = useState<number>(Number.isFinite(pageFromQuery) && pageFromQuery > 0 ? pageFromQuery : 1)

  const [rows, setRows] = useState<ExplorerPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)

  const totalPages = useMemo(() => {
    if (totalCount != null) return Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
    return page + (hasNext ? 1 : 0)
  }, [totalCount, page, hasNext])

  /* keep URL in sync */
  useEffect(() => {
    const sp = new URLSearchParams(searchParams.toString())
    if (page === 1) sp.delete("page"); else sp.set("page", String(page))
    router.replace(`?${sp.toString()}`, { scroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  /* accept manual query changes */
  useEffect(() => {
    if (page !== pageFromQuery && Number.isFinite(pageFromQuery) && pageFromQuery > 0) {
      setPage(pageFromQuery)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageFromQuery])

  /* fetch (or dummy) */
  useEffect(() => {
    const controller = new AbortController()
    const fetchRows = async () => {
      setLoading(true)
      setError(null)
      const USE_DUMMY = true

      try {
        const offset = (page - 1) * PAGE_SIZE
        if (USE_DUMMY) {
          setRows(DUMMY_ROWS.slice(offset, offset + PAGE_SIZE))
          setTotalCount(DUMMY_ROWS.length)
          setHasNext(offset + PAGE_SIZE < DUMMY_ROWS.length)
        } else {
          const res = await fetch(
            urlUtils.getApiUrl(`/payments?limit=${PAGE_SIZE}&offset=${offset}`),
            { signal: controller.signal }
          )
          if (!res.ok) throw new Error(`Failed to fetch payments: ${res.status}`)
          const data: ApiArrayResponse | ApiObjectResponse = await res.json()
          if (Array.isArray(data)) {
            setRows(data)
            setTotalCount(null)
            setHasNext(data.length === PAGE_SIZE)
          } else {
            setRows(data.items)
            setTotalCount(data.total)
            setHasNext(offset + data.items.length < data.total)
          }
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") setError(e.message)
        else if (!(e instanceof Error)) setError("Failed to fetch payments")
        setRows([])
      } finally {
        setLoading(false)
      }
    }

    fetchRows()
    return () => controller.abort()
  }, [page])

  const go = (p: number) => setPage(Math.max(1, p))
  const goPrev = () => go(page - 1)
  const goNext = () => { if (totalCount != null ? page < totalPages : hasNext) go(page + 1) }
  const showPagination = totalCount != null ? totalCount > PAGE_SIZE : page > 1 || hasNext

  const onCopy = async (text: string, message = "Copied") => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(message)
    } catch {
      toast.error("Could not copy")
    }
  }

  /* Compact header/cell padding for tighter layout */
  const th = "px-2 sm:px-3 py-3 text-[12px] uppercase tracking-widest text-muted-foreground text-left whitespace-nowrap"
  const td = "px-2 sm:px-3 py-3.5 border-t border-border align-middle"

  if (error) {
    return (
      <div className="bg-background">
        <main>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 text-center">
            <h1 className={`text-5xl font-extrabold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}>Something went wrong</h1>
            <p className={`text-lg max-w-3xl mx-auto ${isDark ? "text-gray-300" : "text-gray-600"}`}>We couldn&apos;t load the explorer right now.</p>
          </div>
        </main>
        <div className="mt-12">
          <Footer />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background">
      <main>
        {/* Wider container; title aligned with table */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-semibold font-host mb-10">Explorer</h2>
          </div>

          {/* Horizontal scroll on mobile; slightly condensed min width */}
          <div className="max-w-7xl mx-auto overflow-x-auto">
            <div className="min-w-[1100px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border">
                    {/* Status header removed visually but kept for a11y, fixed width */}
                    <TableHead className="w-[40px] pr-1 sr-only">Status</TableHead>
                    <TableHead className={`${th} font-mono`}>Server</TableHead>
                    <TableHead className={`${th} font-mono`}>Tool</TableHead>
                    <TableHead className={`${th} font-mono`}>Amount</TableHead>
                    <TableHead className={`${th} font-mono`}>Network</TableHead>
                    <TableHead className={`${th} font-mono`}>User</TableHead>
                    <TableHead className={`${th} font-mono`}>Date</TableHead>
                    <TableHead className={`${th} font-mono text-right pr-0`}>Transaction</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading
                    ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <TableRow key={`sk-${i}`}>
                        {[...Array(8)].map((__, j) => (
                          <TableCell key={j} className={td}>
                            <Skeleton className="h-5 w-24" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                    : rows.map((r) => {
                      const txUrl = getTxUrl(r.network, r.txHash)
                      const fullDate = new Date(r.timestamp).toLocaleString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      const rel = formatRelativeShort(r.timestamp)

                      return (
                        <TableRow key={r.id} className="hover:bg-muted/40">
                          {/* Status indicator with tooltip */}
                          <TableCell className={`${td} w-[40px] pr-1`}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-teal-700 bg-teal-500/10 hover:bg-teal-500/20 dark:text-teal-200 dark:bg-teal-800/50 dark:hover:bg-teal-800/70 transition-all duration-300"
                                    aria-label={r.status}
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>Success</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>

                          {/* Server */}
                          <TableCell className={`${td}`}>
                            <div className="text-sm whitespace-nowrap">{r.serverName}</div>
                          </TableCell>

                          {/* Tool */}
                          <TableCell className={`${td} font-mono font-medium text-xs sm:text-sm text-foreground`}>
                            {r.tool}
                          </TableCell>

                          {/* Amount + USDC tooltip */}
                          <TableCell className={`${td} font-mono`}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                                    <Image
                                      src="/USDC_Icon_transparent.svg"
                                      alt="USDC"
                                      width={16}
                                      height={16}
                                      className="h-4 w-4"
                                    />
                                    <span className="text-foreground">{formatUSDC(r.amountUSDC)}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>USDC</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>

                          {/* Network */}
                          <TableCell className={`${td} font-mono text-xs sm:text-sm text-muted-foreground`}>
                            {r.network}
                          </TableCell>

                          {/* User */}
                          <TableCell className={`${td}`}>
                            <div className="text-sm whitespace-nowrap">{r.user}</div>
                          </TableCell>

                          {/* Date: relative, tooltip shows full */}
                          <TableCell className={`${td} text-xs sm:text-sm text-muted-foreground pr-1`}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="cursor-default">
                                  {rel}
                                </TooltipTrigger>
                                <TooltipContent>{fullDate}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>

                          {/* Transaction: right-aligned, reduced left padding */}
                          <TableCell className={`${td} font-mono text-right pr-0 pl-1`}>
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs sm:text-sm">{truncateHash(r.txHash)}</span>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="outline"
                                      className="h-6 w-6 rounded-sm"
                                      onClick={() => onCopy(r.txHash, "Copied transaction hash")}
                                    >
                                      <Copy className="size-3 stroke-[2.5]" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Copy hash</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <a
                                      href={txUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Button
                                        size="icon"
                                        variant="outline"
                                        className="h-6 w-6 rounded-sm"
                                      >
                                        <ExternalLink className="size-3 stroke-[2.5]" />
                                      </Button>
                                    </a>
                                  </TooltipTrigger>
                                  <TooltipContent>Open in explorer</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>
          </div>

          {showPagination && (
            <div className="max-w-7xl mx-auto mt-10">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={goPrev}
                      aria-disabled={page === 1 || loading}
                      className={page === 1 || loading ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {totalCount != null && totalPages > 1 ? (
                    <>
                      {page > 2 && (
                        <>
                          <PaginationItem>
                            <PaginationLink onClick={() => go(1)}>1</PaginationLink>
                          </PaginationItem>
                          {page > 3 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                        </>
                      )}

                      {Array.from({ length: 3 })
                        .map((_, i) => page - 1 + i)
                        .filter(p => p >= 1 && p <= totalPages)
                        .map(p => (
                          <PaginationItem key={p}>
                            <PaginationLink onClick={() => go(p)} isActive={p === page}>
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ))}

                      {page < totalPages - 1 && (
                        <>
                          {page < totalPages - 2 && (
                            <PaginationItem>
                              <PaginationEllipsis />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink onClick={() => go(totalPages)}>{totalPages}</PaginationLink>
                          </PaginationItem>
                        </>
                      )}
                    </>
                  ) : (
                    <PaginationItem>
                      <PaginationLink isActive>{page}</PaginationLink>
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={goNext}
                      aria-disabled={loading || (totalCount != null ? page >= totalPages : !hasNext)}
                      className={loading || (totalCount != null ? page >= totalPages : !hasNext) ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </main>

      {/* simple spacing below pagination, no fixed footer */}
      <div className="mt-12">
        <Footer />
      </div>
    </div>
  )
}
