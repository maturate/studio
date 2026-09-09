import Link from "next/link";
import { TopNav } from "@/components/app-shell/top-nav";
import { UserMenu } from "@/components/app-shell/user-menu";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-ink/10 bg-white px-3 py-2.5 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-8">
          <Link href="/playground" className="shrink-0 text-sm font-semibold tracking-tight">
            superOS <span className="hidden text-ink/50 sm:inline">Workflow Studio</span>
          </Link>
          <TopNav />
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <Link
            href="/settings"
            className="hidden rounded-none border border-ink/10 bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:text-ink/90 lg:block"
          >
            Budget: unset
          </Link>
          <UserMenu />
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
