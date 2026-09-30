"use client";

import { useRef, useState, useSyncExternalStore } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribe(onChange) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// True when the visitor asked for less motion or turned on Data Saver. Server render assumes true (poster only).
const prefersCalm = () => window.matchMedia(REDUCED_MOTION).matches || navigator.connection?.saveData === true;
const serverCalm = () => true;

// Decorative looping video with a visible pause control.
// It stays a still poster (no download) when the visitor prefers reduced motion or has Data Saver on,
// and they can still start it by pressing the button.
export default function AutoVideo({
  src,
  poster,
  wrapperClassName = "absolute inset-0",
  videoClassName = "h-full w-full object-cover",
  buttonClassName = "absolute bottom-3 right-3 z-10",
  showButton = true,
  children,
}) {
  const ref = useRef(null);
  const calm = useSyncExternalStore(subscribe, prefersCalm, serverCalm);
  const [startedByUser, setStartedByUser] = useState(false);
  const [playing, setPlaying] = useState(false);
  const active = !calm || startedByUser; // src attached

  function toggle() {
    const video = ref.current;
    if (!video) return;
    if (!active) {
      setStartedByUser(true); // attaching the source starts playback (autoPlay, muted)
      return;
    }
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  return (
    <>
      <div className={wrapperClassName} aria-hidden="true">
        <video
          ref={ref}
          className={videoClassName}
          src={active ? src : undefined}
          poster={poster}
          autoPlay={active}
          muted
          loop
          playsInline
          preload={active ? "metadata" : "none"}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
        />
        {children}
      </div>
      {showButton && (
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause background video" : "Play background video"}
        className={`${buttonClassName} grid h-11 w-11 place-items-center rounded-full border border-line bg-white/90 text-navy shadow-sm`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {playing ? (
            <>
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </>
          ) : (
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
          )}
        </svg>
      </button>
      )}
    </>
  );
}
