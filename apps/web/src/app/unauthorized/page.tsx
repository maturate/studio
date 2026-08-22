import { auth, signOut } from "@/lib/auth";

export default async function UnauthorizedPage() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-ink">
      <div className="w-full max-w-md space-y-6 rounded-none border border-ink/10 bg-ink/6 p-8 text-center backdrop-blur">
        <div className="space-y-2">
          <p className="text-sm font-mono uppercase tracking-[0.2em] text-ink/55">
            Access denied
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Not on the allowlist
          </h1>
          <p className="text-sm leading-6 text-ink/65">
            {session?.user?.email ? (
              <>
                <span className="text-ink/85">{session.user.email}</span> is not
                authorized for superOS Workflow Studio. Ask an admin to add this
                email to the allowlist.
              </>
            ) : (
              "This account is not authorized for superOS Workflow Studio."
            )}
          </p>
        </div>

        {session && (
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/sign-in" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-none border border-ink/15 bg-ink/8 px-4 py-3 text-sm font-medium text-ink transition hover:bg-ink/15"
            >
              Sign out and try a different account
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
