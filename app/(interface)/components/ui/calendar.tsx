"use client";

import * as React from "react";

import { cn } from "./utils";
import { buttonVariants } from "./button";

type CalendarRangeValue = {
  from?: Date;
  to?: Date;
};

type CalendarSelection = Date | CalendarRangeValue | undefined;

interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  mode?: "single" | "range";
  selected?: CalendarSelection;
  onSelect?: (value: CalendarSelection) => void;
  disabled?: boolean;
  fromDate?: Date;
  toDate?: Date;
  classNames?: Partial<Record<string, string>>;
}

const formatDateInputValue = (value?: Date) =>
  value ? value.toISOString().slice(0, 10) : "";

const parseDateInputValue = (value: string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(
  (
    {
      mode = "single",
      selected,
      onSelect,
      disabled,
      fromDate,
      toDate,
      className,
      classNames,
      ...props
    },
    ref,
  ) => {
    const baseClasses = cn("p-3", className);
    const min = formatDateInputValue(fromDate);
    const max = formatDateInputValue(toDate);

    if (mode === "range") {
      const rangeValue: CalendarRangeValue =
        selected && !(selected instanceof Date)
          ? selected
          : {};

      return (
        <div
          ref={ref}
          data-slot="calendar"
          className={baseClasses}
          {...props}
        >
          <div className={cn("flex flex-col gap-2", classNames?.month)}>
            <label className={cn("text-sm font-medium", classNames?.caption_label)}>
              Start date
            </label>
            <input
              type="date"
              className={cn(buttonVariants({ variant: "outline" }), "w-full text-left")}
              value={formatDateInputValue(rangeValue.from)}
              min={min}
              max={max}
              disabled={disabled}
              onChange={event => {
                const next = {
                  ...rangeValue,
                  from: parseDateInputValue(event.target.value),
                };
                onSelect?.(next);
              }}
            />
          </div>
          <div className={cn("mt-3 flex flex-col gap-2", classNames?.month)}>
            <label className={cn("text-sm font-medium", classNames?.caption_label)}>
              End date
            </label>
            <input
              type="date"
              className={cn(buttonVariants({ variant: "outline" }), "w-full text-left")}
              value={formatDateInputValue(rangeValue.to)}
              min={min}
              max={max}
              disabled={disabled}
              onChange={event => {
                const next = {
                  ...rangeValue,
                  to: parseDateInputValue(event.target.value),
                };
                onSelect?.(next);
              }}
            />
          </div>
        </div>
      );
    }

    const singleValue = selected instanceof Date ? selected : undefined;

    return (
      <div
        ref={ref}
        data-slot="calendar"
        className={baseClasses}
        {...props}
      >
        <input
          type="date"
          className={cn(buttonVariants({ variant: "outline" }), "w-full text-left")}
          value={formatDateInputValue(singleValue)}
          min={min}
          max={max}
          disabled={disabled}
          onChange={event => {
            const next = parseDateInputValue(event.target.value);
            onSelect?.(next);
          }}
        />
      </div>
    );
  },
);

Calendar.displayName = "Calendar";

export { Calendar };
