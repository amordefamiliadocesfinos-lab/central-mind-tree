import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Users, ChevronLeft, ChevronRight, Calendar, Sparkles } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { DayTasksModal } from "@/components/DayTasksModal";
import { useMeetings, Meeting } from "@/hooks/useMeetings";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useSeasonalDays, SeasonalDay, SeasonalOccurrence } from "@/hooks/useSeasonalDays";
import { SeasonalDayModal, SeasonalDaysList, SeasonalBadge, SeasonalEventDialog } from "@/components/seasonal";

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

interface DigitalVariation {
  id: string;
  title: string | null;
  platform: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  status: string;
  idea_id: string;
  idea_title?: string;
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const MONTHS_SHORT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

const STATUS_COLORS: Record<string, string> = {
  estrutural: "#8B5CF6",
  andamento: "#EF4444",
  pendente: "#F59E0B",
  "concluído": "#22C55E",
};

const MEETING_COLOR = "#0EA5E9";
const DIGITAL_COLOR = "#EC4899"; // Pink for digital content

const Calendario = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [digitalVariations, setDigitalVariations] = useState<DigitalVariation[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const isMobile = useIsMobile();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskNodeId, setNewTaskNodeId] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState("pendente");
  const [creating, setCreating] = useState(false);
  
  const [dayTasksModalOpen, setDayTasksModalOpen] = useState(false);
  const [dayTasksModalDate, setDayTasksModalDate] = useState<string>("");

  const { meetings, users, updateMeeting, createMeeting, fetchMeetings } = useMeetings();
  const navigate = useNavigate();
  
  const [draggingMeeting, setDraggingMeeting] = useState<Meeting | null>(null);
  const draggedRef = useRef<string | null>(null);

  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  
  const [createMeetingDialogOpen, setCreateMeetingDialogOpen] = useState(false);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("09:00");
  const [newMeetingDuration, setNewMeetingDuration] = useState(60);
  const [newMeetingOwnerId, setNewMeetingOwnerId] = useState("");
  const [creatingMeeting, setCreatingMeeting] = useState(false);

  // Seasonal Days
  const {
    seasonalDays,
    createSeasonalDay,
    updateSeasonalDay,
    deleteSeasonalDay,
    getOccurrencesForYear,
    getOccurrencesForDate,
  } = useSeasonalDays();
  const [showSeasonalDays, setShowSeasonalDays] = useState(true);
  const [seasonalModalOpen, setSeasonalModalOpen] = useState(false);
  const [editingSeasonal, setEditingSeasonal] = useState<SeasonalDay | null>(null);
  const [seasonalDefaultDate, setSeasonalDefaultDate] = useState<string>("");
  const [seasonalFilterImportance, setSeasonalFilterImportance] = useState<number | null>(null);
  const [seasonalEventDialogOpen, setSeasonalEventDialogOpen] = useState(false);
  const [seasonalEventDate, setSeasonalEventDate] = useState<string>("");
  const [seasonalEventActive, setSeasonalEventActive] = useState<SeasonalDay | null>(null);
  const [seasonalEventList, setSeasonalEventList] = useState<SeasonalDay[]>([]);
  const [ideaCountsBySeasonal, setIdeaCountsBySeasonal] = useState<Record<string, number>>({});

  const fetchIdeaCounts = async () => {
    const { data } = await supabase
      .from('digital_ideas')
      .select('seasonal_day_id')
      .not('seasonal_day_id', 'is', null);
    const counts: Record<string, number> = {};
    (data || []).forEach((r: any) => {
      counts[r.seasonal_day_id] = (counts[r.seasonal_day_id] || 0) + 1;
    });
    setIdeaCountsBySeasonal(counts);
  };

  useEffect(() => {
    fetchIdeaCounts();
    const ch = supabase
      .channel('cal-seasonal-ideas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'digital_ideas' }, fetchIdeaCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const openSeasonalEventDialog = (dateKey: string, events: SeasonalDay[]) => {
    setSeasonalEventDate(dateKey);
    setSeasonalEventList(events);
    setSeasonalEventActive(events[0] || null);
    setSeasonalEventDialogOpen(true);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [tasksRes, nodesRes, digitalRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, scheduled_date, status, node_id")
        .not("scheduled_date", "is", null),
      supabase.from("nodes").select("id, title, color"),
      supabase
        .from("digital_variations")
        .select("id, title, platform, scheduled_date, scheduled_time, status, idea_id, digital_ideas!inner(title)")
        .not("scheduled_date", "is", null),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (nodesRes.data) setNodes(nodesRes.data);
    if (digitalRes.data) {
      setDigitalVariations(digitalRes.data.map(v => ({
        ...v,
        idea_title: (v as any).digital_ideas?.title,
      })));
    }
    setLoading(false);
  };

  const handleDayClick = (dateKey: string) => {
    const dayTasks = tasksByDate[dateKey] || [];
    const dayMeetings = meetingsByDate[dateKey] || [];
    const dayDigital = digitalByDate[dateKey] || [];
    
    if (dayTasks.length > 0 || dayMeetings.length > 0 || dayDigital.length > 0) {
      setDayTasksModalDate(dateKey);
      setDayTasksModalOpen(true);
    } else {
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

  const digitalByDate = useMemo(() => {
    const map: Record<string, DigitalVariation[]> = {};
    digitalVariations.forEach((v) => {
      if (v.scheduled_date) {
        if (!map[v.scheduled_date]) {
          map[v.scheduled_date] = [];
        }
        map[v.scheduled_date].push(v);
      }
    });
    return map;
  }, [digitalVariations]);

  // Seasonal occurrences by date for quick lookup
  const seasonalOccurrences = useMemo(() => {
    return getOccurrencesForYear(selectedYear);
  }, [selectedYear, getOccurrencesForYear]);

  const seasonalByDate = useMemo(() => {
    const map: Record<string, SeasonalOccurrence[]> = {};
    seasonalOccurrences.forEach((occ) => {
      if (occ.isRange && occ.endDate) {
        // Add to all dates in range
        let current = new Date(occ.date);
        const end = new Date(occ.endDate);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(occ);
          current.setDate(current.getDate() + 1);
        }
      } else {
        if (!map[occ.date]) map[occ.date] = [];
        map[occ.date].push(occ);
      }
    });
    return map;
  }, [seasonalOccurrences]);

  const handleSeasonalSave = async (data: Omit<SeasonalDay, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingSeasonal) {
      const success = await updateSeasonalDay(editingSeasonal.id, data);
      if (success) {
        toast.success('Dia sazonal atualizado');
        return true;
      }
      toast.error('Erro ao atualizar');
      return false;
    } else {
      const created = await createSeasonalDay(data);
      if (created) {
        toast.success('Dia sazonal criado');
        return true;
      }
      toast.error('Erro ao criar');
      return false;
    }
  };

  const handleOpenSeasonalModal = (dateKey?: string, sd?: SeasonalDay) => {
    setEditingSeasonal(sd || null);
    setSeasonalDefaultDate(dateKey || '');
    setSeasonalModalOpen(true);
  };

  const handleMeetingDragStart = (e: React.DragEvent, meeting: Meeting) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', meeting.id);
    draggedRef.current = meeting.id;
    setDraggingMeeting(meeting);
  };

  const handleMeetingDragEnd = () => {
    draggedRef.current = null;
    setDraggingMeeting(null);
  };

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const formatDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const isToday = (dateKey: string) => {
    const today = new Date();
    const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate());
    return dateKey === todayKey;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-sm px-4">
          <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
          <div className="h-48 bg-muted rounded" />
          <div className="h-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background no-overflow-x">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-pt">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold truncate">Calendário</h1>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setSelectedYear((y) => y - 1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="text-lg font-semibold min-w-[60px] text-center tabular-nums">
              {selectedYear}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setSelectedYear((y) => y + 1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 pb-8 no-overflow-x">
        {/* Legend + Seasonal Toggle */}
        <div className="flex items-center justify-between gap-4">
          {showSeasonalDays ? (
            <div className="flex-1 text-sm text-muted-foreground">
              <span className="text-primary font-medium">Modo Sazonais:</span> clique em uma data para criar ou editar eventos sazonais
            </div>
          ) : (
            <div className="scroll-x-container flex-1">
              {Object.entries(STATUS_COLORS).map(([status, color]) => (
                <div key={status} className="flex items-center gap-1.5 shrink-0 text-sm">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-muted-foreground whitespace-nowrap">
                    {status === "concluído" ? "Concluído" : status === "andamento" ? "Andamento" : status}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-1.5 shrink-0 text-sm">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: MEETING_COLOR }}
                />
                <span className="text-muted-foreground">Reunião</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 text-sm">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: DIGITAL_COLOR }}
                />
                <span className="text-muted-foreground">Digital</span>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            <Sparkles className={cn("h-4 w-4", showSeasonalDays ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("text-sm hidden sm:inline", showSeasonalDays ? "text-primary font-medium" : "text-muted-foreground")}>Sazonais</span>
            <Switch checked={showSeasonalDays} onCheckedChange={setShowSeasonalDays} />
          </div>
        </div>

        {/* Calendar Grid */}
        <div className={cn(
          "grid gap-3",
          isMobile ? "grid-cols-1" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}>
          {MONTHS.map((monthName, monthIndex) => {
            const daysInMonth = getDaysInMonth(monthIndex, selectedYear);
            const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
            const firstDayOfWeek = new Date(selectedYear, monthIndex, 1).getDay();
            const adjustedFirstDay = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

            return (
              <div key={monthIndex} className="border rounded-xl p-3 bg-card">
                <h3 className="font-semibold mb-3 text-base">
                  {isMobile ? monthName : MONTHS_SHORT[monthIndex]}
                </h3>
                
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, i) => (
                    <div key={i} className="text-center text-[10px] text-muted-foreground font-medium">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: adjustedFirstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  
                  {days.map((day) => {
                    const dateKey = formatDateKey(selectedYear, monthIndex, day);
                    const dayTasks = tasksByDate[dateKey] || [];
                    const dayMeetings = meetingsByDate[dateKey] || [];
                    const dayDigital = digitalByDate[dateKey] || [];
                    const daySeasonal = seasonalByDate[dateKey] || [];
                    const hasScheduledTasks = dayTasks.length > 0;
                    const hasMeetings = dayMeetings.length > 0;
                    const hasDigital = dayDigital.length > 0;
                    const hasSeasonal = daySeasonal.length > 0;
                    const todayHighlight = isToday(dateKey);
                    
                    // Modo sazonais: mostra TODAS as campanhas de forma clara
                    if (showSeasonalDays) {
                      // Separar eventos principais de dias de prep
                      const mainEvents = daySeasonal.filter(s => !s.isPrepDay);
                      const prepEvents = daySeasonal.filter(s => s.isPrepDay);
                      const allEvents = [...mainEvents, ...prepEvents].sort((a, b) => b.seasonalDay.importance - a.seasonalDay.importance);
                      const hasMainEvent = mainEvents.length > 0;
                      
                      const totalIdeasHere = allEvents.reduce((s, occ) => s + (ideaCountsBySeasonal[occ.seasonalDay.id] || 0), 0);
                      return (
                        <button
                          key={day}
                          onClick={() => {
                            if (hasSeasonal) {
                              openSeasonalEventDialog(dateKey, allEvents.map(e => e.seasonalDay));
                            } else {
                              handleOpenSeasonalModal(dateKey);
                            }
                          }}
                          className={cn(
                            "aspect-square flex flex-col items-center justify-center text-xs sm:text-sm rounded-md relative group",
                            "touch-manipulation active:scale-95 transition-all duration-150",
                            "focus:outline-none focus:ring-2 focus:ring-primary",
                            todayHighlight && "ring-2 ring-primary",
                            !hasSeasonal && "text-muted-foreground/30 hover:bg-muted/20",
                            hasSeasonal && hasMainEvent && "font-bold bg-card shadow-sm border",
                            hasSeasonal && !hasMainEvent && "text-muted-foreground bg-muted/30",
                          )}
                        >
                          <span className="text-foreground">{day}</span>

                          {/* Badge: número de conteúdos planejados */}
                          {hasSeasonal && totalIdeasHere > 0 && (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-primary text-primary-foreground text-[9px] rounded-full flex items-center justify-center font-bold shadow">
                              {totalIdeasHere}
                            </span>
                          )}

                          {/* Indicadores coloridos para CADA campanha */}
                          {hasSeasonal && (
                            <div className="absolute bottom-0.5 left-0.5 right-0.5 flex justify-center gap-0.5">
                              {allEvents.slice(0, 4).map((occ, idx) => (
                                <div
                                  key={occ.seasonalDay.id + idx}
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: occ.seasonalDay.color,
                                    opacity: occ.isPrepDay ? 0.35 : 1
                                  }}
                                  title={`${occ.seasonalDay.name}${occ.isPrepDay ? ' (prep)' : ''}`}
                                />
                              ))}
                              {allEvents.length > 4 && (
                                <span className="text-[6px] text-muted-foreground font-medium">+{allEvents.length - 4}</span>
                              )}
                            </div>
                          )}

                          {/* Tooltip ao hover mostrando todas as campanhas */}
                          {hasSeasonal && allEvents.length > 0 && (
                            <div className="absolute z-50 hidden group-hover:flex flex-col gap-0.5 bottom-full left-1/2 -translate-x-1/2 mb-1 bg-popover border rounded-md shadow-lg p-1.5 min-w-max max-w-48">
                              {allEvents.map((occ, idx) => {
                                const c = ideaCountsBySeasonal[occ.seasonalDay.id] || 0;
                                return (
                                  <div key={occ.seasonalDay.id + idx} className="flex items-center gap-1.5 text-[10px]">
                                    <div
                                      className="w-2 h-2 rounded-full flex-shrink-0"
                                      style={{
                                        backgroundColor: occ.seasonalDay.color,
                                        opacity: occ.isPrepDay ? 0.5 : 1
                                      }}
                                    />
                                    <span className={cn(
                                      "truncate flex-1",
                                      occ.isPrepDay ? "text-muted-foreground" : "text-foreground font-medium"
                                    )}>
                                      {occ.seasonalDay.name}
                                      {occ.isPrepDay && <span className="text-muted-foreground/70"> (prep)</span>}
                                    </span>
                                    {c > 0 && (
                                      <span className="text-[9px] px-1 rounded bg-primary/15 text-primary font-bold">{c}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </button>
                      );
                    }
                    
                    // Modo normal: mostra tarefas, reuniões e digital
                    const hasContent = hasScheduledTasks || hasMeetings || hasDigital;
                    const totalItems = dayTasks.length + dayMeetings.length + dayDigital.length;

                    const dominantColor = hasDigital
                      ? DIGITAL_COLOR
                      : hasMeetings 
                        ? MEETING_COLOR 
                        : hasScheduledTasks
                          ? STATUS_COLORS[dayTasks[0].status] || "#6B7280"
                          : undefined;

                    return (
                      <button
                        key={day}
                        onClick={() => handleDayClick(dateKey)}
                        onDrop={(e) => handleDrop(e, dateKey)}
                        onDragOver={handleDragOver}
                        className={cn(
                          "aspect-square flex items-center justify-center text-xs sm:text-sm rounded-lg relative",
                          "touch-manipulation active:scale-95 transition-all duration-150",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
                          todayHighlight && "ring-2 ring-primary ring-offset-1",
                          hasContent 
                            ? "text-white font-medium shadow-sm" 
                            : "text-foreground hover:bg-muted",
                          draggingMeeting && "hover:ring-2 hover:ring-primary/50"
                        )}
                        style={{
                          backgroundColor: hasContent ? dominantColor : undefined,
                        }}
                      >
                        {day}
                        {totalItems > 1 && (
                          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] bg-background text-foreground text-[9px] rounded-full flex items-center justify-center border font-bold px-0.5">
                            {totalItems}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="border rounded-xl p-4 bg-card">
          <h3 className="font-semibold mb-2">Resumo {selectedYear}</h3>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <p>{tasks.filter((t) => t.scheduled_date?.startsWith(String(selectedYear))).length} tarefa(s)</p>
            <p>{meetings.filter((m) => m.meeting_date?.startsWith(String(selectedYear))).length} reunião(ões)</p>
            <p>{digitalVariations.filter((d) => d.scheduled_date?.startsWith(String(selectedYear))).length} conteúdo(s) digital(is)</p>
          </div>
        </div>

        {/* Meetings list for drag - Desktop only */}
        {!isMobile && meetings.filter(m => m.meeting_date?.startsWith(String(selectedYear))).length > 0 && (
          <div className="border rounded-xl p-4 bg-card">
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
                    className="px-3 py-2 rounded-full text-sm font-medium text-white cursor-move hover:opacity-80 transition-opacity flex items-center gap-2"
                    style={{ backgroundColor: MEETING_COLOR }}
                  >
                    <span>{meeting.meeting_date.split('-').reverse().join('/').slice(0, 5)}</span>
                    <span className="max-w-[120px] truncate">{meeting.title}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Seasonal Days List */}
        {showSeasonalDays && (
          <SeasonalDaysList
            seasonalDays={seasonalDays}
            filterImportance={seasonalFilterImportance}
            onFilterChange={setSeasonalFilterImportance}
            onEdit={(sd) => handleOpenSeasonalModal(undefined, sd)}
            onAdd={() => handleOpenSeasonalModal()}
            selectedYear={selectedYear}
          />
        )}
      </main>

      {/* Seasonal Day Modal */}
      <SeasonalDayModal
        open={seasonalModalOpen}
        onOpenChange={setSeasonalModalOpen}
        seasonalDay={editingSeasonal}
        defaultDate={seasonalDefaultDate}
        onSave={handleSeasonalSave}
        onDelete={deleteSeasonalDay}
      />

      {/* Create Task Dialog */}
      <ResponsiveDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title={`Nova Tarefa - ${selectedDate.split('-').reverse().join('/')}`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Nome da tarefa"
              className="h-12"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Nó</Label>
            <Select value={newTaskNodeId} onValueChange={setNewTaskNodeId}>
              <SelectTrigger className="h-12">
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
              <SelectTrigger className="h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="estrutural">Estrutural</SelectItem>
                <SelectItem value="andamento">Em Andamento</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 h-12" 
              onClick={handleCreateTask} 
              disabled={creating}
            >
              {creating ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Choice Dialog */}
      <ResponsiveDialog
        open={choiceDialogOpen}
        onOpenChange={setChoiceDialogOpen}
        title="O que deseja criar?"
        description={`Data: ${selectedDate.split('-').reverse().join('/')}`}
      >
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 h-20 flex-col gap-2 touch-manipulation active:scale-95"
            onClick={handleChooseTask}
          >
            <Plus className="h-6 w-6" />
            <span>Tarefa</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 h-20 flex-col gap-2 touch-manipulation active:scale-95"
            onClick={handleChooseMeeting}
          >
            <Users className="h-6 w-6" />
            <span>Reunião</span>
          </Button>
        </div>
      </ResponsiveDialog>

      {/* Create Meeting Dialog */}
      <ResponsiveDialog
        open={createMeetingDialogOpen}
        onOpenChange={setCreateMeetingDialogOpen}
        title={`Nova Reunião - ${selectedDate.split('-').reverse().join('/')}`}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="meeting-title">Título</Label>
            <Input
              id="meeting-title"
              value={newMeetingTitle}
              onChange={(e) => setNewMeetingTitle(e.target.value)}
              placeholder="Nome da reunião"
              className="h-12"
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
                className="h-12"
              />
            </div>

            <div className="space-y-2">
              <Label>Duração</Label>
              <Select 
                value={String(newMeetingDuration)} 
                onValueChange={(v) => setNewMeetingDuration(Number(v))}
              >
                <SelectTrigger className="h-12">
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
                <SelectTrigger className="h-12">
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

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 h-12"
              onClick={() => setCreateMeetingDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 h-12" 
              onClick={handleCreateMeeting} 
              disabled={creatingMeeting}
            >
              {creatingMeeting ? "Criando..." : "Criar Reunião"}
            </Button>
          </div>
        </div>
      </ResponsiveDialog>

      {/* Day Tasks Modal */}
      <DayTasksModal
        isOpen={dayTasksModalOpen}
        onClose={() => setDayTasksModalOpen(false)}
        date={dayTasksModalDate}
        tasks={tasksByDate[dayTasksModalDate] || []}
        meetings={meetingsByDate[dayTasksModalDate] || []}
        digitalVariations={digitalByDate[dayTasksModalDate] || []}
        nodesMap={nodesMap}
        onTaskUpdated={loadData}
        onCreateTask={() => {
          setDayTasksModalOpen(false);
          setSelectedDate(dayTasksModalDate);
          handleChooseTask();
        }}
        onCreateMeeting={() => {
          setDayTasksModalOpen(false);
          setSelectedDate(dayTasksModalDate);
          handleChooseMeeting();
        }}
      />
    </div>
  );
};

export default Calendario;
