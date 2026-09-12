import { useEffect, useState } from "react";

/**
 * digital dash by drake & future, the song the company is named after.
 * nothing loads until someone asks for it; then a small youtube player
 * (privacy-enhanced embed) appears in the corner and starts playing.
 */

const VIDEO_ID = "VWWM-TD9hYA";
const EVENT = "dd:song";

type Detail = "open" | "toggle" | "close";

/** ask the player to open, toggle, or close, from anywhere on the page. */
export function song(detail: Detail = "open") {
  window.dispatchEvent(new CustomEvent<Detail>(EVENT, { detail }));
}

export function SongPlayer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onSong(e: Event) {
      const detail = (e as CustomEvent<Detail>).detail;
      setOpen((v) => (detail === "toggle" ? !v : detail === "open"));
    }
    window.addEventListener(EVENT, onSong);
    return () => window.removeEventListener(EVENT, onSong);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <aside className="song" aria-label="now playing">
      <div className="song-head">
        <span>digital dash — drake &amp; future</span>
        <button type="button" className="song-close" onClick={() => setOpen(false)} aria-label="close the player">
          ×
        </button>
      </div>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0&playsinline=1`}
        title="digital dash by drake & future"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </aside>
  );
}
