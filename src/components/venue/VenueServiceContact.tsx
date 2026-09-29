import { Link } from "react-router-dom";
import { communityPath } from "@/lib/communityShare";
import type { VenueContact } from "@/lib/venues/branding";
export type { VenueContact } from "@/lib/venues/branding";
export function VenueServiceContact({
  contact,
  topic = "your booking",
}: {
  contact?: VenueContact | null;
  topic?: string;
}) {
  return (
    <aside
      className="space-y-2 rounded-xl border bg-card p-4 text-sm"
      aria-label="Venue information"
    >
      <p>
        For more information about {topic}, contact{" "}
        {contact?.name || "the venue"}.
      </p>
      <div className="flex flex-wrap gap-4">
        {contact?.group_id && (
          <Link
            className="font-medium underline underline-offset-4"
            to={communityPath(contact.group_id)}
          >
            See venue for more information
          </Link>
        )}
        {contact?.email && (
          <a
            className="break-all underline underline-offset-4"
            href={"mailto:" + encodeURIComponent(contact.email)}
          >
            Email the venue
          </a>
        )}
        {contact?.phone && (
          <a
            className="underline underline-offset-4"
            href={"tel:" + contact.phone.replace(/[^+0-9]/g, "")}
          >
            {contact.phone}
          </a>
        )}
      </div>
      {!contact?.email && !contact?.phone && !contact?.group_id && (
        <p className="text-muted-foreground">
          See venue staff for more information.
        </p>
      )}
    </aside>
  );
}
