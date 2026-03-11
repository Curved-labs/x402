import Link from "next/link";
import type { ReactNode } from "react";
import { getBreadcrumbs, getPager } from "./_nav";

export function DocHeader({
  eyebrow,
  title,
  lead,
  href,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  href: string;
}) {
  const crumbs = getBreadcrumbs(href);
  return (
    <>
      <nav className="docs-breadcrumb" aria-label="breadcrumb">
        {crumbs.map((c, i) => (
          <span key={c.href}>
            {i > 0 && <span className="sep">/</span>}
            {i === crumbs.length - 1 ? (
              <span>{c.label}</span>
            ) : (
              <Link href={c.href}>{c.label}</Link>
            )}
          </span>
        ))}
      </nav>
      <div className="docs-eyebrow">{eyebrow}</div>
      <h1 className="docs-h1">{title}</h1>
      <p className="docs-lead">{lead}</p>
    </>
  );
}

export function DocPager({ href }: { href: string }) {
  const { prev, next } = getPager(href);
  return (
    <nav className="docs-pager" aria-label="pagination">
      {prev ? (
        <Link href={prev.href} className="pager-link prev">
          <span className="pager-label">← previous</span>
          <span className="pager-title">{prev.label}</span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={next.href} className="pager-link next">
          <span className="pager-label">next →</span>
          <span className="pager-title">{next.label}</span>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "warn" | "critical" | "ok";
