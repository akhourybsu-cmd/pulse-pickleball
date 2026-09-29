import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { venueRpc as rpc, venueDate } from "@/lib/venues/customerRecords";
import type { DeskWorkspace } from "@/lib/venues/deskSales";
import { paymentApi } from "@/lib/payments";
export function VenueDeskFollowup({
  workspace: w,
  onChanged,
}: {
  workspace: DeskWorkspace;
  onChanged: () => void;
}) {
  const [cancel, setCancel] = useState<
      NonNullable<DeskWorkspace["memberships"]>[number] | null
    >(null),
    [returned, setReturned] = useState<
      NonNullable<DeskWorkspace["equipment"]>[number] | null
    >(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [request, setRequest] = useState(() => crypto.randomUUID());
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setCancel(null);
      setReturned(null);
      setNotice("Changes saved.");
      onChanged();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to complete the change."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Membership renewals</h2>
        {w.memberships?.length ? (
          w.memberships.map((m) => (
            <article
              key={m.subscription_id}
              className="space-y-2 border-t py-3"
            >
              <p className="font-medium">
                {m.first_name} {m.last_name} · {m.product_name}
              </p>
              <p className="text-sm text-muted-foreground">
                {m.status}
                {m.paid_through
                  ? ` · Paid through ${venueDate(m.paid_through, w.timezone)}`
                  : ""}
                {m.cancel_at_period_end ? " · Renewal canceled" : ""}
              </p>
              {w.is_owner &&
                !m.cancel_at_period_end &&
                !["canceled", "incomplete_expired"].includes(m.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setError("");
                      setRequest(crypto.randomUUID());
                      setCancel(m);
                    }}
                  >
                    Cancel next renewal
                  </Button>
                )}
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No monthly memberships for this selection.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          The venue owner can stop future renewal. Paid membership time remains
          available. Players can also manage billing in Payments & purchases.
        </p>
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-semibold">Equipment checked out</h2>
        {w.equipment?.length ? (
          w.equipment.map((e) => (
            <article
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 border-t py-3"
            >
              <div>
                <p className="font-medium">
                  {e.product_name} · {e.outstanding} out
                </p>
                <p className="text-sm text-muted-foreground">
                  {e.first_name} {e.last_name}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setError("");
                  setRequest(crypto.randomUUID());
                  setReturned(e);
                }}
              >
                Record return
              </Button>
            </article>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            All rented equipment has been returned.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Recording a physical return restores inventory. Refunds are managed
          separately.
        </p>
      </section>
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      <Dialog
        open={!!cancel || !!returned}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setCancel(null);
            setReturned(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {cancel ? "Cancel membership renewal" : "Return rented equipment"}
            </DialogTitle>
            <DialogDescription>
              {cancel
                ? `${cancel.product_name}: stop the next charge and preserve paid access.`
                : `${returned?.product_name}: restore only the items physically returned.`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void act(() =>
                cancel
                  ? paymentApi("venue_membership_cancel", {
                      subscription_id: cancel.subscription_id,
                      confirm_cancel: f.get("confirm") === "on",
                      request_key: request,
                    })
                  : rpc("venue_equipment_return", {
                      p_sale: returned!.id,
                      p_quantity: Number(f.get("quantity")),
                      p_request: request,
                      p_returned: f.get("confirm") === "on",
                    })
              );
            }}
          >
            {returned && (
              <label className="block text-sm">
                Quantity returned
                <Input
                  name="quantity"
                  type="number"
                  min={1}
                  max={Number(returned.outstanding)}
                  defaultValue={Number(returned.outstanding)}
                  required
                />
              </label>
            )}
            <label className="flex gap-2 text-sm">
              <input type="checkbox" name="confirm" required />
              {cancel
                ? "Stop future automatic renewal for this membership."
                : "I have received these items back at the venue."}
            </label>
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            <Button disabled={busy}>
              {busy ? "Saving…" : cancel ? "Cancel renewal" : "Record return"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
