import { useNavigate } from "react-router-dom";
import { Plus, CalendarSearch, MapPin, Trophy, Building2 } from "lucide-react";

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
      label: "Find",
      sublabel: "Venues",
      icon: <Building2 className="w-7 h-7" />,
      path: "/player/venues",
    },
    {
      label: "Browse",
      sublabel: "Events",
      icon: <CalendarSearch className="w-7 h-7" />,
      path: "/events/browse",
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {actions.map((action) => (
          <button
            key={action.path}
            onClick={() => navigate(action.path)}
            className={`
              flex flex-col items-center justify-center gap-2 p-4 rounded-xl
              transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
              aspect-square lg:aspect-auto lg:py-4
              ${action.primary 
                ? "bg-primary/10 border-2 border-primary/40 text-primary hover:bg-primary/15 hover:border-primary/60 shadow-sm" 
                : "bg-card border border-border hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm"
              }
            `}
            data-tour={action.path === "/match/new" ? "record-match" : undefined}
          >
            <div className={action.primary ? "text-primary" : "text-primary/70"}>
              {action.icon}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold leading-tight text-foreground">{action.label}</p>
              <p className="text-xs text-muted-foreground leading-tight">
                {action.sublabel}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
