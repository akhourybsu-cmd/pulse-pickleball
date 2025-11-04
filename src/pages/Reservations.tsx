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
          <div className="flex items-center gap-3 mb-1">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Court Reservations</h1>
          </div>
          <div className="flex items-center gap-2 mt-2 ml-11" aria-label="Pickleball Citi branding">
            <img 
              src={pickleballCitiLogo} 
              alt="Pickleball Citi" 
              className="h-7 object-contain"
              style={{ maxWidth: '110px' }}
            />
            <span className="text-[15px] font-medium">Cranston Facility</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-[13px] text-muted-foreground/70 italic">Powered by PULSE</span>
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
