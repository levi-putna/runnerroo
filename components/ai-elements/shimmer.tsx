"use client";

import { cn } from "@/lib/utils";
import type { MotionProps } from "motion/react";
import { motion } from "motion/react";
import type { CSSProperties, ElementType } from "react";
import { memo, useMemo } from "react";

type MotionHTMLProps = MotionProps & Record<string, unknown>;

// motion.* references are module-level (eslint react-hooks/static-components).
const MotionP = motion.p;
const MotionSpan = motion.span;
const MotionDiv = motion.div;

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  const motionProps: MotionHTMLProps = {
    animate: { backgroundPosition: "0% center" },
    className: cn(
      "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
      "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
      className
    ),
    initial: { backgroundPosition: "100% center" },
    style: {
      "--spread": `${dynamicSpread}px`,
      backgroundImage:
        "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
    } as CSSProperties,
    transition: {
      duration,
      ease: "linear",
      repeat: Number.POSITIVE_INFINITY,
    },
  };

  if (typeof Component === "string" && Component === "span") {
    return <MotionSpan {...motionProps}>{children}</MotionSpan>;
  }
  if (typeof Component === "string" && Component === "div") {
    return <MotionDiv {...motionProps}>{children}</MotionDiv>;
  }

  return <MotionP {...motionProps}>{children}</MotionP>;
};

export const Shimmer = memo(ShimmerComponent);
