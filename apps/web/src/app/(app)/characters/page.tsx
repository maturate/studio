import { listCharactersWithPreview } from "@/features/characters/queries";
import { CharacterForm } from "@/features/characters/components/character-form";
import { CharacterCard } from "@/features/characters/components/character-card";

export default async function CharactersPage() {
  const characterRows = await listCharactersWithPreview();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Consistent character identities</h1>
        <p className="text-sm text-ink/55">Use a character&apos;s id in a Character Input node.</p>
      </div>

      <CharacterForm />

      {characterRows.length === 0 ? (
        <div className="rounded-none border border-dashed border-ink/15 px-6 py-16 text-center text-sm text-ink/45">
          No characters yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {characterRows.map((c) => (
            <CharacterCard
              key={c.id}
              character={{ id: c.id, name: c.name, description: c.description, mimeType: c.mimeType, previewUrl: c.previewUrl }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
