import { useState } from 'react';
import { RoutineBlock, FOCUS_TYPES, FocusType } from '@/hooks/useRoutine';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Play, Check, SkipForward, Pencil, Trash2, 
  GripVertical, Plus, Clock, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  kpis,
}: RoutineDayViewProps) {
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

      {/* Quick Add Buttons */}
      {isToday && (
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickAdd(25)}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" /> 25min
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickAdd(50)}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" /> 50min
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onQuickAdd(90)}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" /> 90min
          </Button>
          <Button 
            size="sm" 
            onClick={onAddBlock}
            className="flex-1"
          >
            <Plus className="h-3 w-3 mr-1" /> Custom
          </Button>
        </div>
      )}

      {/* Blocks Timeline */}
      {blocks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">Nenhum bloco para este dia.</p>
          <Button onClick={onAddBlock}>
            <Plus className="h-4 w-4 mr-2" /> Adicionar Bloco
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <BlockCard
              key={block.id}
              block={block}
              isActive={block.status === 'andamento'}
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
      )}
    </div>
  );
}

interface BlockCardProps {
  block: RoutineBlock;
  isActive: boolean;
  progress: number;
  formatTime: (time: string | null) => string;
  onStart: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function BlockCard({
  block,
  isActive,
  progress,
  formatTime,
  onStart,
  onComplete,
  onSkip,
  onEdit,
  onDelete,
}: BlockCardProps) {
  const focusInfo = FOCUS_TYPES[block.focus as FocusType] || FOCUS_TYPES.trabalho_profundo;

  return (
    <Card
      className={cn(
        'transition-all',
        isActive && 'ring-2 ring-primary shadow-lg',
        block.status === 'concluido' && 'opacity-60 bg-muted/30',
        block.status === 'pulado' && 'opacity-40'
      )}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          {block.status === 'pendente' && (
            <div className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
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
