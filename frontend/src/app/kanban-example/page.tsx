"use client";

import { useState } from "react";
import { faker } from "@faker-js/faker";
import {
  KanbanBoard,
  KanbanCard,
  KanbanCards,
  KanbanHeader,
  KanbanProvider,
  type KanbanCardData,
} from "@/components/ui/kanban";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const columns = [
  { id: faker.string.uuid(), name: "Planned", color: "#6B7280" },
  { id: faker.string.uuid(), name: "In Progress", color: "#F59E0B" },
  { id: faker.string.uuid(), name: "Done", color: "#10B981" },
];

const users = Array.from({ length: 4 })
  .fill(null)
  .map(() => ({
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    image: faker.image.avatar(),
  }));

const exampleFeatures: KanbanCardData[] = Array.from({ length: 20 })
  .fill(null)
  .map(() => ({
    id: faker.string.uuid(),
    name: capitalize(faker.company.buzzPhrase()),
    startAt: faker.date.past({ years: 0.5, refDate: new Date() }),
    endAt: faker.date.future({ years: 0.5, refDate: new Date() }),
    column: faker.helpers.arrayElement(columns).id,
    owner: faker.helpers.arrayElement(users),
  }));

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export default function KanbanExample() {
  const [features, setFeatures] = useState(exampleFeatures);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Kanban Board Example
        </h1>
        <p className="text-muted-foreground">
          Drag and drop cards between columns to see the Kanban functionality in
          action.
        </p>
      </div>

      <KanbanProvider
        columns={columns}
        data={features}
        onDataChange={setFeatures}
      >
        {(column) => (
          <KanbanBoard id={column.id} key={column.id}>
            <KanbanHeader>
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
                <span className="font-semibold text-foreground">
                  {column.name}
                </span>
              </div>
            </KanbanHeader>
            <KanbanCards id={column.id}>
              {(feature: KanbanCardData) => (
                <KanbanCard
                  column={column.id}
                  id={feature.id}
                  key={feature.id}
                  name={feature.name}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                      <p className="m-0 flex-1 font-medium text-sm text-foreground">
                        {feature.name}
                      </p>
                    </div>
                    {feature.owner && (
                      <Avatar className="h-4 w-4 shrink-0">
                        <AvatarImage src={feature.owner.image} />
                        <AvatarFallback>
                          {feature.owner.name?.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <p className="m-0 text-muted-foreground text-xs">
                    {shortDateFormatter.format(feature.startAt)} -{" "}
                    {dateFormatter.format(feature.endAt)}
                  </p>
                </KanbanCard>
              )}
            </KanbanCards>
          </KanbanBoard>
        )}
      </KanbanProvider>
    </div>
  );
}
