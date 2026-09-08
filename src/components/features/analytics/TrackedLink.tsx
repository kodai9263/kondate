"use client";

import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";

type EventValue = string | number | boolean;

type TrackedLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode;
  eventName: string;
  eventParams?: Record<string, EventValue>;
};

export function TrackedLink({ children, eventName, eventParams, onClick, ...props }: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        const analyticsWindow = window as typeof window & {
          gtag?: (command: "event", name: string, params?: Record<string, EventValue>) => void;
        };
        analyticsWindow.gtag?.("event", eventName, eventParams);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
