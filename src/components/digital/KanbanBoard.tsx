import { useState, useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners, useSensor, useSensors, PointerSensor, TouchSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DigitalIdea, DigitalVariation, DIGITAL_STATUS, PLATFORMS } from '@/hooks/useDigital';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Calendar, GripVertical } from 'lucide-react';

interface KanbanBoardProps {
  ideas: DigitalIdea[];
  onUpdateIdea: (id: string, updates: Partial<DigitalIdea>) => void;
  onUpdateVariation: (id: string, updates: Partial<DigitalVariation>) => void;
  onSelectIdea: (id: string) => void;
  viewMode: 'ideas' | 'variations';
}

// Sortable Idea Card
function SortableIdeaCard({ idea, onClick }: { idea: DigitalIdea; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: idea.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusConfig = DIGITAL_STATUS[idea.status];
  const variations = idea.variations || [];
  const completedVariations = variations.filter(v => v.status === 'concluido').length;
  const progress = variations.length > 0 ? (completedVariations / variations.length) * 100 : 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation',
        'border-l-4',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button {...attributes} {...listeners} className="touch-none mt-1">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{idea.title}</h4>
            {idea.objective && (
              <p className="text-xs text-muted-foreground line-clamp-1">{idea.objective}</p>
            )}
            {variations.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex gap-0.5">
                  {variations.slice(0, 4).map(v => (
                    <span key={v.id} className="text-xs" title={PLATFORMS[v.platform]?.label}>
                      {PLATFORMS[v.platform]?.icon}
                    </span>
                  ))}
                  {variations.length > 4 && (
                    <span className="text-xs text-muted-foreground">+{variations.length - 4}</span>
                  )}
                </div>
                <Progress value={progress} className="w-12 h-1" />
                <span className="text-xs text-muted-foreground tabular-nums">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Sortable Variation Card
function SortableVariationCard({ 
  variation, 
  ideaTitle,
  onClick 
}: { 
  variation: DigitalVariation & { ideaTitle: string }; 
  ideaTitle: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: variation.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusConfig = DIGITAL_STATUS[variation.status];
  const platformConfig = PLATFORMS[variation.platform];
  const checklistProgress = variation.checklist?.length
    ? (variation.checklist.filter(c => c.done).length / variation.checklist.length) * 100
    : 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-all touch-manipulation',
        'border-l-4',
        statusConfig.color.replace('bg-', 'border-l-')
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <button {...attributes} {...listeners} className="touch-none mt-1">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{platformConfig?.icon}</span>
              <span className="text-xs text-muted-foreground truncate">{platformConfig?.label}</span>
            </div>
            <p className="text-xs font-medium truncate mt-1">{ideaTitle}</p>
            
            <div className="flex items-center gap-2 mt-2">
              {variation.scheduled_date && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span className="tabular-nums">{variation.scheduled_date.slice(5).replace('-', '/')}</span>
                </div>
              )}
              {variation.checklist && variation.checklist.length > 0 && (
                <>
                  <Progress value={checklistProgress} className="w-10 h-1" />
                  <span className="text-xs text-muted-foreground tabular-nums">{Math.round(checklistProgress)}%</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KanbanBoard({ ideas, onUpdateIdea, onUpdateVariation, onSelectIdea, viewMode }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Group by status
  const columns = useMemo(() => {
    if (viewMode === 'ideas') {
      return Object.entries(DIGITAL_STATUS).map(([status, config]) => ({
        status,
        config,
        items: ideas.filter(i => i.status === status),
      }));
    } else {
      // Flatten all variations
      const allVariations = ideas.flatMap(idea => 
        (idea.variations || []).map(v => ({ ...v, ideaTitle: idea.title }))
      );
      
      return Object.entries(DIGITAL_STATUS).map(([status, config]) => ({
        status,
        config,
        items: allVariations.filter(v => v.status === status),
      }));
    }
  }, [ideas, viewMode]);

  const handleDragStart = (event: any) => {
    setActiveId(event.active.id);
    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    // Find which column the item was dropped into
    const overColumn = columns.find(col => 
      col.items.some(item => item.id === over.id) || col.status === over.id
    );

    if (!overColumn) return;

    const newStatus = overColumn.status as keyof typeof DIGITAL_STATUS;

    if (viewMode === 'ideas') {
      const activeIdea = ideas.find(i => i.id === active.id);
      if (activeIdea && activeIdea.status !== newStatus) {
        onUpdateIdea(active.id, { status: newStatus });
      }
    } else {
      // Find the variation
      const activeVariation = ideas.flatMap(i => i.variations || []).find(v => v.id === active.id);
      if (activeVariation && activeVariation.status !== newStatus) {
        onUpdateVariation(active.id, { status: newStatus });
      }
    }
  };

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    if (viewMode === 'ideas') {
      return ideas.find(i => i.id === activeId);
    } else {
      for (const idea of ideas) {
        const variation = idea.variations?.find(v => v.id === activeId);
        if (variation) return { ...variation, ideaTitle: idea.title };
      }
    }
    return null;
  }, [activeId, ideas, viewMode]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
        {columns.map(({ status, config, items }) => (
          <div
            key={status}
            className="flex-shrink-0 w-64 md:w-72"
          >
            <Card className="h-full">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <div className={cn('w-2 h-2 rounded-full', config.color)} />
                    {config.label}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {items.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-2 space-y-2 min-h-[200px]">
                <SortableContext
                  items={items.map(i => i.id)}
                  strategy={verticalListSortingStrategy}
                  id={status}
                >
                  {items.map(item => (
                    viewMode === 'ideas' ? (
                      <SortableIdeaCard
                        key={item.id}
                        idea={item as DigitalIdea}
                        onClick={() => onSelectIdea((item as DigitalIdea).id)}
                      />
                    ) : (
                      <SortableVariationCard
                        key={item.id}
                        variation={item as DigitalVariation & { ideaTitle: string }}
                        ideaTitle={(item as any).ideaTitle}
                        onClick={() => {
                          const idea = ideas.find(i => i.variations?.some(v => v.id === item.id));
                          if (idea) onSelectIdea(idea.id);
                        }}
                      />
                    )
                  ))}
                </SortableContext>

                {items.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-8">
                    Arraste itens aqui
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <DragOverlay>
        {activeItem && viewMode === 'ideas' ? (
          <Card className="shadow-lg rotate-3 cursor-grabbing opacity-90">
            <CardContent className="p-3">
              <h4 className="font-medium text-sm">{(activeItem as DigitalIdea).title}</h4>
            </CardContent>
          </Card>
        ) : activeItem ? (
          <Card className="shadow-lg rotate-3 cursor-grabbing opacity-90">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{PLATFORMS[(activeItem as any).platform]?.icon}</span>
                <span className="text-xs">{(activeItem as any).ideaTitle}</span>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
