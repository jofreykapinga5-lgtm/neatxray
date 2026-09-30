"use client";

import { useRef, useState } from "react";

export default function Viewer({ images, index, onSelect }) {
  const [zoom, setZoom] = useState(1);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [invert, setInvert] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={current.name}
            draggable={false}
            className="absolute inset-0 m-auto max-h-full max-w-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              filter: `brightness(${brightness}%) contrast(${contrast}%) invert(${invert ? 1 : 0})`,
            }}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-sm text-white/60">No image selected</div>
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
            <button
              type="button"
              key={img.url}
              onClick={() => {
                onSelect(i);
                reset();
              }}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === index ? "border-accent" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
