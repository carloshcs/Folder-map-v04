import React, { useState, useRef, useEffect } from 'react';
import { TextFormat } from './TextFormatDialog';
import PostItNote from './svg/PostItNote';
import DialogueBox from './svg/DialogueBox';
import Parallelogram from './svg/Parallelogram';

interface TextBoxProps {
  id: string;
  x: number;
  y: number;
  text: string;
  format: TextFormat;
  isSelected: boolean;
  zoom: number;
  onTextChange: (id: string, text: string) => void;
  onPositionChange: (id: string, x: number, y: number) => void;
  onFormatChange: (id: string, format: TextFormat) => void;
  onSelect: (id: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | null;

export function TextBox({
  id,
  x,
  y,
  text,
  format,
  isSelected,
  zoom,
  onTextChange,
  onPositionChange,
  onFormatChange,
  onSelect,
  onDragStart,
  onDragEnd,
}: TextBoxProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, startX: 0, startY: 0 });
  const [editText, setEditText] = useState(text);
  const [hasMoved, setHasMoved] = useState(false);
  const [lastClickTime, setLastClickTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const width = format.width || 150;
  const height = format.height || 60;

  useEffect(() => {
    setEditText(text);
  }, [text]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentTime = Date.now();
    const isDoubleClick = currentTime - lastClickTime < 300;
    
    onSelect(id);
    
    if (isDoubleClick && format.link && !hasMoved) {
      // Handle double-click on linked text
      window.open(format.link, '_blank', 'noopener,noreferrer');
      return;
    }
    
    // Start editing on double-click, not single click (but only if not locked)
    if (isDoubleClick && !hasMoved && !format.isLocked) {
      setIsEditing(true);
    }
    
    setLastClickTime(currentTime);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && !format.isLocked) { // Left button and not locked
      e.stopPropagation();
      setHasMoved(false);
      setIsDragging(true);
      setDragStart({
        x: e.clientX / (zoom / 100) - x,
        y: e.clientY / (zoom / 100) - y,
      });
      onSelect(id);
      onDragStart?.();
    } else if (e.button === 0) {
      // Still select locked items, just don't allow dragging
      e.stopPropagation();
      onSelect(id);
    }
  };

  const handleResizeMouseDown = (e: React.MouseEvent, handle: ResizeHandle) => {
    if (format.isLocked) return; // Don't allow resizing if locked
    
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      x: e.clientX / (zoom / 100),
      y: e.clientY / (zoom / 100),
      width: width,
      height: height,
      startX: x, // Store initial position
      startY: y, // Store initial position
    });
    onDragStart?.();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && !isResizing) {
      setHasMoved(true);
      const newX = e.clientX / (zoom / 100) - dragStart.x;
      const newY = e.clientY / (zoom / 100) - dragStart.y;
      onPositionChange(id, newX, newY);
    } else if (isResizing && resizeHandle) {
      const currentX = e.clientX / (zoom / 100);
      const currentY = e.clientY / (zoom / 100);
      const deltaX = currentX - resizeStart.x;
      const deltaY = currentY - resizeStart.y;

      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;
      let newX = resizeStart.startX; // Use initial position
      let newY = resizeStart.startY; // Use initial position

      switch (resizeHandle) {
        case 'nw': // Northwest - resize from top-left corner
          newWidth = Math.max(80, resizeStart.width - deltaX);
          newHeight = Math.max(40, resizeStart.height - deltaY);
          // Adjust position to keep bottom-right corner fixed
          newX = resizeStart.startX + (resizeStart.width - newWidth);
          newY = resizeStart.startY + (resizeStart.height - newHeight);
          break;
        case 'ne': // Northeast - resize from top-right corner  
          newWidth = Math.max(80, resizeStart.width + deltaX);
          newHeight = Math.max(40, resizeStart.height - deltaY);
          // Keep bottom-left corner fixed, only adjust Y position
          newX = resizeStart.startX;
          newY = resizeStart.startY + (resizeStart.height - newHeight);
          break;
        case 'sw': // Southwest - resize from bottom-left corner
          newWidth = Math.max(80, resizeStart.width - deltaX);
          newHeight = Math.max(40, resizeStart.height + deltaY);
          // Keep top-right corner fixed, only adjust X position
          newX = resizeStart.startX + (resizeStart.width - newWidth);
          newY = resizeStart.startY;
          break;
        case 'se': // Southeast - resize from bottom-right corner
          newWidth = Math.max(80, resizeStart.width + deltaX);
          newHeight = Math.max(40, resizeStart.height + deltaY);
          // Keep top-left corner fixed
          newX = resizeStart.startX;
          newY = resizeStart.startY;
          break;
      }

      // Update position if it changed
      if (newX !== x || newY !== y) {
        onPositionChange(id, newX, newY);
      }

      // Update size
      onFormatChange(id, { ...format, width: newWidth, height: newHeight });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    onDragEnd?.();
    
    // Reset hasMoved after a short delay to allow click detection
    setTimeout(() => setHasMoved(false), 10);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, zoom, x, y, width, height]);

  const handleTextSubmit = () => {
    setIsEditing(false);
    onTextChange(id, editText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditText(text); // Revert changes
    }
  };

  const borderStyle = format.borderStyle === 'none' ? 'none' : 
    `${format.borderThickness}px ${format.borderStyle} ${format.borderColor}`;

  const backgroundStyle = format.backgroundColor === 'transparent' 
    ? 'transparent' 
    : format.backgroundColor;

  const getBoxStyles = () => {
    switch (format.boxType) {
      case 'circle':
        return {
          borderRadius: '50%',
          clipPath: 'none'
        };
      case 'dialogue':
        return {
          borderRadius: '8px',
          clipPath: 'none',
          position: 'relative' as const
        };
      case 'postit':
        return {
          borderRadius: '2px',
          clipPath: 'none',
          transform: 'rotate(-1deg)',
          boxShadow: '2px 2px 4px rgba(0,0,0,0.1)'
        };
      case 'parallelogram':
        return {
          borderRadius: '4px',
          clipPath: 'polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)',
          boxShadow: '2px 2px 8px rgba(0,0,0,0.15)',
          overflow: 'hidden'
        };
      case 'box':
      default:
        return {
          borderRadius: '4px',
          clipPath: 'none'
        };
    }
  };

  // Special rendering for PostIt SVG type
  if (format.boxType === 'postit') {
    return (
      <div
        ref={containerRef}
        className={`absolute select-none ${format.isLocked ? 'cursor-default' : 
            isDragging ? 'cursor-grabbing' : 
            format.link ? 'cursor-pointer' : 'cursor-grab'}`}
        style={{
          left: x + 'px',
          top: y + 'px',
          width: width + 'px',
          height: height + 'px',
          zIndex: isSelected ? 1000 : 100,
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        {/* PostIt SVG Background - always use PostItNote SVG */}
        <PostItNote
          width={width}
          height={height}
          noteColor={format.backgroundColor === 'transparent' ? 'transparent' : format.backgroundColor}
          className="absolute inset-0"
          withShadow={true}
        />
        
        {/* Text Content */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{
            padding: '20px 16px 16px 16px', // Extra top padding to avoid the pin
            fontFamily: format.fontFamily,
            fontSize: format.fontSize + 'px',
            color: format.textColor,
            fontWeight: format.isBold ? 'bold' : 'normal',
            fontStyle: format.isItalic ? 'italic' : 'normal',
            textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
            textAlign: format.textAlign,
            pointerEvents: format.isLocked ? 'none' : 'auto',
          }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleTextSubmit}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent resize-none outline-none border-none"
              style={{
                fontFamily: format.fontFamily,
                fontSize: format.fontSize + 'px',
                color: format.textColor,
                fontWeight: format.isBold ? 'bold' : 'normal',
                fontStyle: format.isItalic ? 'italic' : 'normal',
                textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
                textAlign: format.textAlign,
              }}
            />
          ) : (
            <div
              className="whitespace-pre-wrap w-full h-full flex relative cursor-text"
              style={{
                wordBreak: 'break-word',
                alignItems: format.textAlign === 'center' ? 'center' : 'flex-start',
                justifyContent: format.textAlign === 'left' ? 'flex-start' : 
                             format.textAlign === 'right' ? 'flex-end' : 'center',
                textAlign: format.textAlign,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isSelected && !format.isLocked) {
                  setIsEditing(true);
                }
              }}
            >
              {text || (format.isLocked ? 'Locked' : 'Double-click to edit')}
              {format.link && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-primary/20 rounded-full flex items-center justify-center text-xs transform translate-x-1 -translate-y-1">
                  🔗
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resize Handles for PostIt */}
        {isSelected && !format.isLocked && (
          <>
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-nw-resize shadow-sm"
              style={{
                top: '-6px',
                left: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-ne-resize shadow-sm"
              style={{
                top: '-6px',
                right: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-sw-resize shadow-sm"
              style={{
                bottom: '-6px',
                left: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-se-resize shadow-sm"
              style={{
                bottom: '-6px',
                right: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            />
          </>
        )}
      </div>
    );
  }

  // Special rendering for DialogueBox SVG type
  if (format.boxType === 'dialogue') {
    return (
      <div
        ref={containerRef}
        className={`absolute select-none ${format.isLocked ? 'cursor-default' : 
            isDragging ? 'cursor-grabbing' : 
            format.link ? 'cursor-pointer' : 'cursor-grab'}`}
        style={{
          left: x + 'px',
          top: y + 'px',
          width: width + 'px',
          height: height + 'px',
          zIndex: isSelected ? 1000 : 100,
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        {/* DialogueBox SVG Background */}
        {format.backgroundColor !== 'transparent' && (
          <DialogueBox
            width={width}
            height={height}
            fillColor={format.backgroundColor}
            strokeColor={format.borderColor}
            strokeWidth={format.borderThickness}
            className="absolute inset-0"
            pointerHeight={Math.min(24, height * 0.15)} // Scale pointer proportionally
            pointerWidth={Math.min(28, width * 0.15)}
            radius={Math.min(16, Math.min(width, height) * 0.08)}
          />
        )}
        
        {/* Fallback for transparent dialogue box */}
        {format.backgroundColor === 'transparent' && (
          <DialogueBox
            width={width}
            height={height}
            fillColor="transparent"
            strokeColor={format.borderColor || '#000000'}
            strokeWidth={format.borderThickness || 2}
            className="absolute inset-0"
            pointerHeight={Math.min(24, height * 0.15)}
            pointerWidth={Math.min(28, width * 0.15)}
            radius={Math.min(16, Math.min(width, height) * 0.08)}
          />
        )}
        
        {/* Text Content */}
        <div 
          className="absolute flex items-center justify-center"
          style={{
            left: '8px',
            right: '8px',
            top: '8px',
            bottom: `${Math.min(24, height * 0.15) + 8}px`, // Leave space for pointer
            fontFamily: format.fontFamily,
            fontSize: format.fontSize + 'px',
            color: format.textColor,
            fontWeight: format.isBold ? 'bold' : 'normal',
            fontStyle: format.isItalic ? 'italic' : 'normal',
            textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
            textAlign: format.textAlign,
            pointerEvents: format.isLocked ? 'none' : 'auto',
          }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleTextSubmit}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent resize-none outline-none border-none"
              style={{
                fontFamily: format.fontFamily,
                fontSize: format.fontSize + 'px',
                color: format.textColor,
                fontWeight: format.isBold ? 'bold' : 'normal',
                fontStyle: format.isItalic ? 'italic' : 'normal',
                textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
                textAlign: format.textAlign,
              }}
            />
          ) : (
            <div
              className="whitespace-pre-wrap w-full h-full flex relative cursor-text"
              style={{
                wordBreak: 'break-word',
                alignItems: format.textAlign === 'center' ? 'center' : 'flex-start',
                justifyContent: format.textAlign === 'left' ? 'flex-start' : 
                             format.textAlign === 'right' ? 'flex-end' : 'center',
                textAlign: format.textAlign,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isSelected && !format.isLocked) {
                  setIsEditing(true);
                }
              }}
            >
              {text || (format.isLocked ? 'Locked' : 'Double-click to edit')}
              {format.link && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-primary/20 rounded-full flex items-center justify-center text-xs transform translate-x-1 -translate-y-1">
                  🔗
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resize Handles for DialogueBox */}
        {isSelected && !format.isLocked && (
          <>
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-nw-resize shadow-sm"
              style={{
                top: '-6px',
                left: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-ne-resize shadow-sm"
              style={{
                top: '-6px',
                right: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-sw-resize shadow-sm"
              style={{
                bottom: '-6px',
                left: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-se-resize shadow-sm"
              style={{
                bottom: '-6px',
                right: '-6px',
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            />
          </>
        )}
      </div>
    );
  }

  // Special rendering for Parallelogram SVG type
  if (format.boxType === 'parallelogram') {
    const parallelogramSlant = Math.min(30, width * 0.15); // Scale slant proportionally
    const totalWidth = width + parallelogramSlant;
    const handlePadding = 8; // Space to prevent handles from going outside
    
    return (
      <div
        ref={containerRef}
        className={`absolute select-none ${format.isLocked ? 'cursor-default' : 
            isDragging ? 'cursor-grabbing' : 
            format.link ? 'cursor-pointer' : 'cursor-grab'}`}
        style={{
          left: (x - handlePadding) + 'px',
          top: (y - handlePadding) + 'px',
          width: (totalWidth + handlePadding * 2) + 'px',
          height: (height + handlePadding * 2) + 'px',
          zIndex: isSelected ? 1000 : 100,
        }}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
      >
        {/* Parallelogram SVG Background */}
        {format.backgroundColor !== 'transparent' && (
          <Parallelogram
            width={width}
            height={height}
            slant={parallelogramSlant}
            fillColor={format.backgroundColor}
            strokeColor={format.borderColor}
            strokeWidth={format.borderStyle === 'none' ? 0 : format.borderThickness}
            className="absolute"
            style={{
              left: handlePadding + 'px',
              top: handlePadding + 'px',
            }}
          />
        )}
        
        {/* Fallback for transparent parallelogram */}
        {format.backgroundColor === 'transparent' && (
          <Parallelogram
            width={width}
            height={height}
            slant={parallelogramSlant}
            fillColor="transparent"
            strokeColor={format.borderColor || '#000000'}
            strokeWidth={format.borderStyle === 'none' ? 0 : (format.borderThickness || 2)}
            className="absolute"
            style={{
              left: handlePadding + 'px',
              top: handlePadding + 'px',
            }}
          />
        )}
        
        {/* Text Content */}
        <div 
          className="absolute flex items-center justify-center"
          style={{
            left: `${handlePadding + parallelogramSlant / 2 + 8}px`,
            right: `${handlePadding + parallelogramSlant / 2 + 8}px`,
            top: `${handlePadding + 8}px`,
            bottom: `${handlePadding + 8}px`,
            fontFamily: format.fontFamily,
            fontSize: format.fontSize + 'px',
            color: format.textColor,
            fontWeight: format.isBold ? 'bold' : 'normal',
            fontStyle: format.isItalic ? 'italic' : 'normal',
            textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
            textAlign: format.textAlign,
            pointerEvents: format.isLocked ? 'none' : 'auto',
          }}
        >
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleTextSubmit}
              onKeyDown={handleKeyDown}
              className="w-full h-full bg-transparent resize-none outline-none border-none"
              style={{
                fontFamily: format.fontFamily,
                fontSize: format.fontSize + 'px',
                color: format.textColor,
                fontWeight: format.isBold ? 'bold' : 'normal',
                fontStyle: format.isItalic ? 'italic' : 'normal',
                textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
                textAlign: format.textAlign,
              }}
            />
          ) : (
            <div
              className="whitespace-pre-wrap w-full h-full flex relative cursor-text"
              style={{
                wordBreak: 'break-word',
                alignItems: format.textAlign === 'center' ? 'center' : 'flex-start',
                justifyContent: format.textAlign === 'left' ? 'flex-start' : 
                             format.textAlign === 'right' ? 'flex-end' : 'center',
                textAlign: format.textAlign,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (isSelected && !format.isLocked) {
                  setIsEditing(true);
                }
              }}
            >
              {text || (format.isLocked ? 'Locked' : 'Double-click to edit')}
              {format.link && (
                <div className="absolute top-0 right-0 w-3 h-3 bg-primary/20 rounded-full flex items-center justify-center text-xs transform translate-x-1 -translate-y-1">
                  🔗
                </div>
              )}
            </div>
          )}
        </div>

        {/* Resize Handles for Parallelogram */}
        {isSelected && !format.isLocked && (
          <>
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-nw-resize shadow-sm"
              style={{
                top: `${handlePadding - 6}px`,
                left: `${handlePadding - 6}px`,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-ne-resize shadow-sm"
              style={{
                top: `${handlePadding - 6}px`,
                right: `${handlePadding - 6}px`,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-sw-resize shadow-sm"
              style={{
                bottom: `${handlePadding - 6}px`,
                left: `${handlePadding - 6}px`,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            />
            <div
              className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-se-resize shadow-sm"
              style={{
                bottom: `${handlePadding - 6}px`,
                right: `${handlePadding - 6}px`,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`absolute select-none ${format.isLocked ? 'cursor-default' : 
          isDragging ? 'cursor-grabbing' : 
          format.link ? 'cursor-pointer' : 'cursor-grab'}`}
      style={{
        left: x + 'px',
        top: y + 'px',
        width: width + 'px',
        height: height + 'px',
        fontFamily: format.fontFamily,
        fontSize: format.fontSize + 'px',
        color: format.textColor,
        backgroundColor: backgroundStyle,
        border: borderStyle,
        padding: '8px 12px',
        ...getBoxStyles(),
        zIndex: isSelected ? 1000 : 100,
        fontWeight: format.isBold ? 'bold' : 'normal',
        fontStyle: format.isItalic ? 'italic' : 'normal',
        textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
        textAlign: format.textAlign,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
    >
      {/* Content */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleTextSubmit}
            onKeyDown={handleKeyDown}
            className="w-full h-full bg-transparent resize-none outline-none border-none"
            style={{
              fontFamily: format.fontFamily,
              fontSize: format.fontSize + 'px',
              color: format.textColor,
              fontWeight: format.isBold ? 'bold' : 'normal',
              fontStyle: format.isItalic ? 'italic' : 'normal',
              textDecoration: format.isUnderline ? 'underline' : format.link ? 'underline' : 'none',
              textAlign: format.textAlign,
            }}
          />
        ) : (
          <div
            className="whitespace-pre-wrap w-full h-full flex relative cursor-text"
            style={{
              wordBreak: 'break-word',
              alignItems: format.textAlign === 'center' ? 'center' : 'flex-start',
              justifyContent: format.textAlign === 'left' ? 'flex-start' : 
                           format.textAlign === 'right' ? 'flex-end' : 'center',
              textAlign: format.textAlign,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isSelected && !format.isLocked) {
                setIsEditing(true);
              }
            }}
          >
            {text || (format.isLocked ? 'Locked' : 'Double-click to edit')}
            {format.link && (
              <div className="absolute top-0 right-0 w-3 h-3 bg-primary/20 rounded-full flex items-center justify-center text-xs transform translate-x-1 -translate-y-1">
                🔗
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize Handles - positioned outside the box to avoid thickness conflicts */}
      {isSelected && !format.isLocked && (
        <>
          {/* Corner Handles - positioned outside the border based on border thickness */}
          <div
            className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-nw-resize shadow-sm"
            style={{
              top: `${-6 - (format.borderThickness || 0)}px`,
              left: `${-6 - (format.borderThickness || 0)}px`,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          />
          <div
            className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-ne-resize shadow-sm"
            style={{
              top: `${-6 - (format.borderThickness || 0)}px`,
              right: `${-6 - (format.borderThickness || 0)}px`,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          />
          <div
            className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-sw-resize shadow-sm"
            style={{
              bottom: `${-6 - (format.borderThickness || 0)}px`,
              left: `${-6 - (format.borderThickness || 0)}px`,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          />
          <div
            className="absolute w-3 h-3 bg-primary border-2 border-white rounded-full cursor-se-resize shadow-sm"
            style={{
              bottom: `${-6 - (format.borderThickness || 0)}px`,
              right: `${-6 - (format.borderThickness || 0)}px`,
            }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          />
        </>
      )}
    </div>
  );
}