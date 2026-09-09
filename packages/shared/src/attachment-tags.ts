/**
 * Lets a prompt reference a specific attachment instead of a vague "the image"
 * or "the second one", which models have no reliable way to resolve when
 * several references are attached to one generation.
 *
 * Tags are named after what the thing actually is — `@image-1`, `@video-1`,
 * `@audio-1` — falling back to `@attachment-1` only for types that don't map
 * to a modality. Items picked from the Reference or Character library are
 * tagged by their own name instead, since that name is already the meaningful
 * thing to say in a prompt ("@Sheldon Cooper", not "@attachment-3").
 *
 * The tag never reaches the model: it's replaced with the attachment's real
 * display name just before the prompt is sent.
 *
 * Shared between the Playground (an ordered list the user builds directly) and
 * the Workflow canvas (a generation node's wired reference ports).
 */

export interface TaggableAttachment {
  /** Asset type — image / images / frames / video / audio / anything else. */
  type?: string | null;
  /** Display name: asset title, reference title, or character name. */
  title?: string | null;
  /** Where it came from. Library items are tagged by name rather than by index. */
  source?: "asset" | "reference" | "character" | null;
}

export interface AttachmentTag {
  /** What the user types after "@". */
  tag: string;
  /** What that tag resolves to in the final prompt. */
  name: string;
}

const TYPE_PREFIX: Record<string, string> = {
  image: "image",
  images: "image",
  frames: "image",
  video: "video",
  audio: "audio",
};

export function attachmentTypePrefix(type?: string | null): string {
  return TYPE_PREFIX[(type ?? "").toLowerCase()] ?? "attachment";
}

/** Builds the tag list for a set of attachments, numbered per type. */
export function computeAttachmentTags(attachments: TaggableAttachment[]): AttachmentTag[] {
  const counters: Record<string, number> = {};
  return attachments.map((a) => {
    const name = (a.title ?? "").trim();

    // Library items carry a name a human chose — use it directly.
    if ((a.source === "reference" || a.source === "character") && name) {
      return { tag: name, name };
    }

    const prefix = attachmentTypePrefix(a.type);
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    const tag = `${prefix}-${counters[prefix]}`;
    return { tag, name: name || tag };
  });
}

/**
 * Replaces every `@tag` with its resolved name. Longest tag first, so
 * `@image-10` isn't half-eaten by `@image-1`, and a multi-word library name
 * matches before any shorter tag that happens to sit inside it.
 *
 * A tag with no matching attachment is left in the prompt untouched rather
 * than silently deleted — a broken reference should be visible.
 */
export function resolveAttachmentTags(prompt: string, tags: AttachmentTag[]): string {
  const ordered = [...tags].filter((t) => t.tag).sort((a, b) => b.tag.length - a.tag.length);
  let out = prompt;
  for (const { tag, name } of ordered) {
    out = out.split(`@${tag}`).join(name);
  }
  return out;
}
