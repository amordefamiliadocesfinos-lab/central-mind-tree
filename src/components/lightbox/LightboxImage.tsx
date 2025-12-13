import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  RefreshCw,
  Sun,
  Contrast,
} from "lucide-react";
import { ImageTransform, defaultImageTransform } from "./types";

interface LightboxImageProps {
  src: string;
  onTransformChange?: (transform: ImageTransform) => void;
}

export function LightboxImage({ src, onTransformChange }: LightboxImageProps) {
  const [transform, setTransform] = useState<ImageTransform>(defaultImageTransform);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const updateTransform = useCallback((updates: Partial<ImageTransform>) => {
    setTransform((prev) => {
      const newTransform = { ...prev, ...updates };
      onTransformChange?.(newTransform);
      return newTransform;
    });
  }, [onTransformChange]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    updateTransform({ scale: Math.max(0.1, Math.min(10, transform.scale * delta)) });
  }, [transform.scale, updateTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (transform.scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - transform.translateX, y: e.clientY - transform.translateY });
    }
  }, [transform.scale, transform.translateX, transform.translateY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      updateTransform({
        translateX: e.clientX - dragStart.x,
        translateY: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, updateTransform]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const zoomIn = () => updateTransform({ scale: Math.min(10, transform.scale * 1.25) });
  const zoomOut = () => updateTransform({ scale: Math.max(0.1, transform.scale * 0.8) });
  const rotate = () => updateTransform({ rotation: (transform.rotation + 90) % 360 });
  const flipH = () => updateTransform({ flipH: !transform.flipH });
  const flipV = () => updateTransform({ flipV: !transform.flipV });
  const reset = () => setTransform(defaultImageTransform);

  // Reset on src change
  useEffect(() => {
    setTransform(defaultImageTransform);
  }, [src]);

  const imageStyle: React.CSSProperties = {
    transform: `
      translate(${transform.translateX}px, ${transform.translateY}px)
      scale(${transform.scale})
      rotate(${transform.rotation}deg)
      scaleX(${transform.flipH ? -1 : 1})
      scaleY(${transform.flipV ? -1 : 1})
    `,
    filter: `brightness(${transform.brightness}%) contrast(${transform.contrast}%)`,
    cursor: transform.scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
    transition: isDragging ? "none" : "transform 0.1s ease-out",
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={src}
          alt="Lightbox preview"
          className="max-w-full max-h-full object-contain select-none"
          style={imageStyle}
          draggable={false}
        />
      </div>

      {/* Controls Footer */}
      <div className="flex flex-wrap items-center justify-center gap-2 p-3 bg-background/80 backdrop-blur border-t border-border">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom Out (-)">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs w-12 text-center">{Math.round(transform.scale * 100)}%</span>
          <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom In (+)">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="w-px h-6 bg-border" />

        <Button variant="ghost" size="icon" onClick={rotate} title="Rotacionar (R)">
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={flipH} title="Flip Horizontal">
          <FlipHorizontal className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={flipV} title="Flip Vertical">
          <FlipVertical className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-border" />

        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[transform.brightness]}
            onValueChange={([v]) => updateTransform({ brightness: v })}
            min={50}
            max={150}
            step={5}
            className="w-20"
          />
        </div>

        <div className="flex items-center gap-2">
          <Contrast className="h-4 w-4 text-muted-foreground" />
          <Slider
            value={[transform.contrast]}
            onValueChange={([v]) => updateTransform({ contrast: v })}
            min={50}
            max={150}
            step={5}
            className="w-20"
          />
        </div>

        <div className="w-px h-6 bg-border" />

        <Button variant="ghost" size="icon" onClick={reset} title="Reset (0)">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function getTransformedImageDataUrl(
  img: HTMLImageElement,
  transform: ImageTransform
): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const isRotated90or270 = transform.rotation === 90 || transform.rotation === 270;
    canvas.width = isRotated90or270 ? img.naturalHeight : img.naturalWidth;
    canvas.height = isRotated90or270 ? img.naturalWidth : img.naturalHeight;

    ctx.filter = `brightness(${transform.brightness}%) contrast(${transform.contrast}%)`;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

    resolve(canvas.toDataURL("image/png"));
  });
}
