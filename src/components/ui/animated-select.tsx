"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
  useId,
} from "@floating-ui/react";
import { cn } from "../../lib/utils";

export type AnimatedSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
};

type AnimatedSelectProps = {
  value: string;
  options: AnimatedSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  searchable?: boolean;
  mobileMode?: "popover" | "bottom-sheet";
  variant?: "default" | "compact-popover" | "searchable-popover";
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
};

export function AnimatedSelect({
  value,
  options,
  placeholder = "Select option",
  searchPlaceholder = "Search...",
  label,
  searchable = true,
  mobileMode = "bottom-sheet",
  variant = "default",
  disabled = false,
  onChange,
  className,
  triggerClassName,
}: AnimatedSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  const useBottomSheet = isMobile && mobileMode === "bottom-sheet";

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({
        fallbackPlacements: ["top-start", "bottom-end", "top-end"],
        padding: 12,
      }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.max(0, availableWidth)}px`,
            maxHeight: `${Math.max(0, availableHeight)}px`,
          });
        },
      }),
    ],
  });

  const click = useClick(context, { enabled: !disabled });
  const dismiss = useDismiss(context);
  const role = useRole(context);

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
    role,
  ]);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = React.useMemo(() => {
    return options.filter((opt) =>
      opt.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [options, query]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setQuery("");
  };

  const labelId = useId();

  React.useEffect(() => {
    if (isOpen && searchable && !useBottomSheet) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, searchable, useBottomSheet]);

  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-teal-500 ring-2 ring-teal-500/20",
          triggerClassName
        )}
      >
        <span className="truncate font-medium text-slate-700">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "shrink-0 text-slate-400 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <FloatingPortal>
        <AnimatePresence>
          {isOpen && (
            <>
              {useBottomSheet ? (
                <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-slate-950/40 backdrop-blur-sm">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                    onClick={() => setIsOpen(false)}
                  />
                  <motion.section
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="relative flex w-full max-h-[85dvh] flex-col overflow-hidden rounded-t-[2rem] bg-white shadow-2xl pb-[max(12px,env(safe-area-inset-bottom))]"
                  >
                    <header className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
                      <div className="space-y-0.5">
                        <h2 className="text-lg font-black text-slate-900">
                          {label || placeholder}
                        </h2>
                        {selectedOption && (
                          <p className="text-xs font-bold text-teal-600 uppercase">
                            Currently: {selectedOption.label}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                      >
                        <X size={20} strokeWidth={2.5} />
                      </button>
                    </header>

                    {searchable && (
                      <div className="shrink-0 border-b border-slate-100 p-4">
                        <div className="relative flex items-center">
                          <Search className="absolute left-3.5 h-4 w-4 text-slate-400" />
                          <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-10 text-sm font-medium outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all"
                          />
                          {query && (
                            <button
                              onClick={() => setQuery("")}
                              className="absolute right-3.5 p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                      <div className="space-y-1">
                        {filteredOptions.length > 0 ? (
                          filteredOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleSelect(option.value)}
                              className={cn(
                                "flex min-h-[48px] w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition-all",
                                option.value === value
                                  ? "bg-teal-50 text-teal-700"
                                  : "text-slate-600 hover:bg-slate-50"
                              )}
                            >
                              <div className="min-w-0 flex-1">
                                <span className={cn(
                                  "block truncate text-sm",
                                  option.value === value ? "font-bold" : "font-medium"
                                )}>
                                  {option.label}
                                </span>
                                {option.description && (
                                  <span className="mt-0.5 block truncate text-[10px] opacity-70">
                                    {option.description}
                                  </span>
                                )}
                              </div>
                              {option.value === value && (
                                <Check size={18} className="ml-3 shrink-0 text-teal-600" strokeWidth={3} />
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Search className="mb-3 h-8 w-8 text-slate-200" />
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                              No results found
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.section>
                </div>
              ) : (
                <FloatingFocusManager context={context} modal={false}>
                  <motion.div
                    ref={refs.setFloating}
                    style={floatingStyles}
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    {...getFloatingProps()}
                    className={cn(
                      "z-[950] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl outline-none",
                      variant === "compact-popover" ? "w-[min(340px,calc(100vw-24px))] max-h-[min(70dvh,520px)]" : "w-[320px]"
                    )}
                  >
                    {variant === "compact-popover" && (
                      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3">
                        <span className="text-sm font-bold text-slate-900">{label || placeholder}</span>
                        <button
                          onClick={() => setIsOpen(false)}
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    {searchable && (
                      <div className="shrink-0 border-b border-slate-100 p-2">
                        <div className="relative flex items-center">
                          <Search className="absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            ref={inputRef}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="h-9 w-full rounded-lg border border-slate-100 bg-slate-50 pl-8 pr-8 text-xs font-medium outline-none focus:border-teal-500 transition-all"
                          />
                          {query && (
                            <button
                              onClick={() => setQuery("")}
                              className="absolute right-2 p-1 text-slate-400 hover:text-slate-600"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="max-h-[300px] min-h-0 flex-1 overflow-y-auto overscroll-contain py-1 scrollbar-thin">
                      {filteredOptions.length > 0 ? (
                        filteredOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleSelect(option.value)}
                            className={cn(
                              "flex w-full items-center justify-between px-3 py-2 text-left transition-colors",
                              option.value === value
                                ? "bg-teal-50 text-teal-700"
                                : "text-slate-600 hover:bg-slate-50"
                            )}
                          >
                            <span className={cn(
                              "truncate text-xs",
                              option.value === value ? "font-bold" : "font-medium"
                            )}>
                              {option.label}
                            </span>
                            {option.value === value && (
                              <Check size={14} className="ml-2 shrink-0 text-teal-600" strokeWidth={3} />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            No results
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </FloatingFocusManager>
              )}
            </>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </div>
  );
}
