"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/playground", label: "Playground" },
  { href: "/workflows", label: "Workflows" },
  { href: "/assets", label: "Asset Library" },
  { href: "/references", label: "References" },
  { href: "/characters", label: "Characters" },
  { href: "/runs", label: "Runs" },
  { href: "/settings", label: "Settings" },
] as const;

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (href: string) => {
    const active = pathname.startsWith(href);
    return `rounded-none px-3 py-2 text-sm font-medium transition ${
      active ? "bg-ink/10 text-ink" : "text-ink/60 hover:bg-ink/5 hover:text-ink/90"
    }`;
  };

  return (
    <>
      {/* Desktop: full inline nav. All 7 links in a row only fit from md up. */}
      <nav className="hidden items-center gap-1 md:flex">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Mobile: hamburger toggling a full-width dropdown panel. */}
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle navigation"
        aria-expanded={mobileOpen}
        className="flex h-9 w-9 items-center justify-center rounded-none border border-ink/10 text-ink/70 hover:bg-ink/5 md:hidden"
      >
        <span className="text-lg leading-none">{mobileOpen ? "✕" : "☰"}</span>
      </button>

      {mobileOpen && (
        <div className="fixed inset-x-0 top-[49px] z-30 border-b border-ink/10 bg-white shadow-sm md:hidden">
          <nav className="flex flex-col p-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`${linkClass(item.href)} w-full`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
