import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';


interface SubmenuOption {
  id: string;
  label: string;
  description?: string;
  gradient?: string;
  icon?: React.ReactNode;
  textClassName?: string;
  row?: number;
  variant?: "color" | "default";
  previewColors?: string[];
}

interface HorizontalSubmenuProps {
  isOpen: boolean;
  options: SubmenuOption[];
  onSelect: (optionId: string) => void;
  className?: string;
  rowClassName?: string | ((row: number) => string);
  itemClassName?: string;
  selectedOptionId?: string | null;
}

export function HorizontalSubmenu({
  isOpen,
  options,
  onSelect,
  className,
  rowClassName,
  itemClassName = '',
  selectedOptionId,
}: HorizontalSubmenuProps) {
  const groupedOptions = options.reduce((acc, option) => {
    const row = option.row ?? 0;
    if (!acc[row]) {
      acc[row] = [];
    }
    acc[row].push(option);
    return acc;
  }, {} as Record<number, SubmenuOption[]>);

  const sortedRows = Object.entries(groupedOptions)
    .map(([row, rowOptions]) => ({ row: Number(row), options: rowOptions }))
    .sort((a, b) => a.row - b.row);

  const containerClasses = className ? `${className}` : '';
  const getRowClassName = (row: number) => {
    if (typeof rowClassName === 'function') {
      return rowClassName(row);
    }
    return rowClassName ?? 'flex gap-2';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className={`
            absolute left-16 top-0 bg-popover border border-border rounded-lg shadow-lg p-3 z-50
            flex flex-col gap-3 ${containerClasses}
          `}
        >
          {sortedRows.map(({ row, options: rowOptions }) => (
            <div key={row} className={getRowClassName(row)}>
              {rowOptions.map(option => {
                const variant = option.variant ?? "default";
                const isSelected = selectedOptionId === option.id;

                if (variant === "color") {
                  const previewColors = option.previewColors ?? [];
                  return (
                    <button
                      key={option.id}
                      onClick={() => onSelect(option.id)}
                      className={`
                        group flex w-full items-center gap-3 rounded-md border border-transparent
                        bg-card/80 px-3 py-2 text-left text-foreground transition-colors duration-200
                        hover:bg-accent/70 hover:text-accent-foreground
                        ${isSelected ? 'border-primary/60 ring-1 ring-primary/40 bg-accent/80 text-accent-foreground' : ''}
                        ${itemClassName}
                      `}
                      title={option.description}
                    >
                      <div className="flex shrink-0 items-center gap-1">
                        {previewColors.length > 0 ? (
                          previewColors.slice(0, 5).map((color, index) => (
                            <span
                              key={`${option.id}-swatch-${index}`}
                              className="h-8 w-4 rounded-sm border border-border/60"
                              style={{ backgroundColor: color }}
                            />
                          ))
                        ) : (
                          <span
                            className="h-8 w-8 rounded-md border border-border/60"
                            style={option.gradient ? { background: option.gradient } : {}}
                          />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{option.label}</span>
                        {option.description && (
                          <span className="text-xs text-muted-foreground group-hover:text-accent-foreground/80">
                            {option.description}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                }

                const hasGradient = Boolean(option.gradient);
                const textColorClass = option.textClassName ?? (hasGradient ? 'text-white' : 'text-muted-foreground');
                const hoverClasses = hasGradient
                  ? 'hover:brightness-110'
                  : 'hover:bg-accent hover:text-accent-foreground';

                return (
                  <button
                    key={option.id}
                    onClick={() => onSelect(option.id)}
                    className={`
                      flex flex-col items-center justify-center rounded-lg border border-transparent
                      transition-all duration-200 min-w-[72px] h-[62px] px-3 text-center text-xs
                      ${hoverClasses} ${textColorClass}
                      ${isSelected ? 'ring-2 ring-primary' : ''}
                      ${itemClassName}
                    `}
                    style={option.gradient ? { background: option.gradient } : {}}
                    title={option.description}
                  >
                    {option.icon && <div className="mb-1">{option.icon}</div>}
                    <span className="text-xs font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}