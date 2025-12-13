import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { LightboxProvider, LightboxRoot } from "@/components/lightbox";
import Index from "./pages/Index";
import TaskEdit from "./pages/TaskEdit";
import Foco from "./pages/Foco";
import Planejamento from "./pages/Planejamento";
import Calendario from "./pages/Calendario";
import Rotina from "./pages/Rotina";
import Operacoes from "./pages/Operacoes";
import Conteudo from "./pages/Conteudo";
import NotFound from "./pages/NotFound";
import { useScheduledTaskPromotion } from "./hooks/useScheduledTaskPromotion";

const queryClient = new QueryClient();

function AppContent() {
  useScheduledTaskPromotion();

  return (
    <BrowserRouter>
      <GlobalSearchBar />
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/foco" element={<Foco />} />
        <Route path="/planejamento" element={<Planejamento />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/rotina" element={<Rotina />} />
        <Route path="/operacoes" element={<Operacoes />} />
        <Route path="/conteudo" element={<Conteudo />} />
        <Route path="/task/:id" element={<TaskEdit />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <LightboxProvider>
        <Toaster />
        <Sonner />
        <AppContent />
        <LightboxRoot />
      </LightboxProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
