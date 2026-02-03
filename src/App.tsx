import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { GlobalFooterBar } from "@/components/GlobalFooterBar";
import { LightboxProvider, LightboxRoot } from "@/components/lightbox";
import { UndoRedoProvider } from "@/contexts/UndoRedoContext";
import { LinesModeProvider } from "@/contexts/LinesModeContext";
import { StockCheckAlert, StockCheckWizard } from "@/components/stock-check";
import { AssistantPanel } from "@/components/assistant";
import { SwipeNavigationWrapper } from "@/components/SwipeNavigationWrapper";
import { AnimatePresence, motion, Variants } from "framer-motion";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import TaskEdit from "./pages/TaskEdit";
import Foco from "./pages/Foco";
import Planejamento from "./pages/Planejamento";
import Calendario from "./pages/Calendario";
import Rotina from "./pages/Rotina";
import Operacoes from "./pages/Operacoes";
import Digital from "./pages/Digital";
import Planilhas from "./pages/Planilhas";
import Reunioes from "./pages/Reunioes";
import ReuniaoDetalhe from "./pages/ReuniaoDetalhe";
import MinhaArea from "./pages/MinhaArea";
import Financeiro from "./pages/Financeiro";
import Assistente from "./pages/Assistente";
import NotFound from "./pages/NotFound";
import { useScheduledTaskPromotion } from "./hooks/useScheduledTaskPromotion";

const queryClient = new QueryClient();

const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: 0.15,
      ease: "easeIn",
    },
  },
};

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial="initial"
        animate="enter"
        exit="exit"
        variants={pageVariants}
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/foco" element={<Foco />} />
          <Route path="/planejamento" element={<Planejamento />} />
          <Route path="/calendario" element={<Calendario />} />
          <Route path="/rotina" element={<Rotina />} />
          <Route path="/operacoes" element={<Operacoes />} />
          <Route path="/digital" element={<Digital />} />
          <Route path="/planilhas" element={<Planilhas />} />
          <Route path="/reunioes" element={<Reunioes />} />
          <Route path="/reunioes/:id" element={<ReuniaoDetalhe />} />
          <Route path="/minha-area" element={<MinhaArea />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/assistente" element={<Assistente />} />
          <Route path="/task/:id" element={<TaskEdit />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AppContent() {
  useScheduledTaskPromotion();

  return (
    <BrowserRouter>
      {/* Assistant positioned in top-right, but below the search bar on mobile */}
      <div className="fixed z-50 md:top-4 md:right-4 max-md:bottom-16 max-md:right-3">
        <AssistantPanel />
      </div>
      <GlobalSearchBar />
      <SwipeNavigationWrapper>
        <AnimatedRoutes />
      </SwipeNavigationWrapper>
      <GlobalFooterBar />
      <StockCheckAlert />
      <StockCheckWizard />
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <UndoRedoProvider>
        <LinesModeProvider>
          <LightboxProvider>
            <Toaster />
            <Sonner />
            <AppContent />
            <LightboxRoot />
          </LightboxProvider>
        </LinesModeProvider>
      </UndoRedoProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
