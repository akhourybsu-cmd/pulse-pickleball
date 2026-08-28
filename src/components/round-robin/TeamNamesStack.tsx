import { cn } from "@/lib/utils";

interface TeamNamesStackProps {
  player1: string;
  player2?: string | null;
  /** Right-align the names (used for the away side of a versus row). */
  align?: "left" | "right";
  /** Winner treatment. */
  isWinner?: boolean;
  className?: string;
}

/**
 * Two player names stacked on their own lines.
 *
 * Round Robin cards used to join a doubles pairing into one line
 * ("Alexander Khoury / Jordan Whitfield") and truncate it — on a phone
 * that meant both names were unreadable. Stacking gives each name the
 * full card width, so a single name only clips in the extreme case, and
 * the pairing stays scannable at a glance.
 */
export function TeamNamesStack({
  player1,
  player2,
  align = "left",
  isWinner,
  className,
}: TeamNamesStackProps) {
  const names = [player1, player2].filter(
    (n): n is string => !!n && n.trim().length > 0,
  );

  return (
    <div
      className={cn(
        "min-w-0 flex flex-col leading-tight",
        align === "right" ? "items-end text-right" : "items-start text-left",
        className,
      )}
    >
      {names.map((name, i) => (
        <span
          key={`${name}-${i}`}
          className={cn(
            "w-full truncate text-[13px] sm:text-sm",
            isWinner ? "font-semibold text-foreground" : "text-foreground/90",
          )}
          title={name}
        >
          {name}
        </span>
      ))}
    </div>
  );
}
