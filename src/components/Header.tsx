import { Link } from "react-router";
import { Logo } from "./Logo";
import { song } from "./SongPlayer";

export function Header() {
  return (
    <header className="header">
      <h1 className="wordmark">
        <Link to="/" className="wordmark">
          <Logo className="wordmark-logo" />
          digital dash dev
        </Link>
      </h1>
      <button
        type="button"
        className="song-toggle"
        onClick={() => song("toggle")}
        aria-label="play digital dash by drake & future"
      >
        ♪ play the song
      </button>
    </header>
  );
}
