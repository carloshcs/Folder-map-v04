import React, { useState } from 'react';

interface CustomTooltipProps {
  children: React.ReactNode;
  content: string;
  side?: 'right' | 'left' | 'top' | 'bottom';
}

export function CustomTooltip({ children, content, side = 'right' }: CustomTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div 
          className="absolute z-50 flex items-center gap-0"
          style={{
            left: side === 'right' ? 'calc(100% + 8px)' : undefined,
            right: side === 'left' ? 'calc(100% + 8px)' : undefined,
            top: '50%',
            transform: 'translateY(-50%)',
          }}
        >
          {/* Diamond/Lozenge connector */}
          <div 
            className="w-2 h-2 bg-primary rotate-45 transform -mr-1 z-10"
            style={{
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          />
          
          {/* Tooltip content */}
          <div 
            className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs whitespace-nowrap animate-in fade-in-0 slide-in-from-left-2 duration-200"
            style={{
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            {content}
          </div>
        </div>
      )}
    </div>
  );
}