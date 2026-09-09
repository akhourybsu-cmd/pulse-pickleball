import { useReducer, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, LayoutGrid, RotateCcw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  demoCourts, demoTimes, demoHourlyRate, demoMaintenanceSlot,
  demoSlotDetails, demoSlotStatus, newVenueDemo, venueDemoReducer,
  type VenueDemoFeature,
} from "@/lib/venues/venueDemo";

/** Never mount real booking/payment forms here. All interactions are local simulations. */
export default function VenuePremiumDemo({ initialFeature, onClose, onReturnFocus }: {
  initialFeature: VenueDemoFeature;
  onClose: () => void;
  onReturnFocus: () => void;
}) {
  const [feature, setFeature] = useState<VenueDemoFeature>(initialFeature);
  const [state, dispatch] = useReducer(venueDemoReducer, undefined, newVenueDemo);
  const [notice, setNotice] = useState("");
  const reservationPanel = useRef<HTMLElement | null>(null);
  const scrollArea = useRef<HTMLDivElement | null>(null);
  const bookingTab = useRef<HTMLButtonElement | null>(null);
  const operationsTab = useRef<HTMLButtonElement | null>(null);
  const switchFeature = (value: VenueDemoFeature) => {
    setFeature(value);
    scrollArea.current?.scrollTo({ top: 0, behavior: "instant" });
    (value === "court_booking" ? bookingTab : operationsTab).current?.focus({ preventScroll: true });
  };
  const selected = demoSlotDetails(state.selected);
  const reserved = !!state.selected && state.reservations.includes(state.selected);
  const maintenanceConflict = state.reservations.includes(demoMaintenanceSlot);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="flex h-[94dvh] max-h-[960px] w-[calc(100%-1rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-2xl p-0 font-sans sm:rounded-2xl [&>button]:flex [&>button]:h-10 [&>button]:w-10 [&>button]:items-center [&>button]:justify-center [&>button]:right-2 [&>button]:top-2"
        onCloseAutoFocus={(event) => { event.preventDefault(); onReturnFocus(); }}
      >
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-14 text-left sm:px-6 sm:pr-16">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide">INTERACTIVE DEMO</span>
            <span className="text-xs text-muted-foreground">Sample data only</span>
          </div>
          <DialogTitle className="font-sans text-xl leading-tight">Explore a venue with paid features</DialogTitle>
          <DialogDescription className="text-xs leading-5 sm:text-sm">
            Nothing here books a court, charges a card, or changes your venue.
          </DialogDescription>
        </DialogHeader>

        <div ref={scrollArea} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-venue-demo-scroll>
          <Tabs value={feature} onValueChange={(value) => switchFeature(value as VenueDemoFeature)} className="p-4 sm:p-6">
            <TabsList aria-label="Paid feature demos" className="grid h-auto w-full grid-cols-2 gap-1 rounded-xl p-1.5">
              <TabsTrigger ref={bookingTab} value="court_booking" className="min-h-14 min-w-0 flex-col gap-1 whitespace-normal rounded-lg px-2 text-center leading-5">
                <span>Court booking</span><span className="text-xs font-normal">$10/month</span>
              </TabsTrigger>
              <TabsTrigger ref={operationsTab} value="facility_tools" className="min-h-14 min-w-0 flex-col gap-1 whitespace-normal rounded-lg px-2 text-center leading-5">
                <span>Facility operations</span><span className="text-xs font-normal">$10/month</span>
              </TabsTrigger>
            </TabsList>

            <div className="my-4 flex items-center justify-between gap-3 sm:my-5">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Fictional venue</p>
                <h3 className="mt-1 font-sans text-base font-semibold tracking-tight sm:text-xl">Harbor Pickleball Club</h3>
                <p className="mt-1 text-xs text-muted-foreground">3 courts · Sample Saturday<span className="hidden sm:inline"> · Venue time</span></p>
              </div>
              <Button variant="ghost" aria-label="Reset demo" className="h-11 w-11 shrink-0 rounded-xl p-0 sm:w-auto sm:px-4" onClick={() => {
                dispatch({ type: "reset" }); setNotice("Demo reset. All sample reservations and maintenance changes have been cleared.");
              }}><RotateCcw className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Reset demo</span></Button>
            </div>
            <p role="status" aria-live="polite" className={cn("text-sm leading-6", notice && "mb-4 rounded-xl border bg-card p-3")}>{notice}</p>

            <TabsContent value="court_booking" className="mt-0">
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="demo-booking-title">
                  <div className="flex items-start gap-3">
                    <LayoutGrid className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Player view</p>
                      <h4 id="demo-booking-title" className="mt-1 font-sans text-lg font-semibold">Find your next court</h4>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Choose an available one-hour slot. Then try a sample reservation.</p>
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {demoTimes.map((time, timeIndex) => (
                      <div key={time} className="rounded-xl border bg-background/50 p-3 sm:p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-2 text-sm font-semibold tabular-nums"><Clock3 className="h-4 w-4 text-muted-foreground" />{time}</p>
                          <span className="text-xs text-muted-foreground">60 min · ${demoHourlyRate} sample rental</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {demoCourts.map((court, courtIndex) => {
                            const id = `${timeIndex}-${courtIndex}`;
                            const status = demoSlotStatus(state, id);
                            const available = status === "Available";
                            const chosen = state.selected === id;
                            return (
                              <button key={id} type="button" disabled={!available} aria-pressed={chosen}
                                aria-label={`${court}, ${time}, ${status}`}
                                onClick={() => { dispatch({ type: "select", id }); setNotice(""); }}
                                className={cn("min-h-20 min-w-0 rounded-lg border px-2 py-3 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                  available ? "border-border bg-card hover:border-primary hover:bg-primary/10" : "border-dashed bg-muted/40 text-muted-foreground",
                                  chosen && "border-primary bg-primary/15 ring-1 ring-primary")}
                              >
                                <span className="block text-sm font-semibold">{court}</span>
                                <span className="mt-1 block break-words text-[11px] leading-4">{chosen && available ? "Selected" : status}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <aside className="min-w-0 space-y-4 lg:sticky lg:top-4">
                  <section ref={reservationPanel} className="scroll-mt-4 rounded-2xl border bg-card p-5" aria-labelledby="demo-reservation-title">
                    <h4 id="demo-reservation-title" className="font-sans font-semibold">Your sample reservation</h4>
                    {selected ? (
                      <>
                        <p className="mt-4 text-lg font-semibold">{selected.court}</p>
                        <p className="mt-1 text-sm text-muted-foreground">Sample Saturday · {selected.time} · 60 min</p>
                        <div className="my-4 flex items-center justify-between border-y py-4"><span className="text-sm">Sample rental total</span><span className="text-xl font-semibold">${selected.rate}.00</span></div>
                        {reserved ? (
                          <p role="status" className="flex gap-2 rounded-xl bg-primary/10 p-3 text-sm leading-6"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" />Demo complete. Nothing was reserved or charged. See this sample slot in Facility operations.</p>
                        ) : (
                          <Button className="min-h-12 w-full whitespace-normal rounded-xl bg-foreground text-background hover:bg-foreground/90" onClick={() => dispatch({ type: "reserve" })}>Simulate reservation · no charge</Button>
                        )}
                      </>
                    ) : <p className="mt-3 text-sm leading-6 text-muted-foreground">Tap an available court to see the time, duration and sample price before confirming.</p>}
                    <p className="mt-4 text-xs leading-5 text-muted-foreground">Example pricing only. In a live venue, the owner sets rental prices and policies. Paid rentals require a connected Stripe account.</p>
                  </section>
                  <div className="px-1 text-sm leading-6">
                    <p className="font-semibold">What this adds to your venue</p>
                    <p className="mt-2 text-muted-foreground">A player-facing court schedule and reservation flow. Your free posts, chat and community events stay in place.</p>
                    <Button variant="link" className="mt-2 h-auto whitespace-normal px-0 text-left" onClick={() => switchFeature("facility_tools")}>See the manager’s view<ArrowRight className="ml-2 h-4 w-4 shrink-0" /></Button>
                  </div>
                </aside>
              </div>
            </TabsContent>

            <TabsContent value="facility_tools" className="mt-0 space-y-5">
              <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                <section className="min-w-0 rounded-2xl border bg-card p-4 sm:p-5" aria-labelledby="demo-ops-title">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-1 h-5 w-5 shrink-0 text-primary" />
                    <div><p className="text-xs font-medium text-muted-foreground">Manager view</p>
                      <h4 id="demo-ops-title" className="mt-1 font-sans text-lg font-semibold">A clear view of the day</h4>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">Programs, reservations and maintenance in one court schedule.</p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                    {demoCourts.map((court, courtIndex) => {
                      const status = demoSlotStatus(state, `0-${courtIndex}`);
                      return <div key={court} className="rounded-xl border bg-background/50 p-3">
                        <p className="text-sm font-semibold">{court}</p>
                        <p className="mt-1 text-xs text-muted-foreground">At 9:00 AM</p>
                        <p className="mt-3 flex items-start gap-2 text-xs leading-5 sm:text-sm"><span aria-hidden className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", status === "Available" ? "bg-emerald-600" : status === "Maintenance" ? "bg-muted-foreground" : "bg-primary")} /><span className="min-w-0 break-words">{status}</span></p>
                      </div>;
                    })}
                  </div>
                  <h5 className="mb-3 mt-6 text-sm font-semibold">Sample Saturday schedule</h5>
                  <div className="space-y-3">
                    {demoTimes.map((time, timeIndex) => <div key={time} className="grid gap-2 border-t pt-3 sm:grid-cols-[70px_minmax(0,1fr)]">
                      <p className="pt-1 text-xs font-semibold tabular-nums">{time}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {demoCourts.map((court, courtIndex) => {
                          const status = demoSlotStatus(state, `${timeIndex}-${courtIndex}`);
                          return <div key={court} className={cn("min-w-0 rounded-lg border-l-2 p-3", status === "Available" ? "border-l-border bg-muted/30" : status === "Maintenance" ? "border-l-muted-foreground bg-muted" : "border-l-primary bg-primary/10")}>
                            <p className="text-[11px] text-muted-foreground">{court}</p><p className="mt-1 break-words text-xs font-medium leading-5">{status}</p>
                          </div>;
                        })}
                      </div>
                    </div>)}
                  </div>
                </section>

                <aside className="min-w-0 space-y-4 lg:sticky lg:top-4">
                  <section className="rounded-2xl border bg-card p-5" aria-labelledby="demo-maintenance-title">
                    <Wrench className="mb-3 h-5 w-5 text-primary" />
                    <h4 id="demo-maintenance-title" className="font-sans font-semibold">Try a maintenance block</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Take Court 3 out of play from 9–10 AM. Switch to the player view to see that slot become unavailable.</p>
                    <Button variant="outline" disabled={maintenanceConflict} className="mt-4 min-h-12 w-full whitespace-normal rounded-xl" onClick={() => {
                      dispatch({ type: "toggle-maintenance" });
                      setNotice(state.maintenance ? "Sample maintenance removed. Court 3 is available again at 9:00 AM." : "Sample maintenance added. Court 3 is unavailable at 9:00 AM in both views. Your real venue is unchanged.");
                    }}>{state.maintenance ? "Remove sample block" : "Block Court 3 · 9 AM"}</Button>
                    {maintenanceConflict && <p className="mt-3 text-xs leading-5 text-muted-foreground">This slot has your demo reservation. Reset the demo to try maintenance; existing reservations are not overwritten.</p>}
                    <Button variant="link" className="mt-3 h-auto whitespace-normal px-0 text-left" onClick={() => switchFeature("court_booking")}>Check the player view<ArrowRight className="ml-2 h-4 w-4 shrink-0" /></Button>
                  </section>
                  <div className="px-1 text-sm leading-6">
                    <p className="font-semibold">Your team’s working space</p>
                    <p className="mt-2 text-muted-foreground">See court assignments, scheduled programs and closures without mixing staff tools into the player experience.</p>
                    <p className="mt-3 text-xs leading-5 text-muted-foreground">Facility operations is a separate $10/month feature. Player court reservations require Court booking; neither feature requires buying the other.</p>
                  </div>
                </aside>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-card px-4 py-3 sm:px-6">
          {feature === "court_booking" && selected && (
            <div className="flex w-full items-center justify-between gap-3 border-b pb-3 lg:hidden">
              <p className="text-xs leading-5"><span className="font-semibold">{selected.court} · {selected.time}</span><br />{reserved ? "Demo complete · nothing charged" : `$${selected.rate} sample rental · 60 min`}</p>
              <Button variant="outline" className="min-h-11 shrink-0 rounded-xl" onClick={() => {
                reservationPanel.current?.scrollIntoView({ block: "start", behavior: "instant" });
                reservationPanel.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
              }}>View sample</Button>
            </div>
          )}
          <p className="max-w-[90px] text-xs leading-5 text-muted-foreground sm:max-w-xl"><span className="sm:hidden">Demo only.<br />No charges.</span><span className="hidden sm:inline">Illustrative layout · $10/month per feature, or $20/month for both. Your community remains free. No trial or subscription starts. Sample edits reset on close.</span></p>
          <Button variant="outline" className="min-h-11 rounded-xl" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Back to upgrades</Button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
