import React, { useState, useEffect } from 'react';
import {
  Type, Bold, Italic, AlignLeft, AlignCenter, AlignRight,
  Palette, ChevronDown, Underline, Link, Square, Circle,
  X, Trash2, StickyNote, Edit, MessageCircle, Zap, Lock, Unlock
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { TextFormat } from './TextFormatDialog';
import { Separator } from './ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';

interface TextToolbarProps {
  x: number;
  y: number;
  format: TextFormat;
  onFormatChange: (format: TextFormat) => void;
  onDelete: () => void;
  zoom: number;
}

const fontOptions = [
  { name: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Calibri', value: 'Calibri, sans-serif' },
  { name: 'Times New Roman', value: 'Times, "Times New Roman", serif' },
  { name: 'Comic Sans MS', value: '"Comic Sans MS", cursive' },
  { name: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { name: 'Courier New', value: '"Courier New", monospace' },
];

const textColorOptions = [
  '#000000', '#ffffff',
  '#ff0000', '#00aa00', '#0066ff',
  '#ff6600', '#ffcc00', '#ff3399',
  '#9900cc', '#00cccc', '#336600'
];

const backgroundColorOptions = [...textColorOptions];
const borderColorOptions = ['#000000', '#ffffff', '#808080', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ffa500'];

const boxTypeOptions = [
  { name: 'Box', value: 'box' as const, icon: Square },
  { name: 'Circle', value: 'circle' as const, icon: Circle },
  { name: 'Dialogue', value: 'dialogue' as const, icon: MessageCircle },
  { name: 'Post-it', value: 'postit' as const, icon: StickyNote },
  { name: 'Parallelogram', value: 'parallelogram' as const, icon: Zap },
];

type EmphasisToggleKey = 'isBold' | 'isItalic' | 'isUnderline';

const emphasisToggles: Array<[EmphasisToggleKey, LucideIcon]> = [
  ['isBold', Bold],
  ['isItalic', Italic],
  ['isUnderline', Underline],
];

export function TextToolbar({ x, y, format, onFormatChange, onDelete, zoom }: TextToolbarProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState(format.link || '');

  const getFontName = (fontFamily: string) =>
    fontOptions.find(opt => opt.value === fontFamily)?.name || 'Arial';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeDropdown && !(event.target as Element).closest('.toolbar-dropdown')) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  useEffect(() => {
    if (format.isLocked && activeDropdown) setActiveDropdown(null);
  }, [format.isLocked]);

  const toolbarStyle = {
    position: 'fixed' as const,
    left: `${x + (75 * zoom / 100)}px`,
    top: `${y - (60 * zoom / 100)}px`,
    zIndex: 1001,
    transform: 'translateX(-50%)',
  };

  const toggleDropdown = (name: string) => {
    if (!format.isLocked) setActiveDropdown(activeDropdown === name ? null : name);
  };

  const isInLowerQuadrant = () => (y - 60) > window.innerHeight / 2;

  const dropdownBase = `absolute z-50 toolbar-dropdown border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg 
                        bg-white dark:bg-neutral-900`;

  interface ColorPickerProps {
    colors: string[];
    selectedColor: string;
    onColorSelect: (color: string) => void;
    includeTransparent?: boolean;
  }

  const ColorPicker = ({ colors, selectedColor, onColorSelect, includeTransparent = false }: ColorPickerProps) => {
    const pos = isInLowerQuadrant()
      ? 'absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2'
      : 'absolute top-full mt-2 left-1/2 transform -translate-x-1/2';
    return (
      <div className={`${pos} ${dropdownBase} w-[120px]`}>
        <div className="p-2 grid grid-cols-3 gap-1">
          {includeTransparent && (
            <button
              className={`w-6 h-6 border flex items-center justify-center rounded-sm ${
                selectedColor === 'transparent' ? 'border-primary border-2' : 'border-border'
              }`}
              onClick={() => onColorSelect('transparent')}
            >
              <X size={10} />
            </button>
          )}
          {colors.map((c: string) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-sm border ${
                selectedColor === c ? 'border-primary border-2' : 'border-border'
              }`}
              style={{ backgroundColor: c }}
              onClick={() => onColorSelect(c)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        style={toolbarStyle}
        className="flex items-center gap-1 rounded-lg border px-2 py-1 shadow-lg 
        bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700"
      >
        {/* --- Box Type --- */}
        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`h-7 w-7 flex items-center justify-center rounded ${
                  format.isLocked ? 'opacity-50' : 'hover:bg-accent cursor-pointer'
                }`}
                onClick={() => toggleDropdown('boxType')}
              >
                {React.createElement(boxTypeOptions.find(o => o.value === format.boxType)!.icon, { size: 14 })}
              </div>
            </TooltipTrigger>
            <TooltipContent>Box Type</TooltipContent>
          </Tooltip>
          {activeDropdown === 'boxType' && (
            <div className={`${dropdownBase} top-full mt-1 left-0`}>
              <div className="p-1">
                {boxTypeOptions.map(o => (
                  <button
                    key={o.value}
                    className={`h-8 w-full flex items-center gap-2 px-2 text-xs rounded ${
                      format.boxType === o.value ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
                    }`}
                    onClick={() => { onFormatChange({ ...format, boxType: o.value }); setActiveDropdown(null); }}
                  >
                    <o.icon size={14} /> {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* --- Font --- */}
        <div className="relative">
          <div
            className="h-7 px-2 text-xs flex items-center gap-1 rounded hover:bg-accent cursor-pointer"
            onClick={() => toggleDropdown('font')}
          >
            {getFontName(format.fontFamily)} <ChevronDown size={12} />
          </div>
          {activeDropdown === 'font' && (
            <div className={`${dropdownBase} top-full mt-1 left-0 min-w-32`}>
              {fontOptions.map(f => (
                <button
                  key={f.name}
                  style={{ fontFamily: f.value }}
                  className={`w-full px-2 py-1 text-left text-xs rounded ${
                    format.fontFamily === f.value ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
                  }`}
                  onClick={() => { onFormatChange({ ...format, fontFamily: f.value }); setActiveDropdown(null); }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* --- Bold/Italic/Underline --- */}
        {emphasisToggles.map(([key, Icon]) => {
          const isActive = format[key] ?? false;
          return (
            <button
              key={key}
              className={`h-7 w-7 flex items-center justify-center rounded ${
                isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
              }`}
              onClick={() => onFormatChange({ ...format, [key]: !isActive })}
            >
              <Icon size={14} />
            </button>
          );
        })}

        <Separator orientation="vertical" className="h-5" />

        {/* --- Alignment --- */}
        <div className="relative">
          <div
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent cursor-pointer"
            onClick={() => toggleDropdown('alignment')}
          >
            {format.textAlign === 'left' && <AlignLeft size={14} />}
            {format.textAlign === 'center' && <AlignCenter size={14} />}
            {format.textAlign === 'right' && <AlignRight size={14} />}
          </div>
          {activeDropdown === 'alignment' && (
            <div className={`${dropdownBase} ${isInLowerQuadrant() ? 'bottom-full mb-1' : 'top-full mt-1'} left-0`}>
              <div className="p-1 flex">
                {[AlignLeft, AlignCenter, AlignRight].map((Icon, i) => (
                  <button
                    key={i}
                    className={`h-7 w-8 flex items-center justify-center rounded ${
                      ['left', 'center', 'right'][i] === format.textAlign ? 'bg-accent' : 'hover:bg-accent'
                    }`}
                    onClick={() => { onFormatChange({ ...format, textAlign: ['left', 'center', 'right'][i] as any }); setActiveDropdown(null); }}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* --- Text Color --- */}
        <div className="relative">
          <div
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent cursor-pointer relative"
            onClick={() => toggleDropdown('textColor')}
          >
            <Type size={14} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 rounded-sm" style={{ backgroundColor: format.textColor }} />
          </div>
          {activeDropdown === 'textColor' && (
            <ColorPicker
              colors={textColorOptions}
              selectedColor={format.textColor}
              onColorSelect={(color: string) => {
                onFormatChange({ ...format, textColor: color });
                setActiveDropdown(null);
              }}
            />
          )}
        </div>

        {/* --- Background Color --- */}
        <div className="relative">
          <div
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent cursor-pointer relative"
            onClick={() => toggleDropdown('backgroundColor')}
          >
            <Palette size={14} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-1 rounded-sm border border-border"
              style={{ backgroundColor: format.backgroundColor === 'transparent' ? '#ffffff' : format.backgroundColor }} />
          </div>
          {activeDropdown === 'backgroundColor' && (
            <ColorPicker
              colors={backgroundColorOptions}
              selectedColor={format.backgroundColor}
              onColorSelect={(color: string) => {
                onFormatChange({ ...format, backgroundColor: color });
                setActiveDropdown(null);
              }}
              includeTransparent
            />
          )}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* --- Link --- */}
        <div className="relative">
          <button
            className={`h-7 w-7 flex items-center justify-center rounded ${
              format.link || activeDropdown === 'link' ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
            }`}
            onClick={() => { setLinkUrl(format.link || ''); toggleDropdown('link'); }}
          >
            <Link size={14} />
          </button>
          {activeDropdown === 'link' && (
            <div className={`${dropdownBase} ${isInLowerQuadrant() ? 'bottom-full mb-1' : 'top-full mt-1'} left-1/2 -translate-x-1/2 p-3 min-w-64`}>
              <label className="text-xs font-medium text-muted-foreground">Enter URL:</label>
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-2 py-1 text-xs border rounded bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 mt-1"
              />
              <div className="flex gap-2 justify-end mt-2">
                <button className="px-2 py-1 text-xs hover:bg-accent rounded" onClick={() => setActiveDropdown(null)}>Cancel</button>
                <button
                  className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded"
                  onClick={() => {
                    if (linkUrl.trim()) {
                      const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
                      onFormatChange({ ...format, link: url });
                    } else {
                      onFormatChange({ ...format, link: undefined });
                    }
                    setActiveDropdown(null);
                  }}
                >
                  {linkUrl.trim() ? 'Add Link' : 'Remove Link'}
                </button>
              </div>
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* --- Border --- */}
        <div className="relative">
          <div
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent cursor-pointer"
            onClick={() => toggleDropdown('border')}
          >
            <Edit size={14} />
          </div>
          {activeDropdown === 'border' && (
            <div className={`${dropdownBase} ${isInLowerQuadrant() ? 'bottom-full mb-1' : 'top-full mt-1'} left-1/2 -translate-x-1/2 p-2 min-w-56`}>
              <div className="text-xs font-medium text-muted-foreground mb-2">Border Style</div>
              <div className="flex gap-1">
                {['none', 'solid', 'dashed'].map(style => (
                  <button
                    key={style}
                    className={`px-2 py-1 text-xs rounded border ${format.borderStyle === style ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`}
                    onClick={() => onFormatChange({ ...format, borderStyle: style as any })}
                  >
                    {style}
                  </button>
                ))}
              </div>
              {format.borderStyle !== 'none' && (
                <>
                  <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Border Color</div>
                  <div className="flex gap-1 flex-wrap">
                    {borderColorOptions.map(c => (
                      <button key={c} style={{ backgroundColor: c }}
                        className={`w-5 h-5 rounded-sm border ${format.borderColor === c ? 'border-primary border-2' : 'border-border'}`}
                        onClick={() => onFormatChange({ ...format, borderColor: c })} />
                    ))}
                  </div>
                  <div className="text-xs font-medium text-muted-foreground mt-3 mb-1">Border Thickness</div>
                  <input type="range" min="1" max="8" value={format.borderThickness}
                    onChange={e => onFormatChange({ ...format, borderThickness: parseInt(e.target.value) })} className="w-full" />
                  <div className="text-xs text-center text-muted-foreground">{format.borderThickness}px</div>
                </>
              )}
            </div>
          )}
        </div>

        <Separator orientation="vertical" className="h-5" />

        {/* Lock + Delete */}
        <button className={`h-7 w-7 flex items-center justify-center rounded ${format.isLocked ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'}`} onClick={() => onFormatChange({ ...format, isLocked: !format.isLocked })}>
          {format.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
        </button>
        <button className="h-7 w-7 flex items-center justify-center hover:bg-destructive/10 hover:text-destructive rounded" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
    </TooltipProvider>
  );
}
