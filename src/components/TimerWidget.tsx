import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Play, Pause, RotateCcw, Clock, Focus, Calendar, Timer, ShoppingCart, FileText } from "lucide-react";
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

  // Detect timer completion via separate effect
  useEffect(() => {
    if (remainingSeconds <= 0 && status === "running") {
      handleStop();
      toast({ title: "Timer finalizado!" });
    }
  }, [remainingSeconds, status]);

  useEffect(() => {
    if (status === "running") {
      intervalRef.current = window.setInterval(() => {
        setRemainingSeconds((prev) => Math.max(prev - 1, 0));
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
  }, [status]);

  const statusRef = useRef(status);
  statusRef.current = status;
  const remainingRef = useRef(remainingSeconds);
  remainingRef.current = remainingSeconds;

  // Save periodically (every 5s) instead of every tick
  useEffect(() => {
    if (!stateIdRef.current) return;
    // Save immediately on status change
    saveTimerState();
  }, [status]);

  useEffect(() => {
    if (!stateIdRef.current || status !== 'running') return;
    const saveInterval = window.setInterval(() => {
      saveTimerState();
    }, 5000);
    return () => clearInterval(saveInterval);
  }, [status]);

  const loadTimerState = async () => {
    const { data, error } = await supabase
      .from("timer_state")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      stateIdRef.current = data.id;
      const savedStatus = data.status as "stopped" | "running" | "paused";

      if (savedStatus === "running" && data.last_update) {
        const elapsedSinceLastSave = Math.floor(
          (Date.now() - new Date(data.last_update).getTime()) / 1000
        );
        const adjusted = data.remaining_seconds - elapsedSinceLastSave;

        if (adjusted <= 0) {
          setRemainingSeconds(0);
          setStatus("stopped");
          await supabase
            .from("timer_state")
            .update({ remaining_seconds: 0, status: "stopped", last_update: new Date().toISOString() })
            .eq("id", data.id);
          toast({ title: "Timer finalizado!" });
        } else {
          setRemainingSeconds(adjusted);
          setStatus("running");
        }
      } else {
        setRemainingSeconds(data.remaining_seconds);
        setStatus(savedStatus);
      }
    }
  };

  const saveTimerState = async () => {
    if (!stateIdRef.current) return;

    await supabase
      .from("timer_state")
      .update({
        remaining_seconds: remainingRef.current,
        status: statusRef.current,
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
    <div className="fixed bottom-0 left-0 right-0 z-[9999] h-12 bg-background border-t border-border shadow-lg">
      <div className="h-full flex items-center justify-between px-4 gap-4">
        {/* Left section: Navigation and TaskBar */}
        <div className="flex items-center gap-2">
          <TaskBar 
            linesMode={linesMode}
            onLinesModeChange={onLinesModeChange}
          />
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
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
            variant="ghost"
            className="h-8 px-2 text-xs"
            title="Calendário"
          >
            <Link to="/calendario">
              <Calendar className="h-4 w-4 mr-1" />
              Cal
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            title="Rotina"
          >
            <Link to="/rotina">
              <Timer className="h-4 w-4 mr-1" />
              Rotina
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            title="Operações"
          >
            <Link to="/operacoes">
              <ShoppingCart className="h-4 w-4 mr-1" />
              Ops
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            title="Conteúdo"
          >
            <Link to="/conteudo">
              <FileText className="h-4 w-4 mr-1" />
              Post
            </Link>
          </Button>
        </div>

        {/* Center section: Timer display and controls */}
        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                placeholder="hh:mm:ss"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                className="text-center w-24 h-8 text-sm"
              />
              <Button onClick={handleSetTime} size="sm" className="h-8 px-3">
                OK
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
                size="sm"
                variant="ghost"
                className="h-8 px-2"
              >
                ✕
              </Button>
            </div>
          ) : (
            <>
              <div
                className="text-xl font-mono cursor-pointer hover:text-primary transition-colors px-2"
                onClick={() => {
                  if (status === "stopped") {
                    setIsEditing(true);
                    setTimeInput(formatTime(remainingSeconds));
                  }
                }}
                title={status === "stopped" ? "Clique para ajustar tempo" : undefined}
              >
                {formatTime(remainingSeconds)}
              </div>

              <div className="flex items-center gap-1">
                {status === "stopped" && (
                  <>
                    <Button onClick={handleStart} size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(true);
                        setTimeInput(formatTime(remainingSeconds));
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </>
                )}

                {status === "running" && (
                  <Button onClick={handlePause} size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <Pause className="h-4 w-4" />
                  </Button>
                )}

                {status === "paused" && (
                  <>
                    <Button onClick={handleResume} size="sm" variant="ghost" className="h-8 w-8 p-0">
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleStop} size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive">
                      ■
                    </Button>
                  </>
                )}

                {(status === "running" || status === "paused") && (
                  <Button onClick={handleReset} size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right section: Spacer for balance */}
        <div className="w-32" />
      </div>
    </div>
  );
}
