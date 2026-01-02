import { MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demoCourtStats } from "@/data/demoData";

export const DemoStatsByCourt = () => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="w-4 h-4 text-primary" />
          Stats by Court
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {demoCourtStats.map((court, index) => (
          <div 
            key={court.id}
            className="flex justify-between items-center p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{court.name}</p>
              <p className="text-xs text-muted-foreground">{court.matches} matches</p>
            </div>
            <div className="text-right flex-shrink-0 ml-3">
              <p className="font-bold text-primary text-sm">{court.rating.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">{court.wins}W-{court.losses}L</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
