import { auth, signOut } from "@/lib/auth";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="text-right leading-tight">
        <p className="text-sm font-medium text-ink/90">
          {session.user.name ?? session.user.email}
        </p>
        <p className="text-xs text-ink/45">{session.user.role}</p>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/sign-in" });
        }}
      >
        <button
          type="submit"
          className="rounded-none border border-ink/10 bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 transition hover:bg-ink/10 hover:text-ink"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
