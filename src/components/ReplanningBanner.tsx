import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, X, Wand2 } from "lucide-react";
import { useReplanningReminder } from "@/hooks/useReplanningReminder";
import { ReplanningWizard } from "./ReplanningWizard";

export const ReplanningBanner = () => {
  const { showReminder, snoozeToday, shouldAutoOpen, markAutoOpened } = useReplanningReminder();
  const [wizardOpen, setWizardOpen] = useState(false);

  // Auto-open wizard on first visit of the day/week
  useEffect(() => {
    if (shouldAutoOpen && showReminder && !wizardOpen) {
      setWizardOpen(true);
      markAutoOpened();
    }
  }, [shouldAutoOpen, showReminder, wizardOpen, markAutoOpened]);

  if (!showReminder) return null;

  return (
    <>
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[10000] bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-in slide-in-from-top-2">
        <Calendar className="h-5 w-5 flex-shrink-0" />
        <span className="font-medium">Hora de planejar a semana!</span>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setWizardOpen(true)}>
            <Wand2 className="h-4 w-4 mr-1" />
            Replanejar
          </Button>
          <Link to="/planejamento">
            <Button size="sm" variant="ghost" className="text-primary-foreground hover:text-primary-foreground/80">
              Abrir Planejamento
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={snoozeToday} className="text-primary-foreground hover:text-primary-foreground/80">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ReplanningWizard open={wizardOpen} onOpenChange={setWizardOpen} />
    </>
  );
};
