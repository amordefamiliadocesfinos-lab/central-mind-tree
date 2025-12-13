import { useEffect, useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";
import { useLightbox } from "./LightboxContext";
import { LightboxImage, getTransformedImageDataUrl } from "./LightboxImage";
import { LightboxVideo } from "./LightboxVideo";
import { ImageTransform, defaultImageTransform } from "./types";

export function LightboxRoot() {
  const { state, close, next, prev, deleteItem } = useLightbox();
  const { isOpen, items, currentIndex } = state;
  const [imageTransform, setImageTransform] = useState<ImageTransform>(defaultImageTransform);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const currentItem = items[currentIndex];

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "Escape":
          close();
          break;
        case "ArrowLeft":
          prev();
          break;
        case "ArrowRight":
          next();
          break;
        case "Delete":
        case "Backspace":
          if (currentItem) deleteItem(currentItem.id);
          break;
        case "+":
        case "=":
          setImageTransform((t) => ({ ...t, scale: Math.min(10, t.scale * 1.25) }));
          break;
        case "-":
          setImageTransform((t) => ({ ...t, scale: Math.max(0.1, t.scale * 0.8) }));
          break;
        case "0":
          setImageTransform(defaultImageTransform);
          break;
        case "r":
        case "R":
          setImageTransform((t) => ({ ...t, rotation: (t.rotation + 90) % 360 }));
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close, next, prev, deleteItem, currentItem]);

  // Reset transform when item changes
  useEffect(() => {
    setImageTransform(defaultImageTransform);
  }, [currentIndex]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        close();
      }
    },
    [close]
  );

  const downloadOriginal = useCallback(() => {
    if (!currentItem) return;
    const a = document.createElement("a");
    a.href = currentItem.src;
    a.download = currentItem.name || `download-${Date.now()}`;
    a.click();
  }, [currentItem]);

  const downloadEdited = useCallback(async () => {
    if (!currentItem || currentItem.type !== "image") return;

    // Create temp image to get natural dimensions
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = currentItem.src;
    await new Promise((resolve) => (img.onload = resolve));

    const dataUrl = await getTransformedImageDataUrl(img, imageTransform);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `edited-${currentItem.name || Date.now()}.png`;
    a.click();
  }, [currentItem, imageTransform]);

  const openInNewTab = useCallback(() => {
    if (!currentItem) return;
    window.open(currentItem.src, "_blank");
  }, [currentItem]);

  if (!isOpen || !currentItem) return null;

  const hasEdits =
    imageTransform.rotation !== 0 ||
    imageTransform.flipH ||
    imageTransform.flipV ||
    imageTransform.brightness !== 100 ||
    imageTransform.contrast !== 100;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex flex-col"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-background/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {items.length}
          </span>
          {currentItem.name && (
            <span className="text-sm font-medium truncate max-w-[200px]">
              {currentItem.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {currentItem.type === "image" && (
            <>
              <Button variant="ghost" size="icon" onClick={downloadOriginal} title="Download Original">
                <Download className="h-4 w-4" />
              </Button>
              {hasEdits && (
                <Button variant="ghost" size="icon" onClick={downloadEdited} title="Download com Ajustes">
                  <Download className="h-4 w-4 text-primary" />
                </Button>
              )}
            </>
          )}
          {currentItem.type === "file" && (
            <Button variant="ghost" size="icon" onClick={openInNewTab} title="Abrir em nova aba">
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteItem(currentItem.id)}
            title="Excluir"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={close} title="Fechar (Esc)">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Navigation */}
        {items.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                prev();
              }}
              className="absolute left-4 z-10 bg-background/50 hover:bg-background/80"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                next();
              }}
              className="absolute right-4 z-10 bg-background/50 hover:bg-background/80"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          </>
        )}

        {/* Media Content */}
        <div className="w-full h-full" onClick={(e) => e.stopPropagation()}>
          {currentItem.type === "image" && (
            <LightboxImage src={currentItem.src} onTransformChange={setImageTransform} />
          )}
          {currentItem.type === "video" && <LightboxVideo src={currentItem.src} />}
          {currentItem.type === "file" && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <FileText className="h-24 w-24 text-muted-foreground" />
              <span className="text-lg">{currentItem.name || "Arquivo"}</span>
              <Button onClick={openInNewTab}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir em nova aba
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
