"use client";

import React from "react";
import { motion } from "framer-motion";
import { Slider } from "./ui/slider";

interface GridSliderSubmenuProps {
  isOpen: boolean;
  value: number;
  onValueChange: (value: number) => void;
}

export function GridSliderSubmenu({
  isOpen,
  value,
  onValueChange,
}: GridSliderSubmenuProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.2 }}
      className="absolute left-16 top-0 z-50 bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[180px]"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Grid Thickness
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {value}px
          </span>
        </div>

        <Slider
          value={[value]}
          onValueChange={(values) => onValueChange(values[0])}
          min={0}
          max={8}
          step={1}
          className="w-full"
        />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0px</span>
          <span>8px</span>
        </div>
      </div>
    </motion.div>
  );
}
