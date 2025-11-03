"use client";

import { useEffect, useRef, useState } from "react";
import Breadcrumb from "@/components/dashboard/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";
import Image from "next/image";

export default function CompanyProfilePage() {
  const { data: session } = useSession();
  const { addToast } = useToast();
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");

  const [companyName, setCompanyName] = useState("");
  const [dunsNumber, setDunsNumber] = useState("");
  const [cageCode, setCageCode] = useState("");
  const [ueiNumber, setUeiNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [founded, setFounded] = useState("");
  const [numberOfEmployees, setNumberOfEmployees] = useState("");
  const [certifications, setCertifications] = useState<string[]>([]);
  const [naicsCodes, setNaicsCodes] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!session?.accessToken) return;
      try {
        const resp = await fetch(`${apiBase}/company-profile`, {
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
        });
        if (!resp.ok) return;
        const data = await resp.json();
        const p = (data?.profile ?? {}) as Record<string, unknown>;
        if (typeof p.companyName === "string") setCompanyName(p.companyName);
        if (typeof p.dunsNumber === "string") setDunsNumber(p.dunsNumber);
        if (typeof p.cageCode === "string") setCageCode(p.cageCode);
        if (typeof p.ueiNumber === "string") setUeiNumber(p.ueiNumber);
        if (typeof p.businessAddress === "string") setBusinessAddress(p.businessAddress);
        if (typeof p.description === "string") setCompanyDescription(p.description);
        if (typeof p.founded === "string") setFounded(p.founded);
        if (typeof p.numberOfEmployees === "number") setNumberOfEmployees(String(p.numberOfEmployees));
        if (Array.isArray(p.certifications)) setCertifications(p.certifications as string[]);
        if (Array.isArray(p.naicsCodes)) setNaicsCodes(p.naicsCodes as string[]);
        if (typeof p.logoUrl === "string") setLogoUrl(p.logoUrl);
      } catch (e) {
        addToast({ title: "Failed to load profile", variant: "error" });
      }
    };
    void loadProfile();
  }, [session?.accessToken, apiBase, addToast]);

  const handleRemoveCertification = (cert: string) => {
    setCertifications(certifications.filter((c) => c !== cert));
  };

  const handleAddCertification = () => {
    const cert = prompt("Enter certification name:");
    if (cert && cert.trim()) {
      setCertifications([...certifications, cert.trim()]);
    }
  };

  const handleRemoveNaicsCode = (code: string) => {
    setNaicsCodes(naicsCodes.filter((c) => c !== code));
  };

  const handleAddNaicsCode = () => {
    const code = prompt("Enter NAICS code:");
    if (code && code.trim()) {
      setNaicsCodes([...naicsCodes, code.trim()]);
    }
  };

  const handleSave = async () => {
    if (!session?.accessToken) return;
    try {
      const resp = await fetch(`${apiBase}/company-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessToken as string}` },
        body: JSON.stringify({
          companyName,
          dunsNumber,
          cageCode,
          ueiNumber,
          businessAddress,
          description: companyDescription,
          founded,
          numberOfEmployees: Number(numberOfEmployees) || 0,
          certifications,
          naicsCodes,
        }),
      });
      if (resp.ok) addToast({ title: "Profile saved", variant: "success" });
      else addToast({ title: "Save failed", description: await resp.text(), variant: "error" });
    } catch (e) {
      addToast({ title: "Network error", variant: "error" });
    }
  };

  const handleUploadLogo = async (file: File) => {
    if (!session?.accessToken) return;
    try {
      const form = new FormData();
      form.append("logo", file);
      const resp = await fetch(`${apiBase}/company-profile/logo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken as string}` },
        body: form,
      });
      if (resp.ok) {
        const data = await resp.json();
        setLogoUrl(data.logoUrl as string);
        addToast({ title: "Logo uploaded", variant: "success" });
      } else {
        addToast({ title: "Upload failed", description: await resp.text(), variant: "error" });
      }
    } catch (e) {
      addToast({ title: "Network error", variant: "error" });
    }
  };

  return (
    <div className="bg-background h-full flex flex-col p-6">
      {/* Main Content Container with White Background */}
      <div className="bg-card rounded-lg p-6 shadow-sm flex-1">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[{ label: "Home", href: "/" }, { label: "Company Profile" }]}
          className="mb-6"
        />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">BidKore Company</h1>
          <p className="text-muted-foreground mt-1">
            Manage your company information used in proposals and documents.
          </p>
        </div>

        {/* Company Logo Section */}
        <Card className="mb-6">
          <CardHeader className="pt-5 pb-2">
            <CardTitle>Company Logo</CardTitle>
          </CardHeader>
          <CardContent className="py-5">
            <div className="flex items-center gap-6">
              <div className="flex items-center justify-center w-48 h-48 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 overflow-hidden">
                {logoUrl ? (
                  <Image src={logoUrl} alt="Company Logo" className="object-contain w-full h-full" />
                ) : (
                  <FileText className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleUploadLogo(f);
                  }}
                />
                <Button className="gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                  Upload Logo
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Information Section */}
        <Card className="mb-6">
          <CardHeader className="pt-5 pb-2">
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Company Name</label>
                <Input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">DUNS Number</label>
                <Input
                  value={dunsNumber}
                  onChange={(e) => setDunsNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">CAGE Code</label>
                <Input
                  value={cageCode}
                  onChange={(e) => setCageCode(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">UEI Number</label>
                <Input
                  value={ueiNumber}
                  onChange={(e) => setUeiNumber(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Business Address</label>
                <textarea
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  rows={3}
                  className={cn(
                    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "resize-y"
                  )}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Business Details Section */}
        <Card className="mb-6">
          <CardHeader className="pt-5 pb-2">
            <CardTitle>Business Details</CardTitle>
          </CardHeader>
          <CardContent className="py-5">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Company Description</label>
                <textarea
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                  rows={4}
                  className={cn(
                    "flex w-full rounded-md border border-input bg-background px-3 py-2 text-base shadow-sm transition-colors",
                    "placeholder:text-muted-foreground",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "resize-y"
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Founded</label>
                  <Input
                    value={founded}
                    onChange={(e) => setFounded(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Number of Employees</label>
                  <Input
                    value={numberOfEmployees}
                    onChange={(e) => setNumberOfEmployees(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certifications Section */}
        <Card className="mb-6">
          <CardHeader className="pt-5 pb-2">
            <CardTitle>Certifications</CardTitle>
          </CardHeader>
          <CardContent className="py-5">
            <div className="flex flex-wrap gap-2 mb-4">
              {certifications.map((cert) => (
                <div
                  key={cert}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background text-sm font-medium"
                >
                  <span>{cert}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCertification(cert)}
                    className="hover:bg-background/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              onClick={handleAddCertification}
              className="bg-muted hover:bg-muted/80"
            >
              + Add Certification
            </Button>
          </CardContent>
        </Card>

        {/* NAICS Codes Section */}
        <Card className="mb-6">
          <CardHeader className="pt-5 pb-2">
            <CardTitle>NAICS Codes</CardTitle>
          </CardHeader>
          <CardContent className="py-5">
            <div className="flex flex-wrap gap-2 mb-4">
              {naicsCodes.map((code) => (
                <div
                  key={code}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background text-sm font-medium"
                >
                  <span>{code}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveNaicsCode(code)}
                    className="hover:bg-background/20 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleAddNaicsCode}
                className="bg-muted hover:bg-muted/80"
              >
                + Add NAICS Code
              </Button>
              <p className="text-sm text-muted-foreground">
                NAICS codes help match your company to relevant contract opportunities
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline">Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}



