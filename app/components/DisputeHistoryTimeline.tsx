"use client";

interface TimelineEvent {
  id: string;
  timestamp: number;
  title: string;
  description?: string;
  type: "raised" | "evidence" | "resolved" | "dismissed";
}

interface Props {
  events: TimelineEvent[];
  isLoading?: boolean;
}

const typeStyles: Record<string, string> = {
  raised: "bg-danger-soft/10 text-danger-soft border-danger-soft/20",
  evidence: "bg-info-soft/10 text-info-soft border-info-soft/20",
  resolved: "bg-success-soft/10 text-success-soft border-success-soft/20",
  dismissed: "bg-text-muted/10 text-text-muted border-text-muted/20",
};

const typeIcons: Record<string, string> = {
  raised: "⚠️",
  evidence: "📄",
  resolved: "✓",
  dismissed: "✕",
};

export default function DisputeHistoryTimeline({ events, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-surface-secondary animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-8 text-text-muted">
        <p>No dispute history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline container with grid layout constraints for larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {events.map((event, index) => {
          const dateStr = new Date(event.timestamp).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          const timeStr = new Date(event.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={event.id}
              className={`
                border rounded-lg p-4 transition-all
                ${typeStyles[event.type]}
              `}
            >
              {/* Left connector line */}
              {index !== events.length - 1 && (
                <div className="hidden lg:block absolute left-8 top-full h-6 w-0.5 bg-border/30" />
              )}

              {/* Event header with icon and type */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{typeIcons[event.type]}</span>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm truncate">{event.title}</h4>
                  <p className="text-xs opacity-75">
                    {dateStr} {timeStr}
                  </p>
                </div>
              </div>

              {/* Event description */}
              {event.description && (
                <p className="text-sm leading-relaxed break-words">
                  {event.description}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Responsive info text */}
      <div className="text-xs text-text-muted px-4 py-3 bg-surface-secondary rounded-lg">
        <p>
          Showing {events.length} event{events.length !== 1 ? "s" : ""} •{" "}
          {new Date(Math.max(...events.map((e) => e.timestamp))).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
