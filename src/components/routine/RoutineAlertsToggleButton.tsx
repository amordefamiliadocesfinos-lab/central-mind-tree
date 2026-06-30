import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ROUTINE_ALERTS_COUNT_EVENT,
  ROUTINE_ALERTS_TOGGLE_EVENT,
} from './RoutineAlertOverlay';

const HIDDEN_KEY = 'pc.routine.alerts.hidden';

export function RoutineAlertsToggleButton() {
  const [count, setCount] = useState(0);
  const [hidden, setHidden] = useState<boolean>(
    () => localStorage.getItem(HIDDEN_KEY) === 'true'
  );

  useEffect(() => {
    const onCount = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (typeof d?.count === 'number') setCount(d.count);
      if (typeof d?.hidden === 'boolean') setHidden(d.hidden);
    };
    window.addEventListener(ROUTINE_ALERTS_COUNT_EVENT, onCount);
    return () => window.removeEventListener(ROUTINE_ALERTS_COUNT_EVENT, onCount);
  }, []);

  // Hide button when there is nothing pending and alerts are visible
  if (count === 0 && !hidden) return null;

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(HIDDEN_KEY, String(next));
    window.dispatchEvent(
      new CustomEvent(ROUTINE_ALERTS_TOGGLE_EVENT, { detail: { hidden: next } })
    );
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      className="relative"
      title={hidden ? 'Mostrar alertas da rotina' : 'Ocultar alertas da rotina'}
      aria-label={hidden ? 'Mostrar alertas' : 'Ocultar alertas'}
    >
      {hidden ? (
        <BellOff className="h-5 w-5 text-muted-foreground" />
      ) : (
        <Bell className="h-5 w-5" />
      )}
      {count > 0 && (
        <Badge
          variant="destructive"
          className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
        >
          {count > 9 ? '9+' : count}
        </Badge>
      )}
    </Button>
  );
}
