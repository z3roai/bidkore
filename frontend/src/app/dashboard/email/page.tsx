"use client";

import { useState, useMemo } from "react";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  Mail,
  Inbox,
  Star,
  Clock,
  Send,
  FileText,
  Archive,
  Trash2,
  Search,
  PencilLine,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  MoreVertical,
  Circle,
} from "lucide-react";

type FolderKey = "inbox" | "starred" | "snoozed" | "sent" | "drafts" | "archived" | "trash";

interface Email {
  id: string;
  sender: {
    name: string;
    email: string;
    initials: string;
    color: string;
  };
  subject: string;
  snippet: string;
  date: string;
  unread?: boolean;
  attachments?: number;
  folder: FolderKey;
  labels?: string[];
}

const mockEmails: Email[] = [
  {
    id: "1",
    sender: { name: "John Doe", email: "john.doe@example.com", initials: "JD", color: "bg-blue-500" },
    subject: "Proposal Feedback and Next Steps",
    snippet: "Thank you for submitting your proposal. We've reviewed it and would like to discuss...",
    date: "Yesterday",
    unread: true,
    folder: "inbox",
    labels: ["Proposals"],
  },
  {
    id: "2",
    sender: { name: "Technical Support", email: "support@example.com", initials: "TS", color: "bg-green-500" },
    subject: "Technical Requirements Clarification",
    snippet: "We need some additional information about your technical approach. Please review...",
    date: "May 12",
    unread: true,
    attachments: 2,
    folder: "inbox",
    labels: ["Clients"],
  },
  {
    id: "3",
    sender: { name: "Air Force Acquisition", email: "acquisition@af.mil", initials: "AF", color: "bg-purple-500" },
    subject: "Contract Award Notification",
    snippet: "Congratulations! We are pleased to inform you that your proposal has been...",
    date: "May 10",
    unread: true,
    folder: "inbox",
    labels: ["Contracts"],
  },
  {
    id: "4",
    sender: { name: "GSA Contracting", email: "gsa-contracting@gsa.gov", initials: "GS", color: "bg-orange-500" },
    subject: "RFP Update: IT Infrastructure Project",
    snippet: "Dear Vendor, This email provides important updates regarding the IT Infrastructure Project...",
    date: "Today, 10:30 AM",
    unread: false,
    attachments: 2,
    folder: "inbox",
    labels: ["Proposals", "Follow-up"],
  },
];

const folders = [
  { key: "inbox" as FolderKey, label: "Inbox", icon: Inbox, count: 14 },
  { key: "starred" as FolderKey, label: "Starred", icon: Star },
  { key: "snoozed" as FolderKey, label: "Snoozed", icon: Clock },
  { key: "sent" as FolderKey, label: "Sent", icon: Send },
  { key: "drafts" as FolderKey, label: "Drafts", icon: FileText },
  { key: "archived" as FolderKey, label: "Archived", icon: Archive },
  { key: "trash" as FolderKey, label: "Trash", icon: Trash2 },
];

const labels = ["Proposals", "Clients", "Contracts", "Follow-up"];

export default function EmailPage() {
  const [selectedFolder, setSelectedFolder] = useState<FolderKey>("inbox");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(mockEmails[3]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeData, setComposeData] = useState({
    to: "",
    cc: "",
    bcc: "",
    subject: "",
    body: "",
  });
  const { addToast } = useToast();

  const filteredEmails = useMemo(() => {
    let emails = mockEmails.filter((email) => email.folder === selectedFolder);
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      emails = emails.filter(
        (email) =>
          email.subject.toLowerCase().includes(query) ||
          email.sender.name.toLowerCase().includes(query) ||
          email.snippet.toLowerCase().includes(query)
      );
    }
    return emails;
  }, [selectedFolder, searchQuery]);

  const getInitialsBgColor = (email: Email) => {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-orange-500",
      "bg-red-500",
      "bg-pink-500",
      "bg-indigo-500",
    ];
    const index = email.sender.initials.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="bg-background h-full flex flex-col p-6">
      <div className="bg-card rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Breadcrumb and Header */}
        <div className="p-6 pb-4 border-b border-border">
          <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Email" }]} className="mb-4" />
          <div className="mb-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">Email</h1>
            <p className="text-muted-foreground mt-1">Manage your proposal-related communications.</p>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel - Folders/Labels */}
          <div className="w-80 border-r border-border flex flex-col bg-muted/30">
            {/* Compose */}
            <div className="p-4 border-b border-border">
              <Button className="w-full gap-2" onClick={() => setIsComposeOpen(true)}>
                <PencilLine className="size-4" />
                Compose
              </Button>
            </div>

            {/* Folders */}
            <div className="p-4 border-b border-border">
              <div className="space-y-1">
                {folders.map((folder) => {
                  const Icon = folder.icon;
                  const isActive = selectedFolder === folder.key;
                  return (
                    <button
                      key={folder.key}
                      onClick={() => {
                        setSelectedFolder(folder.key);
                        setSelectedEmail(null);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        isActive
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="flex-1 text-left">{folder.label}</span>
                      {folder.count !== undefined && (
                        <span className={cn("text-xs", isActive ? "text-background/80" : "text-muted-foreground")}>
                          {folder.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Labels */}
            <div className="p-4 border-b border-border">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Labels</h3>
              <div className="space-y-1">
                {labels.map((label) => (
                  <button
                    key={label}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                  >
                    <Circle className="size-2 fill-current" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Middle Panel - Message List */}
          <div className="w-[420px] border-r border-border flex flex-col">
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredEmails.map((email) => {
                  const bgColor = getInitialsBgColor(email);
                  const isSelected = selectedEmail?.id === email.id;
                  return (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
                        isSelected ? "bg-accent" : "hover:bg-accent/50",
                        email.unread && "font-semibold"
                      )}
                    >
                      <div
                        className={cn(
                          "flex-shrink-0 size-10 rounded-full flex items-center justify-center text-white text-sm font-medium",
                          bgColor
                        )}
                      >
                        {email.sender.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className={cn(
                              "text-sm truncate",
                              email.unread ? "font-semibold text-foreground" : "text-muted-foreground"
                            )}
                          >
                            {email.sender.name}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{email.date}</span>
                        </div>
                        <div
                          className={cn(
                            "text-sm truncate mb-1",
                            email.unread ? "font-semibold text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {email.subject}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{email.snippet}</div>
                        {email.attachments && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <Paperclip className="size-3" />
                            <span>{email.attachments} attachments</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel - Email Detail */}
          <div className="flex-1 flex flex-col">
            {selectedEmail ? (
              <>
                {/* Email Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-2xl font-semibold text-foreground flex-1">{selectedEmail.subject}</h2>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        <Trash2 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Archive className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("size-10 rounded-full flex items-center justify-center text-white text-sm font-medium", getInitialsBgColor(selectedEmail))}>
                        {selectedEmail.sender.initials}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{selectedEmail.sender.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {selectedEmail.sender.email} • To: me
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">{selectedEmail.date}</div>
                  </div>
                </div>

                {/* Email Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="prose prose-sm max-w-none text-foreground">
                    {selectedEmail.id === "4" ? (
                      <div className="space-y-4">
                        <p>Dear Vendor,</p>
                        <p>
                          This email provides important updates regarding the IT Infrastructure Project
                          (Solicitation #GSA-IT-2023-05). We have made several changes based on vendor feedback:
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-4">
                          <li>Additional details on the cybersecurity requirements have been added to Section 4.3</li>
                          <li>The budget range has been updated to reflect current market conditions</li>
                        </ul>
                        <p>
                          Please acknowledge receipt of this update and ensure your proposal incorporates these changes.
                          Questions must be submitted by May 25th via the procurement portal.
                        </p>
                        <p>
                          A virtual Q&A session has been scheduled for May 30th at 2:00 PM EST. Registration details
                          will follow in a separate email.
                        </p>
                        <p className="mt-4">
                          Regards,<br />
                          Sarah Johnson
                        </p>
                      </div>
                    ) : (
                      <p>{selectedEmail.snippet}</p>
                    )}
                  </div>
                </div>

                {/* Reply Composer */}
                <div className="p-6 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Reply className="size-4" />
                      Reply
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <ReplyAll className="size-4" />
                      Reply All
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Forward className="size-4" />
                      Forward
                    </Button>
                  </div>
                  <div className="space-y-3">
                    <textarea
                      className="w-full min-h-[120px] rounded-lg border border-input bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                      placeholder="Type your reply..."
                    />
                    <div className="flex items-center justify-between">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Paperclip className="size-4" />
                        Attach
                      </Button>
                      <Button className="gap-2">
                        Send
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Mail className="size-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Select an email to view</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compose Email Dialog */}
      <Dialog open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Compose Email</DialogTitle>
            <DialogDescription>Create and send a new email message</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="to" className="text-sm font-medium">
                  To
                </label>
                <div className="flex items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowCc(!showCc)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cc
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBcc(!showBcc)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Bcc
                  </button>
                </div>
              </div>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={composeData.to}
                onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                className="focus-visible:ring-0"
              />
            </div>
            {showCc && (
              <div className="space-y-2">
                <label htmlFor="cc" className="text-sm font-medium">
                  Cc
                </label>
                <Input
                  id="cc"
                  type="email"
                  placeholder="cc@example.com"
                  value={composeData.cc}
                  onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                  className="focus-visible:ring-0"
                />
              </div>
            )}
            {showBcc && (
              <div className="space-y-2">
                <label htmlFor="bcc" className="text-sm font-medium">
                  Bcc
                </label>
                <Input
                  id="bcc"
                  type="email"
                  placeholder="bcc@example.com"
                  value={composeData.bcc}
                  onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                  className="focus-visible:ring-0"
                />
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="subject" className="text-sm font-medium">
                Subject
              </label>
              <Input
                id="subject"
                placeholder="Email subject"
                value={composeData.subject}
                onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                className="focus-visible:ring-0"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="body" className="text-sm font-medium">
                Message
              </label>
              <textarea
                id="body"
                className="w-full min-h-[300px] rounded-lg border border-input bg-background px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-0 resize-none"
                placeholder="Type your message here..."
                value={composeData.body}
                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between">
            <Button variant="outline" className="gap-2">
              <Paperclip className="size-4" />
              Attach File
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsComposeOpen(false)}>
                Cancel
              </Button>
              <Button
                className="gap-2"
                onClick={() => {
                  // Validate required fields
                  if (!composeData.to || !composeData.subject || !composeData.body) {
                    addToast({
                      title: "Missing Information",
                      description: "Please fill in all required fields (To, Subject, and Message).",
                      variant: "error",
                      duration: 4000,
                    });
                    return;
                  }

                  // Save recipient email for notification
                  const recipientEmail = composeData.to;

                  // Handle send email logic here
                  console.log("Sending email:", composeData);
                  
                  // Reset form
                  setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "" });
                  setShowCc(false);
                  setShowBcc(false);
                  setIsComposeOpen(false);
                  
                  // Show success notification
                  addToast({
                    title: "Email Sent",
                    description: `Your email to ${recipientEmail} has been sent successfully.`,
                    variant: "success",
                    duration: 4000,
                  });
                }}
              >
                <Send className="size-4" />
                Send
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

