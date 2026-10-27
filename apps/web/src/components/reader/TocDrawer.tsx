"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type TocItem = { id: string; title: string; matter: "front" | "body" | "back"; depth: number };

export function TocDrawer(props: { open: boolean; onClose: () => void; docId: string; docTitle: string; currentId: string; items: TocItem[] }) {
  const current = props.items.find((i) => i.id === props.currentId);
  const [showAll, setShowAll] = useState(current?.matter !== "body");
  const activeRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (props.open) activeRef.current?.scrollIntoView({ block: "center" });
  }, [props.open]);
  if (!props.open) return null;
  const items = showAll ? props.items : props.items.filter((i) => i.matter === "body");
  return (
    <div className="fixed inset-0 z-50" onClick={props.onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <nav
        className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-line bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-line p-4">
          <Link href={`/read/${props.docId}`} className="font-serif text-lg leading-tight hover:text-accent">{props.docTitle}</Link>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            Show front and back matter
          </label>
        </div>
        <ol className="flex-1 overflow-y-auto py-2 text-sm">
          {items.map((i) => (
            <li key={i.id}>
              <Link
                ref={i.id === props.currentId ? activeRef : undefined}
                href={`/read/${props.docId}/${i.id}`}
                onClick={props.onClose}
                className={`block px-4 py-1.5 font-serif hover:bg-panel ${i.id === props.currentId ? "bg-panel font-semibold text-accent" : ""} ${i.matter !== "body" ? "text-muted" : ""}`}
                style={{ paddingLeft: `${1 + (i.depth - 1) * 0.75}rem` }}
              >
                {i.title}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
