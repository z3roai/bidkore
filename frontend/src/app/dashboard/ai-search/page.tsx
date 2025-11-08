"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MainButton from "@/components/main-button";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  Building2,
  DollarSign,
  Calendar,
  MapPin,
  Eye,
  Bookmark,
  Lightbulb,
  X,
} from "lucide-react";
import { AISearchResultCard } from "@/components/dashboard/ai-search-result-card";
import {
  mockAISearchOpportunities,
  type AISearchOpportunity,
} from "@/lib/mock-data";

interface AISearchResponse {
  success: boolean;
  query: string;
  searchType: string;
  aiServiceAvailable: boolean;
  filterSummary?: {
    keyword?: string;
    naicsCode?: string;
    agency?: string;
    postedFrom?: string;
    postedTo?: string;
    status?: string;
    type?: string;
  };
  opportunities: AISearchOpportunity[];
  total: number;
  limit: number;
  offset: number;
  source: string;
  searchedAt: string;
  message?: string;
}

export default function AISearchPage() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AISearchResponse | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [showMockData, setShowMockData] = useState(true);
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  
  // Filter values
  const [keywordSearch, setKeywordSearch] = useState<string>("");
  const [selectedAgency, setSelectedAgency] = useState<string>("");
  const [naicsCode, setNaicsCode] = useState<string>("");
  const [setAsideType, setSetAsideType] = useState<string>("");
  const [contractTypes, setContractTypes] = useState<Set<string>>(new Set());
  const [placeOfPerformance, setPlaceOfPerformance] = useState<string>("");
  const [datePosted, setDatePosted] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [awardAmountMin, setAwardAmountMin] = useState<string>("");
  const [awardAmountMax, setAwardAmountMax] = useState<string>("");
  const [pscCode, setPscCode] = useState<string>("");
  const [smallBusinessCategories, setSmallBusinessCategories] = useState<Set<string>>(new Set());

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const apiBase =
        (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(
          /\/+$/,
          ""
        ) + "/ai/search";

      const response = await fetch(apiBase, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.accessToken as string}`,
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          context: {
            includeRelated: true,
            maxResults: 20,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Search failed: ${response.status} ${response.statusText}`
        );
      }

      const data: AISearchResponse = await response.json();
      setSearchResults(data);
      setShowMockData(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during search"
      );
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleFilter = (filterName: string) => {
    if (filterName === "filters") {
      setShowFilterSidebar(!showFilterSidebar);
      return;
    }
    const newFilters = new Set(activeFilters);
    if (newFilters.has(filterName)) {
      newFilters.delete(filterName);
    } else {
      newFilters.add(filterName);
    }
    setActiveFilters(newFilters);
  };

  const clearAllFilters = () => {
    setActiveFilters(new Set());
    setKeywordSearch("");
    setSelectedAgency("");
    setNaicsCode("");
    setSetAsideType("");
    setContractTypes(new Set());
    setPlaceOfPerformance("");
    setDatePosted("");
    setDueDate("");
    setAwardAmountMin("");
    setAwardAmountMax("");
    setPscCode("");
    setSmallBusinessCategories(new Set());
  };

  const toggleContractType = (type: string) => {
    const newTypes = new Set(contractTypes);
    if (newTypes.has(type)) {
      newTypes.delete(type);
    } else {
      newTypes.add(type);
    }
    setContractTypes(newTypes);
  };

  const toggleSmallBusinessCategory = (category: string) => {
    const newCategories = new Set(smallBusinessCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setSmallBusinessCategories(newCategories);
  };

  const handleApplyFilters = () => {
    // TODO: Apply filters to search
    console.log("Applying filters:", {
      keywordSearch,
      selectedAgency,
      naicsCode,
      setAsideType,
      contractTypes: Array.from(contractTypes),
      placeOfPerformance,
      datePosted,
      dueDate,
      awardAmountMin,
      awardAmountMax,
      pscCode,
      smallBusinessCategories: Array.from(smallBusinessCategories),
    });
    // Close sidebar after applying
    setShowFilterSidebar(false);
  };

  return (
    <div className="bg-background p-6 relative">
      <div className="bg-card rounded-lg p-6 shadow-sm">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/dashboard" },
            { label: "AI Search" },
          ]}
          className="mb-6"
        />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-foreground mb-2">AI Search</h1>
          <p className="text-lg text-muted-foreground">
            Find relevant bids faster using AI.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search contracts, agencies, keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pl-10 h-12 text-base"
              />
            </div>
            <MainButton
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 h-12"
            >
              {isSearching ? "Searching..." : "AI Search"}
            </MainButton>
          </div>

          {/* Natural Language Prompt */}
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <Lightbulb className="h-4 w-4" />
            <span>
              Try natural language: &quot;DoD IT contracts over $1M in Virginia&quot;
            </span>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFilter("filters")}
            className={cn(
              "gap-2",
              activeFilters.has("filters") && "bg-accent"
            )}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFilter("agency")}
            className={cn(
              "gap-2",
              activeFilters.has("agency") && "bg-accent"
            )}
          >
            <Building2 className="h-4 w-4" />
            Agency
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFilter("budget")}
            className={cn(
              "gap-2",
              activeFilters.has("budget") && "bg-accent"
            )}
          >
            <DollarSign className="h-4 w-4" />
            Budget Range
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFilter("deadline")}
            className={cn(
              "gap-2",
              activeFilters.has("deadline") && "bg-accent"
            )}
          >
            <Calendar className="h-4 w-4" />
            Deadline
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleFilter("location")}
            className={cn(
              "gap-2",
              activeFilters.has("location") && "bg-accent"
            )}
          >
            <MapPin className="h-4 w-4" />
            Location
          </Button>
          {activeFilters.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="gap-2 text-muted-foreground"
            >
              <X className="h-4 w-4" />
              Clear All
            </Button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {/* Search Results */}
        {searchResults && (
          <div>
            <div className="mb-4 text-sm text-muted-foreground">
              Showing {searchResults.total} result{searchResults.total !== 1 ? "s" : ""}
            </div>
            <div className="space-y-4">
              {searchResults.opportunities.map((opportunity) => (
                <AISearchResultCard
                  key={opportunity.noticeId}
                  opportunity={opportunity}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mock Data Cards */}
        {showMockData && !searchResults && !isSearching && !error && (
          <div>
            <div className="mb-4 text-sm text-muted-foreground">
              Showing 3 results
            </div>
            <div className="space-y-4">
              {mockAISearchOpportunities.map((opportunity) => (
                <AISearchResultCard
                  key={opportunity.noticeId}
                  opportunity={opportunity}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!showMockData && !searchResults && !isSearching && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Enter a search query to find opportunities</p>
            <p className="text-sm mt-2">
              Use natural language to describe what you&apos;re looking for
            </p>
          </div>
        )}
      </div>

      {/* Filter Sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-80 bg-card border-l border-border shadow-lg z-50 transition-transform duration-300 ease-in-out overflow-y-auto",
          showFilterSidebar ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="p-6">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-foreground">Filters</h2>
            <button
              onClick={clearAllFilters}
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              Reset All
            </button>
          </div>

          {/* Filter Options */}
          <div className="space-y-6">
            {/* Keyword Search */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Keyword Search
              </label>
              <Input
                placeholder="Enter keywords..."
                value={keywordSearch}
                onChange={(e) => setKeywordSearch(e.target.value)}
              />
            </div>

            {/* Agency / Department */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Agency / Department
              </label>
              <Select value={selectedAgency || undefined} onValueChange={(value) => setSelectedAgency(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Agencies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agencies</SelectItem>
                  <SelectItem value="dod">Department of Defense</SelectItem>
                  <SelectItem value="dhs">Department of Homeland Security</SelectItem>
                  <SelectItem value="gsa">GSA</SelectItem>
                  <SelectItem value="va">Veterans Affairs</SelectItem>
                  <SelectItem value="doe">Department of Energy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* NAICS Code */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                NAICS Code
              </label>
              <Input
                placeholder="e.g., 541511"
                value={naicsCode}
                onChange={(e) => setNaicsCode(e.target.value)}
              />
            </div>

            {/* Set-Aside Type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Set-Aside Type
              </label>
              <Select value={setAsideType || undefined} onValueChange={(value) => setSetAsideType(value === "all" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Set-Asides" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Set-Asides</SelectItem>
                  <SelectItem value="total-small-business">Total Small Business</SelectItem>
                  <SelectItem value="8a">8(a)</SelectItem>
                  <SelectItem value="hubzone">HUBZone</SelectItem>
                  <SelectItem value="sdvosb">SDVOSB</SelectItem>
                  <SelectItem value="wosb">WOSB</SelectItem>
                  <SelectItem value="edwosb">EDWOSB</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Contract Type */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Contract Type
              </label>
              <div className="space-y-2">
                {["RFP", "RFQ", "RFI", "Sources Sought", "Solicitation", "Pre-Solicitation"].map((type) => (
                  <div key={type} className="flex items-center space-x-2">
                    <Checkbox
                      id={`contract-${type}`}
                      checked={contractTypes.has(type)}
                      onCheckedChange={() => toggleContractType(type)}
                    />
                    <label
                      htmlFor={`contract-${type}`}
                      className="text-sm text-foreground cursor-pointer"
                    >
                      {type}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Place of Performance */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Place of Performance
              </label>
              <Input
                placeholder="City, State, or ZIP"
                value={placeOfPerformance}
                onChange={(e) => setPlaceOfPerformance(e.target.value)}
              />
            </div>

            {/* Date Posted */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Date Posted
              </label>
              <Input
                type="date"
                placeholder="mm/dd/yyyy"
                value={datePosted}
                onChange={(e) => setDatePosted(e.target.value)}
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Due Date
              </label>
              <Input
                type="date"
                placeholder="mm/dd/yyyy"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            {/* Award Amount Range */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Award Amount Range
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Min</label>
                  <Input
                    type="number"
                    placeholder="Min"
                    value={awardAmountMin}
                    onChange={(e) => setAwardAmountMin(e.target.value)}
                  />
                </div>
                <span className="text-muted-foreground mt-5">-</span>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">Max</label>
                  <Input
                    type="number"
                    placeholder="Max"
                    value={awardAmountMax}
                    onChange={(e) => setAwardAmountMax(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* PSC Code */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                PSC Code
              </label>
              <Input
                placeholder="e.g., R425"
                value={pscCode}
                onChange={(e) => setPscCode(e.target.value)}
              />
            </div>

            {/* Small Business Category */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Small Business Category
              </label>
              <div className="space-y-2">
                {["Small Business", "8(a)", "HUBZone", "SDVOSB", "WOSB", "EDWOSB"].map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category}`}
                      checked={smallBusinessCategories.has(category)}
                      onCheckedChange={() => toggleSmallBusinessCategory(category)}
                    />
                    <label
                      htmlFor={`category-${category}`}
                      className="text-sm text-foreground cursor-pointer"
                    >
                      {category}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Apply Filters Button */}
            <MainButton
              className="w-full mt-6"
              onClick={handleApplyFilters}
            >
              Apply Filters
            </MainButton>
          </div>
        </div>
      </div>
    </div>
  );
}

