/**
 * Admin System Health page
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { toast } from "sonner";
import { SystemHealthDashboard } from "@/components/admin/SystemHealthDashboard";
import { AdminLayout } from "@/components/admin/AdminLayout";

export default function AdminSystemHealth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error("Please sign in to access admin features");
        navigate("/auth");
        return;
      }
      if (!(await isPlatformAdmin(user.id))) {
        toast.error("Admin privileges required");
        navigate("/player/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };
    checkAdminAccess();
  }, [navigate]);

  if (loading) {
    return (
      <AdminLayout title="System Health">
        <div className="min-h-[40vh] flex items-center justify-center">
          <p className="text-muted-foreground">Checking admin access…</p>
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) return null;

  return (
    <AdminLayout title="System Health">
      <div className="container mx-auto px-4 py-6">
        <SystemHealthDashboard />
      </div>
    </AdminLayout>
  );
}
