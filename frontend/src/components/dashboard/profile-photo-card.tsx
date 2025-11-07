"use client";

import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Upload } from "lucide-react";
import ImageCropperDialog from "@/components/image/ImageCropperDialog";
import { useSession } from "next-auth/react";
import { useToast } from "@/components/ui/toast";

interface ProfilePhotoCardProps {
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

export default function ProfilePhotoCard({ firstName, lastName, avatarUrl }: ProfilePhotoCardProps) {
  const { data: session, update } = useSession();
  const { addToast } = useToast();
  const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api").replace(/\/+$/, "");
  const apiOrigin = apiBase.replace(/\/api$/, "");

  const initialPreview = avatarUrl ? (avatarUrl.startsWith("http") ? avatarUrl : `${apiOrigin}${avatarUrl}`) : null;
  const [preview, setPreview] = useState<string | null>(initialPreview);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const onPickFile = (file: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    setIsCropOpen(true);
  };

  const handleCrop = async (file: File) => {
    try {
      // Ensure <= 2MB; if larger, try JPEG recompress
      let finalFile = file;
      if (finalFile.size > 2 * 1024 * 1024) {
        const blob = await recompressToMax(finalFile, 2 * 1024 * 1024);
        finalFile = new File([blob], "avatar.jpg", { type: blob.type });
      }

      if (!session?.accessToken) {
        addToast({ title: "Not authenticated", variant: "error" });
        return;
      }
      const fd = new FormData();
      fd.append("avatar", finalFile);
      const resp = await fetch(`${apiBase}/users/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.accessToken as string}` },
        body: fd,
      });
      if (!resp.ok) {
        addToast({ title: "Upload failed", description: await resp.text(), variant: "error" });
        return;
      }
      const json = await resp.json().catch(() => null);
      const returnedUrl: string | undefined = json?.avatarUrl;
      const previewUrl = returnedUrl
        ? (returnedUrl.startsWith("http") ? returnedUrl : `${apiOrigin}${returnedUrl}`)
        : URL.createObjectURL(finalFile);
      setPreview(previewUrl);
      try {
        // Notify others (e.g., sidebar) to refresh avatar
        window.dispatchEvent(new CustomEvent("avatar-updated", { detail: { url: previewUrl } }));
        // Attempt to update NextAuth session image (if supported)
        if (typeof update === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (update as any)({ image: previewUrl });
        }
      } catch {}
      addToast({ title: "Avatar updated", variant: "success" });
    } catch (e) {
      addToast({ title: "Upload error", variant: "error" });
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-medium">Profile Photo</h2>
      <div className="flex flex-col items-center gap-4 text-center">
        <label
          htmlFor="profile-avatar-file"
          className="relative w-28 h-28 rounded-full bg-muted/40 border border-muted-foreground/30 overflow-hidden flex items-center justify-center text-xl font-semibold cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            <Image src={preview} alt="Avatar" fill className="object-cover" />
          ) : (
            <span>
              {(firstName?.[0] || "").toUpperCase()}
              {(lastName?.[0] || "").toUpperCase()}
            </span>
          )}
        </label>
        <div className="flex flex-col items-center gap-3">
          <Input
            ref={inputRef}
            id="profile-avatar-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickFile(f);
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" /> Upload Photo
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center">JPG, PNG or GIF. Max size 2MB</p>

      <ImageCropperDialog
        open={isCropOpen}
        onOpenChange={(o) => {
          setIsCropOpen(o);
          if (!o && objectUrl) {
            URL.revokeObjectURL(objectUrl);
            setObjectUrl(null);
          }
        }}
        objectUrl={objectUrl}
        title="Crop Avatar"
        description="Select a square area to use as your avatar."
        initialOutputWidth={512}
        initialOutputHeight={512}
        lockAspectDefault={true}
        outputMimeType="image/jpeg"
        outputQuality={0.9}
        onCrop={handleCrop}
      />
    </Card>
  );
}

async function recompressToMax(file: File, maxBytes: number): Promise<Blob> {
  const img = document.createElement("img");
  img.src = URL.createObjectURL(file);
  await new Promise((res) => (img.onload = res));
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  let quality = 0.9;
  let blob: Blob | null = null;
  for (; quality >= 0.5; quality -= 0.1) {
    // eslint-disable-next-line no-await-in-loop
    blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", quality));
    if (blob && blob.size <= maxBytes) return blob;
  }
  return blob || file;
}


