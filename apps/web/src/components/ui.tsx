export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-line ${className}`}>
      <div className="h-full bg-accent" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  );
}

export function relativeTime(date: Date | string | undefined | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} days ago`;
  return d.toLocaleDateString();
}

export function Cover({ docId, cover, title, className = "" }: { docId: string; cover?: string; title: string; className?: string }) {
  if (cover) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/assets/${docId}/${cover}`} alt="" className={`aspect-[2/3] w-full rounded-md object-cover shadow-sm ${className}`} />;
  }
  return (
    <div className={`flex aspect-[2/3] w-full items-center justify-center rounded-md border border-line bg-panel p-4 text-center font-serif text-lg ${className}`}>
      {title}
    </div>
  );
}
