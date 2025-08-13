"use client"

import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/providers/theme-context"
import { Moon, Sun } from "lucide-react"

export default function Footer() {
    const { isDark, toggleTheme } = useTheme()

    const symbolSrc = isDark ? "/MCPay-symbol-dark.svg" : "/MCPay-symbol-light.svg"

    return (
        <footer
            className={`w-full border-t ${isDark ? "bg-black/95 border-gray-800" : "bg-white/95 border-gray-200"
                }`}
        >
            <div className="w-full px-2">
                <div className="flex items-center justify-between py-2">
                    {/* Left: symbol + © year */}
                    <div className="flex items-center gap-3">
                        <Image
                            src={symbolSrc}
                            alt="MCPay Symbol"
                            width={32}
                            height={32}
                            className="rounded-sm"
                            priority
                        />
                        <p className="text-[13px] font-semibold text-muted-foreground">
                            © <span className="font-mono tracking-wide font-medium">{new Date().getFullYear()} MCPay</span>
                        </p>
                    </div>

                    {/* Right: theme toggle + links */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                            variant="link"
                            size="icon"
                            aria-label="Toggle theme"
                            onClick={toggleTheme}
                            className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                            {isDark ? (
                                <Sun className="h-4 w-4 text-amber-500" />
                            ) : (
                                <Moon className="h-4 w-4" />
                            )}
                        </Button>

                        <nav className="flex items-center">
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href="https://github.com/your-org-or-user" target="_blank" rel="noreferrer">
                                    GITHUB
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href="https://t.me/your-handle" target="_blank" rel="noreferrer">
                                    TELEGRAM
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="link"
                                className="h-8 px-2 font-mono text-[13px] tracking-wide text-muted-foreground hover:text-foreground hover:underline hover:decoration-dotted underline-offset-2"
                            >
                                <Link href="https://x.com/your-handle" target="_blank" rel="noreferrer">
                                    X
                                </Link>
                            </Button>

                        </nav>
                    </div>
                </div>
            </div>
        </footer>
    )
}
