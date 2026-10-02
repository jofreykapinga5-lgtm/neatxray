"use client";

import { useRef, useState } from "react";

export default function Viewer({ images, index, onSelect, onUpload, onCamera, onFiles, onRemove, busy }) {
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);

  const current = images[index];

  function reset() {
    setZoom(1);
    setBrightness(100);
    setContrast(100);
    setInvert(false);
    setPan({ x: 0, y: 0 });
  }

  function onPointerDown(e) {
    drag.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag.current) return;
    setPan({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
  }
  function onPointerUp() {
    drag.current = null;
  }
  function onWheel(e) {
    setZoom((z) => Math.min(6, Math.max(1, z - e.deltaY * 0.002)));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer?.files?.length) onFiles?.(e.dataTransfer.files);
  }

  // Nothing added yet: the viewer is the invitation, so the first action is right here.
  if (images.length === 0) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex min-h-[300px] flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed bg-viewer px-6 py-12 text-center text-white transition-colors ${
          dragging ? "border-accent bg-white/10" : "border-white/25"
        }`}
      >
        <svg width="44" height="44" viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path d="M4 11V8a4 4 0 0 1 4-4h3M21 4h3a4 4 0 0 1 4 4v3M28 21v3a4 4 0 0 1-4 4h-3M11 28H8a4 4 0 0 1-4-4v-3" stroke="#1aa7c4" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M9 16h14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
        <div>
          <h2 className="font-serif text-2xl">Add an X-ray</h2>
          <p className="mt-1 text-sm text-white/75">Drop an image or PDF here, or choose how to add it.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-primary !bg-white !text-navy" disabled={busy} onClick={onUpload}>
            Upload image or PDF
          </button>
          <button type="button" className="btn-on-dark" disabled={busy} onClick={onCamera}>
            Use camera
          </button>
        </div>
        <p className="text-xs text-white/60">JPG, PNG, WebP, HEIC and PDF. Photos of films work too.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-viewer text-white flex flex-col">
      <div
        className="relative h-[52vh] min-h-[280px] overflow-hidden touch-none cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {onRemove && current?.blob && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemove(index)}
            aria-label="Remove this image"
            title="Remove this image"
            className="absolute right-3 top-3 z-10 grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-black/55 text-white backdrop-blur transition-colors hover:bg-black/75"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
          </button>
        )}
        {current && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.name}
            key={current.url}
            draggable={false}
            className="motion-fade absolute inset-0 m-auto max-h-full max-w-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert ? 1 : 0})`,
            }}
          />
        )}
      </div>

      <div className="grid gap-3 p-4 text-sm sm:grid-cols-3 bg-white/5">
        <label className="flex flex-col gap-1">
          <span className="text-white/70">Zoom</span>
          <input type="range" min="1" max="6" step="0.1" value={zoom} onChange={(e) => setZoom(+e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-white/70">Brightness</span>
          <input type="range" min="40" max="200" value={brightness} onChange={(e) => setBrightness(+e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-white/70">Contrast</span>
          <input type="range" min="40" max="250" value={contrast} onChange={(e) => setContrast(+e.target.value)} />
        </label>
        <div className="flex gap-2 sm:col-span-3">
          <button type="button" onClick={() => setInvert((v) => !v)} aria-pressed={invert} className="btn-on-dark">
            Invert
          </button>
          <button type="button" onClick={reset} className="btn-on-dark">
            Reset view
          </button>
        </div>
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-3 bg-black/30">
          {images.map((img, i) => (
            <div key={img.url} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSelect(i);
                  reset();
                }}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === index ? "true" : undefined}
                className={`block h-16 w-16 overflow-hidden rounded-lg border-2 ${i === index ? "border-accent" : "border-transparent"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
              {onRemove && img.blob && (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  aria-label={`Remove image ${i + 1}`}
                  className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/65 text-white hover:bg-black/85"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
