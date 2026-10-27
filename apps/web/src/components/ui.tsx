const PERCENT = 100;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const DAYS_PER_MONTH = 30;

export function roundedPercent(fraction: number): number {
  return Math.round(fraction * PERCENT);
}

function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function ProgressBar({ className = '', value }: { className?: string; value: number }) {
  return (
    <div className={`h-1 overflow-hidden rounded-full bg-line ${className}`}>
      <div
        className="h-full bg-accent"
        style={{ width: `${roundedPercent(clampFraction(value))}%` }}
      />
    </div>
  );
}

export function relativeTime(date: Date | string | undefined | null): string {
  if (!date) return '';
  const moment = typeof date === 'string' ? new Date(date) : date;
  const seconds = (Date.now() - moment.getTime()) / MS_PER_SECOND;

  if (seconds < SECONDS_PER_MINUTE) return 'just now';
  if (seconds < SECONDS_PER_HOUR) return `${Math.floor(seconds / SECONDS_PER_MINUTE)} min ago`;
  if (seconds < SECONDS_PER_DAY) return `${Math.floor(seconds / SECONDS_PER_HOUR)} h ago`;

  if (seconds < SECONDS_PER_DAY * DAYS_PER_MONTH) {
    return `${Math.floor(seconds / SECONDS_PER_DAY)} days ago`;
  }

  return moment.toLocaleDateString();
}

export function Cover({
  className = '',
  cover,
  docId,
  title,
}: {
  className?: string;
  cover?: string;
  docId: string;
  title: string;
}) {
  if (cover) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- covers come from the local assets API at their stored size; next/image would change the rendered markup
      <img
        src={`/api/assets/${docId}/${cover}`}
        alt=""
        className={`aspect-[2/3] w-full rounded-md object-cover shadow-sm ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex aspect-[2/3] w-full items-center justify-center rounded-md border border-line bg-panel p-4 text-center font-serif text-lg ${className}`}
    >
      {title}
    </div>
  );
}
