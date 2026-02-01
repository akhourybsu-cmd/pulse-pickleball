import { useNavigate } from "react-router-dom";
import { Plus, Calendar } from "lucide-react";

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
      label: "Find Events",
      icon: <Calendar className="w-5 h-5" />,
      path: "/player/find",
      primary: true,
    },
    {
      label: "Record Match",
      icon: <Plus className="w-5 h-5" />,
      path: "/match/new",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <button
          key={action.path}
          onClick={() => navigate(action.path)}
          className={`
            flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-xl
            transition-all duration-200 ease-out hover:scale-[1.01] active:scale-[0.98]
            ${action.primary 
              ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:shadow-lg" 
              : "bg-card border border-border/40 text-foreground hover:border-primary/30 hover:bg-muted/30"
            }
          `}
          data-tour={action.path === "/player/find" ? "find-events" : action.path === "/match/new" ? "record-match" : undefined}
        >
          <span className={action.primary ? "text-primary-foreground" : "text-primary/80"}>
            {action.icon}
          </span>
          <span className="text-sm font-medium tracking-tight">{action.label}</span>
        </button>
      ))}
    </div>
  );
};
