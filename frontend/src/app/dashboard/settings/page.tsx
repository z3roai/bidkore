"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useToast } from "@/components/ui/toast";
import Image from "next/image";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MainButton from "@/components/main-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Bell,
  Moon,
  Globe,
  Shield,
  AlertTriangle,
  Download,
  Trash2,
} from "lucide-react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { setTheme: setGlobalTheme } = useTheme();
  const { addToast } = useToast();

  // Notification states
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);

  // Appearance states
  const [theme, setTheme] = useState("Light");
  const [sidebarDisplay, setSidebarDisplay] = useState("Expanded");

  // Language & Region states
  const [language, setLanguage] = useState("English (US)");
  const [timezone, setTimezone] = useState("Pacific Time (PT)");

  // Privacy & Security states
  const [sessionTimeout, setSessionTimeout] = useState(true);

  // Dialog states
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Get user info from session
  const userName = session?.user?.name || "Raymond McCarthy";
  const userEmail = session?.user?.email || "Raymondmc@bidkore.co";
  const userAvatar = session?.user?.image || undefined;

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

  useEffect(() => {
    const loadSettings = async () => {
      if (!apiBase || !session?.accessToken) return;
      try {
        const resp = await fetch(`${apiBase}/users/settings`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken as string}`,
          },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const s = (data?.settings ?? {}) as Record<string, unknown>;
        if (typeof s.emailNotifications === "boolean") setEmailNotifications(s.emailNotifications);
        if (typeof s.pushNotifications === "boolean") setPushNotifications(s.pushNotifications);
        if (typeof s.weeklyDigest === "boolean") setWeeklyDigest(s.weeklyDigest);
        if (typeof s.marketingEmails === "boolean") setMarketingEmails(s.marketingEmails);
        if (typeof s.theme === "string") setTheme(s.theme as string);
        if (typeof s.sidebarDisplay === "string") setSidebarDisplay(s.sidebarDisplay as string);
        if (typeof s.language === "string") setLanguage(s.language as string);
        if (typeof s.timezone === "string") setTimezone(s.timezone as string);
        if (typeof s.sessionTimeout === "boolean") setSessionTimeout(s.sessionTimeout);
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    };
    void loadSettings();
  }, [apiBase, session?.accessToken]);

  useEffect(() => {
    const t = theme?.toLowerCase();
    if (t === "light" || t === "dark" || t === "system") {
      setGlobalTheme(t);
    }
  }, [theme, setGlobalTheme]);

  const handleSaveSettings = async () => {
    if (!apiBase || !session?.accessToken) return;
    try {
      const resp = await fetch(`${apiBase}/users/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken as string}`,
        },
        body: JSON.stringify({
          emailNotifications,
          pushNotifications,
          weeklyDigest,
          marketingEmails,
          theme,
          sidebarDisplay,
          language,
          timezone,
          sessionTimeout,
        }),
      });
      if (resp.ok) {
        addToast({
          title: "Settings saved",
          description: "Your preferences were updated.",
          variant: "success",
        });
      } else {
        const err = await resp.text();
        addToast({
          title: "Save failed",
          description: err || "Unable to update settings.",
          variant: "error",
        });
        console.error("Failed to save settings", err);
      }
    } catch (e) {
      console.error("Error saving settings", e);
      addToast({
        title: "Network error",
        description: "Failed to reach the server.",
        variant: "error",
      });
    }
  };

  const handleDownloadData = async () => {
    setShowDownloadDialog(false);
    if (!apiBase || !session?.accessToken) return;
    try {
      const resp = await fetch(`${apiBase}/users/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken as string}`,
        },
      });
      if (resp.ok) {
        const data = await resp.json();
        const url = (data?.downloadUrl as string) || undefined;
        if (url) window.open(url, "_blank");
      } else {
        console.error("Failed to request export", await resp.text());
      }
    } catch (e) {
      console.error("Export request error", e);
    }
  };

  const handleDeleteAccount = async () => {
    if (!apiBase || !session?.accessToken) return;
    try {
      setIsDeleting(true);
      const resp = await fetch(`${apiBase}/users/account/permanent`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken as string}`,
        },
        body: JSON.stringify({ confirm: true, email: session?.user?.email }),
      });
      setIsDeleting(false);
      setShowDeleteDialog(false);
      if (resp.ok) {
        await signOut({ callbackUrl: "/signin" });
      } else if (resp.status === 409) {
        console.error("Deletion blocked: team ownership");
      } else {
        console.error("Failed to delete account", await resp.text());
      }
    } catch (e) {
      setIsDeleting(false);
      console.error("Delete account error", e);
    }
  };

  return (
    <div className="bg-background h-full flex flex-col p-6 pb-28">
      {/* Main Content Container */}
      <div className="bg-card rounded-lg p-6 shadow-sm flex-1 flex flex-col relative">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "Settings" },
          ]}
          className="mb-6"
        />

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-lg text-muted-foreground">
            Manage your account preferences and application settings
          </p>
        </div>

        {/* Settings Sections */}
        <div className="flex-1 space-y-6 pb-24">
          {/* Notifications Section */}
          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">
                    Email Notifications
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Receive email updates about new opportunities and deadlines.
                  </div>
                </div>
                <Switch
                  checked={emailNotifications}
                  onCheckedChange={setEmailNotifications}
                  aria-label="Toggle email notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">
                    Push Notifications
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Get push notifications for important alerts.
                  </div>
                </div>
                <Switch
                  checked={pushNotifications}
                  onCheckedChange={setPushNotifications}
                  aria-label="Toggle push notifications"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">
                    Weekly Digest
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Receive a weekly summary of your activity.
                  </div>
                </div>
                <Switch
                  checked={weeklyDigest}
                  onCheckedChange={setWeeklyDigest}
                  aria-label="Toggle weekly digest"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">
                    Marketing Emails
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Receive emails about new features and updates.
                  </div>
                </div>
                <Switch
                  checked={marketingEmails}
                  onCheckedChange={setMarketingEmails}
                  aria-label="Toggle marketing emails"
                />
              </div>
            </CardContent>
          </Card>

          {/* Appearance Section */}
          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Moon className="h-5 w-5" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Theme
                </label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Light">Light</SelectItem>
                    <SelectItem value="Dark">Dark</SelectItem>
                    <SelectItem value="System">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Sidebar Display
                </label>
                <Select
                  value={sidebarDisplay}
                  onValueChange={(value) => {
                    setSidebarDisplay(value);
                    // Immediately update the sidebar when value changes
                    window.dispatchEvent(
                      new CustomEvent("sidebar-display-changed", {
                        detail: { sidebarDisplay: value },
                      })
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select display" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Expanded">Expanded</SelectItem>
                    <SelectItem value="Collapsed">Collapsed</SelectItem>
                    <SelectItem value="Auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Language & Region Section */}
          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Language & Region
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Language
                </label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English (US)">English (US)</SelectItem>
                    <SelectItem value="English (UK)">English (UK)</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="German">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Timezone
                </label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pacific Time (PT)">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Mountain Time (MT)">Mountain Time (MT)</SelectItem>
                    <SelectItem value="Central Time (CT)">Central Time (CT)</SelectItem>
                    <SelectItem value="Eastern Time (ET)">Eastern Time (ET)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Privacy & Security Section */}
          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacy & Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 py-5">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">
                    Session Timeout
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Automatically log out after 30 minutes of inactivity.
                  </div>
                </div>
                <Switch
                  checked={sessionTimeout}
                  onCheckedChange={setSessionTimeout}
                  aria-label="Toggle session timeout"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium text-foreground">
                    Download Your Data
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Download a copy of all your data stored in BidKore.
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowDownloadDialog(true)}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download Your Data
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone Section */}
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pt-5 pb-2">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 py-5">
              <div className="space-y-2">
                <div className="text-sm font-medium text-foreground">
                  Delete Account
                </div>
                <div className="text-sm text-muted-foreground">
                  Once you delete your account, there is no going back. Please
                  be certain.
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Bar */}
        <div className="sticky bottom-0 left-0 right-0 h-20 bg-card border-t border-border flex items-center justify-end px-6 mt-auto -mb-6 -mx-6 rounded-b-lg">
          {/* Save Settings Button */}
          <MainButton onClick={handleSaveSettings}>
            Save Settings
          </MainButton>
        </div>
      </div>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action cannot
              be undone. All your data will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Data Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Your Data</DialogTitle>
            <DialogDescription>
              We will prepare a ZIP file containing all your account data. This
              may take a few minutes. You will receive an email with the
              download link when it's ready.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDownloadDialog(false)}
            >
              Cancel
            </Button>
            <MainButton onClick={handleDownloadData}>
              Request Download
            </MainButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

