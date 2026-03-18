import type { Metadata } from "next";
import Link from "next/link";
import { DOCS_NAV } from "./_nav";

export const metadata: Metadata = {
  title: {
    template: "%s // docs // crif",
    default: "docs // crif",
  },
  description:
    "Full reference, architecture, CLI, API shape, risk model, decoder coverage, and the April 2026 Drift exploit post-mortem.",
};

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link href="/" className="brand" aria-label="home">
            <span className="brand-dot" />
            <span>crif</span>
          </Link>
          <nav className="nav-links" aria-label="top">
            <Link href="/">home</Link>
            <Link href="/docs">docs</Link>
            <Link href="/docs/drift-2026">drift 2026</Link>
            <Link href="/api/health">health</Link>
          </nav>
          <a
            className="nav-cta"
            href="https://github.com/Nulltx-xyz/crif"
            rel="noopener"
          >
            github
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <div className="docs-shell">
        <aside className="docs-sidebar" aria-label="docs navigation">
          <div className="docs-sidebar-inner">
            <div className="docs-sidebar-badge">
              <span className="dot" />
              <span>docs · v0.1.0</span>
            </div>
            {DOCS_NAV.map((group) => (
              <div className="docs-nav-group" key={group.title}>
                <div className="docs-nav-group-title">{group.title}</div>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="docs-sidebar-fine">
              pre-deployment · mit · 2026
            </div>
          </div>
        </aside>

        <main className="docs-main" id="content">
          {children}
        </main>
      </div>

      <footer className="site">
        <div className="container">
          <div className="row">
            <div className="brand">
              <span className="mono">crif · docs</span>
            </div>
            <nav aria-label="footer">
              <Link href="/">home</Link>
              <a
                href="https://github.com/Nulltx-xyz/crif"
                rel="noopener"
              >
                github
              </a>
              <Link href="/api/health">health</Link>
              <Link href="/.well-known/crif.json">
                .well-known
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </>
  );
}
