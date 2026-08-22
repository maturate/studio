import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;

  if (session?.user?.isAuthorized) {
    redirect(callbackUrl ?? "/playground");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-ink">
      <div className="w-full max-w-sm space-y-8 rounded-none border border-ink/10 bg-ink/6 p-8 text-center backdrop-blur">
        <div className="space-y-2">
          <p className="text-sm font-mono uppercase tracking-[0.2em] text-ink/55">
            superOS internal
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Workflow Studio</h1>
          <p className="text-sm leading-6 text-ink/65">
            Sign in with an authorized superOS Google account to continue.
          </p>
        </div>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl ?? "/playground" });
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-none border border-ink/15 bg-[#004c37] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#00614a]"
          >
            Continue with Google
          </button>
        </form>

        <p className="text-xs text-ink/40">
          Access is restricted to the superOS team allowlist.
        </p>
      </div>
    </main>
  );
}
