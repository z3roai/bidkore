"use client";

import { useState, useMemo } from "react";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  FileText,
  Search,
  Filter,
  Grid3x3,
  List,
  Upload,
  Eye,
  Download,
  Trash2,
  MoreVertical,
  Calendar,
  Sparkles,
  Zap,
} from "lucide-react";

type TabKey = "all" | "contracts" | "proposals" | "templates";
type ViewMode = "grid" | "list";

interface Document {
  id: string;
  title: string;
  type: string;
  date: string;
  fileType: string;
  size: string;
}

export default function DocumentLibraryPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<string | null>("1");

  const documents: Document[] = useMemo(
    () => [
      { id: "1", title: "Contract Amendment", type: "contracts", date: "May 15, 2023", fileType: "DOCX", size: "2.4 MB" },
      { id: "2", title: "Budget Breakdown", type: "proposals", date: "May 15, 2023", fileType: "XLSX", size: "1.8 MB" },
      { id: "3", title: "Meeting Notes", type: "templates", date: "May 15, 2023", fileType: "TXT", size: "0.2 MB" },
      { id: "4", title: "Technical Proposal Template", type: "templates", date: "May 15, 2023", fileType: "PDF", size: "2.4 MB" },
      { id: "5", title: "Contract Amendment", type: "contracts", date: "May 14, 2023", fileType: "DOCX", size: "2.1 MB" },
      { id: "6", title: "Budget Breakdown", type: "proposals", date: "May 14, 2023", fileType: "XLSX", size: "1.9 MB" },
      { id: "7", title: "Meeting Notes", type: "templates", date: "May 14, 2023", fileType: "TXT", size: "0.3 MB" },
      { id: "8", title: "Contract Amendment", type: "contracts", date: "May 13, 2023", fileType: "DOCX", size: "2.3 MB" },
      { id: "9", title: "Budget Breakdown", type: "proposals", date: "May 13, 2023", fileType: "XLSX", size: "1.7 MB" },
      { id: "10", title: "Meeting Notes", type: "templates", date: "May 13, 2023", fileType: "TXT", size: "0.2 MB" },
      { id: "11", title: "Contract Amendment", type: "contracts", date: "May 12, 2023", fileType: "DOCX", size: "2.5 MB" },
      { id: "12", title: "Budget Breakdown", type: "proposals", date: "May 12, 2023", fileType: "XLSX", size: "1.6 MB" },
    ],
    []
  );

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesTab = activeTab === "all" || doc.type === activeTab;
      const matchesSearch =
        searchQuery === "" || doc.title.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [documents, activeTab, searchQuery]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "contracts", label: "Contracts" },
    { key: "proposals", label: "Proposals" },
    { key: "templates", label: "Templates" },
  ];

  return (
    <div className="bg-background h-full flex flex-col p-6">
      {/* Main Content Container with White Background */}
      <div className="bg-card rounded-lg p-6 shadow-sm flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Header row spanning full width */}
        <div className="lg:col-span-12">
          {/* Breadcrumb */}
          <Breadcrumb
            items={[{ label: "Home", href: "/dashboard" }, { label: "Document Library" }]}
            className="mb-6"
          />

          {/* Header */}
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">Document Library</h1>
              <p className="text-muted-foreground mt-1">
                Manage your documents, templates, and files.
              </p>
            </div>
            <Button className="gap-2 bg-foreground text-background hover:bg-foreground/90">
              <Upload className="size-4" />
              Upload Document
            </Button>
          </div>

          {/* Search, Filter, and View Controls */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="size-4" />
              Filter
            </Button>
            <div className="flex items-center gap-2 border rounded-md p-1">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="p-2"
                onClick={() => setViewMode("grid")}
              >
                <Grid3x3 className="size-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="p-2"
                onClick={() => setViewMode("list")}
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4">
            <div className="flex gap-6 border-b">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "pb-3 px-1 text-sm font-medium transition-colors relative",
                    activeTab === tab.key
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {activeTab === tab.key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main column */}
        <div className="flex flex-col lg:col-span-8 xl:col-span-9">

          {/* Document Grid/List */}
          <div className="flex-1 overflow-auto">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc) => (
                  <Card
                    key={doc.id}
                    className={cn(
                      "cursor-pointer transition-all hover:shadow-md",
                      selectedDocument === doc.id && "ring-2 ring-primary border-primary"
                    )}
                    onClick={() => setSelectedDocument(doc.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center justify-center size-12 rounded-md bg-muted">
                          <FileText className="size-6 text-muted-foreground" />
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="size-4" />
                        </Button>
                      </div>
                      <h3 className="font-semibold text-foreground mb-1">{doc.title}</h3>
                      <p className="text-xs text-muted-foreground mb-3">{doc.fileType}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                        <Calendar className="size-3" />
                        <span>{doc.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          <Download className="size-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2">
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Modified</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocuments.map((doc) => (
                      <TableRow
                        key={doc.id}
                        className={cn(
                          "cursor-pointer",
                          selectedDocument === doc.id && "bg-muted/50"
                        )}
                        onClick={() => setSelectedDocument(doc.id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center size-8 rounded-md bg-muted flex-shrink-0">
                              <FileText className="size-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{doc.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{doc.fileType}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{doc.size}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{doc.date}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Download className="size-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6 lg:col-span-4 xl:col-span-3">
          {/* AI Document Summary */}
          <Card>
            <CardHeader className="pt-5 pb-2">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center size-8 rounded-md bg-primary/10">
                  <Zap className="size-4 text-primary" />
                </div>
                <div>
                  <CardTitle>AI Document Summary</CardTitle>
                  <CardDescription>Intelligent analysis</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pb-5">
              <div className="rounded-md border p-4">
                <h3 className="font-semibold text-sm mb-2">Technical Proposal Template</h3>
                <p className="text-xs text-muted-foreground">
                  Comprehensive technical proposal template with sections for executive summary,
                  technical approach, past performance, and pricing. Includes compliance matrix and
                  evaluation criteria alignment.
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    <span>May 15, 2023</span>
                  </div>
                  <span>2.4 MB</span>
                </div>
              </div>

              {/* Key Topics */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Key Topics</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "Compliance", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
                    { label: "Technical", color: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300" },
                    { label: "Budget", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
                  ].map((topic) => (
                    <span
                      key={topic.label}
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        topic.color
                      )}
                    >
                      {topic.label}
                    </span>
                  ))}
                </div>
              </div>

              {/* Related Documents */}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Related Documents</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="size-4" />
                  <span>3 similar documents found</span>
                </div>
              </div>

              <Button variant="outline" className="w-full gap-2">
                <Sparkles className="size-4" />
                Get More Suggestions
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader className="pt-5 pb-2">
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Documents</span>
                <span className="text-sm font-semibold">248</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Storage Used</span>
                <span className="text-sm font-semibold">2.4 GB</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Shared Files</span>
                <span className="text-sm font-semibold">42</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

