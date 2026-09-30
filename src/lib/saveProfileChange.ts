import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
export async function saveProfileChange(
  userId: string,
  updates: Database["public"]["Tables"]["profiles"]["Update"],
) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error("Profile changes were not saved. Refresh and try again.");
}
