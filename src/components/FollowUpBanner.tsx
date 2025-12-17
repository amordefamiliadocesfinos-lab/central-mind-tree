import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, ExternalLink } from "lucide-react";
import { useOnHold } from "@/hooks/useOnHold";
import { format, parseISO, isToday, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FollowUpTask {
  id: string;
  title: string;
  on_hold_who: string | null;
  on_hold_channel: string | null;
  on_hold_deadline: string | null;
  on_hold_note: string | null;
  node_id: string;
}

export const FollowUpBanner = () => {
  const navigate = useNavigate();
  const { getTodayFollowUps } = useOnHold();
  const [followUps, setFollowUps] = useState<FollowUpTask[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const loadFollowUps = async () => {
      const tasks = await getTodayFollowUps();
      setFollowUps(tasks as FollowUpTask[]);
    };
    loadFollowUps();
  }, [getTodayFollowUps]);

  // Check snooze
  const snoozeKey = "pc.followup.snooze";
  const today = new Date().toISOString().split("T")[0];
  const snoozedToday = localStorage.getItem(snoozeKey) === today;

  if (dismissed || snoozedToday || followUps.length === 0) {
    return null;
  }

  const handleSnooze = () => {
    localStorage.setItem(snoozeKey, today);
    setDismissed(true);
  };

  const overdueCount = followUps.filter(
    (t) => t.on_hold_deadline && isBefore(parseISO(t.on_hold_deadline), new Date()) && !isToday(parseISO(t.on_hold_deadline))
  ).length;

  const todayCount = followUps.filter(
    (t) => t.on_hold_deadline && isToday(parseISO(t.on_hold_deadline))
  ).length;

  return (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="font-medium text-blue-700 dark:text-blue-300">
              Follow-up de Hoje
            </h3>
            <p className="text-sm text-muted-foreground">
              {followUps.length} tarefa(s) aguardando retorno
              {overdueCount > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {overdueCount} atrasada(s)
                </Badge>
              )}
              {todayCount > 0 && (
                <Badge className="ml-2 text-xs bg-amber-500">
                  {todayCount} para hoje
                </Badge>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Ocultar" : "Ver"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSnooze}>
            Adiar hoje
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDismissed(true)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2">
          {followUps.map((task) => {
            const deadline = task.on_hold_deadline ? parseISO(task.on_hold_deadline) : null;
            const isOverdue = deadline && isBefore(deadline, new Date()) && !isToday(deadline);
            const isDueToday = deadline && isToday(deadline);

            return (
              <div
                key={task.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  isOverdue 
                    ? "border-destructive/30 bg-destructive/5" 
                    : isDueToday 
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{task.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {task.on_hold_who && `Aguardando: ${task.on_hold_who}`}
                    {task.on_hold_channel && ` via ${task.on_hold_channel}`}
                    {deadline && (
                      <span className={isOverdue ? "text-destructive ml-2" : isDueToday ? "text-amber-500 ml-2" : " ml-2"}>
                        • Prazo: {format(deadline, "dd/MM", { locale: ptBR })}
                        {isOverdue && " (atrasado)"}
                        {isDueToday && " (hoje)"}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/task/${task.id}`)}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
