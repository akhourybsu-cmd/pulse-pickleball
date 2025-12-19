import { useNavigate } from "react-router-dom";
import { Plus, CalendarSearch, MapPin, Trophy } from "lucide-react";

interface QuickAction {
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  path: string;
  primary?: boolean;
}

export const QuickActionsBar = () => {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      label: "Record",
      sublabel: "Match",
      icon: <Plus className="w-7 h-7" />,
      path: "/match/new",
      primary: true,
    },
    {
      label: "Browse",
      sublabel: "Events",
      icon: <CalendarSearch className="w-7 h-7" />,
      path: "/events/browse",
    },
    {
      label: "Court",
      sublabel: "Connector",
      icon: <MapPin className="w-7 h-7" />,
      path: "/court/connector",
    },
    {
      label: "Round",
      sublabel: "Robin",
      icon: <Trophy className="w-7 h-7" />,
      path: "/round-robin",
    },
  ];

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground px-1">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className={`
              flex flex-col items-center justify-center gap-2 p-4 rounded-2xl
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              aspect-square
              ${action.primary 
                ? "bg-primary text-primary-foreground shadow-[0_0_20px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_28px_hsl(var(--primary)/0.5)]" 
                : "bg-card border border-border hover:border-primary/30 hover:shadow-sm"
              }
            `}
            data-tour={action.path === "/match/new" ? "record-match" : undefined}
          >
            <div className={action.primary ? "" : "text-primary"}>
              {action.icon}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold leading-tight">{action.label}</p>
              <p className={`text-xs leading-tight ${action.primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                {action.sublabel}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
