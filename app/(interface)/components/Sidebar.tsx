import React, { useState, useEffect, useRef } from "react";
import {
  Map,
  Palette,
  Square,
  Type,
  Undo,
  Sun,
  Moon,
  Circle,
  Grid3X3,
  Move,
  MessageCircle,
} from "lucide-react";
import Image from "next/image";
import { MenuItem } from "./MenuItem";
import { HorizontalSubmenu } from "./HorizontalSubmenu";
import { LayoutMenu } from "./LayoutMenu";
import { GridSliderSubmenu } from "./GridSliderSubmenu";
import PostItNote from "./svg/PostItNote";
import DialogueIcon from "./svg/DialogueIcon";
import Parallelogram from "./svg/Parallelogram";
import logoIcon from "../../../public/assets/folder-fox.png";
import { BOX_TYPES, BoxType } from "@/lib/mapTypes";

interface SidebarProps {
  isDark: boolean;
  onToggleDark: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  gridThickness: number;
  onGridThicknessChange: (thickness: number) => void;
  onCreateText: () => void;
  isTextMode: boolean;
  onCreateBox: (boxType: BoxType) => void;
  onCenterMap: () => void;
  onCreateComment: () => void;
  isCommentMode: boolean;
  onLayoutSelect: (layoutId: string) => void;
  selectedLayout: string | null;
  onPaletteSelect: (paletteId: string) => void;
  selectedPaletteId: string;
}

export function Sidebar({
  isDark,
  onToggleDark,
  showGrid,
  onToggleGrid,
  gridThickness,
  onGridThicknessChange,
  onCreateText,
  isTextMode,
  onCreateBox,
  onCenterMap,
  onCreateComment,
  isCommentMode,
  onLayoutSelect,
  selectedLayout,
  onPaletteSelect,
  selectedPaletteId,
}: SidebarProps) {
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [showLogoTooltip, setShowLogoTooltip] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const colorOptions = [
    {
      id: "blue",
      label: "Blue",
      gradient: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 45%, #60a5fa 100%)",
      description: "Blue gradients for strong contrast",
      row: 0,
    },
    {
      id: "magenta",
      label: "Magenta",
      gradient: "linear-gradient(135deg, #7e22ce 0%, #db2777 50%, #f472b6 100%)",
      description: "Magenta and fuchsia accents",
      row: 0,
    },
    {
      id: "neon",
      label: "Neon",
      gradient: "linear-gradient(135deg, #ff007f 0%, #04d9ff 50%, #39ff14 100%)",
      description: "Neon spectrum for maximum pop",
      row: 0,
    },
    {
      id: "heatMap",
      label: "Heat Map",
      gradient: "linear-gradient(135deg, #0b3d91 0%, #2a8ef1 45%, #ff8c7a 100%)",
      description: "Cool-to-warm gradient from blue to blush",
      row: 0,
    },
    {
      id: "rainbow",
      label: "Rainbow",
      gradient: "linear-gradient(135deg, #ff595e 0%, #ffca3a 33%, #1982c4 66%, #b5179e 100%)",
      description: "Vivid rainbow arc for playful contrast",
      row: 0,
    },
    {
      id: "minimal",
      label: "Minimal",
      gradient: "linear-gradient(135deg, #1c1c1e 0%, #3a3a3c 55%, #d1d1d6 100%)",
      description: "Apple-inspired graphite neutrals",
      row: 1,
    },
    {
      id: "appleMidnight",
      label: "Midnight",
      gradient: "linear-gradient(135deg, #0a1f44 0%, #274c8f 55%, #8fb0ed 100%)",
      description: "Deep midnight blues",
      row: 1,
    },
    {
      id: "appleStarlight",
      label: "Starlight",
      gradient: "linear-gradient(135deg, #3f3a2f 0%, #7a6e54 50%, #f7f1d8 100%)",
      description: "Soft starlight golds",
      row: 1,
    },
    {
      id: "appleForest",
      label: "Forest",
      gradient: "linear-gradient(135deg, #1f3b2c 0%, #41744e 55%, #afe4a6 100%)",
      description: "Verdant Apple greens",
      row: 1,
    },
    {
      id: "appleCoral",
      label: "Coral",
      gradient: "linear-gradient(135deg, #462227 0%, #b34d52 55%, #ffc3b9 100%)",
      description: "Warm Apple coral",
      row: 1,
    },
  ];

  const shapeOptions = [
    { id: "box", label: "Box", icon: <Square size={16} />, description: "Basic rectangular box" },
    { id: "circle", label: "Circle", icon: <Circle size={16} />, description: "Circular shape" },
    {
      id: "parallelogram",
      label: "Parallelogram",
      icon: (
        <Parallelogram
          width={12}
          height={16}
          slant={4}
          fillColor="transparent"
          strokeColor="currentColor"
          strokeWidth={1.5}
        />
      ),
      description: "Parallelogram sticky note",
    },
    {
      id: "dialogue",
      label: "Dialogue",
      icon: (
        <DialogueIcon
          width={16}
          height={16}
          fillColor="transparent"
          strokeColor="currentColor"
          strokeWidth={1.5}
        />
      ),
      description: "Speech bubble with tail",
    },
    {
      id: "postit",
      label: "Post-it",
      icon: (
        <PostItNote
          width={16}
          height={16}
          noteColor="#fef08a"
          withShadow={false}
          foldSize={4}
          radius={2}
        />
      ),
      description: "Post-it note with pin",
    },
  ] satisfies Array<{ id: BoxType; label: string; icon: React.ReactNode; description: string }>;

  const toggleSubmenu = (submenu: string) => {
    if (activeSubmenu !== submenu) {
      setActiveSubmenu(submenu);
      if (isTextMode) {
        onCreateText(); // deactivate text mode when opening another submenu
      }
    } else {
      setActiveSubmenu(null);
    }
  };

  const handleOptionSelect = (optionId: string) => {
    if (activeSubmenu === "shapes") {
      if (BOX_TYPES.includes(optionId as BoxType)) {
        onCreateBox(optionId as BoxType);
      }
    }
    if (activeSubmenu === "layout") {
      onLayoutSelect(optionId);
    }
    if (activeSubmenu === "colors") {
      onPaletteSelect(optionId);
    }
    setActiveSubmenu(null);
  };

  const handleGridThicknessSliderChange = (value: number) => {
    onGridThicknessChange(value);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        setActiveSubmenu(null);
      }
    };

    if (activeSubmenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [activeSubmenu]);

  return (
    <div
      ref={sidebarRef}
      className="fixed left-4 top-4 bottom-4 w-12 
                 bg-white dark:bg-neutral-900 
                 border border-border rounded-xl shadow-lg 
                 flex flex-col z-40"
    >
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-border">
        <div
          className="relative"
          onMouseEnter={() => setShowLogoTooltip(true)}
          onMouseLeave={() => setShowLogoTooltip(false)}
        >
          <button className="cursor-pointer w-10 h-10 flex items-center justify-center">
            <Image
              src={logoIcon}
              alt="Logo"
              width={40}
              height={40}
              className="w-9 h-9 object-contain"
              priority
            />
          </button>

          {/* Tooltip */}
          {showLogoTooltip && (
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 flex items-center pointer-events-none z-50"
              style={{ marginLeft: "16px" }}
            >
              <div
                className="w-3 h-3 bg-primary rotate-45 -mr-[6px] z-10"
                style={{ boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)" }}
              />
              <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs whitespace-nowrap shadow-lg animate-in fade-in-0 slide-in-from-left-2 duration-200">
                Go to dashboard
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 flex flex-col items-center py-4 gap-2">
        <MenuItem icon={Move} tooltip="Center map" onClick={onCenterMap} />

        <div className="relative">
          <MenuItem
            icon={Map}
            tooltip="Choose layout"
            onClick={() => toggleSubmenu("layout")}
            isActive={activeSubmenu === "layout"}
          />
          <LayoutMenu
            isOpen={activeSubmenu === "layout"}
            onSelect={handleOptionSelect}
            selectedLayout={selectedLayout}
          />
        </div>

        <div className="relative">
          <MenuItem
            icon={Palette}
            tooltip="Color palette"
            onClick={() => toggleSubmenu("colors")}
            isActive={activeSubmenu === "colors"}
          />
          <HorizontalSubmenu
            isOpen={activeSubmenu === "colors"}
            options={colorOptions}
            onSelect={handleOptionSelect}
            selectedOptionId={selectedPaletteId}
            className="w-[420px]"
            rowClassName={(row) =>
              row === 0 ? "grid grid-cols-3 gap-2" : "grid grid-cols-5 gap-2"
            }
            itemClassName="w-full"
          />
        </div>

        <div className="relative">
          <MenuItem
            icon={Square}
            tooltip="Create box"
            onClick={() => toggleSubmenu("shapes")}
            isActive={activeSubmenu === "shapes"}
          />
          <HorizontalSubmenu
            isOpen={activeSubmenu === "shapes"}
            options={shapeOptions}
            onSelect={handleOptionSelect}
          />
        </div>

        <MenuItem
          icon={Type}
          tooltip={isTextMode ? "Exit text mode" : "Create text"}
          onClick={() => {
            if (!isTextMode) setActiveSubmenu(null);
            onCreateText();
          }}
          isActive={isTextMode}
        />

        <MenuItem
          icon={MessageCircle}
          tooltip={isCommentMode ? "Exit comment mode" : "Create comment"}
          onClick={() => {
            if (!isCommentMode) setActiveSubmenu(null);
            onCreateComment();
          }}
          isActive={isCommentMode}
        />
      </div>

      {/* Footer */}
      <div className="flex flex-col items-center gap-2 p-4 border-t border-border">
        <MenuItem icon={Undo} tooltip="Undo" onClick={() => console.log("Undo")} />

        <div className="relative">
          <MenuItem
            icon={Grid3X3}
            tooltip={showGrid ? "Grid settings" : "Show grid"}
            onClick={() => {
              if (!showGrid) {
                onToggleGrid();
              } else {
                toggleSubmenu("grid");
              }
            }}
            isActive={activeSubmenu === "grid"}
          />
          {showGrid && (
            <GridSliderSubmenu
              isOpen={activeSubmenu === "grid"}
              value={gridThickness}
              onValueChange={handleGridThicknessSliderChange}
            />
          )}
        </div>

        <MenuItem
          icon={isDark ? Sun : Moon}
          tooltip={isDark ? "Light mode" : "Dark mode"}
          onClick={onToggleDark}
        />
      </div>
    </div>
  );
}
