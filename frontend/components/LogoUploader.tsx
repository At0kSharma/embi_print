"use client";

import { useEffect, useRef, useState } from "react";
import { Check, FileImage, Loader2, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PrintMethod, Upload as UploadT } from "@/lib/types";

interface Props {
  onUploaded: (upload: UploadT, localPreviewUrl: string) => void;
  printMethod?: PrintMethod;
}

const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_BYTES = 10 * 1024 * 1024;

export function LogoUploader({ onUploaded, printMethod = "embroidery" }: Props) {
  const showStitchCount = printMethod === "embroidery";
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<UploadT | null>(null);

  // Poll until DST conversion finishes (or fails).
  useEffect(() => {
    if (!upload || upload.status === "done" || upload.status === "failed") {
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await api.getUpload(upload.id);
        if (cancelled) return;
        setUpload(next);
        if (next.status !== "done" && next.status !== "failed") {
          setTimeout(tick, 1000);
        }
      } catch {
        if (!cancelled) setTimeout(tick, 2000);
      }
    };
    const t = setTimeout(tick, 1000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [upload]);

  const handleFile = async (file: File) => {
    if (!ALLOWED.includes(file.type)) {
      toast.error("Unsupported file type", {
        description: "We accept PNG, JPG, and SVG files.",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("File too large", {
        description: "Logos must be under 10 MB.",
      });
      return;
    }
    const localPreview = URL.createObjectURL(file);
    setBusy(true);
    try {
      const u = await api.uploadLogo(file);
      setUpload(u);
      onUploaded(u, localPreview);
      if (u.status === "done") {
        toast.success("Logo uploaded", {
          description: showStitchCount
            ? `Stitch estimate: ${u.stitch_count?.toLocaleString() ?? "—"}`
            : "Ready to print.",
        });
      }
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail : String(e);
      toast.error("Upload failed", { description: detail });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setUpload(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Empty state ──
  if (!upload && !busy) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/30 px-6 py-10 text-center transition-all",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-foreground/40 hover:bg-muted/50",
        )}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-background shadow-sm ring-1 ring-border">
          <Upload className="h-4 w-4" />
        </div>
        <p className="text-sm font-medium">
          Drop your logo here, or{" "}
          <span className="underline underline-offset-2">browse</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          PNG, JPG, or SVG · max 10 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>
    );
  }

  // ── Busy / status state ──
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
            upload?.status === "done" && "bg-primary/10 text-primary",
            upload?.status === "failed" && "bg-amber-50 text-amber-700",
            (busy || upload?.status === "processing") && "bg-muted text-foreground",
          )}
        >
          {busy || upload?.status === "processing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : upload?.status === "done" ? (
            <Check className="h-4 w-4" />
          ) : upload?.status === "failed" ? (
            <FileImage className="h-4 w-4" />
          ) : (
            <FileImage className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {upload?.original_filename ?? "Uploading…"}
          </div>
          <div className="text-xs text-muted-foreground">
            {busy && "Uploading to server…"}
            {upload?.status === "processing" &&
              (showStitchCount ? "Estimating stitch count…" : "Processing…")}
            {upload?.status === "done" &&
              (showStitchCount && upload.stitch_count != null
                ? `${upload.stitch_count.toLocaleString()} stitches estimated`
                : "Ready to print")}
            {upload?.status === "failed" &&
              (showStitchCount
                ? "Stitch estimate unavailable · design will still print"
                : "Design will still print")}
          </div>
        </div>

        {upload && !busy && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={reset}
            aria-label="Replace logo"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>

      {(busy || upload?.status === "processing") && (
        <Progress value={busy ? 40 : 80} className="mt-3 h-1" />
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(",")}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </div>
  );
}
