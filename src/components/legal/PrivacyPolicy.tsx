import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Database, Users, Globe, Lock, Mail, Cookie, Clock, ShieldCheck, Baby, Plane, FileText, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const PrivacyPolicy = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle>Privacy Policy</CardTitle>
                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                  App Store Compliant
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Last updated: January 3, 2026</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            PULSE ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, store, and safeguard your information when you use the PULSE pickleball player rating, events, and community platform (the "Service").
          </p>
          <p className="text-muted-foreground mb-6 font-medium">
            By using PULSE, you agree to the collection and use of information in accordance with this Privacy Policy.
          </p>

          <Accordion type="single" collapsible className="w-full">
            {/* Section 1: Information We Collect */}
            <AccordionItem value="collection">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <span>1. Information We Collect</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Account Information</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Name and email address</li>
                    <li>Optional phone number</li>
                    <li>Profile photo and display preferences</li>
                    <li>Date of birth (used solely for age verification)</li>
                    <li>Location (city and state) for discovering nearby players, venues, and courts</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Gameplay & Activity Data</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Match results, scores, and statistics</li>
                    <li>PULSE rating and rating history</li>
                    <li>Opponent information and match metadata</li>
                    <li>Match dates and general locations</li>
                    <li>Badges, achievements, milestones, and participation history</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Player Preferences</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Skill level and play style preferences</li>
                    <li>Paddle brand and model (optional)</li>
                    <li>Handedness and preferred court side</li>
                    <li>Partner preferences, availability, and event participation</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Community & Communication Data</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Group memberships</li>
                    <li>Event RSVPs and attendance</li>
                    <li>In-app messages, posts, and reactions</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Technical & Usage Data</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Device type, operating system, and browser</li>
                    <li>IP address and approximate location</li>
                    <li>App interactions, feature usage, and diagnostics</li>
                    <li>Cookies and local storage used for session management</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 2: How We Use Your Information */}
            <AccordionItem value="usage">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>2. How We Use Your Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>We use your information to:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Provide Core Services:</strong> Calculate player ratings, track matches, display profiles, and maintain match history</li>
                  <li><strong>Connect Players:</strong> Enable matchmaking, partner discovery, court discovery, and local play opportunities</li>
                  <li><strong>Community Features:</strong> Support groups, events, messaging, and social engagement</li>
                  <li><strong>Notifications & Communications:</strong> Send match confirmations, rating updates, reminders, and service-related alerts</li>
                  <li><strong>Improve the Platform:</strong> Analyze usage patterns, enhance features, and troubleshoot technical issues</li>
                  <li><strong>Safety & Integrity:</strong> Prevent fraud, abuse, cheating, impersonation, and violations of platform rules</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* Section 3: Public vs. Private Information */}
            <AccordionItem value="public-private">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>3. Public vs. Private Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Public Information</h4>
                  <p className="mb-2">The following information may be visible to other users:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Display name</li>
                    <li>PULSE rating and rating tier</li>
                    <li>Match history and statistics</li>
                    <li>Badges and achievements</li>
                  </ul>
                  <p className="mt-3">You control whether your location, profile photo, and additional details are publicly visible through your privacy settings.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Private Information</h4>
                  <p>Sensitive personal information (such as email address, phone number, date of birth, and IP address) is never publicly displayed.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 4: Information Sharing & Third Parties */}
            <AccordionItem value="sharing">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>4. Information Sharing & Third Parties</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Service Providers</h4>
                  <p className="mb-2">We use trusted third-party services that act solely as data processors, including:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Supabase:</strong> Authentication, database hosting, and row-level security</li>
                    <li><strong>Cloud Infrastructure Providers:</strong> Secure data storage and processing</li>
                    <li><strong>Analytics Providers:</strong> Anonymous and aggregated usage insights</li>
                  </ul>
                  <p className="mt-3">These providers are contractually required to safeguard your data and may only access it as necessary to perform their services.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">No Sale of Personal Data</h4>
                  <p>PULSE does not sell, rent, trade, or share your personal information for advertising or marketing purposes.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Legal Requirements</h4>
                  <p>We may disclose information if required by law, court order, or to protect the rights, safety, and integrity of PULSE and its users.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Section 5: Cookies & Tracking */}
            <AccordionItem value="cookies">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Cookie className="h-4 w-4 text-primary" />
                  <span>5. Cookies & Tracking Technologies</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE uses cookies, local storage, and similar technologies to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Maintain login sessions</li>
                  <li>Remember user preferences</li>
                  <li>Analyze app performance and usage</li>
                </ul>
                <p className="mt-3">These technologies do not collect personal information unless you voluntarily provide it.</p>
                <p>You may control cookies through your device or browser settings.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 6: Data Retention */}
            <AccordionItem value="retention">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>6. Data Retention</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <ul className="list-disc list-inside space-y-2">
                  <li>We retain your information for as long as your account remains active</li>
                  <li>Match history and ratings are preserved to maintain statistical integrity</li>
                  <li>You may request deletion of your account and associated data at any time</li>
                </ul>
                <p className="mt-3">Certain data may be retained when legally required or for legitimate business purposes such as fraud prevention and dispute resolution.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 7: Data Security */}
            <AccordionItem value="security">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <span>7. Data Security</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>We implement industry-standard security measures, including:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Encryption in transit (TLS/SSL) and at rest</li>
                  <li>Row-Level Security (RLS) access controls</li>
                  <li>Secure authentication and authorization systems</li>
                  <li>Regular security reviews and updates</li>
                  <li>Optional biometric login where supported</li>
                </ul>
                <p className="mt-3">While no system is completely secure, we continuously work to protect your information.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 8: Your Privacy Rights */}
            <AccordionItem value="rights">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>8. Your Privacy Rights</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Access</strong> your personal data</li>
                  <li><strong>Correct</strong> inaccurate or incomplete information</li>
                  <li><strong>Delete</strong> your account and associated data</li>
                  <li><strong>Export</strong> your data in a portable format</li>
                  <li><strong>Opt Out</strong> of non-essential communications</li>
                </ul>
                <p className="mt-4">Requests can be made through Profile Settings or in-app support.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 9: Regional Privacy Rights */}
            <AccordionItem value="regional">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>9. Regional Privacy Rights</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">California (CCPA)</h4>
                  <p className="mb-2">California residents have the right to:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Know what personal data is collected</li>
                    <li>Request deletion of personal data</li>
                    <li>Confirm that their data is not sold</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">European Union (GDPR)</h4>
                  <p className="mb-2">EU residents may have additional rights, including:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Restricting or objecting to data processing</li>
                    <li>Requesting data portability</li>
                    <li>Withdrawing consent where applicable</li>
                  </ul>
                </div>
                <p className="mt-3 font-medium">We honor all applicable regional privacy laws.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 10: Children's Privacy */}
            <AccordionItem value="children">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Baby className="h-4 w-4 text-primary" />
                  <span>10. Children's Privacy</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p className="font-medium">PULSE is not intended for children under the age of 13.</p>
                <p>We do not knowingly collect personal information from children under 13. If such data is discovered, it will be deleted promptly.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 11: International Data Transfers */}
            <AccordionItem value="international">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Plane className="h-4 w-4 text-primary" />
                  <span>11. International Data Transfers</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE is operated in the United States. If you access the Service from outside the U.S., your information may be transferred to and processed in the United States, where data protection laws may differ.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 12: Changes to This Policy */}
            <AccordionItem value="changes">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>12. Changes to This Privacy Policy</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>We may update this Privacy Policy periodically. When changes occur, the "Last updated" date will be revised, and users will be notified through the app when required.</p>
                <p>Continued use of PULSE constitutes acceptance of the updated policy.</p>
              </AccordionContent>
            </AccordionItem>

            {/* Section 13: Contact Us */}
            <AccordionItem value="contact">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>13. Contact Us</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>For privacy-related questions, data requests, or concerns, please contact your PULSE administrator or submit a request through the in-app support system. We will respond within a reasonable timeframe.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Compliance Badge Footer */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">Compliance:</span>
              <Badge variant="outline" className="text-xs">COPPA</Badge>
              <Badge variant="outline" className="text-xs">CCPA</Badge>
              <Badge variant="outline" className="text-xs">GDPR</Badge>
              <Badge variant="outline" className="text-xs">App Store</Badge>
              <Badge variant="outline" className="text-xs">Play Store</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
