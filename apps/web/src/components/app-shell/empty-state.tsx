export function EmptyState({
  eyebrow,
  title,
  description,
  hint,
}: {
  eyebrow: string;
  title: string;
  description: string;
  hint?: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-6 py-20">
      <span className="rounded-full border border-ink/15 bg-ink/8 px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] text-ink/60">
        {eyebrow}
      </span>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="max-w-xl text-sm leading-7 text-ink/65">{description}</p>
      {hint && (
        <div className="mt-2 rounded-none border border-ink/10 bg-ink/5 px-4 py-3 text-xs text-ink/50">
          {hint}
        </div>
      )}
    </div>
  );
}
