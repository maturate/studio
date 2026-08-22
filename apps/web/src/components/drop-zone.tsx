"use client";

import { useState, type ReactNode } from "react";

/**
 * Thin drag-and-drop wrapper reused across every upload surface in the app —
 * wraps the existing click-to-browse UI, adding a drop target on top without
 * changing how files get picked up afterward.
 */
export function DropZone({
  onFiles,
  children,
  className = "",
  disabled = false,
}: {
  onFiles: (files: FileList) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragOver(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
      }}
      className={`${className} ${dragOver ? "outline outline-2 outline-offset-2 outline-[#004c37]" : ""}`}
    >
      {children}
    </div>
  );
}
