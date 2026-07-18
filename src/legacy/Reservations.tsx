import { PageHeader } from "@/components/PageHeader";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarView } from "@/components/reservations/CalendarView";
import pickleballCitiLogo from "@/assets/pickleball-citi-logo.png";

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
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Court Reservations</h1>
          </div>
          <p className="text-muted-foreground ml-11">Pickleball Citi, Cranston, RI - 2 Courts</p>
        </div>

        <CalendarView 
          facilityId="pickleball-citi-cranston" 
          currentUserId={session?.user?.id || null}
          pickleballCitiLogo={pickleballCitiLogo}
        />
      </div>
    </div>
  );
}
