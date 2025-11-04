import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
            <p className="text-muted-foreground">Book courts and register for events</p>
          </div>
        </div>

        <div className="bg-card rounded-xl shadow-md p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Reservations System</h2>
          <p className="text-muted-foreground mb-6">
            Database schema created successfully! The reservation calendar will be fully functional once the database types are regenerated.
          </p>
          <div className="text-left max-w-2xl mx-auto space-y-4">
            <h3 className="font-semibold text-lg">Created:</h3>
            <ul className="list-disc pl-6 space-y-2 text-sm">
              <li>✅ Facilities table with Pickleball Citi seeded</li>
              <li>✅ Courts table (8 courts created)</li>
              <li>✅ Calendar Events table with event types (League, Open Play, Private, Lesson)</li>
              <li>✅ Leagues table for multi-week programs</li>
              <li>✅ Event Registrations table with waitlist support</li>
              <li>✅ Admin role assigned to akhourybsu@gmail.com</li>
              <li>✅ Row Level Security policies configured</li>
            </ul>
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-sm">
                <strong>Next:</strong> The full calendar interface with week/month/day views, event filtering, and admin panel will be available after the database types update.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
