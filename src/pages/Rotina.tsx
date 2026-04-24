import { useState } from 'react';
import { useRoutine, RoutineBlock, FOCUS_TYPES, FocusType } from '@/hooks/useRoutine';
import { RoutineDayView } from '@/components/routine/RoutineDayView';
import { RoutineWeekView } from '@/components/routine/RoutineWeekView';
import { RoutineMonthView } from '@/components/routine/RoutineMonthView';
import { BlockEditDialog } from '@/components/routine/BlockEditDialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, 
  CalendarDays, CalendarRange, Clock, 
  RotateCcw
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function Rotina() {
  const {
    selectedDate,
    setSelectedDate,
    viewMode,
    setViewMode,
    blocks,
    templates,
    prefs,
    loading,
    activeBlock,
    daysInRange,
    
    startBlock,
    completeBlock,
    skipBlock,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    
    autoPlanDay,
    autoPlanWeek,
    pushBlocksForward,
    
    getBlocksByDay,
    getDayKPIs,
    weekSummary,
    focusTypes,
  } = useRoutine();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);

  // Navigation
  const navigateDate = (direction: 'prev' | 'next') => {
    if (viewMode === 'day') {
      setSelectedDate(direction === 'next' ? addDays(selectedDate, 1) : subDays(selectedDate, 1));
    } else if (viewMode === 'week') {
      setSelectedDate(direction === 'next' ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1));
    } else {
      setSelectedDate(direction === 'next' ? addMonths(selectedDate, 1) : subMonths(selectedDate, 1));
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  // Handlers
  const handleEditBlock = (block: RoutineBlock) => {
    setEditingBlock(block);
    setEditDialogOpen(true);
  };

  const handleAddBlock = () => {
    setEditingBlock(null);
    setEditDialogOpen(true);
  };

  const handleQuickAdd = async (duration: number) => {
    const isViewingToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
    let startHHMM = '08:00';

    if (isViewingToday) {
      const now = new Date();
      // Arredonda para o próximo múltiplo de 5 minutos
      const totalMins = now.getHours() * 60 + Math.ceil(now.getMinutes() / 5) * 5;
      const clamped = Math.min(totalMins, 23 * 60 + 55);
      const h = Math.floor(clamped / 60);
      const m = clamped % 60;
      startHHMM = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    } else {
      // Para datas futuras: pega o último bloco existente do dia + sua duração, ou 08:00
      const dayBlocks = getBlocksByDay(selectedDate)
        .filter(b => b.planned_start)
        .sort((a, b) => (a.planned_start || '').localeCompare(b.planned_start || ''));
      const last = dayBlocks[dayBlocks.length - 1];
      if (last?.planned_start) {
        const [h, m] = last.planned_start.split(':').map(Number);
        const totalMins = Math.min(h * 60 + m + last.duration_minutes, 23 * 60 + 55);
        const newH = Math.floor(totalMins / 60);
        const newM = totalMins % 60;
        startHHMM = `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
      }
    }

    await addBlock({
      title: `Bloco ${duration}min`,
      focus: 'trabalho_profundo',
      duration_minutes: duration,
      planned_start: startHHMM,
      date: format(selectedDate, 'yyyy-MM-dd'),
    });
  };

  const handleSaveBlock = async (data: Partial<RoutineBlock>) => {
    if (editingBlock) {
      await updateBlock(editingBlock.id, data);
    } else {
      await addBlock(data);
    }
    setEditDialogOpen(false);
    setEditingBlock(null);
  };

  const currentDayBlocks = getBlocksByDay(selectedDate);
  const currentDayKPIs = getDayKPIs(selectedDate);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Clock className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Carregando rotina...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-safe-bottom">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b safe-area-pt">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Rotina</h1>
              <p className="text-xs text-muted-foreground">
                {viewMode === 'day' && format(selectedDate, "d 'de' MMMM", { locale: ptBR })}
                {viewMode === 'week' && `Semana ${format(selectedDate, 'w')} de ${format(selectedDate, 'yyyy')}`}
                {viewMode === 'month' && format(selectedDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>
          
          <div className="flex gap-1">
            {!isToday(selectedDate) && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={goToToday}
                className="text-xs h-10"
                title="Voltar para hoje"
              >
                Hoje
              </Button>
            )}
            {isToday(selectedDate) && currentDayBlocks.length > 0 && viewMode === 'day' && (
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => pushBlocksForward(15)}
                title="Empurrar +15min"
                className="h-10 w-10"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* View Mode Tabs & Navigation */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigateDate('prev')}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigateDate('next')}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="day" className="text-xs px-3">
                <Calendar className="h-3 w-3 mr-1" />
                Dia
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-3">
                <CalendarDays className="h-3 w-3 mr-1" />
                Semana
              </TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-3">
                <CalendarRange className="h-3 w-3 mr-1" />
                Mês
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {viewMode === 'day' && (
          <RoutineDayView
            date={selectedDate}
            blocks={currentDayBlocks}
            activeBlock={activeBlock}
            onStartBlock={startBlock}
            onCompleteBlock={completeBlock}
            onSkipBlock={skipBlock}
            onEditBlock={handleEditBlock}
            onDeleteBlock={deleteBlock}
            onReorderBlocks={reorderBlocks}
            onAddBlock={handleAddBlock}
            onQuickAdd={handleQuickAdd}
            onGenerateDay={autoPlanDay}
            kpis={currentDayKPIs}
          />
        )}

        {viewMode === 'week' && (
          <RoutineWeekView
            days={daysInRange}
            getBlocksByDay={getBlocksByDay}
            getDayKPIs={getDayKPIs}
            weekSummary={weekSummary}
            selectedDate={selectedDate}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setViewMode('day');
            }}
            onAutoPlanWeek={autoPlanWeek}
            capacityTargets={prefs?.capacity_targets || { deep_work_min: 180, atendimento_min: 120 }}
          />
        )}

        {viewMode === 'month' && (
          <RoutineMonthView
            selectedDate={selectedDate}
            getBlocksByDay={getBlocksByDay}
            getDayKPIs={getDayKPIs}
            onSelectDate={setSelectedDate}
            onChangeView={setViewMode}
          />
        )}
      </div>

      {/* Block Edit Dialog */}
      <BlockEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        block={editingBlock}
        onSave={handleSaveBlock}
        defaultDate={format(selectedDate, 'yyyy-MM-dd')}
      />
    </div>
  );
}
