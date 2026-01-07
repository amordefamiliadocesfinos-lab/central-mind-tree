import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Play, Pause, RotateCcw, Clock, Focus, Calendar, Timer, 
  ShoppingCart, FileText, Undo2, Redo2, Home, FileSpreadsheet,
  Users, User, UsersRound, DollarSign
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUndoRedoContext } from "@/contexts/UndoRedoContext";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLinesMode } from "@/contexts/LinesModeContext";
import { CollaboratorsPanel } from "./CollaboratorsPanel";

interface Task {
  id: string;
  status: "estrutural" | "andamento" | "pendente" | "concluído";
}

// Timer sound - simple beep using Web Audio API
function playAlertSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = "sine";
    gainNode.gain.value = 0.3;

    oscillator.start();
    
    // Beep pattern: 3 short beeps
    setTimeout(() => { gainNode.gain.value = 0; }, 200);
    setTimeout(() => { gainNode.gain.value = 0.3; }, 400);
    setTimeout(() => { gainNode.gain.value = 0; }, 600);
    setTimeout(() => { gainNode.gain.value = 0.3; }, 800);
    setTimeout(() => { 
      oscillator.stop();
      audioCtx.close();
    }, 1000);
  } catch (e) {
    console.error('Failed to play sound:', e);
  }
}

export function GlobalFooterBar() {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [status, setStatus] = useState<"stopped" | "running" | "paused">("stopped");
  const [isEditing, setIsEditing] = useState(false);
  const [timeInput, setTimeInput] = useState("00:00:00");
  const [stateId, setStateId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [collaboratorsOpen, setCollaboratorsOpen] = useState(false);
  const location = useLocation();
  const { toast } = useToast();
  const { undo, redo, canUndo, canRedo } = useUndoRedoContext();
  const { notify, requestPermission, permission } = useNotifications();
  const isMobile = useIsMobile();
  const { linesMode, setLinesMode, showTaskBar } = useLinesMode();

  // Fetch tasks for status counters
  useEffect(() => {
    if (!showTaskBar) return;
    
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, status")
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTasks(data as Task[]);
      }
    };

    fetchTasks();

    const channel = supabase
      .channel('tasks-footer')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showTaskBar]);

  const statusCounts = {
    estrutural: tasks.filter(t => t.status === "estrutural").length,
    andamento: tasks.filter(t => t.status === "andamento").length,
    pendente: tasks.filter(t => t.status === "pendente").length,
    concluído: tasks.filter(t => t.status === "concluído").length,
  };

  // Load timer state from DB
  useEffect(() => {
    loadTimerState();
  }, []);

  // Timer countdown logic
  useEffect(() => {
    let intervalId: number | null = null;

    if (status === "running" && remainingSeconds > 0) {
      intervalId = window.setInterval(() => {
        setRemainingSeconds((prev) => {
          const next = prev - 1;
          if (next <= 0) {
            handleTimerComplete();
            return 0;
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, remainingSeconds]);

  // Save timer state when it changes
  useEffect(() => {
    if (stateId) {
      saveTimerState();
    }
  }, [remainingSeconds, status, stateId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Ctrl/Cmd + Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Alt + 1 = Home
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        window.location.href = '/';
      }
      // Alt + 2 = Foco
      if (e.altKey && e.key === '2') {
        e.preventDefault();
        window.location.href = '/foco';
      }
      // Alt + 3 = Calendar
      if (e.altKey && e.key === '3') {
        e.preventDefault();
        window.location.href = '/calendario';
      }
      // Alt + 4 = Rotina
      if (e.altKey && e.key === '4') {
        e.preventDefault();
        window.location.href = '/rotina';
      }
      // Space = Start/Pause timer (only on certain pages)
      if (e.code === 'Space' && location.pathname === '/foco') {
        // Already handled in Foco page
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, location.pathname]);

  const loadTimerState = async () => {
    const { data, error } = await supabase
      .from("timer_state")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      setStateId(data.id);
      setRemainingSeconds(data.remaining_seconds);
      setStatus(data.status as "stopped" | "running" | "paused");
    }
  };

  const saveTimerState = async () => {
    if (!stateId) return;

    await supabase
      .from("timer_state")
      .update({
        remaining_seconds: remainingSeconds,
        status: status,
        last_update: new Date().toISOString(),
      })
      .eq("id", stateId);
  };

  const handleTimerComplete = () => {
    setStatus("stopped");
    
    // Play sound
    playAlertSound();
    
    // Show notification (works even in other tabs)
    notify("Timer finalizado!", {
      body: "Seu tempo de foco terminou.",
      tag: "timer-complete",
    });

    toast({ title: "Timer finalizado!" });
  };

  const handleStart = async () => {
    if (remainingSeconds > 0) {
      // Request notification permission on first start
      if (permission === 'default') {
        await requestPermission();
      }
      setStatus("running");
    } else {
      toast({
        variant: "destructive",
        title: "Defina um tempo primeiro",
      });
    }
  };

  const handlePause = () => setStatus("paused");
  const handleResume = () => setStatus("running");
  
  const handleStop = () => {
    setStatus("stopped");
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

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] h-12 bg-background border-t border-border shadow-lg">
      <div className="h-full flex items-center justify-between px-2 md:px-4 gap-1 md:gap-4">
        {/* Left: Task status counters + Lines mode (only when showTaskBar is true) */}
        {showTaskBar && tasks.length > 0 ? (
          <div className="flex items-center gap-1">
            {/* Status counter buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.estrutural > 0 ? "bg-node-roxo text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.estrutural}
                </button>
              </TooltipTrigger>
              <TooltipContent>Estrutural</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.andamento > 0 ? "bg-node-vermelho text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.andamento}
                </button>
              </TooltipTrigger>
              <TooltipContent>Em andamento</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.pendente > 0 ? "bg-node-amarelo text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.pendente}
                </button>
              </TooltipTrigger>
              <TooltipContent>Pendente</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-6 w-6 md:h-7 md:w-7 rounded-full flex items-center justify-center text-[10px] md:text-xs font-semibold",
                    statusCounts.concluído > 0 ? "bg-node-verde text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {statusCounts.concluído}
                </button>
              </TooltipTrigger>
              <TooltipContent>Concluído</TooltipContent>
            </Tooltip>

            {/* Divider */}
            <div className="h-4 w-px bg-border mx-0.5" />

            {/* Lines mode selector */}
            <div className="flex items-center gap-0.5 bg-muted rounded p-0.5">
              <button
                onClick={() => setLinesMode("off")}
                className={cn(
                  "px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded transition-colors",
                  linesMode === "off" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Off
              </button>
              <button
                onClick={() => setLinesMode("resumo")}
                className={cn(
                  "px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded transition-colors",
                  linesMode === "resumo" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isMobile ? "L" : "Linhas"}
              </button>
              <button
                onClick={() => setLinesMode("ceo")}
                className={cn(
                  "px-1.5 md:px-2 py-0.5 text-[10px] md:text-xs rounded transition-colors",
                  linesMode === "ceo" 
                    ? "bg-node-vermelho text-white shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                CEO
              </button>
            </div>
          </div>
        ) : (
          /* Left: Undo/Redo (when no TaskBar) */
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => undo()} 
                  disabled={!canUndo}
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Desfazer (Ctrl+Z)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  onClick={() => redo()} 
                  disabled={!canRedo}
                  size="sm" 
                  variant="ghost" 
                  className="h-8 w-8 p-0"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refazer (Ctrl+Y)</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Center: Navigation */}
        <div className="flex items-center gap-0.5 md:gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant={isActive('/') ? 'secondary' : 'ghost'}
                className={cn("h-8 w-8 md:w-auto md:px-3 p-0 md:p-2 text-xs", isActive('/') && "bg-secondary")}
              >
                <Link to="/">
                  <Home className="h-4 w-4" />
                  <span className="hidden md:inline ml-1">Início</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alt+1</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant={isActive('/foco') ? 'secondary' : 'ghost'}
                className={cn("h-8 w-8 md:w-auto md:px-3 p-0 md:p-2 text-xs", isActive('/foco') && "bg-secondary")}
              >
                <Link to="/foco">
                  <Focus className="h-4 w-4" />
                  <span className="hidden md:inline ml-1">FOCO</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alt+2</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant={isActive('/calendario') ? 'secondary' : 'ghost'}
                className={cn("h-8 w-8 md:w-auto md:px-3 p-0 md:p-2 text-xs", isActive('/calendario') && "bg-secondary")}
              >
                <Link to="/calendario">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden md:inline ml-1">CAL</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alt+3</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant={isActive('/rotina') ? 'secondary' : 'ghost'}
                className={cn("h-8 w-8 md:w-auto md:px-3 p-0 md:p-2 text-xs", isActive('/rotina') && "bg-secondary")}
              >
                <Link to="/rotina">
                  <Timer className="h-4 w-4" />
                  <span className="hidden md:inline ml-1">ROTINA</span>
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Alt+4</TooltipContent>
          </Tooltip>

          <Button
            asChild
            size="sm"
            variant={isActive('/operacoes') ? 'secondary' : 'ghost'}
            className={cn("h-8 w-8 p-0", isActive('/operacoes') && "bg-secondary")}
          >
            <Link to="/operacoes">
              <ShoppingCart className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            variant={isActive('/conteudo') ? 'secondary' : 'ghost'}
            className={cn("h-8 w-8 p-0", isActive('/conteudo') && "bg-secondary")}
          >
            <Link to="/conteudo">
              <FileText className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            variant={isActive('/planilhas') ? 'secondary' : 'ghost'}
            className={cn("h-8 w-8 p-0", isActive('/planilhas') && "bg-secondary")}
          >
            <Link to="/planilhas">
              <FileSpreadsheet className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            variant={isActive('/reunioes') ? 'secondary' : 'ghost'}
            className={cn("h-8 w-8 p-0", isActive('/reunioes') && "bg-secondary")}
          >
            <Link to="/reunioes">
              <Users className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="sm"
            variant={isActive('/minha-area') ? 'secondary' : 'ghost'}
            className={cn("h-8 w-8 p-0", isActive('/minha-area') && "bg-secondary")}
          >
            <Link to="/minha-area">
              <User className="h-4 w-4" />
            </Link>
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                size="sm"
                variant={isActive('/financeiro') ? 'secondary' : 'ghost'}
                className={cn("h-8 w-8 p-0", isActive('/financeiro') && "bg-secondary")}
              >
                <Link to="/financeiro">
                  <DollarSign className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Financeiro</TooltipContent>
          </Tooltip>

          {/* Collaborators button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant={collaboratorsOpen ? 'secondary' : 'ghost'}
                className={cn("h-8 w-8 p-0", collaboratorsOpen && "bg-secondary")}
                onClick={() => setCollaboratorsOpen(true)}
              >
                <UsersRound className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Colaboradores</TooltipContent>
          </Tooltip>
        </div>

        {/* Collaborators Panel */}
        <CollaboratorsPanel 
          open={collaboratorsOpen} 
          onOpenChange={setCollaboratorsOpen} 
        />

        {/* Right: Timer */}
        <div className="flex items-center gap-1 md:gap-2">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <Input
                placeholder="hh:mm:ss"
                value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetTime()}
                className="text-center w-16 md:w-20 h-7 text-xs"
                autoFocus
              />
              <Button onClick={handleSetTime} size="sm" className="h-7 px-2 text-xs">
                OK
              </Button>
              <Button
                onClick={() => setIsEditing(false)}
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0"
              >
                ✕
              </Button>
            </div>
          ) : (
            <>
              <div
                className={cn(
                  "text-sm md:text-lg font-mono cursor-pointer hover:text-primary transition-colors px-1 md:px-2",
                  status === "running" && "text-primary"
                )}
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

              <div className="flex items-center gap-0.5">
                {status === "stopped" && (
                  <>
                    <Button onClick={handleStart} size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    {!isMobile && (
                      <Button
                        onClick={() => {
                          setIsEditing(true);
                          setTimeInput(formatTime(remainingSeconds));
                        }}
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}

                {status === "running" && (
                  <Button onClick={handlePause} size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <Pause className="h-3.5 w-3.5" />
                  </Button>
                )}

                {status === "paused" && (
                  <>
                    <Button onClick={handleResume} size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button onClick={handleStop} size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive">
                      ■
                    </Button>
                  </>
                )}

                {(status === "running" || status === "paused") && (
                  <Button onClick={handleReset} size="sm" variant="ghost" className="h-7 w-7 p-0">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
