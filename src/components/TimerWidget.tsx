import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Play, Pause, RotateCcw, Clock, Focus, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TaskBar } from "./TaskBar";

type LinesMode = "off" | "resumo" | "detalhe" | "ceo";

interface TimerWidgetProps {
  linesMode: LinesMode;
  onLinesModeChange: (mode: LinesMode) => void;
}

export function TimerWidget({ linesMode, onLinesModeChange }: TimerWidgetProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState<"stopped" | "running" | "paused">("stopped");
  const [isEditing, setIsEditing] = useState(false);
  const [timeInput, setTimeInput] = useState("00:00:00");
  const intervalRef = useRef<number | null>(null);
  const stateIdRef = useRef<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTimerState();
  }, []);

  useEffect(() => {
    if (status === "running" && remainingSeconds > 0) {
      intervalRef.current = window.setInterval(() => {
        setRemainingSeconds((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            handleStop();
            toast({ title: "Timer finalizado!" });
            return 0;
          }
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status, remainingSeconds]);

  useEffect(() => {
    if (stateIdRef.current) {
      saveTimerState();
    }
  }, [remainingSeconds, status]);

  const loadTimerState = async () => {
    const { data, error } = await supabase
      .from("timer_state")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      stateIdRef.current = data.id;
      setRemainingSeconds(data.remaining_seconds);
      setStatus(data.status as "stopped" | "running" | "paused");
    }
  };

  const saveTimerState = async () => {
    if (!stateIdRef.current) return;

    await supabase
      .from("timer_state")
      .update({
        remaining_seconds: remainingSeconds,
        status: status,
        last_update: new Date().toISOString(),
      })
      .eq("id", stateIdRef.current);
  };

  const handleStart = () => {
    if (remainingSeconds > 0) {
      setStatus("running");
    } else {
      toast({
        variant: "destructive",
        title: "Defina um tempo primeiro",
      });
    }
  };

  const handlePause = () => {
    setStatus("paused");
  };

  const handleResume = () => {
    setStatus("running");
  };

  const handleStop = () => {
    setStatus("stopped");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleReset = () => {
    handleStop();
    setRemainingSeconds(0);
  };

  const handleSetTime = () => {
    const parts = timeInput.split(":");
    if (parts.length !== 3) {
      toast({
        variant: "destructive",
        title: "Formato inválido. Use hh:mm:ss",
      });
      return;
    }

    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;

    if (totalSeconds <= 0) {
      toast({
        variant: "destructive",
        title: "Tempo deve ser maior que zero",
      });
      return;
    }

    handleStop();
    setRemainingSeconds(totalSeconds);
    setIsEditing(false);
    toast({ title: "Tempo definido" });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <Card className="fixed left-5 bottom-5 z-[9999] p-4 shadow-lg min-w-[240px]">
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <TaskBar 
            linesMode={linesMode}
            onLinesModeChange={onLinesModeChange}
          />
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            title="Modo Foco"
          >
            <Link to="/foco">
              <Focus className="h-4 w-4 mr-1" />
              Foco
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 px-3 text-xs"
            title="Calendário"
          >
            <Link to="/calendario">
              <Calendar className="h-4 w-4 mr-1" />
              Cal
            </Link>
          </Button>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <Input
              placeholder="hh:mm:ss"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
              className="text-center"
            />
            <div className="flex gap-2">
              <Button onClick={handleSetTime} size="sm" className="flex-1">
                Definir
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
                size="sm"
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="text-3xl font-mono text-center py-2 cursor-pointer hover:bg-muted/50 rounded transition-colors"
              onClick={() => {
                if (status === "stopped") {
                  setIsEditing(true);
                  setTimeInput(formatTime(remainingSeconds));
                }
              }}
            >
              {formatTime(remainingSeconds)}
            </div>

            <div className="flex gap-2 flex-wrap">
              {status === "stopped" && (
                <>
                  <Button onClick={handleStart} size="sm" className="flex-1">
                    <Play className="h-4 w-4 mr-1" />
                    Iniciar
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(true);
                      setTimeInput(formatTime(remainingSeconds));
                    }}
                    size="sm"
                    variant="outline"
                  >
                    <Clock className="h-4 w-4" />
                  </Button>
                </>
              )}

              {status === "running" && (
                <Button onClick={handlePause} size="sm" className="flex-1">
                  <Pause className="h-4 w-4 mr-1" />
                  Pausar
                </Button>
              )}

              {status === "paused" && (
                <>
                  <Button onClick={handleResume} size="sm" className="flex-1">
                    <Play className="h-4 w-4 mr-1" />
                    Retomar
                  </Button>
                  <Button onClick={handleStop} size="sm" variant="outline">
                    Parar
                  </Button>
                </>
              )}

              {(status === "running" || status === "paused") && (
                <Button onClick={handleReset} size="sm" variant="outline">
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
