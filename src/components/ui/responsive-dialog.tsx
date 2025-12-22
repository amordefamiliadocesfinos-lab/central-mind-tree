import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn("max-h-[96vh]", className)}>
          {(title || description) && (
            <DrawerHeader className="text-left px-4 pb-2">
              {title && <DrawerTitle className="text-lg">{title}</DrawerTitle>}
              {description && (
                <DrawerDescription>{description}</DrawerDescription>
              )}
            </DrawerHeader>
          )}
          <div className="overflow-y-auto flex-1 px-4 pb-safe-bottom">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-lg", className)}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}

// Full-screen dialog for mobile
interface FullScreenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function FullScreenDialog({
  open,
  onOpenChange,
  children,
  title,
  className,
}: FullScreenDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent 
          className={cn(
            "h-[100dvh] max-h-[100dvh] rounded-none", 
            className
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b safe-area-pt">
            {title && (
              <h2 className="text-lg font-semibold">{title}</h2>
            )}
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>
          <div className="flex-1 overflow-y-auto pb-safe-bottom">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-2xl max-h-[85vh] overflow-y-auto", className)}>
        {title && (
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        {children}
      </DialogContent>
    </Dialog>
  );
}
