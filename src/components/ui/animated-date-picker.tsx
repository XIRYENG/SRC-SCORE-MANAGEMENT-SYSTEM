"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
} from "@floating-ui/react";
import { cn } from "../../lib/utils";

type AnimatedDatePickerProps = {
  id?: string;
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
};

export function AnimatedDatePicker({
  id,
  value,
  onChange,
  placeholder = "Select date",
  label,
  disabled = false,
  className,
  triggerClassName,
}: AnimatedDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Parse current value or default to today
  const initialDate = React.useMemo(() => {
    if (!value) return new Date();
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? new Date() : date;
  }, [value]);

  const [viewDate, setViewDate] = React.useState(initialDate);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(8),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
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

  const handleSelect = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const formattedDate = React.useMemo(() => {
    if (!value) return "";
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  }, [value]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calendarDays = React.useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const days: Date[] = [];
    
    const count = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    // Prev month days
    const prevMonthDays = daysInMonth(year, month - 1);
    for (let i = startDay - 1; i >= 0; i--) {
      days.push(new Date(year, month - 1, prevMonthDays - i));
    }
    
    // Current month days
    for (let i = 1; i <= count; i++) {
      days.push(new Date(year, month, i));
    }
    
    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push(new Date(year, month + 1, i));
    }
    
    return days;
  }, [viewDate]);

  const monthName = viewDate.toLocaleString('default', { month: 'long' });
  const year = viewDate.getFullYear();

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const isSelected = (date: Date) => {
    if (!value) return false;
    const [y, m, d] = value.split('-').map(Number);
    return date.getDate() === d &&
           date.getMonth() === m - 1 &&
           date.getFullYear() === y;
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === viewDate.getMonth();
  };

  return (
    <div className={cn("relative w-full", className)}>
      <button
        id={id}
        ref={refs.setReference}
        {...getReferenceProps()}
        disabled={disabled}
        type="button"
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-50",
          isOpen && "border-teal-500 ring-2 ring-teal-500/20",
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <CalendarIcon size={16} className={cn("shrink-0", value ? "text-teal-600" : "text-slate-400")} />
          <span className={cn("truncate", value ? "font-bold text-slate-900" : "font-medium text-slate-400")}>
            {value ? formattedDate : placeholder}
          </span>
        </div>
      </button>

      <FloatingPortal>
        <AnimatePresence>
          {isOpen && (
            <FloatingFocusManager context={context} modal={false}>
              <div
                ref={refs.setFloating}
                style={floatingStyles}
                {...getFloatingProps()}
                className="z-[9999] outline-none"
              >
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="w-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
                >
                  {/* Calendar Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">{monthName}</span>
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider">{year}</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={prevMonth}
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={nextMonth}
                        type="button"
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Weekdays */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="text-center text-[10px] font-black text-slate-400 uppercase">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Days */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((date, idx) => {
                      const selected = isSelected(date);
                      const currentMonth = isCurrentMonth(date);
                      const today = isToday(date);
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSelect(date)}
                          className={cn(
                            "h-8 w-8 flex items-center justify-center rounded-lg text-xs transition-all relative",
                            !currentMonth && "text-slate-300",
                            currentMonth && !selected && "text-slate-600 hover:bg-teal-50 hover:text-teal-700",
                            selected && "bg-teal-600 text-white font-bold shadow-lg shadow-teal-600/20",
                            today && !selected && "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-teal-600 after:rounded-full"
                          )}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <button
                      onClick={() => handleSelect(new Date())}
                      type="button"
                      className="text-[10px] font-black text-teal-600 uppercase hover:text-teal-700"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      type="button"
                      className="text-[10px] font-black text-slate-400 uppercase hover:text-slate-600"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </div>
            </FloatingFocusManager>
          )}
        </AnimatePresence>
      </FloatingPortal>
    </div>
  );
}
