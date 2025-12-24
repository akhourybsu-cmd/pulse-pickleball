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
      label: "Record Match",
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
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path)}
          className={`
            flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl
            transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]
            ${action.primary 
              ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 col-span-1" 
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
