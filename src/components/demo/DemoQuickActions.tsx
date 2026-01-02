import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";

export const DemoQuickActions = () => {
  const handleClick = () => {
    toast.info("Sign up to use this feature!", {
      action: {
        label: "Sign Up",
        onClick: () => window.location.href = "/auth",
      },
    });
  };

  const actions = [
    {
      label: "Record Match",
      icon: <Plus className="w-5 h-5" />,
      primary: true,
    },
    {
      label: "Round Robin",
      icon: <Trophy className="w-5 h-5" />,
      primary: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <button
          key={action.label}
          onClick={handleClick}
          className={`
            flex items-center justify-center gap-2.5 py-4 px-4 rounded-xl
            transition-all duration-200 hover:scale-[1.01] active:scale-[0.98]
            ${action.primary 
              ? "bg-primary text-primary-foreground shadow-md hover:bg-primary/90" 
              : "bg-background border border-border text-foreground hover:bg-muted/50 hover:border-primary/30"
            }
          `}
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
