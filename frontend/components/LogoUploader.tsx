"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Upload } from "@/lib/types";

interface Props {
  onUploaded: (upload: Upload, localPreviewUrl: string) => void;
}

const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];

export function LogoUploader({ onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);

  // Poll until DST conversion finishes (or fails). Server returns the
  // final status synchronously today, but the polling stays so we tolerate
  // any future shift back to async without changing the UI.
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
        // Swallow transient errors; will retry next tick.
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
    setError(null);
    if (!ALLOWED.includes(file.type)) {
      setError(`Unsupported file type: ${file.type}`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File exceeds 10MB limit");
      return;
    }
    const localPreview = URL.createObjectURL(file);
    setBusy(true);
    try {
      const u = await api.uploadLogo(file);
      setUpload(u);
      onUploaded(u, localPreview);
    } catch (e) {
      const detail = e instanceof ApiError ? e.detail : String(e);
      setError(`Upload failed: ${detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div
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
        onClick={() => inputRef.current?.click()}
        className={`flex h-32 cursor-pointer items-center justify-center rounded border-2 border-dashed text-center text-sm transition ${
          dragOver
            ? "border-neutral-900 bg-neutral-100"
            : "border-neutral-300 hover:border-neutral-500"
        }`}
      >
        {busy
          ? "Uploading…"
          : upload
            ? `Selected: ${upload.original_filename}`
            : "Drop a PNG / JPG / SVG (max 10MB), or click to choose"}
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      {upload && upload.status === "done" && upload.stitch_count != null && (
        <p className="text-sm text-neutral-600">
          Estimated stitches: {upload.stitch_count.toLocaleString()}
        </p>
      )}
      {upload && upload.status === "processing" && (
        <p className="text-sm text-neutral-500">Estimating stitch count…</p>
      )}
      {upload && upload.status === "failed" && (
        <p className="text-sm text-amber-700">
          Stitch-count estimate unavailable. Your design will still print.
        </p>
      )}
    </div>
  );
}
