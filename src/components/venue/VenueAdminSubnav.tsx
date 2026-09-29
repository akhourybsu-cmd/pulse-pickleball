import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Local views keep one clear, scrollable selection without resembling primary actions. */
export function VenueAdminSubnav<T extends string>({
  label,
  value,
  items,
  onChange,
  children,
}: {
  label: string;
  value: T;
  items: readonly { value: T; label: string; icon?: LucideIcon }[];
  onChange: (value: T) => void;
  children?: ReactNode;
}) {
  return (
    <div className="venue-admin-subnav-row">
      <nav aria-label={label} className="venue-admin-subnav">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-current={item.value === value ? "page" : undefined}
            onClick={() => onChange(item.value)}
          >
            {item.icon && (
              <item.icon aria-hidden className="h-4 w-4 shrink-0" />
            )}
            {item.label}
          </button>
        ))}
      </nav>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}
