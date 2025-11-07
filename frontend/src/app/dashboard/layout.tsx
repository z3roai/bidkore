"use client"

import { useEffect, useState } from "react"
import Sidebar from "@/components/dashboard/sidebar"
import { useSession } from "next-auth/react"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { data: session } = useSession()

  useEffect(() => {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "")
    const loadSidebarSetting = async () => {
      try {
        if (!session?.accessToken) return
        const resp = await fetch(`${apiBase}/users/settings`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
        })
        if (!resp.ok) return
        const data = await resp.json()
        const s = (data?.settings ?? {}) as Record<string, unknown>
        const display = typeof s.sidebarDisplay === "string" ? s.sidebarDisplay : undefined
        if (display === "Collapsed") setIsCollapsed(true)
        if (display === "Expanded") setIsCollapsed(false)
        // if Auto, leave as default
      } catch {
        // ignore
      }
    }
    void loadSidebarSetting()
  }, [session?.accessToken])

  // Listen for immediate sidebar display changes from settings page
  useEffect(() => {
    const handleSidebarDisplayChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ sidebarDisplay: string }>
      const display = customEvent.detail?.sidebarDisplay
      if (display === "Collapsed") {
        setIsCollapsed(true)
      } else if (display === "Expanded") {
        setIsCollapsed(false)
      }
      // if Auto, leave as default
    }

    window.addEventListener("sidebar-display-changed", handleSidebarDisplayChange)
    return () => {
      window.removeEventListener("sidebar-display-changed", handleSidebarDisplayChange)
    }
  }, [])

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

