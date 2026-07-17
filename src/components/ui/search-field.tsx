import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Show an inline spinner (e.g. while a debounced query is in flight). */
  loading?: boolean;
  /** Called after the field is cleared via the X button. */
  onClear?: () => void;
  containerClassName?: string;
}

/**
 * Consistent search input used across the friend/player search menus.
 *
 * - leading search icon
 * - trailing inline spinner while `loading`, otherwise a clear (X) button once
 *   there is text — so a stale query is always one tap from reset
 * - `type="text"` (not `"search"`) so the browser's native clear affordance
 *   doesn't collide with ours
 * - forwards a ref and all native input props, so callers keep autoFocus,
 *   onKeyDown, placeholder, etc.
 */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ value, onValueChange, loading, onClear, className, containerClassName, ...props }, ref) => {
    const showClear = value.length > 0 && !loading;
    const hasTrailing = loading || showClear;
    return (
      <div className={cn("relative", containerClassName)}>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={ref}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          role="searchbox"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          className={cn("pl-9", hasTrailing && "pr-9", className)}
          {...props}
        />
        {hasTrailing && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Searching" />
            ) : (
              <button
                type="button"
                onClick={() => {
                  onValueChange("");
                  onClear?.();
                }}
                className="rounded-full p-0.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  },
);
SearchField.displayName = "SearchField";
