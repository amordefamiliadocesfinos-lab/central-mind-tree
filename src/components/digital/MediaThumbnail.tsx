import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { X, Eye, EyeOff, ZoomIn, Play } from 'lucide-react';
import { LightboxProvider, LightboxRoot, useLightbox, LightboxItem } from '@/components/lightbox';

interface MediaThumbnailProps {
  url: string;
  index?: number;
  allMedia?: string[];
  label?: string;
  labelColor?: string;
  size?: 'sm' | 'md' | 'lg';
  isHidden?: boolean;
  showVisibilityToggle?: boolean;
  showRemove?: boolean;
  showDistribute?: boolean;
  onToggleVisibility?: (url: string) => void;
  onRemove?: (url: string) => void;
  onDistribute?: (url: string) => void;
  onOpenLightbox?: (items: LightboxItem[], index: number) => void;
  className?: string;
}

function isVideo(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
  const lowercaseUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowercaseUrl.includes(ext));
}

function urlToLightboxItem(url: string, index: number): LightboxItem {
  return {
    id: `media-${index}-${url}`,
    type: isVideo(url) ? 'video' : 'image',
    src: url,
    name: url.split('/').pop() || `Mídia ${index + 1}`,
  };
}

export function MediaThumbnail({
  url,
  index = 0,
  allMedia = [],
  label,
  labelColor = 'bg-purple-500',
  size = 'md',
  isHidden = false,
  showVisibilityToggle = false,
  showRemove = false,
  showDistribute = false,
  onToggleVisibility,
  onRemove,
  onDistribute,
  onOpenLightbox,
  className,
}: MediaThumbnailProps) {
  const sizeClasses = {
    sm: 'h-12 w-12',
    md: 'h-14 w-14',
    lg: 'h-20 w-20',
  };

  const isVideoFile = isVideo(url);

  const handleClick = useCallback(() => {
    if (onOpenLightbox) {
      const items = (allMedia.length > 0 ? allMedia : [url]).map((u, i) => urlToLightboxItem(u, i));
      const startIndex = allMedia.length > 0 ? allMedia.indexOf(url) : 0;
      onOpenLightbox(items, Math.max(0, startIndex));
    }
  }, [url, allMedia, onOpenLightbox]);

  return (
    <div className={cn("relative group", isHidden && "opacity-40", className)}>
      {/* Media Preview */}
      <div
        className={cn(
          sizeClasses[size],
          "rounded border overflow-hidden cursor-pointer transition-transform hover:scale-105 active:scale-95"
        )}
        onClick={handleClick}
      >
        {isVideoFile ? (
          <div className="relative w-full h-full bg-muted flex items-center justify-center">
            <video
              src={url}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="h-4 w-4 text-white fill-white" />
            </div>
          </div>
        ) : (
          <img
            src={url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        
        {/* Zoom indicator on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="h-5 w-5 text-white" />
        </div>
      </div>

      {/* Label Badge */}
      {label && (
        <Badge
          variant="secondary"
          className={cn(
            "absolute -top-2 -left-2 text-[8px] px-1 py-0 text-white",
            labelColor
          )}
        >
          {label}
        </Badge>
      )}

      {/* Action Buttons - Only show on hover for larger sizes */}
      {size === 'lg' && (showDistribute || showRemove) && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 rounded pointer-events-none">
          <div className="flex items-center gap-1 pointer-events-auto">
            {showDistribute && onDistribute && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  onDistribute(url);
                }}
                title="Disponibilizar em..."
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {showRemove && onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-destructive/80"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(url);
                }}
                title="Remover"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Visibility Toggle - For inherited media */}
      {showVisibilityToggle && onToggleVisibility && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -top-1 -right-1 h-5 w-5 bg-background border shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(url);
          }}
          title={isHidden ? "Exibir" : "Ocultar"}
        >
          {isHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
      )}

      {/* Small remove button for smaller sizes */}
      {size !== 'lg' && showRemove && onRemove && (
        <button
          className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(url);
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// Wrapper component to use in contexts without LightboxProvider
interface MediaGalleryProps {
  media: string[];
  onDelete?: (url: string) => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  labelColor?: string;
  showRemove?: boolean;
  showDistribute?: boolean;
  showVisibilityToggle?: boolean;
  hiddenMedia?: string[];
  onToggleVisibility?: (url: string) => void;
  onDistribute?: (url: string) => void;
  className?: string;
}

function MediaGalleryInner({
  media,
  onDelete,
  size = 'md',
  label,
  labelColor,
  showRemove = false,
  showDistribute = false,
  showVisibilityToggle = false,
  hiddenMedia = [],
  onToggleVisibility,
  onDistribute,
  className,
}: MediaGalleryProps) {
  const { open } = useLightbox();

  return (
    <div className={cn("flex gap-2 flex-wrap", className)}>
      {media.map((url, i) => (
        <MediaThumbnail
          key={i}
          url={url}
          index={i}
          allMedia={media}
          label={label}
          labelColor={labelColor}
          size={size}
          isHidden={hiddenMedia.includes(url)}
          showVisibilityToggle={showVisibilityToggle}
          showRemove={showRemove}
          showDistribute={showDistribute}
          onToggleVisibility={onToggleVisibility}
          onRemove={onDelete}
          onDistribute={onDistribute}
          onOpenLightbox={open}
        />
      ))}
    </div>
  );
}

export function MediaGallery(props: MediaGalleryProps) {
  const handleDelete = props.onDelete;

  return (
    <LightboxProvider onDeleteAttachment={handleDelete}>
      <MediaGalleryInner {...props} />
      <LightboxRoot />
    </LightboxProvider>
  );
}
