import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Calendar, Users, Clock, MapPin, ArrowLeft, MoreVertical, Trash2, Edit, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { FullScreenDialog } from '@/components/ui/responsive-dialog';
import { useMeetings, Meeting, AppUser } from '@/hooks/useMeetings';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  agendada: { label: 'Agendada', color: 'bg-blue-500' },
  em_andamento: { label: 'Em Andamento', color: 'bg-amber-500' },
  concluida: { label: 'Concluída', color: 'bg-green-500' },
  cancelada: { label: 'Cancelada', color: 'bg-gray-500' },
};

export default function Reunioes() {
  const navigate = useNavigate();
  const {
    meetings,
    users,
    loading,
    activeUserId,
    setActiveUserId,
    createMeeting,
    deleteMeeting,
    getStats,
  } = useMeetings();

  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    objective: '',
    meeting_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    duration_minutes: 60,
    location: '',
    owner_id: '',
    participant_ids: [] as string[],
  });

  const stats = useMemo(() => getStats(), [getStats]);

  const handleCreate = async () => {
    if (!newMeeting.title.trim()) {
      toast.error('Título é obrigatório');
      return;
    }

    const result = await createMeeting({
      ...newMeeting,
      owner_id: newMeeting.owner_id || activeUserId || undefined,
    });

    if (result) {
      toast.success('Reunião criada!');
      setShowNewDialog(false);
      setNewMeeting({
        title: '',
        objective: '',
        meeting_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        duration_minutes: 60,
        location: '',
        owner_id: '',
        participant_ids: [],
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Excluir esta reunião?')) {
      await deleteMeeting(id);
      toast.success('Reunião excluída');
    }
  };

  const toggleParticipant = (userId: string) => {
    setNewMeeting(prev => ({
      ...prev,
      participant_ids: prev.participant_ids.includes(userId)
        ? prev.participant_ids.filter(id => id !== userId)
        : [...prev.participant_ids, userId],
    }));
  };

  const formatTime = (time: string) => {
    return time.substring(0, 5);
  };

  const formatDate = (date: string) => {
    return format(new Date(date + 'T12:00:00'), "EEE, d 'de' MMM", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b safe-area-pt">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold">Reuniões</h1>
            </div>
            <div className="flex items-center gap-2">
              <Select value={activeUserId || ''} onValueChange={setActiveUserId}>
                <SelectTrigger className="w-[120px] md:w-[140px] h-10">
                  <User className="h-4 w-4 mr-1 md:mr-2 shrink-0" />
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => setShowNewDialog(true)} className="h-10 px-3 md:px-4">
                <Plus className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Nova</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {/* Stats - Horizontal scroll on mobile */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4">
          <Card className="min-w-0">
            <CardContent className="p-3 md:pt-4 text-center">
              <div className="text-xl md:text-2xl font-bold text-primary">{stats.thisWeek}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">Esta semana</p>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardContent className="p-3 md:pt-4 text-center">
              <div className="text-xl md:text-2xl font-bold text-amber-500">{stats.upcoming}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">Próximos 7d</p>
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardContent className="p-3 md:pt-4 text-center">
              <div className="text-xl md:text-2xl font-bold text-muted-foreground">{stats.total}</div>
              <p className="text-[10px] md:text-xs text-muted-foreground truncate">Total</p>
            </CardContent>
          </Card>
        </div>

        {/* Meetings List */}
        {meetings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma reunião agendada</p>
              <Button onClick={() => setShowNewDialog(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira reunião
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {meetings.map(meeting => {
              const status = STATUS_LABELS[meeting.status] || STATUS_LABELS.agendada;
              const owner = meeting.owner;
              
              return (
                <Card 
                  key={meeting.id} 
                  className="cursor-pointer active:scale-[0.99] hover:border-primary/50 transition-all touch-manipulation"
                  onClick={() => navigate(`/reunioes/${meeting.id}`)}
                >
                  <CardContent className="py-3 md:py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={cn(status.color, "text-white text-xs shrink-0")}>
                            {status.label}
                          </Badge>
                          <h3 className="font-medium truncate text-sm md:text-base">{meeting.title}</h3>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-muted-foreground mt-2">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(meeting.meeting_date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(meeting.start_time)}
                          </span>
                          {meeting.location && (
                            <span className="flex items-center gap-1 max-w-[100px] md:max-w-none">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{meeting.location}</span>
                            </span>
                          )}
                          {owner && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {owner.name}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/reunioes/${meeting.id}`);
                          }}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(meeting.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* New Meeting Dialog */}
      <FullScreenDialog open={showNewDialog} onOpenChange={setShowNewDialog} title="Nova Reunião">
        <div className="space-y-4 p-4 md:p-0">
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              className="h-11"
              value={newMeeting.title}
              onChange={(e) => setNewMeeting(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Alinhamento semanal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="objective">Objetivo</Label>
            <Textarea
              id="objective"
              value={newMeeting.objective}
              onChange={(e) => setNewMeeting(prev => ({ ...prev, objective: e.target.value }))}
              placeholder="Qual o objetivo desta reunião?"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Data *</Label>
              <Input
                id="date"
                type="date"
                className="h-11"
                value={newMeeting.meeting_date}
                onChange={(e) => setNewMeeting(prev => ({ ...prev, meeting_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Horário *</Label>
              <Input
                id="time"
                type="time"
                className="h-11"
                value={newMeeting.start_time}
                onChange={(e) => setNewMeeting(prev => ({ ...prev, start_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração (min)</Label>
              <Input
                id="duration"
                type="number"
                className="h-11"
                min={15}
                step={15}
                value={newMeeting.duration_minutes}
                onChange={(e) => setNewMeeting(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 60 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Local/Link</Label>
              <Input
                id="location"
                className="h-11"
                value={newMeeting.location}
                onChange={(e) => setNewMeeting(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Sala ou link"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={newMeeting.owner_id}
              onValueChange={(v) => setNewMeeting(prev => ({ ...prev, owner_id: v }))}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} {user.role && `(${user.role})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Participantes</Label>
            <div className="border rounded-lg p-3 space-y-3 max-h-40 overflow-y-auto">
              {users.map(user => (
                <label key={user.id} className="flex items-center gap-3 cursor-pointer min-h-[44px] touch-manipulation">
                  <Checkbox
                    checked={newMeeting.participant_ids.includes(user.id)}
                    onCheckedChange={() => toggleParticipant(user.id)}
                    className="h-5 w-5"
                  />
                  <span className="text-sm">{user.name}</span>
                  {user.role && <span className="text-xs text-muted-foreground">({user.role})</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 pb-safe-bottom">
            <Button variant="outline" onClick={() => setShowNewDialog(false)} className="flex-1 h-11">
              Cancelar
            </Button>
            <Button onClick={handleCreate} className="flex-1 h-11">
              Criar Reunião
            </Button>
          </div>
        </div>
      </FullScreenDialog>
    </div>
  );
}
