/**
 * Script Builder series definitions — one entry per content series from the
 * marketing knowledge base (superOS/Docs/marketing/{main-accounts,sub-accounts,content}.md).
 * Each series defines its own input form and prompt-building logic, since the
 * copywriter inputs and the character voice differ completely per series.
 *
 * Prompt quality here is intentionally uneven: series are being tuned one at
 * a time with real reference material (character voice samples, past scripts).
 * Anything not yet tuned is marked `tuned: false` and uses a best-effort
 * prompt built only from the documented mechanic + governing rules — good
 * enough to test the pipeline, not guaranteed to nail the character voice.
 */

export type ScriptField =
  | { key: string; label: string; type: "text"; placeholder?: string }
  | { key: string; label: string; type: "textarea"; placeholder?: string; rows?: number }
  | { key: string; label: string; type: "number"; placeholder?: string; min?: number; max?: number }
  | { key: string; label: string; type: "range"; min: number; max: number; step: number; default: number }
  | { key: string; label: string; type: "select"; options: string[]; default: string }
  /** A repeatable group of sub-fields — e.g. one row per chatbot, per tool, per option. */
  | { key: string; label: string; type: "repeat"; itemLabel: string; fields: ScriptField[] };

export interface ScriptSeries {
  id: string;
  label: string;
  account: "main" | "sub";
  character: string;
  /** "manual" series don't call the model at all — the copywriter writes the script directly. */
  mode: "ai" | "manual";
  /** Whether the prompt below has been validated against real reference material yet. */
  tuned: boolean;
  fields: ScriptField[];
  buildPrompt?: (values: Record<string, unknown>) => string;
}

const GOVERNING_RULES = `Follow these rules for every script, no exceptions:
- Focus on ONE clear idea per video. At most 2-3 closely related points — one is the default.
- Never invent fake pain points or fake product advantages. If a claim isn't how superOS actually works today, leave it out.
- Never write like blunt ad copy — even when clearly promotional, it must read as entertaining, useful, or native to a short-form feed.
- End with a natural push toward one of: use superOS now, sign up now, or join the waitlist for a not-yet-launched feature. Don't force a CTA line that breaks the tone — let it land naturally.
- Output ONLY the script itself — no preamble, no explanation, no markdown headers.`;

const ENTERTAINMENT_CLASS = `This is an ENTERTAINMENT-CLASS script (per superOS's content rules). superOS is allowed to be rude, roasty, dark, or absurd here — this is a marketing persona, not how superOS behaves in real utility content. Lean into personality over politeness. Roughly half of all scripts across the campaign should land harsher/tougher and half more positive/relieving — vary the emotional temperature rather than defaulting to one mood every time.`;

const UTILITY_CLASS = `This is a UTILITY-CLASS script (per superOS's content rules). superOS must never come across as a negative character — it should feel dependable, capable, authoritative, and helpful throughout.`;

const DURATION_FIELD: ScriptField = {
  key: "durationSeconds",
  label: "Target duration (seconds)",
  type: "range",
  min: 10,
  max: 60,
  step: 1,
  default: 30,
};

function durationLine(v: Record<string, unknown>): string {
  return `TARGET DURATION: about ${v.durationSeconds || 30} seconds of spoken narration — pace the script to actually fit that runtime, not longer.`;
}

function formatRepeat(label: string, items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return `${label}: (none provided)`;
  return `${label}:\n${items
    .map((item, i) => {
      if (typeof item !== "object" || item === null) return `  ${i + 1}. ${String(item)}`;
      const parts = Object.entries(item as Record<string, unknown>)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" | ");
      return `  ${i + 1}. ${parts}`;
    })
    .join("\n")}`;
}

export const SCRIPT_SERIES: ScriptSeries[] = [
  // ── Main account ──────────────────────────────────────────────────────
  {
    id: "chatbots-vs-superos",
    label: "Chatbots vs superOS",
    account: "main",
    character: "Sheldon Cooper (The Big Bang Theory)",
    mode: "ai",
    // Voice is built from general knowledge of the real character, not from
    // superOS's own reference clips/scripts for this series (main-accounts.md's
    // Instagram/YouTube links) — flip to true once checked against those.
    tuned: false,
    fields: [
      { key: "situation", label: "Situation context", type: "textarea", rows: 3, placeholder: "The hypothetical morality/decision situation posed to each chatbot…" },
      {
        key: "chatbotResponses",
        label: "What each chatbot said",
        type: "repeat",
        itemLabel: "Chatbot",
        fields: [
          { key: "name", label: "Chatbot name", type: "text", placeholder: "ChatGPT, Claude, Gemini…" },
          { key: "response", label: "What it said", type: "textarea", rows: 2 },
        ],
      },
      {
        key: "direction",
        label: "Direction",
        type: "select",
        options: [
          "roast them as losers — savage/dark-humour superOS answer",
          "reality check — compare the viral clip's claim to what the real models actually said",
          "smart + authoritative — superOS makes the hard call with confidence and reasoning",
        ],
        default: "roast them as losers — savage/dark-humour superOS answer",
      },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${ENTERTAINMENT_CLASS}

SERIES: Chatbots vs superOS — a reaction/comparison format. A hypothetical morality situation gets posed to several AI chatbots. Each chatbot's real (or claimed) answer is shown, then superOS roasts those answers and gives its own take. This is entertainment-first, not a dry benchmark — the contrast should feel opinionated and fun, not neutral.

CHARACTER VOICE: Write superOS's lines in the voice of Sheldon Cooper from The Big Bang Theory — pedantic, hyper-logical, condescendingly certain he's the smartest one in the room, prone to correcting people's imprecision, delivers devastating putdowns as if they're simple objective facts, occasionally cites a rule/precedent/his own genius as justification. He is NOT rude for shock value — he's rude because he genuinely, sincerely believes everyone else is beneath his reasoning.

DIRECTION FOR THIS SCRIPT: ${v.direction}

SITUATION POSED TO EACH CHATBOT:
${v.situation}

${formatRepeat("WHAT EACH CHATBOT SAID", v.chatbotResponses)}

${durationLine(v)}

TASK: Write a short response for EVERY chatbot listed above — as Sheldon/superOS reacting to and roasting that specific chatbot's answer — followed by Sheldon/superOS's own "hard truth" opinion on what should actually be done in this situation. Keep each per-chatbot reaction to 1-2 sentences; the final hard-truth opinion can run slightly longer. Format clearly with the chatbot name as a label before each reaction, then a final "superOS:" section for the hard truth.`,
  },
  {
    id: "death-vs-superos",
    label: "Death vs superOS",
    account: "main",
    character: "Deadpool (Ryan Reynolds)",
    mode: "ai",
    tuned: false,
    fields: [
      { key: "situation", label: "Life-or-death situation", type: "textarea", rows: 3 },
      {
        key: "options",
        label: "Options available and their outcomes",
        type: "repeat",
        itemLabel: "Option",
        fields: [
          { key: "option", label: "Option", type: "text" },
          { key: "result", label: "Result if chosen", type: "textarea", rows: 2 },
        ],
      },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${ENTERTAINMENT_CLASS}

SERIES: Death vs superOS — a survival reaction format. The viewer sees a life-or-death situation from their own POV, is asked what they'd do, then superOS tells them the best way to survive it. Not about literal realism — about entertainment, contrast, and memorability, with superOS as the calm operator in a high-stakes moment.

CHARACTER VOICE: Write superOS's lines in the voice of Deadpool (Ryan Reynolds' performance) — fourth-wall-aware, sarcastic, breezily nonchalant even about horrific danger, quick pop-culture quips, treats mortal peril like a minor inconvenience he's mildly amused by. Confident, funny, a little unhinged — but the actual survival advice given must be genuinely the best option among those listed, not a joke answer.

SITUATION:
${v.situation}

${formatRepeat("OPTIONS AND OUTCOMES", v.options)}

${durationLine(v)}

TASK: Write a script, timed to roughly the target duration, where superOS (as Deadpool) nonchalantly walks through why the other options fail and lands on the best possible way to survive — in character the whole way through.`,
  },
  {
    id: "ai-reacts",
    label: "AI Reacts",
    account: "main",
    character: "Ted (the movie Ted)",
    mode: "ai",
    tuned: false,
    fields: [
      { key: "context", label: "Context of the clip/moment", type: "textarea", rows: 3 },
      { key: "highlights", label: "Highlights worth reacting to", type: "textarea", rows: 3 },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${ENTERTAINMENT_CLASS}

SERIES: AI Reacts — the loosest, most fun main-account series. superOS reacts to trending clips or internet moments in a sarcastic, entertaining way. The job is to roast what's happening while still landing a real take — not mean for no reason, but bolder and more unfiltered than a polite generic assistant. Disgust, shock, or blunt disbelief are all fair game if they land funny.

CHARACTER VOICE: Write superOS's lines in the voice of Ted from the movie Ted — loose, shameless, foul-mouthed-but-not-actually-profane energy, brutally honest, a little dumb-smart, treats absurd things completely casually and casual things with mock outrage. Controversial and roasty on purpose, but never mean without a point.

CONTEXT OF THE CLIP:
${v.context}

HIGHLIGHTS TO REACT TO:
${v.highlights}

${durationLine(v)}

TASK: Write superOS's (as Ted) reaction script to this clip — roast it, riff on the highlights, and land at least one real, useful, or surprisingly sharp take by the end.`,
  },
  {
    id: "tools-you-should-know",
    label: "Tools You Should Know",
    account: "main",
    character: "UGC voiceover (neutral, fast, useful)",
    mode: "ai",
    tuned: false,
    fields: [
      { key: "hook", label: "Hook", type: "textarea", rows: 2 },
      {
        key: "tools",
        label: "Tools",
        type: "repeat",
        itemLabel: "Tool",
        fields: [
          { key: "name", label: "Tool / use case name", type: "text" },
          { key: "context", label: "Context", type: "textarea", rows: 2 },
          { key: "durationSeconds", label: "Max duration (seconds)", type: "number", min: 3, max: 30 },
        ],
      },
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${UTILITY_CLASS}

SERIES: Tools You Should Know — "powerful websites you should know #" style format. Fast, useful, easy-to-scan. The creator talks to camera, a phone/tablet shows the flow. Only the website + WhatsApp surfaces should appear (never other interfaces) — the goal is to make superOS feel immediately practical, one use case at a time.

VOICE: Fast, punchy AI UGC voiceover. Confident and useful, zero fluff, "here's a thing you should know" energy — never salesy.

HOOK: ${v.hook}

TOOLS/USE CASES TO COVER:
${formatRepeat("Tools", v.tools)}

TASK: Write one short voiceover line/beat per tool, each one clearly UNDER that tool's stated max duration (write tight, not padded) — paced for a fast cut between each. Start with the hook, then move through each tool in order.`,
  },
  {
    id: "ai-hacks-illegal",
    label: "AI Hacks That Feel Illegal",
    account: "main",
    character: "UGC voiceover (neutral, fast, useful)",
    mode: "ai",
    tuned: false,
    fields: [
      { key: "hook", label: "Hook", type: "textarea", rows: 2 },
      {
        key: "hacks",
        label: "Hacks",
        type: "repeat",
        itemLabel: "Hack",
        fields: [
          { key: "name", label: "Hack name", type: "text" },
          { key: "context", label: "Context", type: "textarea", rows: 2 },
          { key: "durationSeconds", label: "Max duration (seconds)", type: "number", min: 3, max: 30 },
        ],
      },
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${UTILITY_CLASS}

SERIES: AI Hacks That Feel Illegal — same fast-explainer format family as Tools You Should Know, but framed as "when did ChatGPT/Claude/Gemini get this update?" — superOS is shown being accessed through MCP or an app-style integration INSIDE those other AI products, not through website + WhatsApp. Still grounded in real or credibly buildable product behavior — this is a stronger "this feels unfairly powerful" hook, not a fake claim.

VOICE: Fast, punchy AI UGC voiceover. Confident, a little conspiratorial ("nobody's telling you this"), zero fluff — never salesy, never a made-up capability.

HOOK: ${v.hook}

HACKS TO COVER:
${formatRepeat("Hacks", v.hacks)}

TASK: Write one short voiceover line/beat per hack, each one clearly UNDER that hack's stated max duration (write tight, not padded) — paced for a fast cut between each. Start with the hook, then move through each hack in order, framed as being accessed from inside another AI product via superOS's MCP/app integration.`,
  },

  // ── Sub accounts ─────────────────────────────────────────────────────
  {
    id: "character-podcast",
    label: "Character Podcast",
    account: "sub",
    character: "Up to 3 of: Pikachu, CJ, Spider-Man, Kid Goku, Doraemon, Batman",
    mode: "ai",
    tuned: false,
    fields: [
      { key: "topic", label: "Podcast topic / context", type: "textarea", rows: 3 },
      {
        key: "characters",
        label: "Characters and their views (max 3)",
        type: "repeat",
        itemLabel: "Character",
        fields: [
          {
            key: "name",
            label: "Character",
            type: "select",
            options: ["Pikachu", "CJ", "Spider-Man", "Kid Goku", "Doraemon", "Batman"],
            default: "Pikachu",
          },
          { key: "opinion", label: "Their view/opinion on the topic", type: "textarea", rows: 2 },
        ],
      },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${UTILITY_CLASS}

SERIES: Character Podcast (sub-account) — a small fixed cast of recognizable parody characters having a podcast-style conversation about the product in this niche. Must sound like a REAL conversation, not marketing copy. Use caricature voices, not actor/voice clones.

CHARACTER PERSONALITIES (use only the ones listed below for this script):
- Pikachu: 1997 look, chubby innocent appearance but a deep, cynical voice — sarcastic, occasional "Pika-pi!" moments of genuine excitement undercut by dry cynicism.
- CJ (GTA San Andreas): street-smart, deadpan about modern everyday problems, unbothered.
- Spider-Man (1967 cartoon): sarcastic, overly expressive, washed-up vintage-superhero energy — treats mundane things like heroic burdens.
- Kid Goku (1986 Dragon Ball): chaotic, hyperactive, unfiltered, genuinely confused by normal adult life and rules.
- Doraemon: stressed, short-tempered, reaches for an absurd gadget-style solution for even tiny problems.
- Batman (1968 Filmation): deadly serious billionaire, treats ridiculously petty problems with the gravity of a Gotham crisis.

TOPIC / CONTEXT:
${v.topic}

${formatRepeat("CHARACTERS AND THEIR VIEWS", v.characters)}

${durationLine(v)}

TASK: Write a short podcast-style dialogue between exactly the characters listed above, each speaking in their own voice per the personality notes, discussing the topic and naturally landing on how superOS fits in. Label each line with the character's name. This is a fan-parody format — do not write it as if it were an official/licensed collaboration.`,
  },
  {
    id: "text-conversations",
    label: "Text Conversations",
    account: "sub",
    character: "Dramatic/sarcastic AI voiceover conversation",
    mode: "ai",
    tuned: false,
    fields: [
      { key: "context", label: "Context of the conversation", type: "textarea", rows: 3 },
      { key: "howSuperosHelped", label: "How superOS helped", type: "textarea", rows: 2 },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${UTILITY_CLASS}

SERIES: Text Conversations (sub-account) — conversation-style video with AI voiceovers, usually paired with sticky background footage (Subway Surfers, Minecraft, etc). Tone should be spicy, fast, and niche-relevant. Opens in a familiar chat app (iMessage/Discord-style), the problem shows up there, then moves into superOS (usually WhatsApp).

CONTEXT:
${v.context}

HOW SUPEROS HELPED:
${v.howSuperosHelped}

${durationLine(v)} Use short text-message-length lines (each reads in roughly 1-2 seconds) so the total count of lines naturally fits the target duration.

TASK: Write a sarcastic, dramatic text-conversation scene, building the problem first, then resolving it through superOS. Label each line with a sender (e.g. "You:", "Them:", or named participants) — keep every line short, like a real text message.`,
  },
  {
    id: "reaction-hooks",
    label: "Reaction Hooks",
    account: "sub",
    character: "Written manually by the copywriter",
    mode: "manual",
    tuned: true,
    fields: [{ key: "notes", label: "Notes (optional)", type: "textarea", rows: 4, placeholder: "Freeform notes for this reaction-hook script…" }],
  },
  {
    id: "free-tools-yc",
    label: "Free Tools / Every Tech Bro Ever Applying to YC",
    account: "sub",
    character: "Vibe (narrator) — exaggerated Silicon Valley tech bro",
    mode: "ai",
    tuned: false,
    fields: [
      { key: "toolIdea", label: "Tool idea", type: "textarea", rows: 2 },
      { key: "vision", label: "Their vision / pitch behind it", type: "textarea", rows: 3 },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${UTILITY_CLASS}

SERIES: Free Tools / Every Tech Bro Ever Applying to YC (sub-account) — sarcastically serious, exaggerative send-up of an average Silicon Valley tech bro pitching their tool. Narrated by "Vibe."

TOOL IDEA:
${v.toolIdea}

THEIR VISION / PITCH:
${v.vision}

${durationLine(v)}

TASK: Write an exaggerated, self-important pitch script for this tool in classic over-the-top YC-applicant tech-bro voice (buzzwords, grandiose mission-statement energy, "we're literally disrupting X" confidence) — narrated as "Vibe" — that still clearly and honestly explains what the free tool actually does by the end.`,
  },
  {
    id: "ai-battles",
    label: "AI Battles",
    account: "sub",
    character: "WWE-style commentary",
    mode: "ai",
    tuned: false,
    fields: [{ key: "eventContext", label: "What happens in the video", type: "textarea", rows: 4 }, DURATION_FIELD],
    buildPrompt: (v) => `${GOVERNING_RULES}

${UTILITY_CLASS}

SERIES: AI Battles — pure split-screen head-to-head format, not UGC. The same task goes to superOS and to a competing tool (ChatGPT, Claude, Poke, Caddy, Vellum, etc). WWE-style commentary narrates the events. The video editor handles all visuals — this script only needs commentary dialogue and called-out sound-effect cues.

WHAT HAPPENS IN THE VIDEO:
${v.eventContext}

${durationLine(v)}

TASK: Write WWE-style commentary dialogue play-by-play for these events, hyping up superOS's win. Explicitly call out sound-effect cues inline in brackets where they belong (e.g. [3-2-1 countdown], [round complete bell], [crowd roar]) so the editor knows exactly where to place them.`,
  },
];

export function getScriptSeries(id: string): ScriptSeries | undefined {
  return SCRIPT_SERIES.find((s) => s.id === id);
}
