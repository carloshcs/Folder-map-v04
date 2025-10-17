import React from 'react';
import { Bell, ChevronLeft, HelpCircle, RefreshCw } from 'lucide-react';

import { RightMenuItem } from './RightMenuItem';
import { NotificationsPanel } from './NotificationsPanel';

interface CollapsedSidebarProps {
  onExpand: () => void;
  onToggleNotifications: () => void;
  onRefresh: () => void;
  onHelp: () => void;
  showNotifications: boolean;
  notificationRef: React.RefObject<HTMLDivElement>;
}

export const CollapsedSidebar: React.FC<CollapsedSidebarProps> = ({
  onExpand,
  onToggleNotifications,
  onRefresh,
  onHelp,
  showNotifications,
  notificationRef
}) => {
  return (
    <div className="flex flex-col items-center py-4 gap-4 h-full">
      <RightMenuItem
        icon={ChevronLeft}
        tooltip="Expand menu"
        onClick={onExpand}
      />

      <div className="relative">
        <RightMenuItem
          icon={Bell}
          tooltip="Notifications"
          onClick={onToggleNotifications}
        />
        {showNotifications && (
          <NotificationsPanel
            ref={notificationRef}
            onClose={onToggleNotifications}
            className="absolute left-0 top-0"
            style={{ transform: 'translateX(-100%) translateX(-8px)' }}
          />
        )}
      </div>

      <RightMenuItem
        icon={RefreshCw}
        tooltip="Update"
        onClick={onRefresh}
      />

      <RightMenuItem
        icon={HelpCircle}
        tooltip="Help"
        onClick={onHelp}
      />
    </div>
  );
};