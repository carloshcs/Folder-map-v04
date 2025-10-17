import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  ChevronUp,
  Send,
  MoreVertical,
  Trash2,
} from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  content: string;
  timestamp: Date;
}

interface CommentBoxProps {
  id: string;
  x: number;
  y: number;
  comments: Comment[];
  isSelected: boolean;
  isExpanded: boolean;
  zoom: number;
  onPositionChange: (id: string, x: number, y: number) => void;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onAddComment: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isDark?: boolean; // 👈 Added for theme control
}

export function CommentBox({
  id,
  x,
  y,
  comments,
  isSelected,
  isExpanded,
  zoom,
  onPositionChange,
  onSelect,
  onToggleExpand,
  onAddComment,
  onDelete,
  onDragStart,
  onDragEnd,
  isDark = false,
}: CommentBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [newComment, setNewComment] = useState("");
  const [draggedDistance, setDraggedDistance] = useState(0);
  const commentBoxRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({
      x: e.clientX / (zoom / 100) - x,
      y: e.clientY / (zoom / 100) - y,
    });
    setDraggedDistance(0);
    onSelect(id);
    onDragStart?.();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX / (zoom / 100) - dragStart.x;
    const newY = e.clientY / (zoom / 100) - dragStart.y;
    const distance = Math.sqrt(
      (newX - x) * (newX - x) + (newY - y) * (newY - y)
    );
    setDraggedDistance(distance);
    onPositionChange(id, newX, newY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, zoom]);

  const handleAddComment = () => {
    if (newComment.trim()) {
      onAddComment(id, newComment.trim());
      setNewComment("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddComment();
    }
  };

  const formatTime = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

  const formatDate = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? "Today"
      : new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
        }).format(date);
  };

  // --- COLLAPSED STATE ---
  if (!isExpanded) {
    return (
      <div
        style={{
          position: "absolute",
          left: `${x}px`,
          top: `${y}px`,
          zIndex: isSelected ? 50 : 10,
        }}
        className={isDragging ? "cursor-grabbing" : "cursor-grab"}
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                ref={commentBoxRef}
                className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 ${
                  comments.length > 0 ? "bg-green-600" : "bg-blue-600"
                } ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                onMouseDown={handleMouseDown}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(id);
                  if (draggedDistance < 5) onToggleExpand(id);
                }}
              >
                {comments.length > 0 ? "C" : <MessageCircle size={16} />}
                {comments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {comments.length > 9 ? "9+" : comments.length}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {comments.length > 0
                  ? `${comments.length} comment(s)`
                  : "Click to add comment"}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  // --- EXPANDED STATE ---
  return (
    <div
      style={{
        position: "absolute",
        left: `${x}px`,
        top: `${y}px`,
        zIndex: isSelected ? 50 : 20,
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        ref={commentBoxRef}
        className={`w-80 max-w-sm overflow-hidden rounded-lg border shadow-lg backdrop-blur-md ${
          isDark
            ? "bg-neutral-900/95 border-neutral-700 text-white"
            : "bg-white/95 border-neutral-200 text-black"
        } ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(id);
        }}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-3 border-b ${
            isDark ? "border-neutral-700" : "border-neutral-200"
          } ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
              C
            </div>
            <div>
              <div className="font-medium text-sm">Carlos Saunders</div>
              <div className="text-xs text-muted-foreground">
                {formatDate(new Date())}, {formatTime(new Date())}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (draggedDistance < 5) onToggleExpand(id);
                    }}
                  >
                    <ChevronUp size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Collapse</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                className={`z-[100] w-48 ${
                  isDark
                    ? "bg-neutral-900 border-neutral-700 text-white"
                    : "bg-white border-neutral-200 text-black"
                }`}
              >
                <DropdownMenuItem
                  onClick={() => onDelete(id)}
                  className="text-destructive focus:text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <Trash2 size={14} className="mr-2" />
                  Delete Comment
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Comments */}
        <div className="max-h-60 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No comments yet. Add one below!
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {comments.map((comment) => (
                <div key={comment.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-4 h-4 bg-green-600 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
                      {comment.authorInitials}
                    </div>
                    <span className="font-medium">{comment.author}</span>
                    <span>
                      {formatDate(comment.timestamp)},{" "}
                      {formatTime(comment.timestamp)}
                    </span>
                  </div>
                  <div className="text-sm pl-6">{comment.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add comment */}
        <div
          className={`p-3 border-t ${
            isDark ? "border-neutral-700 bg-neutral-800" : "border-neutral-200 bg-neutral-100"
          }`}
        >
          <div className="flex gap-2">
            <Input
              placeholder="Leave a reply. Use @ to mention."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyPress={handleKeyPress}
              className={`flex-1 h-8 text-sm rounded-md ${
                isDark
                  ? "bg-neutral-800 text-white placeholder-neutral-400 focus:bg-neutral-700"
                  : "bg-white text-black placeholder-neutral-500 focus:bg-neutral-50"
              }`}
            />
            <Button
              size="sm"
              onClick={handleAddComment}
              disabled={!newComment.trim()}
              className="h-8 w-8 p-0"
            >
              <Send size={14} />
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
