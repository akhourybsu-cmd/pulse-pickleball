import { createContext, useContext } from "react";
import {
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useVenueModules } from "@/hooks/useVenueModules";
import { useAuthState } from "@/hooks/useAuthState";
import { usePrivateVenueSandbox } from "@/hooks/usePrivateVenueSandbox";
import {
  canManageVenue,
  canOperateVenue,
  useMyVenueRole,
} from "./VenueStaffContext";
import { VenueTheme } from "./VenueTheme";
import { VenueLoadState } from "./VenueLoadState";
import { VenueAdminShell } from "@/components/community/admin/VenueAdminShell";
import { resolveVenueAdminTab } from "@/lib/venues/navigation";
import { venueAdminHref, venueAdminItems } from "@/lib/venues/adminNavigation";

const VenueAdminContext = createContext(false);
export const useVenueAdminLayout = () => useContext(VenueAdminContext);

/** Mounted once across all venue management routes, including league and match play. */
export default function VenueAdminLayout() {
  const { groupId = "" } = useParams();
  const { group, membership, loading, isError, refetch } =
    useGroupDetail(groupId);
  const { user } = useAuthState();
  const modules = useVenueModules(group?.venue_id);
  const staff = useMyVenueRole(group?.venue_id);
  const privateSample = usePrivateVenueSandbox(group?.venue_id);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  if (isError || staff.error || modules.isError)
    return (
      <VenueLoadState
        fullPage
        onRetry={() => {
          void refetch();
          void staff.refetch();
          void modules.refetch();
        }}
      />
    );
  if (loading || (group?.venue_id && (staff.loading || modules.loading)))
    return (
      <div className="p-6" role="status">
        Opening venue management…
      </div>
    );
  if (!group?.venue_id) return <Outlet />;
  const member = membership?.status === "active" ? membership : null;
  const owner =
    member?.role === "owner" || (!!user && group.venue?.owner_id === user.id);
  const manage = owner || canManageVenue(staff.role);
  const community = member?.role === "owner" || member?.role === "moderator";
  const operate = modules.facility && (owner || canOperateVenue(staff.role));
  const programs = manage || staff.role === "organizer";
  const base = `/player/community/group/${groupId}`;
  if (!manage && !community && !operate && !programs)
    return <Navigate to={base} replace />;
  const section = location.pathname.slice(base.length);
  const active = section.startsWith("/payments")
    ? "payments"
    : section.startsWith("/appointments")
    ? "appointments"
    : section.startsWith("/communications")
    ? "communications"
    : section.startsWith("/reports")
    ? "reports"
    : section.startsWith("/players")
    ? "players"
    : section.startsWith("/desk")
    ? "desk"
    : section.startsWith("/walk-ins")
    ? "walk-ins"
    : section.startsWith("/check-in-stations")
    ? "check-in-stations"
    : section.startsWith("/booking-policies")
    ? "booking-policies"
    : section.startsWith("/ops")
    ? "ops"
    : section.startsWith("/events")
    ? "events"
    : section.startsWith("/competitions")
    ? "competitions"
    : resolveVenueAdminTab(
        params.get("tab"),
        manage,
        community,
        modules.booking || modules.facility
      );
  const kiosk = active === "ops" && params.get("kiosk") === "1";
  return (
    <VenueTheme brand={group.venue}>
      <VenueAdminContext.Provider value={true}>
        <VenueAdminShell
          venueName={group.venue?.name ?? group.name}
          verified={!!group.is_venue_verified}
          roleLabel={owner ? "Owner" : staff.role ?? "Community moderator"}
          accent={group.venue?.primary_color}
          activeTab={active}
          items={venueAdminItems({
            desk:
              (!!user && group.venue?.owner_id === user.id) ||
              canManageVenue(staff.role) ||
              (modules.facility && staff.role === "staff"),
            finance: !!user && group.venue?.owner_id === user.id,
            manage,
            programs,
            operate,
            community,
            facility: modules.booking || modules.facility,
            privateSample: !!privateSample,
          })}
          onTabChange={(tab) => navigate(venueAdminHref(groupId, tab))}
          onBack={() => navigate(base)}
          onViewVenue={() => navigate(base)}
          onOperations={() => navigate(`${base}/ops`)}
          showOperations={operate && active !== "ops"}
          kiosk={kiosk}
        >
          <Outlet />
        </VenueAdminShell>
      </VenueAdminContext.Provider>
    </VenueTheme>
  );
}
