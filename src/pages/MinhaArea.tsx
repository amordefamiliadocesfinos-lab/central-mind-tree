import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Calendar, ListChecks, Clock, ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMeetings } from '@/hooks/useMeetings';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  node_id: string;
  assigned_to: string | null;
}

interface Node {
  id: string;
  title: string;
  color: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pendente: { label: 'Pendente', color: 'bg-gray-500' },
  andamento: { label: 'Em Andamento', color: 'bg-amber-500' },
  concluida: { label: 'Concluída', color: 'bg-green-500' },
};

export default function MinhaArea() {
  const navigate = useNavigate();
  const { meetings, users, activeUserId, setActiveUserId, getMyMeetings } = useMeetings();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [nodes, setNodes] = useState<Record<string, Node>>({});
  const [loading, setLoading] = useState(true);

  const activeUser = users.find(u => u.id === activeUserId);

  // Fetch tasks
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      const [tasksResult, nodesResult] = await Promise.all([
        supabase.from('tasks').select('id, title, status, due_date, node_id, assigned_to').is('deleted_at', null),
        supabase.from('nodes').select('id, title, color'),
      ]);

      if (tasksResult.data) setTasks(tasksResult.data);
      if (nodesResult.data) {
        setNodes(Object.fromEntries(nodesResult.data.map(n => [n.id, n])));
      }
      
      setLoading(false);
    };

    fetchData();
  }, []);

  // My meetings
  const myMeetings = useMemo(() => {
    if (!activeUserId) return [];
    return getMyMeetings(activeUserId).filter(m => m.status !== 'cancelada');
  }, [activeUserId, getMyMeetings]);

  // Upcoming meetings (sorted by date)
  const upcomingMeetings = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return myMeetings
      .filter(m => m.meeting_date >= today && m.status !== 'concluida')
      .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
  }, [myMeetings]);

  // My tasks - filtered by assigned_to when a user is selected
  const myTasks = useMemo(() => {
    let filteredTasks = tasks.filter(t => t.status !== 'concluida' && t.status !== 'concluído');
    if (activeUserId) {
      filteredTasks = filteredTasks.filter(t => t.assigned_to === activeUserId);
    }
    return filteredTasks;
  }, [tasks, activeUserId]);

  // Tasks by status
  const tasksByStatus = useMemo(() => {
    return {
      pendente: myTasks.filter(t => t.status === 'pendente'),
      andamento: myTasks.filter(t => t.status === 'andamento'),
    };
  }, [myTasks]);

  // Overdue tasks
  const overdueTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return myTasks.filter(t => t.due_date && t.due_date < today);
  }, [myTasks]);

  const formatMeetingDate = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return format(d, "dd/MM/yyyy", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Minha Área</h1>
          </div>
          <Select value={activeUserId || ''} onValueChange={setActiveUserId}>
            <SelectTrigger className="w-[160px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* User Info */}
        {activeUser && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{activeUser.name}</h2>
                  <p className="text-sm text-muted-foreground">{activeUser.role || 'Sem função definida'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-primary">{upcomingMeetings.length}</div>
              <p className="text-xs text-muted-foreground">Reuniões</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{tasksByStatus.andamento.length}</div>
              <p className="text-xs text-muted-foreground">Em andamento</p>
            </CardContent>
          </Card>
          <Card className={overdueTasks.length > 0 ? 'border-destructive' : ''}>
            <CardContent className="pt-4 text-center">
              <div className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {overdueTasks.length}
              </div>
              <p className="text-xs text-muted-foreground">Atrasadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="reunioes">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="reunioes">
              <Calendar className="h-4 w-4 mr-2" />
              Minhas Reuniões
            </TabsTrigger>
            <TabsTrigger value="acoes">
              <ListChecks className="h-4 w-4 mr-2" />
              Minhas Ações
            </TabsTrigger>
          </TabsList>

          {/* Reuniões */}
          <TabsContent value="reunioes" className="mt-4 space-y-3">
            {upcomingMeetings.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma reunião agendada</p>
                </CardContent>
              </Card>
            ) : (
              upcomingMeetings.map(meeting => (
                <Card 
                  key={meeting.id} 
                  className="cursor-pointer hover:border-primary/50"
                  onClick={() => navigate(`/reunioes/${meeting.id}`)}
                >
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{meeting.title}</h3>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatMeetingDate(meeting.meeting_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {meeting.start_time.substring(0, 5)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Ações/Tarefas */}
          <TabsContent value="acoes" className="mt-4 space-y-4">
            {/* Overdue */}
            {overdueTasks.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-semibold text-destructive mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Atrasadas ({overdueTasks.length})
                </h3>
                <div className="space-y-2">
                  {overdueTasks.map(task => {
                    const node = nodes[task.node_id];
                    return (
                      <Card 
                        key={task.id} 
                        className="border-destructive/50 cursor-pointer hover:border-destructive"
                        onClick={() => navigate(`/task/${task.id}`)}
                      >
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {node && (
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: node.color }}
                                />
                              )}
                              <span className="font-medium">{task.title}</span>
                            </div>
                            <Badge variant="destructive" className="text-xs">
                              {task.due_date && format(parseISO(task.due_date), 'dd/MM')}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Em andamento */}
            {tasksByStatus.andamento.length > 0 && (
              <div>
                <h3 className="font-semibold text-amber-500 mb-2">
                  Em Andamento ({tasksByStatus.andamento.length})
                </h3>
                <div className="space-y-2">
                  {tasksByStatus.andamento.map(task => {
                    const node = nodes[task.node_id];
                    return (
                      <Card 
                        key={task.id}
                        className="cursor-pointer hover:border-primary/50"
                        onClick={() => navigate(`/task/${task.id}`)}
                      >
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {node && (
                                <div 
                                  className="w-2 h-2 rounded-full" 
                                  style={{ backgroundColor: node.color }}
                                />
                              )}
                              <span>{task.title}</span>
                            </div>
                            {task.due_date && (
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(task.due_date), 'dd/MM')}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pendentes */}
            {tasksByStatus.pendente.length > 0 && (
              <div>
                <h3 className="font-semibold text-muted-foreground mb-2">
                  Pendentes ({tasksByStatus.pendente.length})
                </h3>
                <div className="space-y-2">
                  {tasksByStatus.pendente.slice(0, 5).map(task => {
                    const node = nodes[task.node_id];
                    return (
                      <Card 
                        key={task.id}
                        className="cursor-pointer hover:border-primary/50"
                        onClick={() => navigate(`/task/${task.id}`)}
                      >
                        <CardContent className="py-3">
                          <div className="flex items-center gap-2">
                            {node && (
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: node.color }}
                              />
                            )}
                            <span className="text-muted-foreground">{task.title}</span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {tasksByStatus.pendente.length > 5 && (
                    <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
                      Ver todas ({tasksByStatus.pendente.length - 5} mais)
                    </Button>
                  )}
                </div>
              </div>
            )}

            {myTasks.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <ListChecks className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">Nenhuma tarefa pendente</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
