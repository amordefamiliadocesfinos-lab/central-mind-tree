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
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => keyExtractor(item) === active.id);
      const newIndex = items.findIndex((item) => keyExtractor(item) === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      onReorder(newItems);
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
      <DragOverlay>
        {activeItem && activeIndex >= 0 ? (
          <div className="opacity-80 shadow-lg rounded-lg">
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
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

interface SortableHandleProps {
  className?: string;
}

export function SortableHandle({ className }: SortableHandleProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center w-6 h-6 cursor-grab active:cursor-grabbing touch-none",
        className
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
