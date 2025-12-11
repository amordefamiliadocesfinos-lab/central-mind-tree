import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, FileText, Film, Image as ImageIcon } from "lucide-react";

export interface MediaItem {
  id: string;
  file: File;
  type: "image" | "video" | "other";
  previewUrl: string;
}

interface MediaUploaderProps {
  media: MediaItem[];
  onChange: (media: MediaItem[]) => void;
}

export function MediaUploader({ media, onChange }: MediaUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URLs when component unmounts or media changes
  useEffect(() => {
    return () => {
      media.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newItems: MediaItem[] = [];

    Array.from(files).forEach((file) => {
      const id = crypto.randomUUID();
      const mimeType = file.type;
      let type: MediaItem["type"] = "other";

      if (mimeType.startsWith("image/")) {
        type = "image";
      } else if (mimeType.startsWith("video/")) {
        type = "video";
      }

      const previewUrl = URL.createObjectURL(file);

      newItems.push({
        id,
        file,
        type,
        previewUrl,
      });
    });

    onChange([...media, ...newItems]);

    // Reset input to allow selecting the same file again
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleRemove = (id: string) => {
    const item = media.find((m) => m.id === id);
    if (item) {
      URL.revokeObjectURL(item.previewUrl);
    }
    onChange(media.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*,.pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar Mídia
      </Button>

      {media.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative aspect-square rounded-lg border bg-muted overflow-hidden group"
            >
              {item.type === "image" && (
                <img
                  src={item.previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              )}

              {item.type === "video" && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                  <Film className="h-8 w-8 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground truncate max-w-full px-2">
                    {item.file.name}
                  </span>
                </div>
              )}

              {item.type === "other" && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground truncate max-w-full px-2">
                    {item.file.name}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
