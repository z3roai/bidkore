"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";

// Types
export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
}

export interface KanbanCardData {
  id: string;
  name: string;
  column: string;
  description?: string;
  tags?: string[];
  avatar?: {
    id: string;
    name: string;
    image?: string;
  };
  dueDate?: Date;
  startDate?: Date;
  endDate?: Date;
  startAt?: Date;
  endAt?: Date;
  owner?: {
    id: string;
    name: string;
    image?: string;
  };
  status?: "active" | "inactive";
  location?: string;
  documents?: number;
  department?: string;
  program?: string;
  tcv?: number;
}

interface KanbanContextType {
  columns: KanbanColumn[];
  data: KanbanCardData[];
  onDataChange: (data: KanbanCardData[]) => void;
  activeCard: KanbanCardData | null;
  setActiveCard: (card: KanbanCardData | null) => void;
}

const KanbanContext = createContext<KanbanContextType | null>(null);

const useKanbanContext = () => {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error("useKanbanContext must be used within a KanbanProvider");
  }
  return context;
};

// Provider Component
interface KanbanProviderProps {
  columns: KanbanColumn[];
  data: KanbanCardData[];
  onDataChange: (data: KanbanCardData[]) => void;
  children: (column: KanbanColumn) => React.ReactNode;
}

export function KanbanProvider({
  columns,
  data,
  onDataChange,
  children,
}: KanbanProviderProps) {
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const card = data.find((item) => item.id === active.id);
      setActiveCard(card || null);
    },
    [data]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) return;

      const activeCard = data.find((item) => item.id === active.id);
      if (!activeCard) return;

      // Check if dropping over a column
      const overColumn = columns.find((col) => col.id === over.id);
      if (overColumn && activeCard.column !== overColumn.id) {
        const updatedData = data.map((item) =>
          item.id === activeCard.id ? { ...item, column: overColumn.id } : item
        );
        onDataChange(updatedData);
        return;
      }

      // Check if dropping over another card
      const overCard = data.find((item) => item.id === over.id);
      if (overCard && activeCard.column !== overCard.column) {
        const updatedData = data.map((item) =>
          item.id === activeCard.id
            ? { ...item, column: overCard.column }
            : item
        );
        onDataChange(updatedData);
      }
    },
    [data, columns, onDataChange]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveCard(null);

      if (!over) return;

      const activeCard = data.find((item) => item.id === active.id);
      if (!activeCard) return;

      // Check if dropping over a column
      const overColumn = columns.find((col) => col.id === over.id);
      if (overColumn && activeCard.column !== overColumn.id) {
        const updatedData = data.map((item) =>
          item.id === activeCard.id ? { ...item, column: overColumn.id } : item
        );
        onDataChange(updatedData);
        return;
      }

      // Check if dropping over another card
      const overCard = data.find((item) => item.id === over.id);
      if (overCard && activeCard.column !== overCard.column) {
        const updatedData = data.map((item) =>
          item.id === activeCard.id
            ? { ...item, column: overCard.column }
            : item
        );
        onDataChange(updatedData);
      }
    },
    [data, columns, onDataChange]
  );

  const contextValue: KanbanContextType = {
    columns,
    data,
    onDataChange,
    activeCard,
    setActiveCard,
  };

  return (
    <KanbanContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-6">
          {columns.map((column) => children(column))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <KanbanCard
              id={activeCard.id}
              column={activeCard.column}
              name={activeCard.name}
              className="opacity-50"
            >
              <div className="p-3">
                <p className="font-medium text-sm">{activeCard.name}</p>
              </div>
            </KanbanCard>
          ) : null}
        </DragOverlay>
      </DndContext>
    </KanbanContext.Provider>
  );
}

// Board Component
interface KanbanBoardProps {
  id: string;
  children: React.ReactNode;
  className?: string;
  color?: string;
}

export function KanbanBoard({
  id,
  children,
  className,
  color: _color,
}: KanbanBoardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-full min-w-80 flex-col rounded-lg p-4 bg-gradient-to-br from-[#F3F4F1] to-[#E8E8E8] dark:bg-[#000000] dark:from-transparent dark:to-transparent",
        isOver && "ring-2 ring-primary ring-opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}

// Header Component
interface KanbanHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function KanbanHeader({ children, className }: KanbanHeaderProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

// Cards Container Component
interface KanbanCardsProps {
  id: string;
  children: (card: KanbanCardData) => React.ReactNode;
  className?: string;
}

export function KanbanCards({ id, children, className }: KanbanCardsProps) {
  const { data } = useKanbanContext();
  const columnCards = data.filter((card) => card.column === id);

  return (
    <SortableContext
      items={columnCards.map((card) => card.id)}
      strategy={verticalListSortingStrategy}
    >
      <div className={cn("flex flex-col gap-3", className)}>
        {columnCards.map((card) => children(card))}
      </div>
    </SortableContext>
  );
}

// Card Component
interface KanbanCardProps {
  id: string;
  column: string;
  name: string;
  children: React.ReactNode;
  className?: string;
}

export function KanbanCard({
  id,
  column,
  name,
  children,
  className,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: {
      type: "card",
      card: { id, column, name },
    },
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab rounded-lg p-3 shadow-sm transition-all hover:shadow-md bg-white dark:bg-[#0A0A0A] text-foreground",
        isDragging && "opacity-50",
        className
      )}
    >
      {children}
    </div>
  );
}
