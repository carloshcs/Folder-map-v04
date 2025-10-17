import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { MessageCircle, Send, Minimize2 } from "lucide-react";

export interface Comment {
  id: string;
  author: string;
  authorInitials: string;
  content: string;
  timestamp: Date;
}

interface CommentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: Comment[];
  onAddComment: (content: string) => void;
  isDark?: boolean; // 👈 optional theme flag
}

export function CommentDialog({
  open,
  onOpenChange,
  comments,
  onAddComment,
  isDark = false,
}: CommentDialogProps) {
  const [newComment, setNewComment] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);

  const handleSubmit = () => {
    if (newComment.trim()) {
      onAddComment(newComment.trim());
      setNewComment("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInHours * 60);
      return diffInMinutes <= 0 ? "Just now" : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  // 🧭 Minimized Version
  if (isMinimized) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={`w-64 h-16 p-3 rounded-lg border shadow-md ${
            isDark
              ? "bg-neutral-900 text-white border-neutral-700"
              : "bg-white text-black border-neutral-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium">CS</span>
              {comments.length > 0 && (
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  {comments.length}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(false)}
              className="h-6 w-6 p-0"
            >
              <MessageCircle size={12} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // 🧭 Full Comment Dialog
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-w-md max-h-96 rounded-xl border shadow-lg backdrop-blur-md ${
          isDark
            ? "bg-neutral-900/95 text-white border-neutral-700"
            : "bg-white/95 text-black border-neutral-200"
        }`}
      >
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <DialogTitle className="text-base flex items-center gap-2">
            <MessageCircle size={16} />
            Comments
          </DialogTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMinimized(true)}
              className="h-6 w-6 p-0"
            >
              <Minimize2 size={12} />
            </Button>
          </div>
        </DialogHeader>

        {/* Comments List */}
        <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              No comments yet. Be the first to add one!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="w-6 h-6 flex-shrink-0">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {comment.authorInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-primary">
                      {comment.author}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Comment */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex gap-2">
            <Avatar className="w-6 h-6 flex-shrink-0">
              <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                CS
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <Textarea
                placeholder="Leave a comment. Use @ to mention."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`min-h-16 text-sm resize-none rounded-md transition-all ${
                  isDark
                    ? "bg-neutral-800 text-white placeholder-neutral-400 focus:ring-blue-500/50 focus:bg-neutral-700"
                    : "bg-neutral-100 text-black placeholder-neutral-500 focus:ring-blue-400/40 focus:bg-white"
                }`}
              />
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </span>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={!newComment.trim()}
              className="h-7"
            >
              <Send size={12} className="mr-1" />
              Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
