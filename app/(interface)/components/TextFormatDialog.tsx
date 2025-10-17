import React from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Separator } from './ui/separator';

interface TextFormatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (format: TextFormat) => void;
  currentFormat: TextFormat;
}

export interface TextFormat {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  borderStyle: 'solid' | 'dashed' | 'none';
  borderThickness: number;
  borderColor: string;
  boxType: 'box' | 'circle' | 'rounded' | 'dialogue' | 'postit' | 'parallelogram';
  width?: number;
  height?: number;
  isBold?: boolean;
  isItalic?: boolean;
  isUnderline?: boolean;
  textAlign: 'left' | 'center' | 'right';
  link?: string;
  isLocked?: boolean;
}

const fontOptions = [
  { name: 'Notion Style', value: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"' },
  { name: 'Sans Serif', value: 'Arial, Helvetica, sans-serif' },
  { name: 'Serif', value: 'Times, "Times New Roman", serif' },
  { name: 'Monospace', value: 'Monaco, Consolas, "Lucida Console", monospace' },
  { name: 'Comic Sans', value: '"Comic Sans MS", cursive' },
];

const colorOptions = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080',
  '#008000', '#ffc0cb', '#a52a2a', '#808080', '#000080'
];

export function TextFormatDialog({ isOpen, onClose, onApply, currentFormat }: TextFormatDialogProps) {
  const [format, setFormat] = React.useState<TextFormat>(currentFormat);

  React.useEffect(() => {
    setFormat(currentFormat);
  }, [currentFormat, isOpen]);

  const handleApply = () => {
    onApply(format);
    onClose();
  };

  const ColorPicker = ({ 
    label, 
    value, 
    onChange 
  }: { 
    label: string; 
    value: string; 
    onChange: (color: string) => void; 
  }) => (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex flex-wrap gap-2">
        {colorOptions.map((color) => (
          <button
            key={color}
            className={`w-8 h-8 rounded border-2 transition-all ${
              value === color ? 'border-primary scale-110' : 'border-border hover:scale-105'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Custom:</span>
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-border cursor-pointer"
        />
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Text Format</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Font Family */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Font Style</label>
            <div className="space-y-2">
              {fontOptions.map((font) => (
                <button
                  key={font.name}
                  className={`w-full p-2 text-left rounded border transition-colors ${
                    format.fontFamily === font.value
                      ? 'border-primary bg-accent'
                      : 'border-border hover:bg-accent/50'
                  }`}
                  style={{ fontFamily: font.value }}
                  onClick={() => setFormat({ ...format, fontFamily: font.value })}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Font Size */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Font Size</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="12"
                max="48"
                value={format.fontSize}
                onChange={(e) => setFormat({ ...format, fontSize: parseInt(e.target.value) })}
                className="flex-1"
              />
              <span className="text-sm w-8">{format.fontSize}px</span>
            </div>
          </div>

          <Separator />

          {/* Text Color */}
          <ColorPicker
            label="Text Color"
            value={format.textColor}
            onChange={(color) => setFormat({ ...format, textColor: color })}
          />

          <Separator />

          {/* Background Color */}
          <ColorPicker
            label="Background Color"
            value={format.backgroundColor}
            onChange={(color) => setFormat({ ...format, backgroundColor: color })}
          />

          {/* Border options - hidden for post-it notes */}
          {format.boxType !== 'postit' && (
            <>
              <Separator />

              {/* Border Style */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Border Style</label>
                <div className="flex gap-2">
                  {[
                    { name: 'None', value: 'none' as const },
                    { name: 'Solid', value: 'solid' as const },
                    { name: 'Dashed', value: 'dashed' as const },
                  ].map((style) => (
                    <button
                      key={style.value}
                      className={`px-3 py-2 rounded border transition-colors ${
                        format.borderStyle === style.value
                          ? 'border-primary bg-accent'
                          : 'border-border hover:bg-accent/50'
                      }`}
                      onClick={() => setFormat({ ...format, borderStyle: style.value })}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Border Thickness */}
              {format.borderStyle !== 'none' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Border Thickness</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1"
                      max="8"
                      value={format.borderThickness}
                      onChange={(e) => setFormat({ ...format, borderThickness: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-sm w-8">{format.borderThickness}px</span>
                  </div>
                </div>
              )}

              {/* Border Color */}
              {format.borderStyle !== 'none' && (
                <>
                  <Separator />
                  <ColorPicker
                    label="Border Color"
                    value={format.borderColor}
                    onChange={(color) => setFormat({ ...format, borderColor: color })}
                  />
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>
            Apply
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}