"use client";

import { useEffect, useRef, useState } from "react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setError("Camera access was blocked or no camera was found. You can upload a photo instead.");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Camera">
      <div className="w-full max-w-2xl rounded-2xl bg-viewer p-4 text-white space-y-3">
        {error ? (
          <p className="p-6 text-sm">{error}</p>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl bg-black" />
        )}
        <p className="text-xs text-white/60">
          Tip: photograph the film straight on, avoid glare, and fill the frame. Photos of screens give lower-quality readings.
        </p>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="btn-on-dark">
            Close
          </button>
          {!error && (
            <button type="button" onClick={snap} className="btn-primary !bg-accent hover:!bg-accent-strong">
              Take photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
