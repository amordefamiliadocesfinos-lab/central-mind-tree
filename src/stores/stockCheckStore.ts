import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { getTodayISO } from '@/lib/dateUtils';

interface StockCheckState {
  // Persistent state
  lastStockCheckDate: string | null;

  // Volatile state (not persisted)
  remindAt: number | null; // timestamp
  dismissedDate: string | null; // ISO date (YYYY-MM-DD) - hides only for the current session
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
      dismissedDate: null,
      isWizardOpen: false,

      setLastStockCheckDate: (date) =>
        set({ lastStockCheckDate: date, remindAt: null, dismissedDate: null }),

      // "Pular Hoje" agora só esconde por esta sessão.
      // Ao reabrir o app, o alerta volta a aparecer (modo automático).
      skipToday: () =>
        set({
          dismissedDate: getTodayISO(),
          remindAt: null,
        }),

      remindIn2Hours: () =>
        set({
          remindAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours from now
          dismissedDate: null,
        }),

      clearReminder: () => set({ remindAt: null }),

      openWizard: () => set({ isWizardOpen: true }),

      closeWizard: () => set({ isWizardOpen: false }),

      shouldShowAlert: () => {
        const { lastStockCheckDate, remindAt, dismissedDate } = get();
        const today = getTodayISO();

        // If already checked today, don't show
        if (lastStockCheckDate === today) {
          return false;
        }

        // If user dismissed today (session only), don't show
        if (dismissedDate === today) {
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
        // Don't persist remindAt/dismissedDate: on app reopen, alert can show again if not checked today
      }),
    }
  )
);
