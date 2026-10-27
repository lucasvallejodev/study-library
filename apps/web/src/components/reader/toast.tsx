export function Toast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper shadow-lg">
      {message}
    </div>
  );
}
