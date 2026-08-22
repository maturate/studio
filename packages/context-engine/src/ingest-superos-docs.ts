import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { ingestSource, type IngestSourceResult } from "./ingest";

const SKIP_DIRS = new Set([".git", ".obsidian", "tmp", "node_modules"]);

async function walkMarkdownFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        out.push(full);
      }
    }
  }
  await walk(root);
  return out;
}

/**
 * Ingests the superOS knowledge base (AGENTS.md §11: "repository ingestion
 * and re-sync"). Defaults to the path this project already reads product
 * context from; override with SUPEROS_DOCS_PATH for a different checkout.
 */
export async function ingestSuperOSDocs(
  rootPath = process.env.SUPEROS_DOCS_PATH ?? "/Users/crazylit.dev/Downloads/superOS/Docs",
): Promise<IngestSourceResult[]> {
  const files = await walkMarkdownFiles(rootPath);
  const results: IngestSourceResult[] = [];

  for (const file of files) {
    const stats = await stat(file);
    if (stats.size === 0) continue;

    const content = await readFile(file, "utf-8");
    const sourceRef = relative(rootPath, file);
    const title = sourceRef;

    const result = await ingestSource({
      sourceType: "repo",
      sourceRef: `superos-docs/${sourceRef}`,
      title,
      content,
    });
    results.push(result);
  }

  return results;
}
