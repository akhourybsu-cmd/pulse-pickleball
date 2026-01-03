import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  History,
  Shield,
  FileText,
  Cookie,
  Server
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { APP_VERSION } from "@/config/version";
import { changelog } from "@/data/changelogData";
import { PrivacyPolicy } from "@/components/legal/PrivacyPolicy";
import { TermsOfService } from "@/components/legal/TermsOfService";
import { CookiePolicy } from "@/components/legal/CookiePolicy";
import { DataProcessingDisclosure } from "@/components/legal/DataProcessingDisclosure";
import { motion, AnimatePresence } from "framer-motion";

export default function Changelog() {
  const navigate = useNavigate();
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set([changelog[0]?.version]));
  const [legalSection, setLegalSection] = useState<string>("privacy");

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

  const getTypeBadge = (type: "major" | "feature" | "patch") => {
    const styles = {
      major: "bg-primary text-primary-foreground",
      feature: "bg-blue-500/10 text-blue-500 dark:bg-blue-400/10 dark:text-blue-400",
      patch: "bg-muted text-muted-foreground"
    };
    const labels = {
      major: "Major Release",
      feature: "Feature Update",
      patch: "Patch"
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[type]}`}>
        {labels[type]}
      </span>
    );
  };

  const legalNavItems = [
    { id: "privacy", label: "Privacy Policy", icon: Shield },
    { id: "terms", label: "Terms of Service", icon: FileText },
    { id: "cookies", label: "Cookie Policy", icon: Cookie },
    { id: "data", label: "Data Processing", icon: Server },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-secondary/30 sticky top-0 z-10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl font-bold mb-3">PULSE Updates & Policies</h1>
              <p className="text-muted-foreground text-lg">
                Transparency is at the heart of everything we build
              </p>
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className="text-sm text-muted-foreground">Current version:</span>
                <span className="text-sm font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full">
                  v{APP_VERSION}
                </span>
              </div>
            </motion.div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="changelog" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8">
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
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-muted-foreground mr-2">Jump to:</span>
                {changelog.slice(0, 5).map((entry) => (
                  <button
                    key={entry.version}
                    onClick={() => {
                      setExpandedVersions(prev => new Set(prev).add(entry.version));
                      document.getElementById(`version-${entry.version}`)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/80 transition-colors"
                  >
                    v{entry.version}
                  </button>
                ))}
              </div>

              {/* Version Cards */}
              <div className="space-y-4">
                {changelog.map((entry, index) => {
                  const isExpanded = expandedVersions.has(entry.version);
                  const isLatest = index === 0;

                  return (
                    <motion.div
                      key={entry.version}
                      id={`version-${entry.version}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <Card 
                        className={`transition-all duration-300 ${
                          isLatest 
                            ? "border-primary shadow-[0_0_20px_-5px_hsl(var(--primary)/0.3)]" 
                            : "hover:border-border/80"
                        }`}
                      >
                        <CardHeader 
                          className="cursor-pointer select-none"
                          onClick={() => toggleVersion(entry.version)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap mb-2">
                                <CardTitle className="text-xl">
                                  v{entry.version}
                                </CardTitle>
                                {isLatest && (
                                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Latest
                                  </span>
                                )}
                                {getTypeBadge(entry.type)}
                              </div>
                              {entry.title && (
                                <p className="text-sm font-medium text-foreground/80">
                                  {entry.title}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground mt-1">
                                {entry.date}
                              </p>
                            </div>
                            <Button variant="ghost" size="icon" className="shrink-0">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </CardHeader>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <CardContent className="pt-0 pb-6">
                                <div className="space-y-6">
                                  {entry.categories.map((category, catIndex) => {
                                    const Icon = category.icon;
                                    return (
                                      <div key={catIndex}>
                                        <div className="flex items-center gap-2 mb-3">
                                          <div className="p-1.5 rounded-md bg-primary/10">
                                            <Icon className="h-4 w-4 text-primary" />
                                          </div>
                                          <h4 className="font-semibold text-sm">
                                            {category.name}
                                          </h4>
                                        </div>
                                        <ul className="space-y-2 ml-8">
                                          {category.changes.map((change, changeIndex) => (
                                            <li 
                                              key={changeIndex} 
                                              className="flex items-start gap-2 text-sm text-muted-foreground"
                                            >
                                              <span className="text-primary mt-1.5 text-xs">●</span>
                                              <span>{change}</span>
                                            </li>
                                          ))}
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

              {/* Feedback CTA */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="py-6 text-center">
                  <p className="text-muted-foreground">
                    Have suggestions or found a bug? Contact your administrator for support.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Legal Tab */}
            <TabsContent value="legal" className="space-y-6">
              {/* Legal Navigation */}
              <div className="flex flex-wrap gap-2 mb-6">
                {legalNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setLegalSection(item.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        legalSection === item.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {/* Legal Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={legalSection}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {legalSection === "privacy" && <PrivacyPolicy />}
                  {legalSection === "terms" && <TermsOfService />}
                  {legalSection === "cookies" && <CookiePolicy />}
                  {legalSection === "data" && <DataProcessingDisclosure />}
                </motion.div>
              </AnimatePresence>

              {/* Legal Footer */}
              <Card className="bg-muted/50">
                <CardContent className="py-6">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      These policies are effective as of January 3, 2026. We may update them periodically and will notify you of significant changes.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      For questions about our policies, please contact your PULSE administrator.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Footer />
    </div>
  );
}
