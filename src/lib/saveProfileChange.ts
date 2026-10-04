import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { withAuthDeadline } from '@/lib/authDeadline';
export async function saveProfileChange(
  userId: string,
  updates: Database["public"]["Tables"]["profiles"]["Update"],
) {
  const { data, error } = await withAuthDeadline(signal => supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("id")
    .abortSignal(signal)
    .maybeSingle());
  if (error) throw error;
  if (!data)
    throw new Error("Profile changes were not saved. Refresh and try again.");
}
