import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

/**
 * Lazily creates the drizzle client on first use so importing this module
 * (e.g. at Next.js build time, before env vars are available) never throws.
 */
function getDb(): Db {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    cached = drizzle(postgres(connectionString), { schema });
  }
  return cached;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export type Database = Db;
