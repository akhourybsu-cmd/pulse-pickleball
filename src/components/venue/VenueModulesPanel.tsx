import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { paymentApi, type PaymentConfig } from "@/lib/payments";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  LayoutGrid,
  ShieldCheck,
  ArrowUpRight,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useVenueModules } from "@/hooks/useVenueModules";
import { VenueAddonCheckout } from "./VenueAddonCheckout";
import type { VenueDemoFeature } from "@/lib/venues/venueDemo";

const VenuePremiumDemo = lazy(() => import("./VenuePremiumDemo"));

export function VenueModulesPanel({
  venueId,
  verified,
  canVerify = false,
  privateSample = false,
}: {
  venueId: string;
  verified: boolean;
  canVerify?: boolean;
  privateSample?: boolean;
}) {
  const [demo, setDemo] = useState<VenueDemoFeature | null>(null);
  const demoOpener = useRef<HTMLButtonElement | null>(null);
  const openDemo = (feature: VenueDemoFeature, opener: HTMLButtonElement) => {
    demoOpener.current = opener;
    setDemo(feature);
  };
  const access = useVenueModules(venueId);
  const billing = useQuery({
    queryKey: ["payment-config"],
    queryFn: () => paymentApi<PaymentConfig>("status"),
    staleTime: 60_000,
  });
  const count = Number(access.booking) + Number(access.facility);
  return (
    <div className="space-y-6 font-sans">
      <section className="rounded-2xl border bg-card p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Your current plan
            </p>
            <h2 className="mt-2 font-sans text-2xl font-semibold tracking-tight">
              {privateSample ? "Private sample venue" : access.loading
                ? "Checking your plan…"
                : access.isError
                ? "Plan unavailable"
                : count
                ? "Free venue + " +
                  count +
                  (count === 1 ? " feature" : " features")
                : "Free venue"}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">
              $0
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                /month
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {privateSample ? "All sample features included" : "Community essentials"}
            </p>
          </div>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {privateSample ? "Your own working venue, with court booking and facility operations included. Changes persist here without affecting real venues." : "Your venue’s community stays free. Add only the facility features you need—there is no required bundle and no charge to verify ownership."}
        </p>
        <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          {[
            privateSample ? "Text posts and announcements" : "Posts and photos",
            "Community messaging",
            privateSample ? "Owner-only membership" : "Members and invitations",
            "Community events and RSVPs",
            privateSample ? "Private saved content" : "Shared files",
            "Branding and moderation",
          ].map((label) => (
            <li key={label} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {label}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-5">
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            {privateSample ? "No subscriptions, real charges, or outside members. Explore the venue tools at your own pace." : "Court booking and facility operations are optional upgrades. Canceling a feature does not remove your community."}
          </p>
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <a href="#venue-upgrades">
              {privateSample ? "View included features" : "Explore paid features"}
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </section>

      {!privateSample && <section aria-labelledby="venue-demo-title" className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-primary/30 bg-primary/5 p-5 sm:p-7">
        <div className="min-w-0 max-w-xl">
          <p className="text-xs font-medium text-muted-foreground">Try it before you upgrade</p>
          <h2 id="venue-demo-title" className="mt-2 font-sans text-xl font-semibold tracking-tight">See paid features in action</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Explore a sample venue as a player or manager. Try court reservations and a facility schedule with fictional data—no payment, verification or activation required.</p>
        </div>
        <Button variant="outline" className="min-h-12 w-full shrink-0 rounded-xl border-foreground/20 bg-foreground text-background hover:bg-foreground/90 hover:text-background sm:w-auto" onClick={(event) => openDemo("court_booking", event.currentTarget)}>
          <Play className="mr-2 h-4 w-4" />Explore interactive demo
        </Button>
      </section>}

      {!privateSample && billing.data?.mode === "off" && (
        <p
          role="status"
          className="rounded-xl border bg-muted/30 p-4 text-sm leading-6"
        >
          Paid checkout is not available yet. You can review features and
          complete free ownership verification now. No subscription starts until
          the owner completes checkout once payments are available.
        </p>
      )}
      {!privateSample && billing.data?.mode === "test" && (
        <p
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6"
        >
          Test checkout only. No money moves and no real features are activated.
        </p>
      )}
      {!privateSample && <section
        aria-labelledby="venue-upgrade-steps"
        className="rounded-2xl border bg-card p-5 sm:p-7"
      >
        <h2
          id="venue-upgrade-steps"
          className="font-sans text-lg font-semibold"
        >
          How to upgrade
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          From your venue, open Manage venue → Plan &amp; upgrades.
        </p>
        <ol className="mt-5 grid gap-5 lg:grid-cols-3">
          {[
            [
              "Verify ownership",
              "The registered venue owner submits evidence for a free PULSE review.",
            ],
            [
              "Choose your features",
              "Each feature is $10 USD per month. One is $10/month; both are $20/month.",
            ],
            [
              "Confirm secure checkout",
              "Review renewal terms and pay PULSE through Stripe. Only the purchased feature unlocks after confirmed payment.",
            ],
          ].map(([title, description], index) => (
            <li key={title} className="flex min-w-0 gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {index + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted/40 p-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            {verified ? (
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            ) : (
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {verified
                  ? "Ownership verified"
                  : "Ownership verification needed"}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {canVerify
                  ? verified
                    ? "You can choose upgrades below. Payment availability is shown before checkout."
                    : "Complete this step before purchasing a feature. Your free community is already available."
                  : "Only the current venue owner can verify ownership and purchase upgrades. Managers can review options without being given billing authority."}
              </p>
            </div>
          </div>
          {!verified && canVerify && (
            <Button variant="outline" asChild className="min-h-11 rounded-xl">
              <Link to={"/player/venue-requests?new=1&venue=" + venueId}>
                Verify ownership
              </Link>
            </Button>
          )}
        </div>
      </section>}

      <section
        id="venue-upgrades"
        aria-labelledby="venue-upgrades-title"
        className="scroll-mt-6 space-y-4"
      >
        <div>
          <h2
            id="venue-upgrades-title"
            className="font-sans text-xl font-semibold"
          >
            {privateSample ? "Your included features" : "Choose your paid features"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {privateSample ? "Court booking and facility operations are both included in this private sample. No purchase or ownership verification is required." : "$10 USD per feature, per month. Each subscription renews and can be canceled separately in Profile → Payments & purchases."}
          </p>
        </div>
        {access.isError ? (
          <div role="alert" className="rounded-2xl border p-4">
            Couldn’t load feature access.{" "}
            <Button variant="link" onClick={() => access.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <div className="grid items-stretch gap-4 sm:grid-cols-2">
            {[
              {
                key: "court_booking" as const,
                title: "Court booking",
                icon: LayoutGrid,
                enabled: access.booking,
                description:
                  "Let players find available courts and reserve a time.",
                includes: [
                  "Court inventory and availability",
                  "Player reservations",
                  privateSample ? "Free sample reservations" : "Optional paid rentals with your own prices",
                ],
              },
              {
                key: "facility_tools" as const,
                title: "Facility operations",
                icon: CalendarDays,
                enabled: access.facility,
                description:
                  "Organize your facility and manage the day’s court schedule.",
                includes: [
                  "Facility calendar and court assignments",
                  "Program holds and maintenance blocks",
                  "Staff day-of-play operations",
                ],
              },
            ].map((module) => {
              const grant = access.data?.find(
                (row) => row.module_key === module.key
              );
              return (
                <article
                  key={module.key}
                  className="flex min-w-0 flex-col rounded-2xl border bg-card p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <module.icon className="h-5 w-5 text-primary" />
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                      {access.loading
                        ? "Checking…"
                        : module.enabled
                        ? "Active"
                        : "Optional upgrade"}
                    </span>
                  </div>
                  <h3 className="mt-4 font-sans text-lg font-semibold">
                    {module.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {module.description}
                  </p>
                  <ul className="my-5 space-y-2 text-sm">
                    {module.includes.map((item) => (
                      <li key={item} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto border-t pt-4">
                    {!privateSample && <Button variant="outline" className="mb-4 min-h-11 w-full rounded-xl" onClick={(event) => openDemo(module.key, event.currentTarget)}>
                      <Play className="mr-2 h-4 w-4" />
                      {module.key === "court_booking" ? "View booking demo" : "View operations demo"}
                    </Button>}
                    {module.enabled ? (
                      <>
                        <p className="text-sm font-semibold">
                          {grant?.source === "subscription"
                            ? "$10 USD / month · active subscription"
                            : "Included access · no payment required"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {grant?.source === "subscription"
                            ? "Manage renewals and cancellation in Payments & purchases."
                            : "This venue already has access to this feature. You do not need to purchase it again."}
                        </p>
                        {canVerify && grant?.source === "subscription" && (
                          <Button
                            asChild
                            variant="outline"
                            className="mt-4 min-h-11 w-full rounded-xl"
                          >
                            <Link to="/player/payments">
                              Manage subscription
                            </Link>
                          </Button>
                        )}
                      </>
                    ) : (
                      !access.loading && !privateSample && (
                        <VenueAddonCheckout
                          venueId={venueId}
                          moduleKey={module.key}
                          title={module.title}
                          verified={verified}
                          canPurchase={canVerify}
                        />
                      )
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {!privateSample && <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5">
        <div className="min-w-0 max-w-xl">
          <h2 className="font-sans text-lg font-semibold">
            Collect payments from players
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Feature subscriptions pay PULSE. Court rental payments go to your
            venue’s connected Stripe account. To charge players, activate Court
            booking, connect your venue account, and set your prices and refund
            policy.
          </p>
        </div>
        {canVerify && (
          <Button asChild variant="outline" className="min-h-11 rounded-xl">
            <Link to={"/player/payments?venue=" + venueId}>
              Set up venue payments
            </Link>
          </Button>
        )}
      </section>}
      {demo && (
        <ErrorBoundary fallback={<div role="alert" className="rounded-xl border bg-card p-4 text-sm">The demo couldn’t load. Your venue is unchanged. Refresh this page to try again.<Button variant="link" onClick={() => { setDemo(null); demoOpener.current?.focus(); }}>Dismiss</Button></div>}>
          <Suspense fallback={<p role="status" className="rounded-xl border bg-card p-4 text-sm">Loading interactive demo…</p>}>
            <VenuePremiumDemo initialFeature={demo} onClose={() => setDemo(null)} onReturnFocus={() => demoOpener.current?.focus()} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}
