import * as React from "react";

type PrimitiveProps<P> = P & { children?: React.ReactNode };

type DrawerRootProps = PrimitiveProps<React.HTMLAttributes<HTMLDivElement>> & {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DrawerContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({ open: false, setOpen: () => {} });

const DrawerRoot = React.forwardRef<HTMLDivElement, DrawerRootProps>(
  ({ open: openProp, onOpenChange, children, ...props }, ref) => {
    const [open, setOpen] = React.useState(Boolean(openProp));

    React.useEffect(() => {
      if (openProp === undefined) {
        return;
      }
      setOpen(openProp);
    }, [openProp]);

    const handleSetOpen = (value: boolean) => {
      if (openProp === undefined) {
        setOpen(value);
      }
      onOpenChange?.(value);
    };

    return (
      <DrawerContext.Provider value={{ open, setOpen: handleSetOpen }}>
        <div ref={ref} {...props}>
          {children}
        </div>
      </DrawerContext.Provider>
    );
  },
);
DrawerRoot.displayName = "DrawerRoot";

const DrawerTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(DrawerContext);
    return (
      <button
        ref={ref}
        onClick={event => {
          setOpen(true);
          onClick?.(event);
        }}
        {...props}
      />
    );
  },
);
DrawerTrigger.displayName = "DrawerTrigger";

const DrawerPortal: React.FC<PrimitiveProps<{}>> = ({ children }) => <>{children}</>;

const DrawerClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(DrawerContext);
    return (
      <button
        ref={ref}
        onClick={event => {
          setOpen(false);
          onClick?.(event);
        }}
        {...props}
      />
    );
  },
);
DrawerClose.displayName = "DrawerClose";

const DrawerOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ onClick, ...props }, ref) => {
    const { setOpen } = React.useContext(DrawerContext);
    return (
      <div
        ref={ref}
        onClick={event => {
          setOpen(false);
          onClick?.(event);
        }}
        {...props}
      />
    );
  },
);
DrawerOverlay.displayName = "DrawerOverlay";

const DrawerContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => (
    <div ref={ref} role="dialog" {...props}>
      {children}
    </div>
  ),
);
DrawerContent.displayName = "DrawerContent";

const DrawerTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ children, ...props }, ref) => (
    <h2 ref={ref} {...props}>
      {children}
    </h2>
  ),
);
DrawerTitle.displayName = "DrawerTitle";

const DrawerDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ children, ...props }, ref) => (
    <p ref={ref} {...props}>
      {children}
    </p>
  ),
);
DrawerDescription.displayName = "DrawerDescription";

export const Drawer = {
  Root: DrawerRoot,
  Trigger: DrawerTrigger,
  Portal: DrawerPortal,
  Close: DrawerClose,
  Overlay: DrawerOverlay,
  Content: DrawerContent,
  Title: DrawerTitle,
  Description: DrawerDescription,
};
