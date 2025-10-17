import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';


interface SubmenuOption {
  id: string;
  label: string;
  description?: string;
  gradient?: string;
  icon?: React.ReactNode;
}

interface HorizontalSubmenuProps {
  isOpen: boolean;
  options: SubmenuOption[];
  onSelect: (optionId: string) => void;
  className?: string;
  selectedOptionId?: string | null;
}

export function HorizontalSubmenu({
  isOpen,
  options,
  onSelect,
  className = '',
  selectedOptionId,
}: HorizontalSubmenuProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          className={`
            absolute left-16 top-0 bg-popover border border-border rounded-lg shadow-lg p-2 z-50
            flex gap-2 min-w-max ${className}
          `}
        >
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`
                flex flex-col items-center justify-center p-3 rounded-lg
                min-w-[80px] h-[70px] transition-all duration-200
                hover:bg-accent hover:text-accent-foreground text-muted-foreground
                ${option.gradient ? 'text-white' : ''}
                ${selectedOptionId === option.id ? 'ring-2 ring-primary' : ''}
              `}
              style={option.gradient ? { background: option.gradient } : {}}
              title={option.description}
            >
              {option.icon && (
                <div className="mb-1">
                  {option.icon}
                </div>
              )}
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}