"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteFolderAction, moveFolderAction, renameFolderAction } from "../actions";

export interface FolderOption {
  id: string;
  name: string;
  depth: number;
}

export function FolderTile({ id, name, folders }: { id: string; name: string; folders: FolderOption[] }) {
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  function handleRename() {
    setMenuOpen(false);
    const next = prompt("Rename folder", name);
    if (!next || next.trim() === "" || next.trim() === name) return;
    startTransition(async () => {
      try {
        await renameFolderAction(id, next.trim());
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not rename folder");
      }
    });
  }

  function handleMove(newParentId: string) {
    setMenuOpen(false);
    startTransition(async () => {
      try {
        await moveFolderAction(id, newParentId || null);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not move folder");
      }
    });
  }

  function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete empty folder "${name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteFolderAction(id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not delete folder");
      }
    });
  }

  // Excludes only this folder itself here — moving into one of its own
  // descendants is still possible to pick, but the server rejects that (it
  // has the real path data to detect the cycle) and this shows an alert.
  const moveTargets = folders.filter((f) => f.id !== id);

  return (
    <div className="group relative flex items-center gap-2 rounded-none border border-ink/10 bg-ink/5 px-4 py-3 transition hover:bg-ink/10">
      <Link href={`/assets?folder=${id}`} className="flex flex-1 items-center gap-2 text-sm text-ink/85">
        <span>📁</span>
        <span className="truncate">{pending ? "…" : name}</span>
      </Link>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-none px-2 py-1 text-sm text-ink/40 opacity-0 transition hover:bg-ink/10 hover:text-ink/80 group-hover:opacity-100"
          title="Folder options"
        >
          ⋮
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-52 rounded-none border border-ink/10 bg-white shadow-lg">
            <button
              type="button"
              onClick={handleRename}
              className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
            >
              Rename
            </button>
            <a
              href={`/api/assets/folder-zip?folderId=${id}`}
              onClick={() => setMenuOpen(false)}
              className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
            >
              Download as .zip
            </a>
            <div className="border-t border-ink/10 px-3 py-2">
              <label className="mb-1 block text-[10px] font-mono uppercase tracking-wide text-ink/40">Move to</label>
              <select
                defaultValue=""
                onChange={(e) => handleMove(e.target.value)}
                className="w-full rounded-none border border-ink/15 bg-white px-1.5 py-1 text-xs text-ink"
              >
                <option value="">Asset Library (root)</option>
                {moveTargets.map((f) => (
                  <option key={f.id} value={f.id}>
                    {"—".repeat(f.depth)} {f.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleDelete}
              className="block w-full border-t border-ink/10 px-3 py-2 text-left text-sm text-red-700 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
