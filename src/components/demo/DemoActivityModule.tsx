import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, CheckCircle, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { demoPendingActions } from "@/data/demoData";

export const DemoActivityModule = () => {
  const handleClick = () => {
    toast.info("Sign up to use this feature!", {
      action: {
        label: "Sign Up",
        onClick: () => window.location.href = "/auth",
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Pending Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="w-4 h-4 text-primary" />
            Pending Actions
            <span className="ml-auto bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
              {demoPendingActions.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {demoPendingActions.map((action) => (
            <div 
              key={action.id}
              className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {action.type === "match_verification" ? (
                  <CheckCircle className="w-4 h-4 text-primary" />
                ) : (
                  <Users className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{action.message}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {action.time}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-shrink-0 text-xs"
                onClick={handleClick}
              >
                View
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">This Week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-primary">3</p>
              <p className="text-xs text-muted-foreground">Matches Played</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">+0.09</p>
              <p className="text-xs text-muted-foreground">Rating Change</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
