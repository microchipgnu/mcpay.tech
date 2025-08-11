"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { HeroTab } from "./hero-tab";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";

type Copy = {
    id: "devs" | "hosts" | "agents";
    label: string;
    subheading: string;
    cta: string;
    href?: string;
};

const COPY: Copy[] = [
    {
        id: "devs",
        label: "AI DEVELOPERS",
        subheading:
            "Consume MCPs seamlessly with micropayments, no subscription required.",
        cta: "Browse Servers",
        href: "/servers",
    },
    {
        id: "hosts",
        label: "MCP HOSTS",
        subheading:
            "Register your servers and accept micropayments, with custom prices for each tool call.",
        cta: "Monetize Server",
        href: "/monetize",
    },
    {
        id: "agents",
        label: "AI AGENTS",
        subheading:
            "Prepare your infrastructure for Agent to Agents payments, enabling microtransactions.",
        cta: "View Docs",
        href: "/docs",
    },
];

export default function Hero({
    className,
    durationMs = 10000,
}: {
    className?: string;
    /** milliseconds per tab for auto-advance + underline fill */
    durationMs?: number;
}) {
    const [active, setActive] = React.useState<Copy["id"]>("devs");
    const current = COPY.find((c) => c.id === active) ?? COPY[0];
    const prefersReduced = useReducedMotion();

    return (
        <section className={cn("mx-auto w-full max-w-6xl px-4 md:px-6", className)}>
            {/* Image + Overlay Title */}
            <div className="relative mx-auto w-full overflow-hidden rounded-3xl">
                <div className="relative aspect-[3/4] sm:aspect-[21/9]">
                    <Image
                        src="/mcpay-hero-painting.png"
                        alt=""
                        priority
                        fill
                        sizes="(max-width: 640px) 100vw, 100vw"
                        className="object-cover"
                    />

                    <div className="absolute inset-0 flex items-end sm:items-end justify-center sm:justify-start">
                        <div className="w-full p-6 sm:p-10 md:p-14">
                            <h1 className="text-center sm:text-left text-2xl md:text-4xl font-host font-semibold leading-tight text-background drop-shadow">
                                Tool–Call Based
                                <br className="hidden sm:block" />{" "}
                                <span className="sm:ml-1">Payments for MCPs</span>
                            </h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="mt-8">
                <HeroTab
                    items={COPY.map(({ id, label }) => ({ id, label }))}
                    value={active}
                    onChange={(id) => setActive(id as Copy["id"])}
                    durationMs={durationMs}
                    className="px-2"
                />
            </div>

            {/* Dynamic copy + CTA */}
            <div
                id={`hero-tabpanel-${current.id}`}
                role="tabpanel"
                aria-labelledby={`hero-tab-${current.id}`}
                className="mx-auto mt-8 flex max-w-3xl flex-col items-center text-center"
            >
                <AnimatePresence mode="wait" initial={false}>
                    <motion.p
                        key={current.id} // re-mount on tab change
                        className="text-balance max-w-lg font-medium text-md text-muted-foreground sm:text-lg"
                        initial={{ opacity: 0, filter: "blur(6px)" }}
                        animate={{ opacity: 1, filter: "blur(0px)" }}
                        exit={{ opacity: 0, filter: "blur(6px)" }}        // ← blur+fade on disappear
                        transition={{
                            duration: prefersReduced ? 0 : 0.25,            // keep your 0.55
                            ease: "easeOut",
                        }}
                    >
                        {current.subheading}
                    </motion.p>
                </AnimatePresence>

                <div className="mt-8">
                    <Button asChild size="lg" className="min-w-[10rem]">
                        <a href={current.href ?? "#"}>{current.cta}</a>
                    </Button>
                </div>
            </div>
        </section>
    );
}