import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableListProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, isDragging: boolean) => React.ReactNode;
  className?: string;
}

export function SortableList<T>({
  items,
  keyExtractor,
  onReorder,
  renderItem,
  className,
}: SortableListProps<T>) {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      const oldIndex = items.findIndex((item) => keyExtractor(item) === active.id);
      const newIndex = items.findIndex((item) => keyExtractor(item) === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
      // Success haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
    }
  };

  const activeItem = activeId
    ? items.find((item) => keyExtractor(item) === activeId)
    : null;
  const activeIndex = activeItem
    ? items.findIndex((item) => keyExtractor(item) === activeId)
    : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      measuring={{
        droppable: {
          strategy: MeasuringStrategy.Always,
        },
      }}
    >
      <SortableContext
        items={items.map(keyExtractor)}
        strategy={verticalListSortingStrategy}
      >
        <div className={cn("space-y-1", className)}>
          {items.map((item, index) => (
            <SortableItem
              key={keyExtractor(item)}
              id={keyExtractor(item)}
              isActive={keyExtractor(item) === activeId}
            >
              {renderItem(item, index, keyExtractor(item) === activeId)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
      <DragOverlay
        dropAnimation={{
          duration: 250,
          easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
        }}
      >
        {activeItem && activeIndex >= 0 ? (
          <div 
            className="animate-in zoom-in-95 duration-150"
            style={{
              transform: "scale(1.02)",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.25), 0 10px 20px -5px rgba(0,0,0,0.15)",
              borderRadius: "0.5rem",
            }}
          >
            {renderItem(activeItem, activeIndex, true)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
  isActive: boolean;
}

function SortableItem({ id, children, isActive }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isSorting,
  } = useSortable({ 
    id,
    transition: {
      duration: 200,
      easing: "cubic-bezier(0.25, 1, 0.5, 1)",
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
    zIndex: isDragging ? 100 : "auto",
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className={cn(
        "relative transition-all duration-200",
        isDragging && "scale-[0.98]",
        isSorting && !isDragging && "transition-transform",
      )}
    >
      {/* Placeholder indicator when dragging over */}
      {isDragging && (
        <div 
          className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/40 rounded-lg pointer-events-none"
          style={{ zIndex: -1 }}
        />
      )}
      {children}
    </div>
  );
}

interface SortableHandleProps {
  className?: string;
  isDragging?: boolean;
}

export function SortableHandle({ className, isDragging }: SortableHandleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center w-8 h-8 cursor-grab active:cursor-grabbing touch-none rounded-md transition-all duration-150",
        "hover:bg-muted/80 active:bg-muted",
        isDragging && "cursor-grabbing bg-primary/10 text-primary",
        className
      )}
    >
      <GripVertical className={cn(
        "h-4 w-4 text-muted-foreground transition-colors duration-150",
        isDragging && "text-primary"
      )} />
    </div>
  );
}
