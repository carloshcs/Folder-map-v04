import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

import { EditMapDialog } from './EditMapDialog';
import { CollapsedSidebar } from './right-sidebar/CollapsedSidebar';
import { ExpandedSidebar } from './right-sidebar/ExpandedSidebar';
import { FolderItem } from './right-sidebar/data';
import { useFolderManager } from './right-sidebar/useFolderManager';

interface RightSidebarProps {
  isDark: boolean;
  onFolderDataChange?: (folders: FolderItem[]) => void;
  currentMap: string;
  existingMaps: string[];
  onMapChange: (mapName: string) => void;
  onMapNameUpdate: (oldName: string, newName: string) => void;
}

export function RightSidebar({
  isDark,
  onFolderDataChange,
  currentMap,
  existingMaps,
  onMapChange,
  onMapNameUpdate
}: RightSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMapName, setEditingMapName] = useState('');
  const [showSuppressedSection, setShowSuppressedSection] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const {
    folders,
    suppressedFolders,
    toggleFolder,
    toggleFolderSelection,
    showOnlyFolder,
    showEverything,
    hideEverything,
    suppressFolder,
    restoreFolder,
    restoreAllFolders
  } = useFolderManager();

  useEffect(() => {
    if (suppressedFolders.length === 0) {
      setShowSuppressedSection(false);
    }
  }, [suppressedFolders]);

  useEffect(() => {
    if (onFolderDataChange) {
      onFolderDataChange(folders);
    }
  }, [folders, onFolderDataChange]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const toggleExpanded = () => {
    setIsExpanded(previous => !previous);
  };

  const handleRefresh = () => {
    console.log('Refreshing database...');
  };

  const handleNotifications = () => {
    setShowNotifications(previous => !previous);
  };

  const handleLogout = () => {
    console.log('Logging out...');
  };

  const handleHelp = () => {
    console.log('Help opened');
  };

  const handleFolderDoubleClick = (folder: FolderItem) => {
    console.log('Navigating to folder:', folder.name);
  };

  const handleEditMap = (map: string) => {
    setEditingMapName(map);
    setEditDialogOpen(true);
  };

  return (
    <>
      <motion.div
        ref={sidebarRef}
        initial={false}
        animate={{ width: isExpanded ? 280 : 48 }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
          type: 'tween'
        }}
        className={`fixed right-4 top-4 bottom-4 border border-border rounded-xl shadow-lg flex flex-col z-40
          ${isDark ? 'bg-neutral-900 backdrop-blur-sm' : 'bg-white backdrop-blur-sm'}
        `}
      >
        {!isExpanded ? (
          <CollapsedSidebar
            onExpand={toggleExpanded}
            onToggleNotifications={handleNotifications}
            onRefresh={handleRefresh}
            onHelp={handleHelp}
            showNotifications={showNotifications}
            notificationRef={notificationRef}
          />
        ) : (
          <ExpandedSidebar
            currentMap={currentMap}
            existingMaps={existingMaps}
            onMapChange={onMapChange}
            onToggleExpand={toggleExpanded}
            onRefresh={handleRefresh}
            onHelp={handleHelp}
            onToggleNotifications={handleNotifications}
            onLogout={handleLogout}
            showNotifications={showNotifications}
            notificationRef={notificationRef}
            searchQuery={searchQuery}
            onSearchQueryChange={value => setSearchQuery(value)}
            folders={folders}
            suppressedFolders={suppressedFolders}
            showSuppressedSection={showSuppressedSection}
            onToggleSuppressedSection={() => setShowSuppressedSection(previous => !previous)}
            onToggleFolder={toggleFolder}
            onToggleFolderSelection={toggleFolderSelection}
            onShowOnlyFolder={showOnlyFolder}
            onShowEverything={showEverything}
            onHideEverything={hideEverything}
            onSuppressFolder={suppressFolder}
            onRestoreFolder={restoreFolder}
            onRestoreAllFolders={restoreAllFolders}
            onFolderDoubleClick={handleFolderDoubleClick}
            onEditMap={handleEditMap}
          />
        )}
      </motion.div>

      <EditMapDialog
        mapName={editingMapName}
        currentIntegrations={
          editingMapName === 'My Project Map'
            ? ['Notion', 'Google Drive']
            : editingMapName === 'Team Workspace'
              ? ['Google Drive', 'OneDrive']
              : editingMapName === 'Design System'
                ? ['Notion']
                : []
        }
        onMapNameUpdate={onMapNameUpdate}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
      />
    </>
  );
}
