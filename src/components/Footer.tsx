const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="footer">
      <a href="mailto:hello@digitaldash.dev">hello@digitaldash.dev</a>
      <a href="https://github.com/samkhalsa/digitaldash-dev" target="_blank" rel="noreferrer noopener">
        source
      </a>
      <span className="copyright">© {year} digital dash dev</span>
    </footer>
  );
}
