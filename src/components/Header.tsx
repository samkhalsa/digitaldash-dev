import { Link } from "react-router";

export function Header() {
  return (
    <header className="header">
      <h1 className="wordmark">
        <Link to="/" className="wordmark">
          digital dash dev
        </Link>
      </h1>
    </header>
  );
}
