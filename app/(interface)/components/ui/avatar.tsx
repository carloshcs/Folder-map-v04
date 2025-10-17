"use client";

import * as React from "react";

import { cn } from "./utils";

type AvatarContextValue = {
  hasImage: boolean;
  setHasImage: (value: boolean) => void;
};

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

const useAvatarContext = () => {
  const context = React.useContext(AvatarContext);
  if (!context) {
    throw new Error("Avatar compound components must be used within <Avatar>");
  }
  return context;
};

type AvatarProps = React.HTMLAttributes<HTMLSpanElement>;

const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, children, ...props }, ref) => {
    const [hasImage, setHasImage] = React.useState(false);
    const contextValue = React.useMemo<AvatarContextValue>(
      () => ({ hasImage, setHasImage }),
      [hasImage],
    );

    return (
      <AvatarContext.Provider value={contextValue}>
        <span
          ref={ref}
          data-slot="avatar"
          className={cn(
            "relative flex size-10 shrink-0 overflow-hidden rounded-full",
            className,
          )}
          {...props}
        >
          {children}
        </span>
      </AvatarContext.Provider>
    );
  },
);
Avatar.displayName = "Avatar";

type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, onLoad, onError, ...props }, ref) => {
    const { setHasImage } = useAvatarContext();

    return (
      <img
        ref={ref}
        data-slot="avatar-image"
        className={cn("aspect-square size-full object-cover", className)}
        onLoad={event => {
          setHasImage(true);
          onLoad?.(event);
        }}
        onError={event => {
          setHasImage(false);
          onError?.(event);
        }}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = "AvatarImage";

type AvatarFallbackProps = React.HTMLAttributes<HTMLSpanElement>;

const AvatarFallback = React.forwardRef<HTMLSpanElement, AvatarFallbackProps>(
  ({ className, children, ...props }, ref) => {
    const { hasImage } = useAvatarContext();

    if (hasImage) {
      return null;
    }

    return (
      <span
        ref={ref}
        data-slot="avatar-fallback"
        className={cn(
          "bg-muted flex size-full items-center justify-center rounded-full",
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  },
);
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
