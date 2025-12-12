import { useNavigate } from "react-router-dom";
import { Plus, CalendarPlus, Users, Trophy } from "lucide-react";

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
      icon: <Plus className="w-5 h-5" />,
      path: "/match/new",
      primary: true,
    },
    {
      label: "Create",
      sublabel: "Event",
      icon: <CalendarPlus className="w-5 h-5" />,
      path: "/round-robin/create",
    },
    {
      label: "Find",
      sublabel: "Open Play",
      icon: <Users className="w-5 h-5" />,
      path: "/court/connector",
    },
    {
      label: "Round",
      sublabel: "Robin",
      icon: <Trophy className="w-5 h-5" />,
      path: "/round-robin",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2 md:gap-3">
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path)}
          className={`
            flex flex-col items-center justify-center gap-1 p-3 md:p-4 rounded-xl
            transition-all hover:scale-105 active:scale-95
            min-h-[72px] md:min-h-[80px]
            ${action.primary 
              ? "bg-primary text-primary-foreground shadow-[var(--shadow-glow)]" 
              : "bg-card border border-border hover:border-primary/30 hover:shadow-md"
            }
          `}
          data-tour={action.path === "/match/new" ? "record-match" : undefined}
        >
          <div className={action.primary ? "" : "text-primary"}>
            {action.icon}
          </div>
          <div className="text-center">
            <p className="text-xs md:text-sm font-semibold leading-tight">{action.label}</p>
            <p className={`text-[10px] md:text-xs leading-tight ${action.primary ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {action.sublabel}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
};
