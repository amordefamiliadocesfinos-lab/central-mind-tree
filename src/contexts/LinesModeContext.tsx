import { createContext, useContext, useState, ReactNode } from "react";

export type LinesMode = "off" | "resumo" | "detalhe" | "ceo";

interface LinesModeContextType {
  linesMode: LinesMode;
  setLinesMode: (mode: LinesMode) => void;
  showTaskBar: boolean;
  setShowTaskBar: (show: boolean) => void;
}

const LinesModeContext = createContext<LinesModeContextType | undefined>(undefined);

export function LinesModeProvider({ children }: { children: ReactNode }) {
  const [linesMode, setLinesMode] = useState<LinesMode>("off");
  const [showTaskBar, setShowTaskBar] = useState(false);

  return (
    <LinesModeContext.Provider value={{ linesMode, setLinesMode, showTaskBar, setShowTaskBar }}>
      {children}
    </LinesModeContext.Provider>
  );
}

export function useLinesMode() {
  const context = useContext(LinesModeContext);
  if (!context) {
    throw new Error("useLinesMode must be used within a LinesModeProvider");
  }
  return context;
}
