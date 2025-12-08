import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import TaskEdit from "./pages/TaskEdit";
import Foco from "./pages/Foco";
import Planejamento from "./pages/Planejamento";
import Calendario from "./pages/Calendario";
import NotFound from "./pages/NotFound";
import { useScheduledTaskPromotion } from "./hooks/useScheduledTaskPromotion";

const queryClient = new QueryClient();

function AppContent() {
  // Check and promote scheduled tasks on app load
  useScheduledTaskPromotion();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/foco" element={<Foco />} />
        <Route path="/planejamento" element={<Planejamento />} />
        <Route path="/calendario" element={<Calendario />} />
        <Route path="/task/:id" element={<TaskEdit />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppContent />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
