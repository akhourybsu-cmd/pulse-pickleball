import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthState } from "@/hooks/useAuthState";
import { eventManagementRpc as rpc } from "@/lib/venues/eventManagement";
import type { AttendanceDay } from "@/lib/venues/attendance";

export function useVenueAttendance(
  groupId: string | undefined,
  day: string,
  enabled: boolean
) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["venue-attendance", groupId, day, user?.id],
    enabled: enabled && !!groupId && !!user,
    queryFn: () =>
      rpc<AttendanceDay>("get_venue_attendance_day", {
        p_group: groupId,
        p_day: day,
      }),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const refresh = async () => {
    await Promise.all(
      [
        "venue-attendance",
        "venue-event-attendees",
        "venue-event-management",
      ].map((key) => client.invalidateQueries({ queryKey: [key] }))
    );
  };
  return { ...query, refresh };
}

