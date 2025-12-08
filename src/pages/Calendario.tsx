import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Task {
  id: string;
  title: string;
  scheduled_date: string | null;
  status: string;
  node_id: string;
}

interface Node {
  id: string;
  title: string;
  color: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const STATUS_COLORS: Record<string, string> = {
  estrutural: "#8B5CF6",
  andamento: "#EF4444",
  pendente: "#F59E0B",
  "concluído": "#22C55E",
};

const Calendario = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Quick create task state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNodeId, setNewTaskNodeId] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("pendente");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tasksRes, nodesRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, scheduled_date, status, node_id")
        .not("scheduled_date", "is", null),
      supabase.from("nodes").select("id, title, color"),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (nodesRes.data) setNodes(nodesRes.data);
    setLoading(false);
  };

  const handleDayClick = (dateKey: string) => {
    setSelectedDate(dateKey);
    setNewTaskTitle("");
    setNewTaskNodeId(nodes[0]?.id || "");
    setNewTaskStatus("pendente");
    setCreateDialogOpen(true);
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || !newTaskNodeId) {
      toast.error("Preencha o título e selecione um nó");
      return;
    }

    setCreating(true);
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: newTaskTitle.trim(),
        node_id: newTaskNodeId,
        status: newTaskStatus,
        scheduled_date: selectedDate,
      })
      .select("id, title, scheduled_date, status, node_id")
      .single();

    if (error) {
      toast.error("Erro ao criar tarefa");
      setCreating(false);
      return;
    }

    if (data) {
      setTasks((prev) => [...prev, data]);
      toast.success("Tarefa criada");
    }
    setCreating(false);
    setCreateDialogOpen(false);
  };

  const nodesMap = useMemo(() => {
    const map: Record<string, Node> = {};
    nodes.forEach((n) => (map[n.id] = n));
    return map;
  }, [nodes]);

  // Group tasks by date (YYYY-MM-DD)
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      if (task.scheduled_date) {
        if (!map[task.scheduled_date]) {
          map[task.scheduled_date] = [];
        }
        map[task.scheduled_date].push(task);
      }
    });
    return map;
  }, [tasks]);

  // Get days in month
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  // Format date as YYYY-MM-DD
  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  // Get tooltip content for a day
  const getTooltipContent = (dateKey: string) => {
    const dayTasks = tasksByDate[dateKey];
    if (!dayTasks || dayTasks.length === 0) return "";
    return dayTasks.map((t) => `• ${t.title}`).join("\n");
  };

  // Check if date is today
  const isToday = (dateKey: string) => {
    const today = new Date();
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    return dateKey === todayKey;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Calendário Anual</h1>
          </div>
          
          {/* Year selector */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear((y) => y - 1)}
            >
              ←
            </Button>
            <span className="text-lg font-semibold min-w-[80px] text-center">
              {selectedYear}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedYear((y) => y + 1)}
            >
              →
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-muted-foreground capitalize">
                {status === "concluído" ? "Concluído" : status === "andamento" ? "Em Andamento" : status}
              </span>
            </div>
          ))}
        </div>

        {/* Calendar Grid - 12 months */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {MONTHS.map((monthName, monthIndex) => {
            const daysInMonth = getDaysInMonth(monthIndex, selectedYear);
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

            return (
              <div
                key={monthIndex}
                className="border rounded-lg p-3 bg-card"
              >
                <h3 className="font-semibold mb-2 text-sm">{monthName}</h3>
                <div className="grid grid-cols-7 gap-0.5">
                  {days.map((day) => {
                    const dateKey = formatDateKey(selectedYear, monthIndex, day);
                    const dayTasks = tasksByDate[dateKey] || [];
                    const hasScheduledTasks = dayTasks.length > 0;
                    const tooltipContent = getTooltipContent(dateKey);
                    const todayHighlight = isToday(dateKey);

                    // Get dominant status color (first task's status)
                    const dominantColor = hasScheduledTasks
                      ? STATUS_COLORS[dayTasks[0].status] || "#6B7280"
                      : undefined;

                    return (
                      <div
                        key={day}
                        title={tooltipContent || "Clique para agendar tarefa"}
                        onClick={() => handleDayClick(dateKey)}
                        className={`
                          relative w-6 h-6 flex items-center justify-center text-[10px] rounded cursor-pointer
                          ${todayHighlight ? "ring-2 ring-primary ring-offset-1" : ""}
                          ${hasScheduledTasks ? "hover:opacity-80" : "text-muted-foreground hover:bg-muted"}
                        `}
                        style={{
                          backgroundColor: hasScheduledTasks ? dominantColor : undefined,
                          color: hasScheduledTasks ? "white" : undefined,
                        }}
                      >
                        {day}
                        {/* Multi-task indicator */}
                        {dayTasks.length > 1 && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-background text-foreground text-[7px] rounded-full flex items-center justify-center border">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="border rounded-lg p-4 bg-card">
          <h3 className="font-semibold mb-2">Resumo {selectedYear}</h3>
          <p className="text-sm text-muted-foreground">
            {tasks.filter((t) => t.scheduled_date?.startsWith(String(selectedYear))).length} tarefa(s) agendada(s)
          </p>
        </div>
      </div>

      {/* Quick Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nova Tarefa - {selectedDate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="task-title">Título</Label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nome da tarefa"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Nó</Label>
              <Select value={newTaskNodeId} onValueChange={setNewTaskNodeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um nó" />
                </SelectTrigger>
                <SelectContent>
                  {nodes.map((node) => (
                    <SelectItem key={node.id} value={node.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: node.color }}
                        />
                        {node.title}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newTaskStatus} onValueChange={setNewTaskStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="estrutural">Estrutural</SelectItem>
                  <SelectItem value="andamento">Em Andamento</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateTask} disabled={creating}>
                {creating ? "Criando..." : "Criar Tarefa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Calendario;
