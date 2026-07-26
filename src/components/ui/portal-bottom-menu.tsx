"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
} from "motion/react";
import { cn } from "../../lib/utils";

export type PortalBottomMenuItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  disabled?: boolean;
};

type PortalBottomMenuProps = {
  items: PortalBottomMenuItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
};

const menuTransition = {
  duration: 0.22,
  ease: "easeOut" as const,
};

export function PortalBottomMenu({
  items,
  activeId,
  onSelect,
  className,
}: PortalBottomMenuProps) {
  const [visibleLabel, setVisibleLabel] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSelect = (item: PortalBottomMenuItem) => {
    if (item.disabled) {
      return;
    }

    onSelect(item.id);
    setVisibleLabel(item.label);

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setVisibleLabel(null);
    }, 1700);
  };

  return (
    <nav
      aria-label="Portal navigation"
      className={cn(
        "fixed left-1/2 z-[900] w-[calc(100vw-24px)] max-w-md -translate-x-1/2",
        "bottom-[max(12px,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <div className="relative flex justify-center">
        <AnimatePresence>
          {visibleLabel && (
            <motion.div
              initial={{
                opacity: 0,
                y: 6,
                scale: 0.96,
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
              }}
              exit={{
                opacity: 0,
                y: 4,
                scale: 0.98,
              }}
              transition={menuTransition}
              className="
                pointer-events-none
                absolute
                -top-11
                left-1/2
                max-w-[calc(100vw-32px)]
                -translate-x-1/2
                rounded-xl
                border
                border-slate-200
                bg-white/95
                px-3
                py-1.5
                text-xs
                font-bold
                text-slate-800
                shadow-lg
                backdrop-blur-xl
                dark:border-white/10
                dark:bg-slate-900/95
                dark:text-white
              "
            >
              <span className="block truncate">
                {visibleLabel}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="
            flex
            w-fit
            max-w-full
            items-center
            justify-center
            gap-1
            overflow-hidden
            rounded-full
            border
            border-slate-200/80
            bg-white/95
            px-2
            py-1.5
            shadow-[0_12px_32px_-12px_rgba(15,23,42,0.38)]
            backdrop-blur-xl
            dark:border-white/10
            dark:bg-slate-900/95
          "
        >
          {items.map(item => {
            const isActive = item.id === activeId;
            const IconElement = React.isValidElement(item.icon) 
              ? React.cloneElement(item.icon as React.ReactElement<any>, { size: 20, strokeWidth: isActive ? 2.5 : 2, className: "h-5 w-5" })
              : item.icon;

            return (
              <button
                key={item.id}
                type="button"
                disabled={item.disabled}
                onClick={() => handleSelect(item)}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                  "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
                  isActive
                    ? "bg-[#007C89] text-white shadow-md"
                    : "text-slate-600 hover:bg-teal-50 hover:text-teal-700 dark:text-slate-300 dark:hover:bg-white/10",
                  item.disabled && "cursor-not-allowed opacity-40"
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="portal-bottom-menu-active"
                    className="absolute inset-0 rounded-full bg-[#007C89]"
                    transition={{
                      type: "spring",
                      stiffness: 420,
                      damping: 32,
                    }}
                  />
                ) : null}

                <motion.span
                  animate={{
                    scale: isActive ? 1.08 : 1,
                    y: isActive ? -1 : 0,
                  }}
                  transition={menuTransition}
                  className="relative z-10"
                >
                  {IconElement}
                </motion.span>

                {typeof item.badgeCount === "number" && item.badgeCount > 0 && (
                  <span
                    className="
                      absolute
                      right-0.5
                      top-0.5
                      z-20
                      flex
                      min-h-4
                      min-w-4
                      items-center
                      justify-center
                      rounded-full
                      bg-red-500
                      px-1
                      text-[9px]
                      font-black
                      leading-none
                      text-white
                    "
                  >
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                )}

                <span className="sr-only">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
