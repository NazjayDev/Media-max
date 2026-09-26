export default function SkeletonCard() {
  return (
    <div className="animate-pulse overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="aspect-[2/3] w-full bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-7 w-7 rounded-md bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
