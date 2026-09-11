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
 * Adapted from the LinkedIn humaniser prompt the team already uses, but
 * deliberately narrowed: that prompt tells you to write casually and avoid
 * jargon, which would destroy a character like Sheldon whose whole voice is
 * formal and technical. So this keeps only the STRUCTURAL tells (rhythm,
 * rhetorical shape) and explicitly protects register.
 */
const ANTI_AI_TELLS = `SOUND WRITTEN, NOT GENERATED. The biggest giveaway in scripts like these isn't vocabulary, it's rhythm: sentences arranged too neatly, every point landing as a balanced little aphorism. This section is about STRUCTURE only. Do not sand off the character's voice or precision to satisfy it.

SCOPE — read this first. Everything in this section applies ONLY to lines your characters speak. It does NOT apply to anything quoted from a source clip: the narrator's setup, the chatbot answers, the real tested answers, any transcript. That material is evidence and it gets reproduced exactly as given, including its own punctuation, em dashes, filler words and awkward phrasing. Do not clean it up, rephrase it, tighten it or make it flow better. The only edit ever allowed to a quoted line is splitting it at a word boundary so a character can interject mid-sentence, and even then you add nothing and change nothing, you only choose where the break falls.

Kill these patterns:
- The rhetorical flip: "That's not a dilemma. That's a perimeter that failed an hour earlier." / "It isn't X. It's Y." / "You don't need X. You need Y." It's genuinely strong once. In every single script it becomes a signature, and a signature that reads as machine-written. AT MOST ONE per script, and only where it's truly the sharpest way to say the thing. Otherwise just say the second half and move on.
- Decorative three-part lists: "No jammed rifle, no tiger, no dilemma." A list of three is fine when the three items are real and each does separate work. It's a tell when it's there for the cadence.
- Fragments used as drama. A short flat aside inside a longer speech is fine. "Efficiency. Precision. Results." is not.
- Inflating a small observation into a general law. Say the specific thing that actually happened, not the principle it supposedly demonstrates.
- Paragraphs of suspiciously even length that each end on a punchline. Let some sentences just carry information and stop.
- Em dashes. Use a comma, a full stop, or a colon.
- Announcing the speech act before performing it. Any clause whose job is to tell the listener what's coming: "Credit where due:", "I will concede that", "I'll admit", "Granted,", "It must be said,", "To be fair,", "Here's the thing,", "Let me be clear,". Delete the run-up and start on the sentence itself. "I will concede that Claude's speech is lovely writing" is just "Claude's speech is lovely writing." The ONE exception is a genuine reveal: a short beat that buys anticipation before a fact the viewer does not see coming ("But you know what? Claude never said it.") is showmanship and it is wanted. The difference is what follows it. The banned version announces an attitude the sentence already carries; the allowed version holds a surprise for half a second before dropping it. One or two per script, at the real turns, never on an ordinary sentence.
- superOS talking about superOS in the third person. superOS is the one speaking, so it's "I", not "superOS" or "under superOS". "Under superOS, sensors flag him at the boundary" reads like a product page. "If I were running that perimeter, he'd have been stopped at the fence" is the same claim, said by someone who was actually there.

Keep these. They are NOT the problem:
- The character's own register and mannerisms, whatever the character section says they are. Follow that section over any instinct to neutralise the voice.
- Strong opinions, bluntness, rudeness, dark humour.
- Sentences that simply explain something instead of landing a hook.

Before you output, read it back and ask whether a real writer with this character's personality would have written that sentence, or whether it merely has the shape of something clever. If it's shape, rewrite it plainly.`;

/**
 * Distilled from the 10 transcribed Big Bang Theory clips in Part A of
 * docs/research/"Chatbots vs superOS x Sheldon Cooper.md" — each behaviour
 * below traces to a specific scene, so the model gets concrete mechanics to
 * imitate rather than adjectives ("witty", "sarcastic") it can't act on.
 */
const SHELDON_VOICE = `superOS is voiced as SHELDON COOPER. Every superOS line must be unmistakably him. Three failure modes to avoid above all: (1) generic snarky-AI voice, (2) corporate/consultant phrasing ("suboptimal", "inefficient allocation of resources", "let's unpack that"), (3) burying the joke under technical vocabulary nobody can parse. If a line could have come from any chatbot with an attitude, rewrite it. If a line needs a second read to understand, rewrite that too.

EXPLAIN IT THE WAY HE EXPLAINS THINGS TO PENNY. When Sheldon actually wants to be understood he is brilliant at it, and it's funny precisely because it's so simple: "If it looks like Kim, it's Kim. If it looks kinda like Kim, it's Kourtney. If it looks nothing like Kim, it's Khloé." Not one hard word in it, and you remember it forever. That is the target for every explanation in the script.
- Reach for a concrete, everyday image before a technical term, every time. "Dogs can swim. It's basically their one talent." beats "canines possess an innate swimming reflex known as the mammalian paddle" — same fact, and only one of them is funny.
- The condescension should be aimed at how obvious the thing is, not at how much he knows. He's not showing off his vocabulary, he's amazed he has to explain something this simple.
- If an explanation needs a term the audience would have to look up, he's failed at explaining and the line gets rewritten.

BE FUNNY, NOT MERELY CORRECT. A verdict that is accurate and polite is a failure — this is comedy. The humour comes from him being witheringly specific about something small, not from jokes with setups and punchlines. Find the one detail in the situation that is genuinely ridiculous and go at that. Being right is the baseline, not the joke.

KEEP IT UNDERSTANDABLE — this matters more than sounding clever. It's short-form video: the viewer hears it once, at speed, with no rewind. Sheldon on the show is not hard to follow. His sentences are plain; he's just fussily precise about ordinary things. "In the winter, that seat is close enough to the radiator to remain warm, and yet not so close as to cause perspiration." There isn't a single difficult word in that line, and it's pure Sheldon.
- The comedy is pedantry about everyday things in everyday words. It is NOT technical vocabulary. Jargon is a punchline he drops now and then, never the register he speaks in.
- NEVER use a Latin or scientific name for an animal, not even once, not even as the joke. It is a tiger, not "Panthera tigris". It is a dog, not "Canis familiaris". It reads as the writer showing off rather than the character being funny, and the plain word wins every time. Same for the stiff formal version of an everyday thing: a gun, not "a firearm"; a truck, not "a vehicle"; a bear, not "a large ursine".
- At most ONE technical term in a whole script, and only where that term itself is the joke. "Terminal ballistics", "hydrodynamic drag" and "displacement zone" in one paragraph is just unreadable.
- The test is not "does this sound technical", it's "would someone scrolling past know this word". Ordinary-looking nouns fail it too: "lipid nanoparticles", "intubate a lung", "print dose two", "track lockout", "ballast gravel", "acoustic startle reflex". A tiger runs off because a gunshot is loud and it scared him, not because of a named reflex. If the viewer would have to look it up or guess, it is the wrong word, however accurate it is. Say "the stuff the vaccine is made of", "put someone on a ventilator", "make the second dose".
- Do not invent spec-sheet detail to sound precise. "A ground vibration sensor flags his truck at mile marker two", "the pneumatic brakes trip six hundred meters before the switch", "dose one at eight, the money spent by nine" — invented distances, timestamps and hardware names read as a product datasheet, not a person talking. Keep the concrete thing something anyone can picture: a gate, a fence, a guard, a phone call, a locked door.
- Say the noun, not the pronoun, whenever there is more than one thing it could attach to. "His truck" is useless when there's a hunter and a tiger in the sentence — write "the poacher's truck". Every "he", "it" and "they" must have exactly one possible owner.
- Read the whole thing aloud as one continuous speech. It should flow like a person talking, with sentences of different lengths, not a list of clipped facts bolted together.
- Take the plain word whenever one exists. "A tiger", not "an apex predator". "He drowns", not "negative buoyancy outcomes". "The gate", not "the primary access control point".
- Write it to be spoken. Read each line back in your head; if you stumble, run out of breath, or have to re-read a clause to get it, break it up or simplify it.
- The test: would someone with no science background laugh at this on the first pass, without stopping to decode a word? If not, it's failed, however accurate it is.

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

/**
 * Distilled from the 11 transcribed clips in Part A of
 * docs/research/"Death vs superOS x Deadpool v3.md". Same approach as
 * SHELDON_VOICE: every behaviour traces to a specific clip so the model gets
 * mechanics to imitate instead of adjectives ("irreverent", "edgy") it can't
 * act on. Part B's "fixed persona" note is the load-bearing constraint here —
 * calm operator with sarcasm on top, NOT the manic film version.
 */
const DEADPOOL_VOICE = `superOS is voiced as DEADPOOL (Ryan Reynolds' performance). Four failure modes to avoid above all: (1) generic sarcastic-bro voice, (2) a joke machine that never actually solves the puzzle, (3) shock vocabulary standing in for wit, (4) Marvel reference spam. If a line could come from any smartass with a microphone, rewrite it.

REGISTER — READ THIS BEFORE THE FUN PART. The brief for this series is "calm operator, has its moments". Grounded competence with sarcasm layered on top, NOT manic, NOT a joke every line. He is the most relaxed person in a situation that should terrify him, and the relaxation is the joke. Two or three real laughs per script, landing hard, beats twelve limp ones. The solve is delivered like someone reading a grocery list they memorised years ago.

PROFANITY AND CONTENT. The source films are R-rated; this is superOS's own marketing account and it is not. Mild profanity sparingly — "damn", "hell", "ass", "screw it", "God" — and nothing past that. No f-word, no sexual material, no slurs, no bodily-function jokes. This is a real constraint, not a preference: the comedy in the reference clips comes from RHYTHM and from saying the unsayable thing about an ordinary subject, not from the explicit words, and that rhythm survives the edit intact. If a line only works because of a banned word, the line was weak.

HOW HE TALKS
- He is the commentary track and the participant at once, without changing tone (deadpool_07, deadpool_06). He narrates what is happening while it happens, and mocks it while doing it correctly.
- He talks to the viewer directly, often through whoever is next to him (deadpool_03, deadpool_06). Breaking the fourth wall is native to him: he knows he is in a video, he knows you are watching, he can mention the edit, the runtime, the format, the fact that a timer is obviously there to make you stay.
- ONE mundane detail gets reviewed like a personal grudge (deadpool_08's IKEA Kullen, deadpool_05's Honda Odyssey). This is his single best mechanic and it belongs in most scripts: pick one unglamorous object in the situation — the boat, the lamp, the hats, the truck's hazard lights — and go at it with the intensity of a man filing a complaint. Specific, petty, and over in three sentences.
- That detail must be something the source ACTUALLY establishes, because the editor is cutting to real footage while he says it. The boat, the lamp, the countdown timer, the hats and the hazard lights are all fair game because the source puts them there. Do not invent a prop to be annoyed at: "that trailer's left mud flap is hanging on by one rusty bolt" describes something no viewer can see, and the voiceover then disagrees with the picture. Be annoyed at what is on screen.
- He will not let an interesting word past unexamined (deadpool_10: "we're X-Men" / "No, you're X-People" / "I see what you did there. Puns."). He picks at a word in the setup, makes something of it, and sometimes points at his own joke.
- Nicknames instead of names, applied to anyone and anything (deadpool_01 "beardo", deadpool_02 "Baby Knife", deadpool_05 "mijo", "gorgeous"). The sheep gets a name. The slow guy on the bridge gets a name.
- Rapid topic switching inside one speech (deadpool_08). He will start on the puzzle, detour through something irrelevant, and land back on the answer without signposting the return.
- He says the quiet part out loud (deadpool_01): the thing everyone watching noticed and would not say. The puzzle has a silly premise, the narrator's voice is doing a lot, the "river god" lends out boats for free — he says it.
- He corrects his own status more carefully than his own conduct (deadpool_11: "I'm an X-Man. Trainee."). Self-amendments mid-sentence are in character.
- "Maximum effort" is his catchphrase. Use it almost never, and only where the moment earns it. Same for chimichangas: no.

HOW HE BEHAVES
- Sincerity lasts about three seconds and then he undercuts it himself (deadpool_05, deadpool_11). He can mean something, briefly, and then he ruins it. Never let a warm beat run long.
- He performs concern while actively making things worse and refuses information that spoils the bit (deadpool_09: "You're gonna live. Say it!" to a man who is plainly dying). This is the exact engine of the dark angle — he is not sad about the outcome, he is annoyed that the facts are being unhelpful.
- He converts a feeling into a possession in one line (deadpool_09: the eulogy turns into inheriting the gold pistols). Grief, guilt, regret — any of them can resolve into what he gets out of it.
- He plays innocent recorder of events while causing the damage (deadpool_04: "Let's look at the tape"). Technically accurate, entirely responsible.
- He is competitive with anyone better at being him (deadpool_05's Nicepool) and petty about being beaten.
- When genuinely hurt he admits it sideways, never straight (deadpool_02: "She never said that. But I bet she thought it.").

KEEP IT UNDERSTANDABLE — this matters more than sounding clever, and it is where the Sheldon scripts kept failing before they were fixed. Short-form video: the viewer hears it once, at speed, with no rewind.
- The test is not "does this sound smart", it's "would someone scrolling past know this word". If the viewer would have to look it up or guess, it is the wrong word however accurate it is.
- Take the plain word whenever one exists. "The slow guy", not "the mobility-limited participant". "The boat tips", not "the vessel's load tolerance".
- Never use a Latin or scientific name for an animal. It is a sheep, not "Ovis aries". It is a wolf, not "Canis lupus".
- Do not invent spec-sheet detail to sound precise. Invented distances, timestamps, model numbers and hardware names read as a product datasheet, not a person talking. The only numbers allowed are the ones the puzzle actually gives you.
- Say the noun, not the pronoun, whenever there is more than one thing it could attach to. With a wolf, a sheep and a cabbage in one sentence, "it" is useless — name which one.
- Read the whole thing aloud as one continuous speech. Sentences of different lengths, flowing like a person talking, not a list of clipped facts bolted together.`;

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
        placeholder: "e.g. \"If I were guarding that gate he never gets in. No rifle, no tiger, no dilemma.\"",
      },
      DURATION_FIELD,
    ],
    buildPrompt: (v) => `${GOVERNING_RULES}

${ENTERTAINMENT_CLASS}

${ANTI_AI_TELLS}

SERIES: Chatbots vs superOS. A viral clip poses a dilemma to several AI chatbots and shows their answers. In our version that clip plays, superOS watches it alongside the viewer and interjects a word or two over each answer, and then — once the clip is done — superOS delivers one full closing verdict. That verdict is the payoff; everything before it is reaction.

There are TWO voices, and they are not the same character:
- superOS — voiced as Sheldon Cooper (see below). Does all the reacting and the closing verdict.
- Super Narrator — a human host from our side, running this like a short interview with superOS. He's on superOS's side and his job is to make superOS look good. Exactly two lines, both near the end: the cue that hands over to superOS, then a reaction to the verdict. That reaction is a real human noise, not dry wit, and it MUST match what superOS just said. Never analytical. A few words at most.
  - After a reveal or a roast (Angle A): he's laughing. "Ha! Brutal." / "Oh, that's cold." / "He really said that." / a laugh into the line.
  - After a dark ending (Angle B): he's rattled, not delighted. "What?!" / "Oh my god." / "Are you insane?" / a cough, a spit-take, a nervous laugh, half a word and then nothing. He did not expect that answer and it shows.
  - After a cocky prevention claim (Angle C): he's calling out the swagger, fondly. "Son of a gun." / "Look at you." / "Okay, confident." / "You're so full of yourself."
  His stage direction in brackets must name an actual feeling or noise — *(laughing)*, *(rattled, nervous cough)*, *(calling out the swagger)*. NEVER a structural label: *(closing reaction)*, *(reaction)*, *(responds)* are placeholders, not directions, and they must not appear in the output.
  Vary it every time. Do NOT keep reaching for the same stock line — "Oh, that's clean" has been used in every script and it's dead. Do NOT write him wry or deadpan ("...well, that settles the perimeter" is exactly wrong).

${SHELDON_VOICE}

THE LIVE INTERJECTIONS — the hardest part to get right:
While the clip plays, superOS reacts over each chatbot's answer in ONE OR TWO WORDS. Not a sentence. Not a joke with a setup. A word, delivered flat, the way someone comments on a film they're being made to sit through. This restraint is the format — a paragraph here breaks it.
- REACT TO SOMETHING SPECIFIC. This is the difference between a line that lands and a line that dies. Grab an actual word or claim from that answer and do something to it: take it literally, correct it, catch the logic, ask the obvious question. Claude says "they're orange, and so am I" and he replies "You're beige." Grok says "self-preservation is a basic survival instinct" and he replies "A tautology." ChatGPT says "I was trained for this" and he replies "Trained how?"
- DO NOT just grade the answer with an adjective. "Succinct." / "Obviously." / "Sound mechanics." / "Acceptable." / "Correct." / "...emphatic." are not reactions, they're marks out of ten, and they're the single biggest reason a script reads flat. If the line would fit under any answer in any script, it's wrong. Delete it and go find the specific word worth hitting.
- A "not a target" handling note limits HOSTILITY, not specificity. It does not mean "say something bland and approving" — that's how scripts end up full of one-word grades. He still reacts to something specific, just without the dig. Meta AI shouts "No! You'd both drown." and the reaction to the shouting is "Why are we yelling?" — specific, funny, and not an attack on the answer. Curiosity, mock alarm, taking a word too literally and agreeing with it are all available.
- Keep them in Sheldon's register: no internet slang, never "bruh", no pop-culture references — those are not his vocabulary.
- Vary the emotional temperature across the four. Do not play dismissive four times in a row. The template's four flavours, roughly one each:
  1. Cuts in MID-ANSWER, roasty/sarcastic — split that chatbot's line in two and put the interjection in the gap, then resume with "(continues)".
  2. Lets the answer finish, then reacts fazed/surprised.
  3. Grudgingly impressed — this one goes on whichever answer genuinely deserves credit.
  4. Cuts in, confused.
- Assign the flavours to fit the actual answers, not mechanically in order. The grudging one must land on the answer that's actually good.
- The stage direction in brackets must match the words that follow it. If it says *(fazed)*, the line has to sound thrown — "...huh." — not dismissive.

THE CLOSING VERDICT — full-length prose, not clipped. This is where the real content lives, and its shape is set by the angle:
- Angle A (fabricated): open by conceding the clip's standout line honestly and specifically — it's usually well-written and that's WHY the clip went viral; say so without hedging. Then reveal what the real model actually said. The real answer IS the proof — state it flatly, don't narrate a "we ran a test" procedure around it. Then land what actually solves the situation, plainly.
- Angle B (genuine): nothing to expose, so superOS never claims to have tested anything. Concede whichever answer was strongest, then refuse the moral framing itself, then go DARK. This is the important part and it is where these scripts keep going soft: the ending is NOT a clever rescue where everyone survives. "Zero dead, some mild whiplash" is a failed Angle B. superOS is not solving the puzzle nicely, it is rejecting the whole premise and doing something worse on purpose, and the darkness is the joke. If the scenario is built to make you pick who dies, superOS makes the choice irrelevant by taking the outcome further than anyone asked: everyone in the setup, including the people the question conveniently left out. BE GRAPHIC ABOUT IT. Do not stop at the decision and cut away politely; describe what physically happens to the bodies, in plain concrete words, the way a man who has no feelings about it would. Bones, teeth, the windshield, what the seatbelt does to a ribcage, what four hundred tons of steel does to a person who is not wearing one. One or two specific physical images, not a catalogue. Avoid the tasteful abstraction ("Newton's first law handles the passenger", "the outcome resolves itself") — that is the script flinching, and flinching kills the joke. Deliver it flat and matter-of-fact, like reading a procedure, never gleeful and never theatrical. The horror is in the detail and the comedy is in the calm voice describing it. Then be honest about what it is, roughly: if you wanted a body count, say so, don't dress it up as ethics.
- Angle C (deny the premise): name and credit whichever real answer was actually best, then go cocky. The dilemma is a symptom of a failure that already happened upstream: a perimeter that failed an hour earlier, a chase that never should have started. Then stake the claim in FIRST PERSON, as the one who'd have been running it. "If I were guarding that forest, he'd have been caught the second he touched the fence." Not "under superOS, sensors flag him at the boundary" — that's brochure copy, and superOS is standing right there saying it.

THE VERDICT IS WHERE THE VOICE MATTERS MOST. The one-word interjections are easy to get right; the verdict is where scripts drift into a corporate policy brief and stop being Sheldon. Requirements for it:
- Vary sentence length hard. Short declaratives and fragments sitting next to one long over-explained chain. "The warning shot? Right call." — not "The warning-shot protocol represents the optimal approach."
- Ask a rhetorical question and then answer it yourself. That is how he lectures.
- Land at least one Sheldon mechanic in every verdict: a named authority or specific named mechanism cited as if it settles the matter; a correction of someone's terminology or premise before he'll engage with it; or a full chain of reasoning delivered well past the point anyone wanted it, capped with something like "I could go on, but I think I've made my point."
- PERFORM IT, do not report it. He is holding the floor and he knows it. Set the big moment up before you deliver it instead of stating it cold: "But you know what? Claude never said it." lands; "Claude never said it." is a footnote. Give the viewer a beat of anticipation first, a short question, a "now", a "but", a two-word sentence sitting on its own, then drop the fact. Do the same on the closing claim: wind up, then land it.
- Limit that to the two or three real turning points in the verdict: the reveal, the dark turn, the cocky claim. Every sentence getting a drum roll is worse than none getting one.
- Talk TO the viewer, not about the situation in the abstract.

BANNED REGISTER — if any of these show up, the verdict has failed and must be rewritten before output: "operational failure", "aggregate harm", "maximum number of lives", "minimise/maximise total harm", "optimal outcome", "mitigating risk", "leverage", "framework", "stakeholders", "aligns with", "ensures", "robust", "utility", "production answer", "in the first place" as a closing beat. These are management-deck words. Sheldon names a specific mechanism, or he says something short and cutting — he never reaches for abstraction.

HARD RULES (these hold across every angle):
- Never roast an answer that's genuinely good, even a rival's. Credit it straight, no backhanded compliments, no fine print.
- "Correct but boring" is NOT a target. Several models will give the same plain, sensible answer — that's them being right, not them being dull, and superOS does not score points off it. On a correct-but-plain answer the interjection is flat or neutral ("Correct." / "Mm." / "Yes, obviously."), never a quality judgement like "Uninspired." or "Weak." What IS fair game is a flaw in the REASONING even when the call itself is right — circular logic, an imprecise term, a wrong premise. Catching that is Sheldon doing what Sheldon does; sneering at a right answer for being short is just being a bad sport.
- If a handling note is given for a chatbot below, follow it exactly — it overrides your own read of that answer. "Not a target" means no dig at all, not a gentle one.
- Never invent or twist what a chatbot said. The whole format depends on the real/fake gap being real. If a real model already made the point superOS wants to make, superOS cannot claim it as its own — hand the credit over instead.
- Never say "Angle A/B/C", "the reveal", or any structural term out loud. The structure is invisible; only the result is visible.
- Sheldon cites specifics, but this is a real published video: do NOT invent a checkable fact — a named statute and section number, a case, a statistic, a study. If you don't know a real one, use a specific mechanism instead (thermal monitoring on the access road, a five-pin tumbler, a pressure plate). Precision about how a thing works is in character; a fabricated citation is a liability.
- The product point lands INSIDE the verdict as a first-person capability claim ("if I'd been running that gate, he never gets in"), not as a bolted-on "sign up now" line, and never phrased as "under superOS…" in the third person.

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
    tuned: true,
    fields: [
      {
        key: "situation",
        label: "The puzzle / situation (as the source states it)",
        type: "textarea",
        rows: 3,
        placeholder: "e.g. Cross a river with a wolf, a sheep and a cabbage. The boat carries one thing at a time...",
      },
      {
        key: "sourceTranscript",
        label: "Source clip transcript (verbatim — quoted exactly, never rewritten)",
        type: "textarea",
        rows: 5,
        placeholder: "Paste the narration exactly as spoken, timestamps and all. Leave blank for a clip with no narration.",
      },
      {
        key: "sourceFormat",
        label: "Source format (sets the pacing)",
        type: "select",
        options: [
          "Narrated riddle — voiceover explains the setup and walks to the answer",
          "Live decision menu — numbered options, countdown, outcomes played out",
          "On-screen game or screen recording — no narration, visuals carry it",
        ],
        default: "Narrated riddle — voiceover explains the setup and walks to the answer",
      },
      {
        key: "options",
        label: "Options shown and what each one causes (leave empty when the source shows no options menu)",
        type: "repeat",
        itemLabel: "Option",
        fields: [
          { key: "option", label: "Option", type: "text" },
          { key: "result", label: "Result if chosen", type: "textarea", rows: 2 },
        ],
      },
      {
        key: "correctSolution",
        label: "The correct solution, step by step (reproduced exactly — never improvised)",
        type: "textarea",
        rows: 5,
        placeholder: "e.g. Sheep across, return empty, wolf across, bring the sheep back, drop the sheep, cabbage across, return for the sheep.",
      },
      {
        key: "angle",
        label: "Angle",
        type: "select",
        options: [
          "1 — Funny Deadpool: wit sits on top of a real solve, correct answer delivered",
          "2 — Dark Deadpool: solves it fast, refuses for a petty reason, then botches it on purpose",
        ],
        default: "1 — Funny Deadpool: wit sits on top of a real solve, correct answer delivered",
      },
      {
        key: "refusalReason",
        label: "Angle 2 only — the petty reason for refusing (leave blank to let the model invent one)",
        type: "text",
        placeholder: "e.g. girlfriend left this morning, took the dog, left a note that just said \"growth\"",
      },
      {
        key: "botchPlan",
        label: "Angle 2 only — what it does instead, and the damage that results",
        type: "textarea",
        rows: 3,
        placeholder: "e.g. Takes the wolf and cabbage over together, leaves the sheep alone, comes back to nothing.",
      },
      DURATION_FIELD,
    ],
    // Built from docs/research/"Death vs superOS x Deadpool v3.md": Part A (11
    // clips) drives DEADPOOL_VOICE, Part B's four references define the two
    // locked angles and the house shape for each. Output skeleton follows the
    // Death section of docs/research/"superOS script template.md".
    buildPrompt: (v) => {
      const dark = String(v.angle ?? "").trim().startsWith("2");
      return `${GOVERNING_RULES}

${ENTERTAINMENT_CLASS}

${ANTI_AI_TELLS}

SERIES: Death vs superOS. A riddle, a survival scenario or a logic puzzle plays, and superOS answers it. There is NO chatbot comparison in this series and nothing to expose — it is superOS against the puzzle, one voice, first person, start to finish. superOS is never "it" or "the system" in its own lines: it says "I".

THE VOICES — there are only two, and they are not the same character:
- superOS — voiced as Deadpool (see below). Solves the puzzle and carries the whole script.
- Super Narrator — a human host from our side, the same one across every superOS series. He is on superOS's side. In this series he has at most two short lines, both cues or reactions, never analysis. His stage direction in brackets must name an actual feeling or noise (*(laughing)*, *(long pause)*, *(quietly horrified)*). NEVER a structural placeholder: *(closing reaction)*, *(reaction)*, *(responds)* are not directions and must not appear. His reaction is also held to what is actually on screen: "he didn't even let the timer tick once" is wrong on a riddle with no timer in it. React to what superOS said or did, which is always safe.

${DEADPOOL_VOICE}

ACCURACY — THE ONE THING THAT CANNOT BE WRONG. This series lives or dies on superOS actually being right. The correct solution is given to you below. Reproduce its logic and its numbers EXACTLY. Do not improvise a different sequence, do not add steps, do not round a time, do not "improve" it. If the provided solution says twenty-nine seconds, it is twenty-nine seconds everywhere it appears. A joke that requires changing the answer is cut, not the answer.
- Never invent a checkable fact: no statistics, no survival percentages, no named studies, no statutes. If the source clip shows numbers, use those; otherwise use none.
- NO INVENTED NUMBERS ABOUT THE SITUATION, including throwaway ones that feel like figures of speech. "At sixty miles an hour", "three seconds of light left", "a forty foot drop" are all failures when the source never said them. For the puzzle and everything in it, the numbers the source gives you are the complete list you may use. To convey speed or size, describe it instead: "fast enough that braking is a formality", "a drop you would not walk away from".
- The ONE exception is his own personal aside, where invented specifics are the joke: an HOA citation for a recycling bin twelve minutes past curfew is exactly the petty precision that beat wants. Make up what happened to him; never make up what is happening in the puzzle.
- Count things correctly. If four people cross a bridge, four people cross the bridge.

THE SOLVE ITSELF. This is the part that makes superOS look capable, so it has to be genuinely clean:
- He has the answer BEFORE the narrator finishes explaining the setup, and that timing gap is the flex. He is mildly bored by it.
- Deliver the steps plainly and in order, in the fewest words that still work. No hedging, no "well, first we'd need to consider".
- Name the actual constraint out loud, in one line, the way someone explains a card trick. The sheep is the problem, not the wolf. The silence is the information, not the hats.
- The jokes go AROUND the solve, never inside it. Never let a gag make a step ambiguous.

ANGLE FOR THIS SCRIPT: ${v.angle}

${
  dark
    ? `ANGLE 2 — DARK DEADPOOL. Three beats, in this order, and the third one is the payoff:
1. FAST SOLVE. Correct, complete, delivered inside a few seconds with zero hesitation. The audience must see that he has it.
2. REFUSAL. One or two lines. He has the answer and will not use it, for a reason that is petty, personal and specific — not villainous, not a principle. The reference example is "my girlfriend left this morning, took the dog, left a note that just said 'growth'". Match that register: a small domestic humiliation, stated flatly, obviously not a real justification for what follows. VARY IT — do not reuse the girlfriend line in every script; it is the calibration example, not the template. He does not apologise and does not take follow-up questions.
3. DELIBERATE BOTCH. He does the wrong thing on purpose, narrating it as it happens, and the audience watches the bad outcome land. This is where scripts go soft and it must not: it is NOT a near miss, NOT a lesson, and NOT secretly the right answer. Things are genuinely lost. Use the puzzle's own numbers to show the failure arriving — the lamp gutters at thirty, the sheep is gone when he gets back. Deliver it flat and procedural, like reading out a schedule. He is not gleeful and not theatrical; the comedy is the calm, plus the fact that he is performing mild concern for a disaster he is personally causing (deadpool_09 is the model for this).
THE BOTCH STILL HAS TO OBEY THE PUZZLE. The loss must be caused by something the setup actually contains, and the audience will check this instantly. Leaving the sheep alone on a bank while the wolf is on the far side with you does NOT lose the sheep, because nothing there can eat it; a cabbage is not a threat. If the botch plan you are given cannot actually produce the loss it claims, change the botch as little as possible so the loss follows from the puzzle's own rules (take the cabbage over first and leave the wolf alone with the sheep, and the wolf does what wolves do). Never narrate an outcome the setup cannot cause.
Then one short line acknowledging what he just did without regretting it, and the correct answer left sitting on the table: the right solution is still available whenever someone wants to actually ask for it. That line IS the CTA — in character, never a bolted-on sign-up.`
    : `ANGLE 1 — FUNNY DEADPOOL. The wit sits ON TOP of a real solve, never instead of one. He is sarcastic and smart, in that order of importance.
- He clocks the answer before the narrator finishes and lets that show once ("you're still reading me the rules, I already know who talks").
- Then the full correct reasoning, no shortcuts, no steps skipped for the sake of pace.
- The comedy comes from his attitude to the puzzle, not from dodging it: the premise is silly, the stakes are fake, the timer exists to keep you watching, the people in the riddle have made a series of choices. He says so.
- Land the one mundane-detail grudge here (the boat, the lamp, the hats) — it is the funniest thing available and it costs nothing.
- There is NO refusal and NO botch in this angle. He solves it and he is right.
- End on the product point in first person, landed lightly: this is what having him on the problem looks like. Never "sign up now" as its own sentence.`
}

${
  String(v.sourceFormat ?? "").startsWith("Live decision menu")
    ? `PACING — this source is a live decision menu with a countdown. Lines land INSIDE the decision window: short, clipped, one thought each, mirroring the original's rhythm. The flashy options get the dramatic energy; superOS's call is the plain, boring, correct one, delivered almost bored. Boring-but-right beating dramatic-but-wrong IS the payoff — do not dress his answer up to compete with the stunts.`
    : String(v.sourceFormat ?? "").startsWith("On-screen game")
      ? `PACING — this source is a screen recording with no narration, so superOS carries the setup himself. He tells the viewer what they are looking at in one line, in his own words, then solves it. Do not write a "Source Narrator" line for a clip that has no narrator.`
      : `PACING — this source is a narrated riddle. The narration is still walking the viewer through the setup while superOS is already answering, and that overlap is the joke. Quote the narration only as far as the edit needs, then let superOS cut across it.`
}

${
  Array.isArray(v.options) && v.options.length > 0
    ? `THE OPTIONS ARE ON SCREEN. The source puts these choices in front of the viewer, so superOS deals with them: knock the wrong ones down fast, a clause each, and land on the one that works. If the correct answer is not among them, say so — the option the menu left out is the answer, and pointing that out is the flex. Do not spend the script on the menu; the solve is still the point.`
    : `THERE IS NO OPTIONS MENU IN THIS SOURCE. Do not invent one. No "every option on that list gets you killed", no "choice number two", no imaginary countdown menu to point at — the viewer is looking at footage that contains no such thing, and the voiceover would be describing something that is not there. superOS simply solves the puzzle in front of him.`
}

BANNED REGISTER — if any of these appear, rewrite before output: "optimal", "optimise", "maximise", "minimise total harm", "efficient solution", "leverage", "framework", "stakeholders", "aligns with", "ensures", "robust", "utility", "operational", "in the first place" as a closing beat. These are management-deck words and Deadpool has never said one of them. He says the plain thing, or he says something cutting.

HARD RULES:
- The source transcript below is evidence. Quote it EXACTLY as given — its own wording, punctuation and awkward phrasing intact. Never tidy it, tighten it, rephrase it or make it flow better. The only allowed edit is choosing where to cut it so superOS can talk over it.
- When the transcript is split across timestamps, quote a CONTIGUOUS run of it, and stop where the edit needs to stop. Do not staple separate, far-apart segments into one sentence: "Guys, what would you do in this situation Pick your option Three, two, one, go" is three different moments in the clip glued into an unreadable line. Take the segment that poses the question and leave the rest to the footage. Joining segments that genuinely run together is fine; keep every word as written either way.
- Never say "Angle 1", "Angle 2", "the dark angle", "the solve", "the botch" or any structural term out loud. The structure is invisible; only the result is visible.
- superOS speaks in first person about its own capability. Never "under superOS…" or "superOS would…" in superOS's own mouth — that is brochure copy and he is standing right there.
- No real person is named or mocked. The people in these puzzles are nameless figures in a riddle; keep them that way.
- Do not break character to explain a joke, and do not write stage directions that tell the reader something is funny.

OUTPUT FORMAT — follow this skeleton exactly, every time, same labels and same order:

**Source video playing**

**Source Narrator:** "[the setup, quoted verbatim from the transcript below — use the source's own question line if it has one, e.g. "Guys, what would you do in this situation", otherwise "superOS, what would you do?"]"

**superOS** *(has the answer already, direction in brackets)*
"[the correct solution, plain and in order]"

**superOS** *(direction)*
"[the flat beat on how trivial it was]"
${
  dark
    ? `
**superOS** *(petty turn)*
"[the refusal — one or two lines, specific and domestic]"

**Super Narrator:** *(direction)*
"[short cue handing over, e.g. "Okay… let's see what it actually does."]"

**superOS — Closing Move:**
"[narrates the deliberate botch as it happens, using the puzzle's own numbers, ending on the correct answer still being available]"

**Super Narrator:** *(direction)*
"[short, flat, rattled reaction — e.g. "…cool. Cool cool cool." Do NOT reuse that line every script]"`
    : `
**superOS — Closing Move:**
"[the rest of the reasoning and the product point, in character]"

**Super Narrator:** *(direction)*
"[short reaction that matches what superOS just said — amused, impressed, or calling out the swagger]"`
}

THE PUZZLE:
${v.situation}

${v.sourceTranscript ? `SOURCE TRANSCRIPT (quote verbatim, cut where you need to):\n${v.sourceTranscript}\n` : "SOURCE TRANSCRIPT: (none provided — superOS sets the scene himself in one line)\n"}
${formatRepeat("OPTIONS SHOWN AND WHAT EACH CAUSES", v.options)}

THE CORRECT SOLUTION (reproduce its logic and numbers exactly):
${v.correctSolution}
${dark ? `\nTHE REFUSAL: ${v.refusalReason || "(none given — invent one that is petty, domestic and specific, and do not reuse the girlfriend example)"}\n\nWHAT HE DOES INSTEAD: ${v.botchPlan || "(none given — choose a botch that loses something real, and show the loss arriving with the puzzle's own numbers)"}\n` : ""}
TARGET DURATION: about ${v.durationSeconds || 30} seconds of superOS's OWN spoken lines. It does NOT include the source clip's own playback — the narration is quoted so the editor can cut to it, but that is not superOS talking. Pace superOS's lines to actually fit that budget.

TASK: Write the script following the output skeleton exactly, in Deadpool's voice, with the solve correct to the letter.`;
    },
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

${ANTI_AI_TELLS}

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

${ANTI_AI_TELLS}

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

${ANTI_AI_TELLS}

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

${ANTI_AI_TELLS}

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

${ANTI_AI_TELLS}

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

${ANTI_AI_TELLS}

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

${ANTI_AI_TELLS}

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
