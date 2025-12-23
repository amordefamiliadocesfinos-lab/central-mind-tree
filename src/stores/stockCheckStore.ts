import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getTodayISO } from '@/lib/dateUtils';

interface StockCheckState {
  // Persistent state
  lastStockCheckDate: string | null;
  
  // Volatile state (not persisted)
  remindAt: number | null; // timestamp
  isWizardOpen: boolean;
  
  // Actions
  setLastStockCheckDate: (date: string) => void;
  skipToday: () => void;
  remindIn2Hours: () => void;
  clearReminder: () => void;
  openWizard: () => void;
  closeWizard: () => void;
  shouldShowAlert: () => boolean;
}

export const useStockCheckStore = create<StockCheckState>()(
  persist(
    (set, get) => ({
      lastStockCheckDate: null,
      remindAt: null,
      isWizardOpen: false,

      setLastStockCheckDate: (date) => set({ lastStockCheckDate: date }),
      
      skipToday: () => set({ 
        lastStockCheckDate: getTodayISO(),
        remindAt: null,
      }),
      
      remindIn2Hours: () => set({ 
        remindAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
      }),
      
      clearReminder: () => set({ remindAt: null }),
      
      openWizard: () => set({ isWizardOpen: true }),
      
      closeWizard: () => set({ isWizardOpen: false }),
      
      shouldShowAlert: () => {
        const { lastStockCheckDate, remindAt } = get();
        const today = getTodayISO();
        
        // If already checked today, don't show
        if (lastStockCheckDate === today) {
          return false;
        }
        
        // If reminder is set and not yet expired, don't show
        if (remindAt && Date.now() < remindAt) {
          return false;
        }
        
        return true;
      },
    }),
    {
      name: 'stock-check-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        lastStockCheckDate: state.lastStockCheckDate,
        remindAt: state.remindAt, // Persist reminder across sessions
      }),
    }
  )
);
