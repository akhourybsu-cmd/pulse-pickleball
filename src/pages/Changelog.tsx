import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  ChevronDown,
  History,
  Shield,
  FileText,
  Cookie,
  Server,
  Rocket,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Footer } from "@/components/Footer";
import { APP_VERSION, LAST_UPDATED } from "@/config/version";
import { changelog } from "@/data/changelogData";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";
import { TermsOfService } from "@/components/legal/TermsOfService";
import { CookiePolicy } from "@/components/legal/CookiePolicy";
import { DataProcessingDisclosure } from "@/components/legal/DataProcessingDisclosure";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const typeMeta: Record<
  "major" | "feature" | "patch",
  { label: string; className: string }
> = {
  major: {
    label: "Major Release",
    className: "bg-primary/15 text-primary border border-primary/30",
  },
  feature: {
    label: "Feature Update",
    className:
      "bg-foreground/[0.06] text-foreground border border-border/60",
  },
  patch: {
    label: "Patch",
    className: "bg-muted text-muted-foreground border border-border/40",
  },
};

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Changelog() {
  const [searchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set([changelog[0]?.version]),
  );

  const tabParam = searchParams.get("tab");
  const sectionParam = searchParams.get("section");
  const [legalSection, setLegalSection] = useState<string>(
    sectionParam || "privacy",
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  const legalNavItems = [
    { id: "privacy", label: "Privacy Policy", icon: Shield },
    { id: "terms", label: "Terms of Service", icon: FileText },
    { id: "cookies", label: "Cookie Policy", icon: Cookie },
    { id: "data", label: "Data Processing", icon: Server },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <PageHeader userId={userId} />

      {/* Hero */}
      <section className="relative border-b border-border/40 bg-gradient-to-b from-primary/[0.08] via-background to-background">
        <div className="container mx-auto px-4 pt-10 pb-8 md:pt-14 md:pb-10 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-start gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/20">
                <Rocket className="h-5 w-5" strokeWidth={2} />
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                <Sparkles className="h-3 w-3" />
                v{APP_VERSION} · Live
              </span>
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
                What's new in PULSE
              </h1>
              <div className="h-[3px] w-12 mt-2 bg-primary rounded-full" />
              <p className="text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                A clear, honest record of every meaningful update — new
                features, fixes, and the policies that govern your data. Last
                updated {formatDate(LAST_UPDATED)}.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <Tabs
          defaultValue={tabParam === "legal" ? "legal" : "changelog"}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 mb-8 h-11">
            <TabsTrigger value="changelog" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Changelog
            </TabsTrigger>
            <TabsTrigger value="legal" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Privacy & Legal
            </TabsTrigger>
          </TabsList>

          {/* Changelog Tab */}
          <TabsContent value="changelog" className="space-y-6">
            {/* Quick Jump */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">
                Jump to
              </span>
              {changelog.slice(0, 6).map((entry) => (
                <button
                  key={entry.version}
                  onClick={() => {
                    setExpandedVersions((prev) =>
                      new Set(prev).add(entry.version),
                    );
                    document
                      .getElementById(`version-${entry.version}`)
                      ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="text-xs font-medium px-2.5 py-1 rounded-full border border-border/60 bg-card hover:bg-muted hover:border-border transition-colors"
                >
                  v{entry.version}
                </button>
              ))}
            </div>

            {/* Timeline */}
            <div className="relative">
              <div
                className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-border to-transparent"
                aria-hidden
              />
              <div className="space-y-4">
                {changelog.map((entry, index) => {
                  const isExpanded = expandedVersions.has(entry.version);
                  const isLatest = index === 0;
                  const meta = typeMeta[entry.type];

                  return (
                    <motion.div
                      key={entry.version}
                      id={`version-${entry.version}`}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.04 }}
                      className="relative pl-10"
                    >
                      {/* Timeline node */}
                      <div
                        className={cn(
                          "absolute left-0 top-5 h-[14px] w-[14px] rounded-full ring-4 ring-background",
                          isLatest
                            ? "bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]"
                            : "bg-border",
                        )}
                        aria-hidden
                      />
                      <Card
                        className={cn(
                          "overflow-hidden transition-all duration-300 border-border/60",
                          isLatest &&
                            "border-primary/40 shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.35)]",
                        )}
                      >
                        <button
                          onClick={() => toggleVersion(entry.version)}
                          className="w-full text-left p-5 md:p-6 hover:bg-muted/40 transition-colors"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="text-lg font-bold tracking-tight">
                                  v{entry.version}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full",
                                    meta.className,
                                  )}
                                >
                                  {meta.label}
                                </span>
                                {isLatest && (
                                  <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Latest
                                  </span>
                                )}
                              </div>
                              {entry.title && (
                                <h3 className="text-base md:text-lg font-semibold text-foreground leading-snug">
                                  {entry.title}
                                </h3>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDate(entry.date)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              tabIndex={-1}
                              className="shrink-0 -mr-2"
                            >
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 transition-transform duration-300",
                                  isExpanded && "rotate-180",
                                )}
                              />
                            </Button>
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.25, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <CardContent className="pt-0 px-5 md:px-6 pb-6">
                                <div className="border-t border-border/60 pt-5 space-y-6">
                                  {entry.categories.map((category, catIndex) => {
                                    const Icon = category.icon;
                                    return (
                                      <div key={catIndex}>
                                        <div className="flex items-center gap-2.5 mb-3">
                                          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                                            <Icon
                                              className="h-3.5 w-3.5"
                                              strokeWidth={2.25}
                                            />
                                          </div>
                                          <h4 className="font-semibold text-sm text-foreground">
                                            {category.name}
                                          </h4>
                                        </div>
                                        <ul className="space-y-2 pl-9">
                                          {category.changes.map(
                                            (change, changeIndex) => (
                                              <li
                                                key={changeIndex}
                                                className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed"
                                              >
                                                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0" />
                                                <span>{change}</span>
                                              </li>
                                            ),
                                          )}
                                        </ul>
                                      </div>
                                    );
                                  })}
                                </div>
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Feedback CTA */}
            <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02]">
              <CardContent className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Have suggestions or found a bug? Reach out to your PULSE
                  administrator — we read every note.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Legal Tab */}
          <TabsContent value="legal" className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {legalNavItems.map((item) => {
                const Icon = item.icon;
                const active = legalSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setLegalSection(item.id)}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium transition-all border",
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card text-foreground border-border/60 hover:bg-muted hover:border-border",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={legalSection}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {legalSection === "privacy" && <PrivacyPolicy />}
                {legalSection === "terms" && <TermsOfService />}
                {legalSection === "cookies" && <CookiePolicy />}
                {legalSection === "data" && <DataProcessingDisclosure />}
              </motion.div>
            </AnimatePresence>

            <Card className="bg-muted/40 border-border/60">
              <CardContent className="py-6 text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  These policies are effective as of {formatDate(LAST_UPDATED)}.
                  We update them as the product evolves and will notify you of
                  significant changes.
                </p>
                <p className="text-xs text-muted-foreground">
                  Questions? Contact your PULSE administrator.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  );
}
