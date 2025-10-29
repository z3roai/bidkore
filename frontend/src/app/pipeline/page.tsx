"use client";

import { useState } from "react";
import { Clock, MapPin, FileText, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
} from "@/components/ui/kanban";
import {
  pipelineColumns,
  pipelineCards,
  type PipelineCard,
} from "@/lib/mock-data";

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatTCV = (tcv: number) => {
  return `$${tcv.toFixed(1)}M`;
};

const getColumnStats = (columnId: string, cards: PipelineCard[]) => {
  const columnCards = cards.filter((card) => card.column === columnId);
  const count = columnCards.length;
  const totalTCV = columnCards.reduce((sum, card) => sum + (card.tcv || 0), 0);

  return { count, totalTCV };
};

export default function PipelinePage() {
  const [cards, setCards] = useState<PipelineCard[]>(pipelineCards);
  const [filter, setFilter] = useState("all");

  return (
    <div className="bg-background min-h-full p-6">
      {/* Main Content Container with White Background */}
      <div className="bg-white dark:bg-card rounded-lg p-6 shadow-sm">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[{ label: "Home", href: "/dashboard" }, { label: "Pipeline" }]}
          className="mb-6"
        />

        {/* Page Title */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-foreground mb-2">Pipeline</h1>
        </div>

        {/* Filter Toggle */}
        <div className="flex gap-2 mb-3">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={setFilter}
            className="bg-background p-2 rounded-lg gap-2"
          >
            <ToggleGroupItem
              value="all"
              className={`
                px-4 py-2 rounded-md
                transition-all duration-300
                data-[state=on]:bg-white
                data-[state=on]:text-foreground 
                dark:data-[state=on]:text-black
                data-[state=off]:text-muted-foreground
                data-[state=on]:scale-105
                data-[state=off]:scale-100
                `}
            >
              All
            </ToggleGroupItem>
            <ToggleGroupItem
              value="active"
              className={`
                px-4 py-2 rounded-md
                transition-all duration-300
                data-[state=on]:bg-white
                data-[state=on]:text-foreground 
                dark:data-[state=on]:text-black
                data-[state=off]:text-muted-foreground
                data-[state=on]:scale-105
                data-[state=off]:scale-100
                `}
            >
              Active
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Kanban Board */}
        <div>
          <KanbanProvider
            columns={pipelineColumns}
            data={cards}
            onDataChange={setCards}
          >
            {(column) => {
              const stats = getColumnStats(column.id, cards);

              return (
                <KanbanBoard
                  id={column.id}
                  key={column.id}
                  color={column.color}
                >
                  <KanbanHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: column.color }}
                        />
                        <span className="font-semibold text-foreground">
                          {column.name}
                        </span>
                        <div className="text-sm font-medium text-foreground px-2 py-1 rounded-md inline-block bg-secondary">
                          {stats.count}
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatTCV(stats.totalTCV)} (TCV)
                      </div>
                    </div>
                  </KanbanHeader>

                  <KanbanCards id={column.id}>
                    {(card: PipelineCard) => (
                      <KanbanCard
                        column={column.id}
                        id={card.id}
                        key={card.id}
                        name={card.name}
                      >
                        <div className="space-y-3">
                          {/* Program */}
                          {card.program && (
                            <div className="text-sm text-card-foreground/70">
                              Program: {card.program}
                            </div>
                          )}

                          {/* Divider Line */}
                          {card.program && (
                            <hr className="border-t border-border" />
                          )}

                          {/* Title */}
                          <div className="font-medium text-base text-card-foreground">
                            {card.name}
                          </div>

                          {/* Due Date */}
                          {card.dueDate && (
                            <div className="flex items-center gap-1 text-sm text-card-foreground/70">
                              <Clock className="h-4 w-4" />
                              Due: {formatDate(card.dueDate)}
                            </div>
                          )}

                          {/* Status */}
                          {card.status && (
                            <div className="flex items-center gap-1">
                              <div
                                className={cn(
                                  "h-2 w-2 rounded-full",
                                  card.status === "active"
                                    ? "bg-green-500"
                                    : "bg-red-500"
                                )}
                              />
                              <span className="text-sm font-medium capitalize text-card-foreground">
                                {card.status}
                              </span>
                            </div>
                          )}

                          {/* Location */}
                          {card.location && (
                            <div className="flex items-center gap-1 text-sm text-card-foreground/70">
                              <MapPin className="h-4 w-4" />
                              {card.location}
                            </div>
                          )}

                          {/* Documents */}
                          {card.documents && (
                            <div className="flex items-center gap-1 text-sm text-card-foreground/70">
                              <FileText className="h-4 w-4" />
                              {card.documents} Docs
                            </div>
                          )}

                          {/* Department */}
                          {card.department && (
                            <div className="flex items-center gap-1 text-sm text-card-foreground/70">
                              <Banknote className="h-4 w-4" />
                              {card.department}
                            </div>
                          )}
                        </div>
                      </KanbanCard>
                    )}
                  </KanbanCards>
                </KanbanBoard>
              );
            }}
          </KanbanProvider>
        </div>
      </div>
    </div>
  );
}
