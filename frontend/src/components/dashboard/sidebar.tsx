"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Bell,
  FileText,
  BarChart3,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Mail,
  Users,
  Workflow,
  Building2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Logo from "@/components/logo";
import UserProfileCard from "@/components/dashboard/user-profile-card";

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Smart Alerts", icon: Bell, href: "/dashboard/smart-alerts" },
  { label: "AI Search", icon: Search, href: "/dashboard/ai-search" },
  { label: "Pipeline", icon: Workflow, href: "/pipeline" },
  {
    label: "Proposal Assistant",
    icon: FileText,
    href: "/dashboard/proposal-assistant",
  },
  {
    label: "Document Library",
    icon: Bookmark,
    href: "/dashboard/document-library",
  },
  {
    label: "Company profile",
    icon: Building2,
    href: "/dashboard/company-profile",
  },
  { label: "Email", icon: Mail, href: "/dashboard/email" },
  { label: "Team", icon: Users, href: "/dashboard/team" },
  { label: "Usage", icon: BarChart3, href: "/dashboard/usage" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({
  isCollapsed = false,
  onToggle,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "h-screen bg-background border-r border-border flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "border-b border-border flex items-center",
          isCollapsed ? "p-4 justify-center" : "p-6 justify-between",
        )}
      >
        <Logo isCollapsed={isCollapsed} />
        {onToggle && !isCollapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Toggle button for collapsed state */}
      {onToggle && isCollapsed && (
        <div className="p-2 border-b border-border flex justify-center">
          <button
            type="button"
            onClick={onToggle}
            className="p-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="Expand sidebar"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto",
          isCollapsed ? "px-2 py-4 space-y-1" : "px-4 py-6 space-y-2",
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center transition-all duration-200",
                isCollapsed
                  ? "justify-center p-3 rounded-lg"
                  : "space-x-3 rounded-lg px-3 py-4",
                "bg-card text-card-foreground",
                !isActive && "hover:bg-accent hover:text-accent-foreground",
                isActive ? "bg-foreground text-background shadow-sm" : "",
              )}
              title={isCollapsed ? item.label : undefined}
            >
              <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isActive ? "text-background" : "text-current",
                  )}
                />
              </div>
              {!isCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div
        className={cn("border-t border-border", isCollapsed ? "p-2" : "p-4")}
      >
        <UserProfileCard
          name="Raymond McCarthy"
          email="Raymondmc@bidkore.co"
          isCollapsed={isCollapsed}
        />
      </div>
    </aside>
  );
}
