import Link from "next/link";
import { TopNav } from "@/components/app-shell/top-nav";
import { UserMenu } from "@/components/app-shell/user-menu";

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white text-ink">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-ink/10 bg-white px-6 py-3">
        <div className="flex items-center gap-8">
          <Link href="/playground" className="text-sm font-semibold tracking-tight">
            superOS <span className="text-ink/50">Workflow Studio</span>
          </Link>
          <TopNav />
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/settings"
            className="hidden rounded-none border border-ink/10 bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/60 transition hover:text-ink/90 sm:block"
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
