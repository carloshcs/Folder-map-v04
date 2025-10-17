import React, { useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface MenuItemProps {
  icon: LucideIcon;
  tooltip: string;
  onClick?: () => void;
  isActive?: boolean;
  children?: React.ReactNode;
}

export function MenuItem({ icon: Icon, tooltip, onClick, isActive, children }: MenuItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative">
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative"
      >
        <button
          onClick={onClick}
          className={`
            relative w-10 h-10 flex items-center justify-center rounded-lg
            transition-all duration-200 hover:bg-accent
            ${isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'}
          `}
        >
          <Icon size={18} />
        </button>

        {/* Custom Tooltip with Diamond Connector */}
        {isHovered && (
          <div
            className="absolute left-full top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-50"
            style={{ marginLeft: '16px' }}
          >
            {/* Diamond/Lozenge Connector */}
            <div
              className="w-3 h-3 bg-primary rotate-45 mr-1 z-10"
              style={{
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
            />

            {/* Tooltip Content */}
            <div
              className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs whitespace-nowrap shadow-lg animate-in fade-in-0 slide-in-from-left-2 duration-200"
            >
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {children}
    </div>
  );
}