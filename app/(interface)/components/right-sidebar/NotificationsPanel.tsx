import React, { forwardRef } from 'react';

interface NotificationsPanelProps {
  onClose: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const NotificationsPanel = forwardRef<HTMLDivElement, NotificationsPanelProps>(
  ({ onClose, className = '', style }, ref) => {
    return (
      <div
        ref={ref}
        className={`w-64 bg-popover border border-border rounded-lg shadow-lg p-3 z-[100] ${className}`.trim()}
        style={style}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium">Notifications</h4>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ×
          </button>
        </div>
        <div className="text-sm text-muted-foreground text-center py-4">
          No new notifications
        </div>
        <div className="border-t border-border pt-2 mt-2">
          <p className="text-xs text-muted-foreground">Last updated: 2 hours ago</p>
        </div>
      </div>
    );
  }
);

NotificationsPanel.displayName = 'NotificationsPanel';
