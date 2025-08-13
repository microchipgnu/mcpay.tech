"use client";

import * as React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { HeroTab } from "./hero-tab";
import { cn } from "@/lib/utils";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { easeOut } from "motion";
import LogoStack from "@/components/custom-ui/logo-stack";

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

  const fadeUp: Variants = React.useMemo(
    () => ({
      hidden: { opacity: 0, y: prefersReduced ? 0 : 8 },
      visible: {
        opacity: 1,
        y: 0,
        transition: { duration: prefersReduced ? 0 : 0.4, ease: easeOut },
      },
    }),
    [prefersReduced]
  );

  return (
    <section className={cn("mx-auto w-full max-w-6xl px-4 md:px-6", className)}>
      {/* Image + Overlay Title */}
      <div className="relative mx-auto w-full overflow-hidden rounded-2xl mt-4">
        <div className="relative aspect-[3/4] sm:aspect-[21/9]">
          {/* Blur -> crisp on first load (image) */}
          <motion.div
            initial={{ opacity: 0, filter: "blur(16px) saturate(0.9)" }}
            animate={{ opacity: 1, filter: "blur(0px) saturate(1)" }}
            transition={{ duration: prefersReduced ? 0 : 0.8, ease: easeOut }}
            className="absolute inset-0"
          >
            <Image
              src="/mcpay-hero-painting.png"
              alt=""
              priority
              fill
              sizes="(max-width: 640px) 100vw, 100vw"
              className="object-cover"
            />
          </motion.div>

          {/* Heading with the same blur -> crisp motion */}
          <div className="absolute inset-0 flex items-end sm:items-end justify-center sm:justify-start">
            <div className="w-full p-6 sm:p-8">
              <motion.h1
                className="text-center sm:text-left text-2xl md:text-4xl font-host font-semibold leading-tight text-background drop-shadow"
                initial={{ opacity: 0, filter: "blur(16px) saturate(0.9)" }}
                animate={{ opacity: 1, filter: "blur(0px) saturate(1)" }}
                transition={{ duration: prefersReduced ? 0 : 0.8, ease: easeOut }}
              >
                Tool–Call Based
                <br className="hidden sm:block" />{" "}
                <span className="sm:ml-1">Payments for MCPs</span>
              </motion.h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content row */}
      <motion.div
        className="mt-12 grid gap-8 sm:grid-cols-2 sm:gap-4 sm:items-center"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {/* LEFT column: tabs + copy + CTA */}
        <div>
          {/* Tabs */}
          <motion.div className="px-0 sm:px-8" variants={fadeUp}>
            <HeroTab
              items={COPY.map(({ id, label }) => ({ id, label }))}
              value={active}
              onChange={(id) => setActive(id as Copy["id"])}
              durationMs={durationMs}
            />
          </motion.div>

          {/* Dynamic copy + CTA */}
          <motion.div
            className="mt-6 px-0 sm:px-8 max-w-xl mx-auto sm:mx-0 text-center sm:text-left"
            variants={fadeUp}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={current.id}
                className="text-balance font-medium text-md text-muted-foreground sm:text-lg"
                initial={{
                  opacity: 0,
                  filter: "blur(6px)",
                  y: prefersReduced ? 0 : 6,
                }}
                animate={{
                  opacity: 1,
                  filter: "blur(0px)",
                  y: 0,
                }}
                exit={{
                  opacity: 0,
                  filter: "blur(6px)",
                  y: prefersReduced ? 0 : -6,
                }}
                transition={{
                  duration: prefersReduced ? 0 : 0.25,
                  ease: easeOut,
                }}
              >
                {current.subheading}
              </motion.p>
            </AnimatePresence>

            <motion.div
              className="mt-6 flex justify-center sm:justify-start"
              variants={fadeUp}
            >
              <Button asChild size="lg" className="min-w-[10rem]">
                <a href={current.href ?? "#"}>{current.cta}</a>
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* RIGHT column: logo stack */}
        <motion.div
          className="order-last sm:order-none mt-8 sm:mt-0 px-0 sm:px-8 flex justify-center sm:justify-end items-center"
          variants={fadeUp}
        >
          <LogoStack />
        </motion.div>
      </motion.div>
    </section>
  );
}
