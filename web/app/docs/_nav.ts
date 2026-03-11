export type DocLink = {
  href: string;
  label: string;
};

export type DocGroup = {
  title: string;
  items: DocLink[];
};

export const DOCS_NAV: DocGroup[] = [
  {
    title: "Getting started",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/getting-started", label: "Quickstart" },
      { href: "/docs/architecture", label: "Architecture" },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/docs/cli", label: "CLI" },
      { href: "/docs/api-reference", label: "LegibilityReport" },
      { href: "/docs/risk-model", label: "Risk model" },
      { href: "/docs/decoders", label: "Decoder coverage" },
    ],
  },
  {
    title: "Security",
    items: [{ href: "/docs/drift-2026", label: "Drift 2026 post-mortem" }],
  },
  {
    title: "Integrate",
    items: [{ href: "/docs/integrate", label: "Rust library usage" }],
  },
];

// Flat ordered list for prev/next navigation.
export const DOCS_ORDER: DocLink[] = DOCS_NAV.flatMap((g) => g.items);

export function getPager(currentHref: string): {
  prev: DocLink | null;
  next: DocLink | null;
} {
  const i = DOCS_ORDER.findIndex((d) => d.href === currentHref);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? DOCS_ORDER[i - 1] : null,
    next: i < DOCS_ORDER.length - 1 ? DOCS_ORDER[i + 1] : null,
  };
}

export function getBreadcrumbs(currentHref: string): DocLink[] {
  const found = DOCS_ORDER.find((d) => d.href === currentHref);
  if (!found) return [{ href: "/docs", label: "Docs" }];
  if (found.href === "/docs") return [{ href: "/docs", label: "Docs" }];
  return [
    { href: "/docs", label: "Docs" },
    { href: found.href, label: found.label },
  ];
}
