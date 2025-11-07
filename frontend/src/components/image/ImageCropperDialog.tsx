"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImageCropperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectUrl: string | null;
  title?: string;
  description?: string;
  initialOutputWidth?: number;
  initialOutputHeight?: number;
  lockAspectDefault?: boolean;
  primaryLabel?: string;
  outputMimeType?: "image/png" | "image/jpeg";
  outputQuality?: number; // for jpeg
  onCrop: (file: File) => Promise<void> | void;
}

export default function ImageCropperDialog({
  open,
  onOpenChange,
  objectUrl,
  title = "Crop Image",
  description = "Select the area to keep.",
  initialOutputWidth = 512,
  initialOutputHeight = 512,
  lockAspectDefault = true,
  primaryLabel = "Crop & Save",
  outputMimeType = "image/png",
  outputQuality = 0.92,
  onCrop,
}: ImageCropperDialogProps) {
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const cropContainerRef = useRef<HTMLDivElement | null>(null);

  const [imgNatural, setImgNatural] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [imgDisplay, setImgDisplay] = useState<{ w: number; h: number; offX: number; offY: number }>({ w: 0, h: 0, offX: 0, offY: 0 });
  const [crop, setCrop] = useState<{ x: number; y: number; size: number }>({ x: 0, y: 0, size: 0 });
  const [dragState, setDragState] = useState<{ dragging: boolean; startX: number; startY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ resizing: boolean; startX: number; startY: number; startSize: number } | null>(null);
  const [outputW, setOutputW] = useState<number>(initialOutputWidth);
  const [outputH, setOutputH] = useState<number>(initialOutputHeight);
  const [lockAspect, setLockAspect] = useState<boolean>(lockAspectDefault);

  useEffect(() => {
    if (!open) return;
    setOutputW(initialOutputWidth);
    setOutputH(initialOutputHeight);
    setLockAspect(lockAspectDefault);
  }, [open, initialOutputWidth, initialOutputHeight, lockAspectDefault]);

  const onCropImageLoad = () => {
    const img = cropImgRef.current;
    const container = cropContainerRef.current;
    if (!img || !container) return;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    setImgNatural({ w: naturalW, h: naturalH });

    const contW = container.clientWidth;
    const contH = container.clientHeight;
    const scale = Math.min(contW / naturalW, contH / naturalH);
    const dispW = Math.max(1, Math.floor(naturalW * scale));
    const dispH = Math.max(1, Math.floor(naturalH * scale));
    const offX = Math.floor((contW - dispW) / 2);
    const offY = Math.floor((contH - dispH) / 2);
    setImgDisplay({ w: dispW, h: dispH, offX, offY });

    const initSize = Math.floor(Math.min(dispW, dispH) * 0.8);
    const initX = offX + Math.floor((dispW - initSize) / 2);
    const initY = offY + Math.floor((dispH - initSize) / 2);
    setCrop({ x: initX, y: initY, size: initSize });
  };

  const onCropPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({ dragging: true, startX: e.clientX, startY: e.clientY });
  };
  const onCropPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragState) return;
    const dx = e.clientX - dragState.startX;
    const dy = e.clientY - dragState.startY;
    setDragState({ dragging: true, startX: e.clientX, startY: e.clientY });
    setCrop((prev) => {
      const nx = Math.min(Math.max(prev.x + dx, imgDisplay.offX), imgDisplay.offX + imgDisplay.w - prev.size);
      const ny = Math.min(Math.max(prev.y + dy, imgDisplay.offY), imgDisplay.offY + imgDisplay.h - prev.size);
      return { ...prev, x: nx, y: ny };
    });
  };
  const onCropPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragState(null);
  };

  const onResizePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setResizeState({ resizing: true, startX: e.clientX, startY: e.clientY, startSize: crop.size });
  };
  const onResizePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!resizeState) return;
    const dx = e.clientX - resizeState.startX;
    const dy = e.clientY - resizeState.startY;
    const delta = Math.max(dx, dy);
    setResizeState({ ...resizeState, startX: e.clientX, startY: e.clientY, startSize: resizeState.startSize + delta });
    setCrop(prev => {
      const minSize = 40;
      const maxRight = imgDisplay.offX + imgDisplay.w - prev.x;
      const maxBottom = imgDisplay.offY + imgDisplay.h - prev.y;
      const maxSize = Math.max(minSize, Math.min(maxRight, maxBottom));
      const nextSize = Math.max(minSize, Math.min(resizeState.startSize + delta, maxSize));
      return { ...prev, size: nextSize };
    });
  };
  const onResizePointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setResizeState(null);
  };

  const applyCrop = async () => {
    if (!objectUrl || imgNatural.w === 0 || imgDisplay.w === 0) return;
    const scale = imgDisplay.w / imgNatural.w;
    const srcX = Math.max(0, Math.round((crop.x - imgDisplay.offX) / scale));
    const srcY = Math.max(0, Math.round((crop.y - imgDisplay.offY) / scale));
    const srcSize = Math.max(1, Math.round(crop.size / scale));

    const img = document.createElement("img");
    img.src = objectUrl;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement("canvas");
    const w = Math.max(32, Math.min(4096, Math.floor(outputW)));
    const h = Math.max(32, Math.min(4096, Math.floor(outputH)));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, canvas.width, canvas.height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), outputMimeType, outputMimeType === "image/jpeg" ? outputQuality : undefined)
    );
    if (!blob) return;
    const file = new File([blob], outputMimeType === "image/jpeg" ? "image.jpg" : "image.png", { type: outputMimeType });
    await onCrop(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div ref={cropContainerRef} className="relative w-full h-[480px] bg-muted rounded-md overflow-hidden">
          {objectUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={cropImgRef}
              src={objectUrl}
              alt="Crop source"
              className="absolute inset-0 m-auto max-w-full max-h-full select-none pointer-events-none"
              onLoad={onCropImageLoad}
            />
          )}
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] cursor-move"
            style={{ left: `${crop.x}px`, top: `${crop.y}px`, width: `${crop.size}px`, height: `${crop.size}px` }}
            onPointerDown={onCropPointerDown}
            onPointerMove={onCropPointerMove}
            onPointerUp={onCropPointerUp}
          />
          <div
            className="absolute bg-white border border-black/40 rounded-sm w-4 h-4 cursor-nwse-resize"
            style={{ left: `${crop.x + crop.size - 8}px`, top: `${crop.y + crop.size - 8}px` }}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
          />
        </div>
        <div className="flex items-center justify-between mt-4 gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Width</span>
              <Input
                type="number"
                className="w-24"
                value={outputW}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setOutputW(v);
                  if (lockAspect) setOutputH(v);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Height</span>
              <Input
                type="number"
                className="w-24"
                value={outputH}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  setOutputH(v);
                  if (lockAspect) setOutputW(v);
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">Lock</span>
            <Switch checked={lockAspect} onCheckedChange={(v) => {
              setLockAspect(v);
              if (v) setOutputH(outputW);
            }} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={applyCrop}>{primaryLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


