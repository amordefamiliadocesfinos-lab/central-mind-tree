import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { LightboxState, LightboxContextValue, LightboxItem } from "./types";

const LightboxContext = createContext<LightboxContextValue | null>(null);

interface LightboxProviderProps {
  children: ReactNode;
  onDeleteAttachment?: (id: string) => void;
}

export function LightboxProvider({ children, onDeleteAttachment }: LightboxProviderProps) {
  const [state, setState] = useState<LightboxState>({
    isOpen: false,
    items: [],
    currentIndex: 0,
  });

  const open = useCallback((items: LightboxItem[], startIndex = 0) => {
    setState({
      isOpen: true,
      items,
      currentIndex: Math.min(startIndex, items.length - 1),
    });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const next = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.items.length,
    }));
  }, []);

  const prev = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentIndex: (prev.currentIndex - 1 + prev.items.length) % prev.items.length,
    }));
  }, []);

  const goTo = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      currentIndex: Math.max(0, Math.min(index, prev.items.length - 1)),
    }));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setState((prev) => {
      const newItems = prev.items.filter((item) => item.id !== id);
      if (newItems.length === 0) {
        return { ...prev, isOpen: false, items: [], currentIndex: 0 };
      }
      const newIndex = Math.min(prev.currentIndex, newItems.length - 1);
      return { ...prev, items: newItems, currentIndex: newIndex };
    });
    onDeleteAttachment?.(id);
  }, [onDeleteAttachment]);

  return (
    <LightboxContext.Provider
      value={{ state, open, close, next, prev, goTo, deleteItem, onDeleteAttachment }}
    >
      {children}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const context = useContext(LightboxContext);
  if (!context) {
    throw new Error("useLightbox must be used within LightboxProvider");
  }
  return context;
}
