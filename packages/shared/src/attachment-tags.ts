/**
 * Lets a prompt reference a specific attachment by position — `@attachment-1`,
 * `@attachment-2`, etc. — instead of a vague "the image"/"the second one",
 * which models otherwise have no reliable way to resolve when several
 * references are attached to one generation. `@attachment-N` never reaches
 * the model itself: it's replaced with that attachment's real display name
 * right before the prompt is sent, so the model sees an actual filename/title
 * it can anchor to.
 *
 * Shared between the Playground (an ordered array of attachments the user
 * builds directly) and the Workflow canvas (a generation node's wired
 * reference-type ports, numbered in a fixed collection order — see
 * `collectReferences` in `packages/workflow-engine/src/resolve.ts`).
 *
 * A tag with no matching attachment (out of range, or that slot has no name)
 * is left in the prompt untouched rather than silently deleted — a broken
 * reference should be visible, not vanish.
 */
export function resolveAttachmentTags(prompt: string, attachmentNames: (string | null | undefined)[]): string {
  return prompt.replace(/@attachment-(\d+)\b/g, (match, numStr: string) => {
    const name = attachmentNames[Number(numStr) - 1];
    return name ? name : match;
  });
}
