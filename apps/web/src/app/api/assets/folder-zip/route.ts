import { NextRequest } from "next/server";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { getObjectBuffer } from "@superos/storage";
import { getFolder, listAssets } from "@/features/assets/queries";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

function sanitizeEntryName(name: string): string {
  return name.replace(/[/\\]/g, "_");
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.isAuthorized) {
    return new Response("Unauthorized", { status: 401 });
  }

  const folderId = req.nextUrl.searchParams.get("folderId");
  const [rows, folder] = await Promise.all([
    listAssets({ folderId: folderId || null }),
    folderId ? getFolder(folderId) : Promise.resolve(null),
  ]);

  if (rows.length === 0) {
    return new Response("No assets in this folder", { status: 404 });
  }

  const archive = new ZipArchive({ zlib: { level: 6 } });

  void (async () => {
    const usedNames = new Set<string>();
    for (const row of rows) {
      try {
        const buf = await getObjectBuffer(row.storageKey);
        const ext = row.storageKey.split(".").pop();
        const base = sanitizeEntryName(row.title || row.id);
        let name = ext ? `${base}.${ext}` : base;
        let i = 1;
        while (usedNames.has(name)) {
          name = ext ? `${base}-${i}.${ext}` : `${base}-${i}`;
          i++;
        }
        usedNames.add(name);
        archive.append(buf, { name });
      } catch {
        // Skip a single unreadable object rather than aborting the whole zip.
      }
    }
    await archive.finalize();
  })();

  const zipName = sanitizeEntryName(folder?.name ?? "assets");
  return new Response(Readable.toWeb(archive as unknown as Readable) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipName}.zip"`,
    },
  });
}
