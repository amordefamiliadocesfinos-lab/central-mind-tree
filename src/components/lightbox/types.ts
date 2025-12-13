// Lightbox Types - Phase 1 (Stable, do not change)

export interface LightboxItem {
  id: string;
  type: "image" | "video" | "file";
  src: string;
  name?: string;
}

export interface LightboxState {
  isOpen: boolean;
  items: LightboxItem[];
  currentIndex: number;
}

export interface LightboxContextValue {
  state: LightboxState;
  open: (items: LightboxItem[], startIndex?: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  deleteItem: (id: string) => void;
  onDeleteAttachment?: (id: string) => void;
}

export interface ImageTransform {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  brightness: number;
  contrast: number;
}

export const defaultImageTransform: ImageTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  rotation: 0,
  flipH: false,
  flipV: false,
  brightness: 100,
  contrast: 100,
};
