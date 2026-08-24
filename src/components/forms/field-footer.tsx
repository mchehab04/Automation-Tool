import { cn } from "@/lib/utils";

export function FieldFooter({
  error,
  count,
  max,
}: {
  error?: string;
  count?: number;
  max?: number;
}) {
  if (!error && max === undefined) return null;

  return (
    <div className="flex min-h-4 items-center justify-between gap-2 text-xs">
      <span className="text-destructive">{error}</span>
      {max !== undefined && count !== undefined ? (
        <span
          className={cn(
            "ml-auto shrink-0 tabular-nums text-muted-foreground",
            count > max && "text-destructive",
          )}
        >
          {count}/{max}
        </span>
      ) : null}
    </div>
  );
}
