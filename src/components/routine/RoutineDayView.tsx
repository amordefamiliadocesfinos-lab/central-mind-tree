import { useState, useMemo } from 'react';
import { RoutineBlock, FOCUS_TYPES, FocusType } from '@/hooks/useRoutine';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, Check, SkipForward, Pencil, Trash2, 
  GripVertical, Plus, Clock, Target, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface RoutineDayViewProps {
  date: Date;
  blocks: RoutineBlock[];
  activeBlock: RoutineBlock | null;
  onStartBlock: (id: string) => void;
  onCompleteBlock: (id: string) => void;
  onSkipBlock: (id: string) => void;
  onEditBlock: (block: RoutineBlock) => void;
  onDeleteBlock: (id: string) => void;
  onReorderBlocks: (blocks: RoutineBlock[]) => void;
  onAddBlock: () => void;
  onQuickAdd: (duration: number) => void;
  onGenerateDay: () => void;
  kpis: {
    totalBlocks: number;
    completed: number;
    skipped: number;
    plannedMinutes: number;
    executedMinutes: number;
    adherence: number;
    byFocus: Record<string, { planned: number; done: number }>;
    deepWorkTarget: number;
    atendimentoTarget: number;
    deepWorkDone: number;
    atendimentoDone: number;
  };
}

export function RoutineDayView({
  date,
  blocks,
  activeBlock,
  onStartBlock,
  onCompleteBlock,
  onSkipBlock,
  onEditBlock,
  onDeleteBlock,
  onReorderBlocks,
  onAddBlock,
  onQuickAdd,
  onGenerateDay,
  kpis,
}: RoutineDayViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeBlockDrag = useMemo(
    () => blocks.find((b) => b.id === activeId),
    [blocks, activeId]
  );

  const sortableIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    // Haptic feedback on mobile
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);
      const reordered = arrayMove(blocks, oldIndex, newIndex);
      onReorderBlocks(reordered);
      // Haptic feedback on drop
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return '--:--';
    return time.slice(0, 5);
  };

  const getBlockProgress = (block: RoutineBlock) => {
    if (block.status !== 'andamento' || !block.actual_start) return 0;
    const start = new Date(block.actual_start).getTime();
    const elapsed = Date.now() - start;
    const total = block.duration_minutes * 60 * 1000;
    return Math.min(100, Math.round((elapsed / total) * 100));
  };

  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-4">
      {/* KPIs Card */}
      <Card className="bg-gradient-to-r from-muted/50 to-muted/30">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Target className="h-4 w-4" />
              {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <Badge variant={kpis.adherence >= 70 ? 'default' : 'secondary'}>
              {kpis.adherence}% aderência
            </Badge>
          </div>
          
          <div className="grid grid-cols-4 gap-3 text-center mb-4">
            <div>
              <p className="text-2xl font-bold">{kpis.completed}/{kpis.totalBlocks}</p>
              <p className="text-xs text-muted-foreground">Blocos</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{kpis.executedMinutes}</p>
              <p className="text-xs text-muted-foreground">min feitos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{kpis.deepWorkDone}</p>
              <p className="text-xs text-muted-foreground">/{kpis.deepWorkTarget} profundo</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{kpis.atendimentoDone}</p>
              <p className="text-xs text-muted-foreground">/{kpis.atendimentoTarget} atend.</p>
            </div>
          </div>

          {/* Focus breakdown */}
          <div className="flex gap-2 flex-wrap">
            {Object.entries(kpis.byFocus).map(([focus, data]) => {
              const focusInfo = FOCUS_TYPES[focus as FocusType];
              if (!focusInfo || data.planned === 0) return null;
              return (
                <div
                  key={focus}
                  className={cn(
                    'px-2 py-1 rounded text-xs text-white flex items-center gap-1',
                    focusInfo.color
                  )}
                >
                  <span>{focusInfo.icon}</span>
                  <span>{data.done}/{data.planned}min</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Generate Day + Quick Add Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button 
          onClick={onGenerateDay}
          className="flex-1 min-w-[140px]"
        >
          <Sparkles className="h-4 w-4 mr-2" /> Gerar Dia
        </Button>
        {isToday && (
          <>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onQuickAdd(25)}
            >
              <Plus className="h-3 w-3 mr-1" /> 25min
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onQuickAdd(50)}
            >
              <Plus className="h-3 w-3 mr-1" /> 50min
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onQuickAdd(90)}
            >
              <Plus className="h-3 w-3 mr-1" /> 90min
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={onAddBlock}
            >
              <Plus className="h-3 w-3 mr-1" /> Custom
            </Button>
          </>
        )}
      </div>

      {/* Blocks Timeline with Drag and Drop */}
      {blocks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Nenhum bloco para este dia.</p>
          <Button onClick={onAddBlock}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Bloco
          </Button>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {blocks.map((block) => (
                <SortableBlockCard
                  key={block.id}
                  block={block}
                  isActive={block.status === 'andamento'}
                  isDragging={activeId === block.id}
                  progress={getBlockProgress(block)}
                  formatTime={formatTime}
                  onStart={() => onStartBlock(block.id)}
                  onComplete={() => onCompleteBlock(block.id)}
                  onSkip={() => onSkipBlock(block.id)}
                  onEdit={() => onEditBlock(block)}
                  onDelete={() => onDeleteBlock(block.id)}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag Overlay for visual feedback */}
          <DragOverlay dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}>
            {activeBlockDrag ? (
              <div className="opacity-90 shadow-2xl scale-105">
                <BlockCardContent
                  block={activeBlockDrag}
                  isActive={activeBlockDrag.status === 'andamento'}
                  isDragging={true}
                  progress={getBlockProgress(activeBlockDrag)}
                  formatTime={formatTime}
                  onStart={() => {}}
                  onComplete={() => {}}
                  onSkip={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

interface SortableBlockCardProps {
  block: RoutineBlock;
  isActive: boolean;
  isDragging: boolean;
  progress: number;
  formatTime: (time: string | null) => string;
  onStart: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableBlockCard(props: SortableBlockCardProps) {
  const { block, isDragging } = props;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSorting,
  } = useSortable({ 
    id: block.id,
    disabled: block.status !== 'pendente',
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-opacity',
        (isDragging || isSorting) && 'opacity-50'
      )}
    >
      <BlockCardContent
        {...props}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

interface BlockCardContentProps {
  block: RoutineBlock;
  isActive: boolean;
  isDragging: boolean;
  progress: number;
  formatTime: (time: string | null) => string;
  onStart: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onDelete: () => void;
  dragHandleProps?: Record<string, unknown>;
}

function BlockCardContent({
  block,
  isActive,
  isDragging,
  progress,
  formatTime,
  onStart,
  onComplete,
  onSkip,
  onEdit,
  onDelete,
  dragHandleProps = {},
}: BlockCardContentProps) {
  const focusInfo = FOCUS_TYPES[block.focus as FocusType] || FOCUS_TYPES.trabalho_profundo;

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isActive && 'ring-2 ring-primary shadow-lg',
        block.status === 'concluido' && 'opacity-60 bg-muted/30',
        block.status === 'pulado' && 'opacity-40',
        isDragging && 'ring-2 ring-primary shadow-2xl'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          {block.status === 'pendente' && (
            <div 
              {...dragHandleProps}
              className="cursor-grab active:cursor-grabbing touch-none"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </div>
          )}

          {/* Time */}
          <div className="text-center w-14 flex-shrink-0">
            <p className="text-lg font-mono font-bold">
              {formatTime(block.planned_start)}
            </p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              {block.duration_minutes}min
            </p>
          </div>

          {/* Focus Indicator */}
          <div
            className={cn(
              'w-1.5 h-12 rounded-full flex-shrink-0',
              focusInfo.color
            )}
          />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm">{focusInfo.icon}</span>
              <h3 className="font-medium truncate">{block.title}</h3>
              <Badge variant="outline" className="text-xs">
                {focusInfo.label}
              </Badge>
            </div>
            
            {isActive && (
              <Progress value={progress} className="mt-2 h-1.5" />
            )}
            
            {block.status === 'concluido' && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <Check className="h-3 w-3" /> Concluído
              </p>
            )}
            
            {block.status === 'pulado' && (
              <p className="text-xs text-muted-foreground mt-1">Pulado</p>
            )}

            {block.notes && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{block.notes}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1 flex-shrink-0">
            {block.status === 'pendente' && (
              <>
                <Button
                  size="sm"
                  onClick={onStart}
                  className="h-9 w-9 p-0"
                >
                  <Play className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onSkip}
                  className="h-9 w-9 p-0"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onEdit}
                  className="h-9 w-9 p-0"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </>
            )}
            
            {isActive && (
              <Button
                size="sm"
                variant="default"
                onClick={onComplete}
                className="h-9 px-3"
              >
                <Check className="h-4 w-4 mr-1" /> Concluir
              </Button>
            )}
            
            {block.status !== 'andamento' && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-9 w-9 p-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
