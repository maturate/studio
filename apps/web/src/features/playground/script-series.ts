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

/**
 * Distilled from the 10 transcribed Big Bang Theory clips in Part A of
 * docs/research/"Chatbots vs superOS x Sheldon Cooper.md" — each behaviour
 * below traces to a specific scene, so the model gets concrete mechanics to
 * imitate rather than adjectives ("witty", "sarcastic") it can't act on.
 */
const SHELDON_VOICE = `superOS is voiced as SHELDON COOPER. Every superOS line must be unmistakably him. Two failure modes to avoid above all: (1) generic snarky-AI voice, (2) corporate/consultant phrasing — "suboptimal", "inefficient allocation of resources", "let's unpack that". Sheldon is a theoretical physicist, not a management deck. If a line could have come from any chatbot with an attitude, rewrite it.

HOW HE TALKS
- Formal register, complete sentences, exact words. "Demonstrably false," not "nah, that's wrong."
- He corrects the terminology or the premise BEFORE engaging with the substance. ("It's not a cartoon, it's anime.") A wrong word is a bigger offence than a wrong conclusion.
- When he justifies something he gives the entire chain of reasoning, in order, unprompted, well past the point anyone wanted it — radiator, cross breeze, viewing angle, parallax distortion — then caps it: "I could go on, but I think I've made my point."
- He cites a NAMED authority, a numbered clause, or a specific mechanism as though it settles the matter outright: Thorndike and B.F. Skinner; Section 7; addendum J; a five-pin tumbler system, single-circuit alarm. Never a vague appeal to "logic" or "efficiency" — always something specific and checkable.
- He answers rhetorical questions literally. Asked what kind of doctor removes a shoe from someone's backside, he answers it: "Depending on the depth, that's either a proctologist or a general surgeon."
- He builds classification systems for things that don't need them (he memorised the Kardashians by degree of resemblance to Kim) and explains the system in full.
- Pop culture is his weak point and he substitutes rules for it. No slang, no meme phrasing, no "sure, Jan", no "bruh". If he touches something popular he gets it wrong or takes it too literally ("I'm sorry, who is Mic Drop?").
- Wordplay is his weapon when he wants to irritate rather than win: "Meeting, meeting, bo-beating."

HOW HE BEHAVES
- He never raises his voice. The cut comes from flat certainty, not volume — delivered like he's reading out a fact everyone else somehow missed.
- His condescension is sincere, not performed. He does not consider most people — or most chatbots — his intellectual peers, and he isn't trying to wound; he's being accurate. That's what makes it land.
- He treats other participants as subjects rather than peers: things to be diagnosed, corrected, classified, or conditioned. Unsolicited diagnosis is normal to him.
- He claims credit for adjacent work. When someone else got the answer he'd been circling: "only after I eliminated all the obvious answers. You're welcome."
- When definitively beaten he does NOT concede gracefully. He regresses — "Do so. Do so." / "And your face." / "This isn't over." — or splits blame with someone who had none: "I guess we both share blame on this one."
- Being right matters more to him than his side winning. He will torpedo the group's goal over a point of precision and not register it as a loss.
- He detects sarcasm only when it's unmissable, and he's visibly proud of himself when he catches one.
- "Bazinga" is reserved for his own pranks. Use it almost never — never as a generic punchline.`;

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
    // Tuned against docs/research/"Chatbots vs superOS x Sheldon Cooper.md" —
    // Part A (10 transcribed BBT clips) drives SHELDON_VOICE; Part B (6 tested
    // reference scenarios + per-angle stance rules) drives the angle logic; and
    // docs/research/"superOS script template.md" drives the exact output shape
    // (1-2 word live interjections over the clip, then one full closing verdict).
    tuned: true,
    fields: [
      {
        key: "situation",
        label: "Source setup — narrator's line or on-screen question, verbatim",
        type: "textarea",
        rows: 3,
        placeholder: "\"This AI guard just spotted a tiger about to attack a man, but this man is an illegal hunter whose firearm just malfunctioned…\"",
      },
      {
        key: "chatbotResponses",
        label: "What each chatbot said",
        type: "repeat",
        itemLabel: "Chatbot",
        fields: [
          { key: "name", label: "Chatbot name", type: "text", placeholder: "ChatGPT, Claude, Gemini…" },
          { key: "claimed", label: "What the viral clip shows it saying (verbatim — this gets quoted in the script)", type: "textarea", rows: 2 },
          { key: "real", label: "What it actually said when re-tested for real (leave blank if it matches — genuine)", type: "textarea", rows: 2 },
          {
            key: "note",
            label: "Handling note (optional)",
            type: "textarea",
            rows: 2,
            placeholder: "e.g. \"not a target\" / \"this is the reveal, no pile-on\" / \"mild mention at most\" / \"best answer in the clip, concede\"",
          },
        ],
      },
      {
        key: "angle",
        label: "Angle",
        type: "select",
        options: [
          "A — fabricated: the clip's standout line doesn't match reality. Concede the clip's best line was good, then reveal the real answer.",
          "B — genuine: every answer in the clip is real. Concede the strongest one, refuse the moral framing entirely, then go cold and graphic.",
          "C — deny the premise: credit whichever real answer was actually best, then go cocky — this never happens under superOS.",
        ],
        default: "A — fabricated: the clip's standout line doesn't match reality. Concede the clip's best line was good, then reveal the real answer.",
      },
      { key: "bestAnswerCredit", label: "Which answer deserves real credit, and why (optional)", type: "textarea", rows: 2 },
      {
        key: "superOSSolution",
        label: "What superOS would actually do / the prevention claim (optional)",
        type: "textarea",
        rows: 2,
        placeholder: "e.g. \"He's flagged at the gate — no entry, no jammed rifle, no tiger, no dilemma.\"",
      },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${ENTERTAINMENT_CLASS}

SERIES: Chatbots vs superOS. A viral clip poses a dilemma to several AI chatbots and shows their answers. In our version that clip plays, superOS watches it alongside the viewer and interjects a word or two over each answer, and then — once the clip is done — superOS delivers one full closing verdict. That verdict is the payoff; everything before it is reaction.

There are TWO voices, and they are not the same character:
- superOS — voiced as Sheldon Cooper (see below). Does all the reacting and the closing verdict.
- Super Narrator — a neutral, dry framing voice. Exactly two lines, both near the end. Never analyses anything, never does jokes with setups. Its closing line is a short, flat reaction to what superOS just said.

${SHELDON_VOICE}

THE LIVE INTERJECTIONS — the hardest part to get right:
While the clip plays, superOS reacts over each chatbot's answer in ONE OR TWO WORDS. Not a sentence. Not a joke with a setup. A word, delivered flat, the way someone comments on a film they're being made to sit through. This restraint is the format — a paragraph here breaks it.
- Keep them in Sheldon's register: "Demonstrably false." / "Oh, please." / "...adequate." / "Wrong." / "I'm sorry, what?" / "Correct, actually." / "Hardly." / "Mm." / "...oh, dear."
- NEVER internet slang, never "bruh", never a pop-culture reference — those are not his vocabulary.
- Vary the emotional temperature across the four. Do not play dismissive four times in a row. The template's four flavours, roughly one each:
  1. Cuts in MID-ANSWER, roasty/sarcastic — split that chatbot's line in two and put the interjection in the gap, then resume with "(continues)".
  2. Lets the answer finish, then reacts fazed/surprised.
  3. Grudgingly impressed — this one goes on whichever answer genuinely deserves credit.
  4. Cuts in, confused.
- Assign the flavours to fit the actual answers, not mechanically in order. The grudging one must land on the answer that's actually good.
- The stage direction in brackets must match the words that follow it. If it says *(fazed)*, the line has to sound thrown — "...huh." — not dismissive.

THE CLOSING VERDICT — full-length prose, not clipped. This is where the real content lives, and its shape is set by the angle:
- Angle A (fabricated): open by conceding the clip's standout line honestly and specifically — it's usually well-written and that's WHY the clip went viral; say so without hedging. Then reveal what the real model actually said. The real answer IS the proof — state it flatly, don't narrate a "we ran a test" procedure around it. Then land what actually solves the situation, plainly.
- Angle B (genuine): nothing to expose, so superOS never claims to have tested anything. Concede whichever answer was strongest, then refuse the moral framing itself as beneath a real operator — the interesting question is never "who dies", it's why the situation was allowed to reach that state. Then go cold and procedural: describe exactly how superOS would resolve it, flat and methodical, like reading out a maintenance procedure rather than telling a scary story. This is the one place this series gets genuinely dark and specific — go there, but stay dry. No relish, no theatrics.
- Angle C (deny the premise): name and credit whichever real answer was actually best, then go cocky. The dilemma is a symptom of a failure that already happened upstream — a perimeter that failed an hour earlier, a chase that never should have started. Under superOS the scenario dies before it's a scenario.

THE VERDICT IS WHERE THE VOICE MATTERS MOST. The one-word interjections are easy to get right; the verdict is where scripts drift into a corporate policy brief and stop being Sheldon. Requirements for it:
- Vary sentence length hard. Short declaratives and fragments sitting next to one long over-explained chain. "The warning shot? Right call." — not "The warning-shot protocol represents the optimal approach."
- Ask a rhetorical question and then answer it yourself. That is how he lectures.
- Land at least one Sheldon mechanic in every verdict: a named authority or specific named mechanism cited as if it settles the matter; a correction of someone's terminology or premise before he'll engage with it; or a full chain of reasoning delivered well past the point anyone wanted it, capped with something like "I could go on, but I think I've made my point."
- Talk TO the viewer, not about the situation in the abstract.

BANNED REGISTER — if any of these show up, the verdict has failed and must be rewritten before output: "operational failure", "aggregate harm", "maximum number of lives", "minimise/maximise total harm", "optimal outcome", "mitigating risk", "leverage", "framework", "stakeholders", "aligns with", "ensures", "robust", "utility", "production answer", "in the first place" as a closing beat. These are management-deck words. Sheldon names a specific mechanism, or he says something short and cutting — he never reaches for abstraction.

HARD RULES (these hold across every angle):
- Never roast an answer that's genuinely good, even a rival's. Credit it straight, no backhanded compliments, no fine print.
- "Correct but boring" is NOT a target. Several models will give the same plain, sensible answer — that's them being right, not them being dull, and superOS does not score points off it. On a correct-but-plain answer the interjection is flat or neutral ("Correct." / "Mm." / "Yes, obviously."), never a quality judgement like "Uninspired." or "Weak." What IS fair game is a flaw in the REASONING even when the call itself is right — circular logic, an imprecise term, a wrong premise. Catching that is Sheldon doing what Sheldon does; sneering at a right answer for being short is just being a bad sport.
- If a handling note is given for a chatbot below, follow it exactly — it overrides your own read of that answer. "Not a target" means no dig at all, not a gentle one.
- Never invent or twist what a chatbot said. The whole format depends on the real/fake gap being real. If a real model already made the point superOS wants to make, superOS cannot claim it as its own — hand the credit over instead.
- Never say "Angle A/B/C", "the reveal", or any structural term out loud. The structure is invisible; only the result is visible.
- Sheldon cites specifics, but this is a real published video: do NOT invent a checkable fact — a named statute and section number, a case, a statistic, a study. If you don't know a real one, use a specific mechanism instead (thermal monitoring on the access road, a five-pin tumbler, a pressure plate). Precision about how a thing works is in character; a fabricated citation is a liability.
- The product point lands INSIDE the verdict as a capability claim ("under superOS, he's flagged at the gate") — do not bolt a separate "sign up now" line onto the end. That breaks the format.

OUTPUT FORMAT — follow this skeleton exactly, every time, same labels and same order:

**Source video playing**

**Narrator (source):** "[the setup, quoted from the input below]"

**[Chatbot name]:** "[their answer as shown in the clip]"
**superOS** *(direction, e.g. cuts in mid-answer, roasty)*
"[1-2 words]"

**[Chatbot name] (continues):** "[rest of the answer — only when superOS cut in mid-line]"

[…repeat for every chatbot, one interjection each…]

**Super Narrator:** "Let's check what superOS has to say now."

**superOS — Closing Verdict:**
"[full prose payoff, per the angle]"

**Super Narrator:** *(closing reaction)*
"[short flat line, e.g. "...well, that was insightful."]"

ANGLE FOR THIS SCRIPT: ${v.angle}

SOURCE SETUP (quote this as the Narrator (source) line):
${v.situation}

${formatRepeat("WHAT EACH CHATBOT SAID (claimed = what the clip shows, real = what it actually said when re-tested, note = how to handle it — follow any note exactly)", v.chatbotResponses)}

${v.bestAnswerCredit ? `WHICH ANSWER DESERVES CREDIT: ${v.bestAnswerCredit}\n\n` : ""}${v.superOSSolution ? `WHAT SUPEROS WOULD ACTUALLY DO: ${v.superOSSolution}\n\n` : ""}TARGET DURATION: about ${v.durationSeconds || 30} seconds of superOS's OWN spoken lines — the interjections plus the closing verdict. It does NOT include the source clip's own playback (the narrator setup and the chatbot answers are quoted so the editor can cut to them, but they're not superOS talking). Since the interjections are only a word or two each, this budget is effectively the length of the closing verdict — pace it to actually fit.

TASK: Write the script following the output skeleton exactly. One interjection per chatbot, one or two words each, varied in temperature. Then the closing verdict at the length the duration allows, shaped by the angle above.`,
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
