import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit,
  Eye,
  EyeOff,
  Folder,
  FolderOpen,
  HelpCircle,
  LogOut,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
  EyeOff as SuppressIcon
} from 'lucide-react';
import Image from 'next/image';

import notionLogo from '@/public/assets/notion-logo.png';
import oneDriveLogo from '@/public/assets/onedrive-logo.png';
import dropboxLogo from '@/public/assets/dropbox-logo.png';
import googleDriveLogo from '@/public/assets/google-drive-logo.png';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '../ui/context-menu';
import { Checkbox } from '../ui/checkbox';
import { RightMenuItem } from './RightMenuItem';
import { NotificationsPanel } from './NotificationsPanel';
import { FolderItem, SuppressedFolder } from './data';

interface ExpandedSidebarProps {
  currentMap: string;
  existingMaps: string[];
  onMapChange: (mapName: string) => void;
  onToggleExpand: () => void;
  onRefresh: () => void;
  onHelp: () => void;
  onToggleNotifications: () => void;
  onLogout: () => void;
  showNotifications: boolean;
  notificationRef: React.RefObject<HTMLDivElement>;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  folders: FolderItem[];
  suppressedFolders: SuppressedFolder[];
  showSuppressedSection: boolean;
  onToggleSuppressedSection: () => void;
  onToggleFolder: (id: string) => void;
  onToggleFolderSelection: (id: string) => void;
  onShowOnlyFolder: (id: string) => void;
  onShowEverything: () => void;
  onHideEverything: () => void;
  onSuppressFolder: (id: string) => void;
  onRestoreFolder: (id: string) => void;
  onRestoreAllFolders: () => void;
  onFolderDoubleClick: (folder: FolderItem) => void;
  onEditMap: (mapName: string) => void;
}

export const ExpandedSidebar: React.FC<ExpandedSidebarProps> = ({
  currentMap,
  existingMaps,
  onMapChange,
  onToggleExpand,
  onRefresh,
  onHelp,
  onToggleNotifications,
  onLogout,
  showNotifications,
  notificationRef,
  searchQuery,
  onSearchQueryChange,
  folders,
  suppressedFolders,
  showSuppressedSection,
  onToggleSuppressedSection,
  onToggleFolder,
  onToggleFolderSelection,
  onShowOnlyFolder,
  onShowEverything,
  onHideEverything,
  onSuppressFolder,
  onRestoreFolder,
  onRestoreAllFolders,
  onFolderDoubleClick,
  onEditMap
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editTooltipStates, setEditTooltipStates] = useState<Record<string, boolean>>({});

  const handleEditMouseEnter = (mapName: string) => {
    setEditTooltipStates(prev => ({ ...prev, [mapName]: true }));
  };

  const handleEditMouseLeave = (mapName: string) => {
    setEditTooltipStates(prev => ({ ...prev, [mapName]: false }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger className="flex items-center gap-2 hover:bg-accent px-2 py-1 rounded-md transition-colors min-w-0">
            <span className="font-medium text-sm truncate max-w-[120px]">{currentMap}</span>
            <ChevronDown size={14} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => console.log('Create new map')} className="flex items-center gap-2">
              <Plus size={16} />
              Create New Map
            </DropdownMenuItem>
            {existingMaps.map(map => (
              <DropdownMenuItem
                key={map}
                className={`flex items-center justify-between group ${map === currentMap ? 'bg-accent' : ''}`}
                onClick={event => {
                  if (!(event.target as HTMLElement).closest('.edit-button')) {
                    onMapChange(map);
                  }
                }}
              >
                <div className="flex items-center justify-between w-full min-w-0">
                  <span className="flex-1 truncate pr-2 min-w-0">{map}</span>
                  <div className="relative">
                    <button
                      className="edit-button w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ml-2 flex-shrink-0"
                      onClick={event => {
                        event.stopPropagation();
                        onEditMap(map);
                      }}
                      onMouseEnter={() => handleEditMouseEnter(map)}
                      onMouseLeave={() => handleEditMouseLeave(map)}
                    >
                      <Edit size={12} />
                    </button>

                    {/* Tooltip */}
                    {editTooltipStates[map] && (
                      <div
                        className="absolute right-full top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-50"
                        style={{ marginRight: '8px' }}
                      >
                        <div className="bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs whitespace-nowrap shadow-lg animate-in fade-in-0 slide-in-from-right-2 duration-200">
                          Edit map
                        </div>
                        <div
                          className="w-2 h-2 bg-primary rotate-45 ml-0.5 z-10"
                          style={{
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="relative">
            <button
              onClick={onToggleNotifications}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
              title="Notifications"
            >
              <Bell size={16} />
            </button>
            {showNotifications && (
              <NotificationsPanel
                ref={notificationRef}
                onClose={onToggleNotifications}
                className="absolute right-0 top-0"
                style={{ transform: 'translateX(-100%) translateX(-16px)' }}
              />
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
              <MoreVertical size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>Pro Plan</DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Details')}>Details</DropdownMenuItem>
              <DropdownMenuItem onClick={() => console.log('Go to Dashboard')}>
                Go to Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogout} className="flex items-center gap-2">
                <LogOut size={14} />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <RightMenuItem
            icon={ChevronRight}
            tooltip="Collapse menu"
            onClick={onToggleExpand}
          />
        </div>
      </div>

      {/* Search Box */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search folders..."
            value={searchQuery}
            onChange={event => onSearchQueryChange(event.target.value)}
            className="pl-9 h-9 rounded-md text-sm border border-border transition-colors
              bg-neutral-100 text-black placeholder-neutral-500 focus:bg-white
              dark:bg-neutral-800 dark:text-white dark:placeholder-neutral-400 dark:focus:bg-neutral-700"
          />
        </div>
      </div>

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="space-y-1">
          {folders.map(folder => (
            <FolderTree
              key={folder.id}
              folder={folder}
              level={0}
              searchQuery={searchQuery}
              suppressedFolders={suppressedFolders}
              onToggleFolder={onToggleFolder}
              onToggleFolderSelection={onToggleFolderSelection}
              onShowOnlyFolder={onShowOnlyFolder}
              onShowEverything={onShowEverything}
              onHideEverything={onHideEverything}
              onSuppressFolder={onSuppressFolder}
              onFolderDoubleClick={onFolderDoubleClick}
            />
          ))}
        </div>
      </div>

      {suppressedFolders.length > 0 && (
        <div className="border-t border-border">
          <div className="p-3">
            <div className="flex items-center justify-between">
              <button
                onClick={onToggleSuppressedSection}
                className="flex items-center justify-between py-1 hover:bg-accent rounded-md px-2 transition-colors flex-1"
              >
                <span className="text-sm text-muted-foreground">Suppressed Folders</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                    {suppressedFolders.length}
                  </span>
                  {showSuppressedSection ? (
                    <ChevronUp size={14} className="text-muted-foreground" />
                  ) : (
                    <ChevronDown size={14} className="text-muted-foreground" />
                  )}
                </div>
              </button>

              <button
                onClick={onRestoreAllFolders}
                className="ml-2 px-2 py-1 text-xs text-primary hover:bg-accent rounded-md transition-colors"
                title="Restore all suppressed folders"
              >
                Restore All
              </button>
            </div>

            {showSuppressedSection && (
              <div className="flex flex-wrap gap-2 mt-3">
                {suppressedFolders.map(folder => (
                  <div
                    key={folder.id}
                    className="flex items-center gap-1 bg-muted text-muted-foreground px-2 py-1 rounded-md text-xs"
                  >
                    <span className="max-w-32 truncate" title={folder.path}>
                      {folder.path}
                    </span>
                    <button
                      onClick={() => onRestoreFolder(folder.id)}
                      className="hover:text-foreground transition-colors flex-shrink-0"
                      title={`Restore ${folder.path}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <RightMenuItem
            icon={HelpCircle}
            tooltip="Help"
            onClick={onHelp}
          />
          <button
            onClick={onRefresh}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={16} />
            <span className="text-sm">Refresh Database</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Folder Tree (unchanged)
interface FolderTreeProps {
  folder: FolderItem;
  level: number;
  searchQuery: string;
  suppressedFolders: SuppressedFolder[];
  onToggleFolder: (id: string) => void;
  onToggleFolderSelection: (id: string) => void;
  onShowOnlyFolder: (id: string) => void;
  onShowEverything: () => void;
  onHideEverything: () => void;
  onSuppressFolder: (id: string) => void;
  onFolderDoubleClick: (folder: FolderItem) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({
  folder,
  level,
  searchQuery,
  suppressedFolders,
  onToggleFolder,
  onToggleFolderSelection,
  onShowOnlyFolder,
  onShowEverything,
  onHideEverything,
  onSuppressFolder,
  onFolderDoubleClick
}) => {
  const hasMatchingDescendant = (item: FolderItem): boolean => {
    if (item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return true;
    }
    if (item.children) {
      return item.children.some(child => hasMatchingDescendant(child));
    }
    return false;
  };

  const shouldShow = searchQuery.trim() === '' || hasMatchingDescendant(folder);
  const isSuppressed = suppressedFolders.some(suppressed => suppressed.id === folder.id);

  if (!shouldShow || isSuppressed) return null;

  const getServiceLogo = (folderId: string) => {
    switch (folderId) {
      case 'notion':
        return <Image src={notionLogo} alt="Notion" width={16} height={16} className="object-contain" />;
      case 'onedrive':
        return <Image src={oneDriveLogo} alt="OneDrive" width={16} height={16} className="object-contain" />;
      case 'dropbox':
        return <Image src={dropboxLogo} alt="Dropbox" width={16} height={16} className="object-contain" />;
      case 'googledrive':
        return <Image src={googleDriveLogo} alt="Google Drive" width={16} height={16} className="object-contain" />;
      default:
        return null;
    }
  };

  const isServiceRoot = ['notion', 'onedrive', 'dropbox', 'googledrive'].includes(folder.id);
  const icon = isServiceRoot
    ? getServiceLogo(folder.id)
    : folder.isOpen
      ? <FolderOpen size={16} className="text-muted-foreground" />
      : <Folder size={16} className="text-muted-foreground" />;
  const renderedIcon = icon ?? (folder.isOpen ? <FolderOpen size={16} className="text-muted-foreground" /> : <Folder size={16} className="text-muted-foreground" />);

  return (
    <div className="select-none">
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-accent transition-colors cursor-pointer"
            style={{ paddingLeft: `${8 + level * 16}px` }}
            onDoubleClick={() => onFolderDoubleClick(folder)}
          >
            <button onClick={() => onToggleFolder(folder.id)} className="flex items-center gap-1 flex-1 text-left">
              {folder.children && folder.children.length > 0 && (
                <ChevronRight size={14} className={`transition-transform ${folder.isOpen ? 'rotate-90' : ''}`} />
              )}
              {renderedIcon}
              <span className="text-sm">{folder.name}</span>
            </button>
            <Checkbox
              checked={folder.isSelected}
              onCheckedChange={() => onToggleFolderSelection(folder.id)}
              className="w-4 h-4 shrink-0"
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => console.log('Show in Map:', folder.name)}>Show in Map</ContextMenuItem>
          <ContextMenuItem onClick={() => onToggleFolder(folder.id)}>
            {folder.isOpen ? 'Collapse in Map' : 'Expand in Map'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onShowOnlyFolder(folder.id)}>Show Only</ContextMenuItem>
          <ContextMenuItem onClick={() => onShowEverything()} className="flex items-center gap-2">
            <Eye size={14} />
            Show Everything
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onHideEverything()} className="flex items-center gap-2">
            <EyeOff size={14} />
            Hide Everything
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => onSuppressFolder(folder.id)} className="flex items-center gap-2">
            <SuppressIcon size={14} />
            Suppress from Map
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {folder.isOpen && folder.children && (
        <div>
          {folder.children.map(child => (
            <FolderTree
              key={child.id}
              folder={child}
              level={level + 1}
              searchQuery={searchQuery}
              suppressedFolders={suppressedFolders}
              onToggleFolder={onToggleFolder}
              onToggleFolderSelection={onToggleFolderSelection}
              onShowOnlyFolder={onShowOnlyFolder}
              onShowEverything={onShowEverything}
              onHideEverything={onHideEverything}
              onSuppressFolder={onSuppressFolder}
              onFolderDoubleClick={onFolderDoubleClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};
