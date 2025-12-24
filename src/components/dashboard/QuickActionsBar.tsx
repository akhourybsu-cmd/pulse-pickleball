import { useNavigate } from "react-router-dom";
import { Plus, CalendarSearch, Building2, Trophy } from "lucide-react";

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  path: string;
  primary?: boolean;
}

export const QuickActionsBar = () => {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      label: "Record",
      icon: <Plus className="w-5 h-5" />,
      path: "/match/new",
      primary: true,
    },
    {
      label: "Venues",
      icon: <Building2 className="w-5 h-5" />,
      path: "/player/venues",
    },
    {
      label: "Events",
      icon: <CalendarSearch className="w-5 h-5" />,
      path: "/events/browse",
    },
    {
      label: "Round Robin",
      icon: <Trophy className="w-5 h-5" />,
      path: "/round-robin",
    },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-full
            transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
            whitespace-nowrap flex-shrink-0
            ${action.primary 
              ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90" 
              : "bg-background border border-border text-foreground hover:bg-muted/50 hover:border-primary/30"
            }
          `}
          data-tour={action.path === "/match/new" ? "record-match" : undefined}
        >
          <span className={action.primary ? "text-primary-foreground" : "text-primary/70"}>
            {action.icon}
          </span>
          <span className="text-sm font-medium">{action.label}</span>
        </button>
      ))}
    </div>
  );
};
