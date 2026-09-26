import { RowCard } from "@/components/dashboard/Row";
import type { Recommendation } from "@/types/media";

export interface ThreadMessage {
  role: "user" | "assistant";
  content: string;
  results?: Recommendation[];
  followUps?: string[];
  error?: boolean;
}

interface MessageProps {
  message: ThreadMessage;
  /** Only the newest assistant message offers follow-up suggestions. */
  isLatest: boolean;
  disabled: boolean;
  onFollowUp: (text: string) => void;
}

export default function Message({ message, isLatest, disabled, onFollowUp }: MessageProps) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-accent-from to-accent-to px-4 py-2.5 text-sm text-white">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-accent-from to-accent-to text-[11px] font-extrabold text-white"
      >
        MM
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={`inline-block max-w-[92%] rounded-2xl rounded-tl-md border px-4 py-2.5 text-sm ${
            message.error
              ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
              : "border-border bg-surface"
          }`}
        >
          {message.content}
        </p>

        {message.results && message.results.length > 0 && (
          <div className="scroll-row -mr-4 mt-3 flex snap-x gap-3 overflow-x-auto pb-3 pr-4">
            {message.results.map((item, i) => (
              <RowCard key={`${item.mediaType}:${item.id}`} item={item} index={i} />
            ))}
          </div>
        )}

        {isLatest && message.followUps && message.followUps.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {message.followUps.map((text) => (
              <button
                key={text}
                type="button"
                disabled={disabled}
                onClick={() => onFollowUp(text)}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition hover:border-accent-from disabled:opacity-50"
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
