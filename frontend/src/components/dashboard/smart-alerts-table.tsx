"use client";

import { useState } from "react";
import { Search, Columns3, Filter, Plus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import MainButton from "@/components/main-button";
import { cn } from "@/lib/utils";
import { SmartAlert } from "@/lib/mock-data";

interface SmartAlertsTableProps {
  alerts: SmartAlert[];
}

export default function SmartAlertsTable({ alerts }: SmartAlertsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAlerts = alerts.filter((alert) =>
    alert.contract.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Search and Action Bar */}
      <div className="flex items-center gap-4 flex-shrink-0 justify-between">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search alert"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Columns3 className="h-4 w-4" />
            Columns
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filter
          </Button>

          <MainButton className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add alert
          </MainButton>
        </div>
      </div>

      {/* Table */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="p-0 flex-1 flex flex-col">
          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead className="text-left p-4 font-medium text-muted-foreground">
                    Contract
                  </TableHead>
                  <TableHead className="text-left p-4 font-medium text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="text-left p-4 font-medium text-muted-foreground">
                    Interval
                  </TableHead>
                  <TableHead className="text-left p-4 font-medium text-muted-foreground">
                    Due Date
                  </TableHead>
                  <TableHead className="text-right p-4 font-medium text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="p-4 text-foreground font-medium">
                      {alert.contract}
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full",
                            alert.status === "Active"
                              ? "bg-green-500"
                              : "bg-red-500"
                          )}
                        />
                        <span className="text-foreground">{alert.status}</span>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-foreground">
                      {alert.interval}
                    </TableCell>
                    <TableCell className="p-4 text-foreground">
                      {alert.dueDate}
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
