import { PageHeader } from "@/components/PageHeader";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarView } from "@/components/reservations/CalendarView";

export default function Reservations() {
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={session?.user?.id} />

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Court Reservations</h1>
            <p className="text-muted-foreground">
              Pickleball Citi - Cranston • 2 Courts • Open 8 AM - 8 PM Daily
            </p>
          </div>
        </div>

        <CalendarView 
          facilityId="pickleball-citi-cranston" 
          currentUserId={session?.user?.id || null}
        />
      </div>
    </div>
  );
}
