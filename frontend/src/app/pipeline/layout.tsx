"use client";

import { useState } from "react";
import Sidebar from "@/components/dashboard/sidebar";

interface PipelineLayoutProps {
  children: React.ReactNode;
}

export default function PipelineLayout({ children }: PipelineLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
