import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Users } from "lucide-react";
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
import { DayTasksModal } from "@/components/DayTasksModal";
import { useMeetings, Meeting } from "@/hooks/useMeetings";

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

const MEETING_COLOR = "#0EA5E9"; // Sky blue for meetings

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
  
  // Day tasks modal state
  const [dayTasksModalOpen, setDayTasksModalOpen] = useState(false);
  const [dayTasksModalDate, setDayTasksModalDate] = useState<string>("");

  // Meetings integration
  const { meetings, users, updateMeeting, createMeeting, fetchMeetings } = useMeetings();
  const navigate = useNavigate();
  
  // Drag state for meetings
  const [draggingMeeting, setDraggingMeeting] = useState<Meeting | null>(null);
  const draggedRef = useRef<string | null>(null);

  // Create choice dialog (task or meeting)
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  
  // Create meeting dialog state
  const [createMeetingDialogOpen, setCreateMeetingDialogOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("09:00");
  const [newMeetingDuration, setNewMeetingDuration] = useState(60);
  const [newMeetingOwnerId, setNewMeetingOwnerId] = useState("");
  const [creatingMeeting, setCreatingMeeting] = useState(false);

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
    const dayTasks = tasksByDate[dateKey] || [];
    const dayMeetings = meetingsByDate[dateKey] || [];
    
    if (dayTasks.length > 0 || dayMeetings.length > 0) {
      // Se há tarefas ou reuniões, abrir modal de visualização
      setDayTasksModalDate(dateKey);
      setDayTasksModalOpen(true);
    } else {
      // Se não há nada, abrir dialog de escolha
      setSelectedDate(dateKey);
      setChoiceDialogOpen(true);
    }
  };

  const handleChooseTask = () => {
    setChoiceDialogOpen(false);
    setNewTaskTitle("");
    setNewTaskNodeId(nodes[0]?.id || "");
    setNewTaskStatus("pendente");
    setCreateDialogOpen(true);
  };

  const handleChooseMeeting = () => {
    setChoiceDialogOpen(false);
    setNewMeetingTitle("");
    setNewMeetingTime("09:00");
    setNewMeetingDuration(60);
    setNewMeetingOwnerId(users[0]?.id || "");
    setCreateMeetingDialogOpen(true);
  };

  const handleCreateMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      toast.error("Preencha o título da reunião");
      return;
    }

    setCreatingMeeting(true);
    const result = await createMeeting({
      title: newMeetingTitle.trim(),
      meeting_date: selectedDate,
      start_time: newMeetingTime,
      duration_minutes: newMeetingDuration,
      owner_id: newMeetingOwnerId || undefined,
    });

    if (result) {
      toast.success("Reunião criada");
      setCreateMeetingDialogOpen(false);
    } else {
      toast.error("Erro ao criar reunião");
    }
    setCreatingMeeting(false);
  };

  const handleOpenCreateFromModal = () => {
    setDayTasksModalOpen(false);
    setSelectedDate(dayTasksModalDate);
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

  // Group meetings by date
  const meetingsByDate = useMemo(() => {
    const map: Record<string, Meeting[]> = {};
    meetings.forEach((meeting) => {
      if (meeting.meeting_date) {
        if (!map[meeting.meeting_date]) {
          map[meeting.meeting_date] = [];
        }
        map[meeting.meeting_date].push(meeting);
      }
    });
    return map;
  }, [meetings]);

  // Handle meeting drag start
  const handleMeetingDragStart = (e: React.DragEvent, meeting: Meeting) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', meeting.id);
    draggedRef.current = meeting.id;
    setDraggingMeeting(meeting);
  };

  // Handle meeting drag end
  const handleMeetingDragEnd = () => {
    draggedRef.current = null;
    setDraggingMeeting(null);
  };

  // Handle drop on a day
  const handleDrop = async (e: React.DragEvent, dateKey: string) => {
    e.preventDefault();
    const meetingId = e.dataTransfer.getData('text/plain');
    
    if (meetingId && draggingMeeting) {
      const result = await updateMeeting(meetingId, { meeting_date: dateKey });
      if (result) {
        toast.success(`Reunião reagendada para ${dateKey}`);
        await fetchMeetings();
      } else {
        toast.error("Erro ao reagendar reunião");
      }
    }
    
    setDraggingMeeting(null);
    draggedRef.current = null;
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

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
    const dayTasks = tasksByDate[dateKey] || [];
    const dayMeetings = meetingsByDate[dateKey] || [];
    const lines: string[] = [];
    
    if (dayMeetings.length > 0) {
      lines.push('📅 Reuniões:');
      dayMeetings.forEach(m => lines.push(`  • ${m.title} (${m.start_time.slice(0, 5)})`));
    }
    
    if (dayTasks.length > 0) {
      if (lines.length > 0) lines.push('');
      lines.push('📋 Tarefas:');
      dayTasks.forEach(t => lines.push(`  • ${t.title}`));
    }
    
    return lines.join('\n');
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
          {/* Meeting legend */}
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: MEETING_COLOR }}
            />
            <span className="text-muted-foreground">Reunião</span>
          </div>
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
                    const dayMeetings = meetingsByDate[dateKey] || [];
                    const hasScheduledTasks = dayTasks.length > 0;
                    const hasMeetings = dayMeetings.length > 0;
                    const hasContent = hasScheduledTasks || hasMeetings;
                    const tooltipContent = getTooltipContent(dateKey);
                    const todayHighlight = isToday(dateKey);
                    const totalItems = dayTasks.length + dayMeetings.length;

                    // Priority: meeting > task status
                    const dominantColor = hasMeetings 
                      ? MEETING_COLOR 
                      : hasScheduledTasks
                        ? STATUS_COLORS[dayTasks[0].status] || "#6B7280"
                        : undefined;

                    return (
                      <div
                        key={day}
                        title={tooltipContent || "Clique para agendar tarefa"}
                        onClick={() => handleDayClick(dateKey)}
                        onDrop={(e) => handleDrop(e, dateKey)}
                        onDragOver={handleDragOver}
                        className={`
                          relative w-6 h-6 flex items-center justify-center text-[10px] rounded cursor-pointer
                          ${todayHighlight ? "ring-2 ring-primary ring-offset-1" : ""}
                          ${hasContent ? "hover:opacity-80" : "text-muted-foreground hover:bg-muted"}
                          ${draggingMeeting ? "hover:ring-2 hover:ring-primary/50" : ""}
                        `}
                        style={{
                          backgroundColor: hasContent ? dominantColor : undefined,
                          color: hasContent ? "white" : undefined,
                        }}
                      >
                        {day}
                        {/* Multi-item indicator */}
                        {totalItems > 1 && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-background text-foreground text-[7px] rounded-full flex items-center justify-center border">
                            {totalItems}
                          </span>
                        )}
                        {/* Meeting indicator */}
                        {hasMeetings && !hasScheduledTasks && (
                          <Users className="absolute -bottom-0.5 -right-0.5 w-2 h-2 text-white" />
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
          <div className="flex gap-6 text-sm text-muted-foreground">
            <p>{tasks.filter((t) => t.scheduled_date?.startsWith(String(selectedYear))).length} tarefa(s) agendada(s)</p>
            <p>{meetings.filter((m) => m.meeting_date?.startsWith(String(selectedYear))).length} reunião(ões)</p>
          </div>
        </div>

        {/* Meetings list for drag */}
        {meetings.filter(m => m.meeting_date?.startsWith(String(selectedYear))).length > 0 && (
          <div className="border rounded-lg p-4 bg-card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Reuniões de {selectedYear}
              <span className="text-xs text-muted-foreground font-normal">(arraste para reagendar)</span>
            </h3>
            <div className="flex flex-wrap gap-2">
              {meetings
                .filter(m => m.meeting_date?.startsWith(String(selectedYear)))
                .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date))
                .map(meeting => (
                  <div
                    key={meeting.id}
                    draggable
                    onDragStart={(e) => handleMeetingDragStart(e, meeting)}
                    onDragEnd={handleMeetingDragEnd}
                    onClick={() => navigate(`/reunioes/${meeting.id}`)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium text-white cursor-move hover:opacity-80 transition-opacity flex items-center gap-2"
                    style={{ backgroundColor: MEETING_COLOR }}
                  >
                    <span>{meeting.meeting_date.slice(5, 10).replace('-', '/')}</span>
                    <span className="max-w-[120px] truncate">{meeting.title}</span>
                    <span className="opacity-75">{meeting.start_time.slice(0, 5)}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
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

      {/* Choice Dialog - Task or Meeting */}
      <Dialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>O que deseja criar?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Data selecionada: {selectedDate}
          </p>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-20 flex-col gap-2"
              onClick={handleChooseTask}
            >
              <Plus className="h-6 w-6" />
              <span>Tarefa</span>
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 h-20 flex-col gap-2"
              onClick={handleChooseMeeting}
            >
              <Users className="h-6 w-6" />
              <span>Reunião</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Meeting Dialog */}
      <Dialog open={createMeetingDialogOpen} onOpenChange={setCreateMeetingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Nova Reunião - {selectedDate}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="meeting-title">Título</Label>
              <Input
                id="meeting-title"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                placeholder="Nome da reunião"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meeting-time">Horário</Label>
                <Input
                  id="meeting-time"
                  type="time"
                  value={newMeetingTime}
                  onChange={(e) => setNewMeetingTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Duração</Label>
                <Select 
                  value={String(newMeetingDuration)} 
                  onValueChange={(v) => setNewMeetingDuration(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">1 hora</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                    <SelectItem value="120">2 horas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {users.length > 0 && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={newMeetingOwnerId} onValueChange={setNewMeetingOwnerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateMeetingDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateMeeting} disabled={creatingMeeting}>
                {creatingMeeting ? "Criando..." : "Criar Reunião"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Day Tasks Modal */}
      <DayTasksModal
        isOpen={dayTasksModalOpen}
        onClose={() => setDayTasksModalOpen(false)}
        date={dayTasksModalDate}
        tasks={tasksByDate[dayTasksModalDate] || []}
        nodesMap={nodesMap}
        onTaskUpdated={loadData}
      />
    </div>
  );
};

export default Calendario;
