"use client";

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

  return (
    <nav className="flex items-center gap-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-none px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-ink/10 text-ink"
                : "text-ink/60 hover:bg-ink/5 hover:text-ink/90"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
