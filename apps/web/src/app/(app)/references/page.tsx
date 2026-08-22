import { listReferencesWithPreview } from "@/features/references/queries";
import { ReferenceForm } from "@/features/references/components/reference-form";
import { ReferenceCard } from "@/features/references/components/reference-card";

export default async function ReferencesPage() {
  const referenceRows = await listReferencesWithPreview();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Reusable reference objects</h1>
        <p className="text-sm text-ink/55">
          Use a reference&apos;s id in a Reference Input node, or pick it directly once the workflow canvas gets an asset
          picker.
        </p>
      </div>

      <ReferenceForm />

      {referenceRows.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/45">
          No references yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {referenceRows.map((r) => (
            <ReferenceCard
              key={r.id}
              reference={{
                id: r.id,
                type: r.type,
                title: r.title,
                description: r.description,
                mimeType: r.mimeType,
                previewUrl: r.previewUrl,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
