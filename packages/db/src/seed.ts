import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../../../.env") });

import { db } from "./client";
import { allowedEmails } from "./schema";

const SEED_ALLOWED_EMAILS = (process.env.SEED_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

async function main() {
  if (SEED_ALLOWED_EMAILS.length === 0) {
    console.log("No SEED_ALLOWED_EMAILS set — skipping allowlist seed.");
    return;
  }

  for (const email of SEED_ALLOWED_EMAILS) {
    await db
      .insert(allowedEmails)
      .values({ email, notes: "seeded" })
      .onConflictDoNothing({ target: allowedEmails.email });
    console.log(`Allowlisted: ${email}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
