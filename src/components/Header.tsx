import { Link } from "react-router";
import { Logo } from "./Logo";

export function Header() {
  return (
    <header className="header">
      <h1 className="wordmark">
        <Link to="/" className="wordmark">
          <Logo className="wordmark-logo" />
          digital dash dev
        </Link>
      </h1>
    </header>
  );
}
