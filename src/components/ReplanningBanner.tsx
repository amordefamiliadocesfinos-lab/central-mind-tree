import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, X } from "lucide-react";
import { useReplanningReminder } from "@/hooks/useReplanningReminder";

export const ReplanningBanner = () => {
  const { showReminder, snoozeToday } = useReplanningReminder();

  if (!showReminder) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-in slide-in-from-top-2">
      <Calendar className="h-5 w-5 flex-shrink-0" />
      <span className="font-medium">Hora de planejar a semana!</span>
      <div className="flex gap-2">
        <Link to="/planejamento">
          <Button size="sm" variant="secondary">
            Abrir Planejamento
          </Button>
        </Link>
        <Button size="sm" variant="ghost" onClick={snoozeToday}>
          <X className="h-4 w-4 mr-1" />
          Adiar hoje
        </Button>
      </div>
    </div>
  );
};
