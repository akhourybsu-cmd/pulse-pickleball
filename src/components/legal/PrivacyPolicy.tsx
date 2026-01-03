import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Database, Users, Globe, Lock, Mail } from "lucide-react";

export const PrivacyPolicy = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Privacy Policy</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last updated: January 3, 2026</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            PULSE ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our pickleball player rating and community platform.
          </p>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="collection">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-primary" />
                  <span>Information We Collect</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Account Information</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Name, email address, and optional phone number</li>
                    <li>Profile photo and display preferences</li>
                    <li>Date of birth (for age verification)</li>
                    <li>Location (city, state) for finding nearby players and courts</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Gameplay Data</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Match results, scores, and statistics</li>
                    <li>PULSE rating and rating history</li>
                    <li>Opponent information and match locations</li>
                    <li>Badge achievements and milestones</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Player Preferences</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Skill level and play style preferences</li>
                    <li>Paddle brand and model</li>
                    <li>Handedness and preferred court side</li>
                    <li>Partner preferences and availability</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Technical Data</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Device type, browser, and operating system</li>
                    <li>IP address and general location</li>
                    <li>App usage patterns and feature interactions</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="usage">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>How We Use Your Information</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Provide Services:</strong> Calculate ratings, track matches, and display your player profile</li>
                  <li><strong>Connect Players:</strong> Help you find matches, partners, and local courts</li>
                  <li><strong>Community Features:</strong> Enable group participation, event RSVPs, and messaging</li>
                  <li><strong>Notifications:</strong> Send match confirmations, rating updates, and activity alerts</li>
                  <li><strong>Improve PULSE:</strong> Analyze usage patterns to enhance features and fix issues</li>
                  <li><strong>Safety:</strong> Detect and prevent fraud, abuse, or terms violations</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sharing">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>Information Sharing</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Public Information</h4>
                  <p>Your display name, PULSE rating, and match history are visible to other players. You control whether your location is publicly displayed.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Third-Party Services</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Supabase:</strong> Database hosting and authentication</li>
                    <li><strong>Cloud Infrastructure:</strong> Secure data storage and processing</li>
                    <li><strong>Analytics:</strong> Anonymous usage statistics to improve the platform</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">We Never Sell Your Data</h4>
                  <p>PULSE does not sell, rent, or trade your personal information to third parties for marketing purposes.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="retention">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <span>Data Retention & Security</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Retention</h4>
                  <p>We retain your data for as long as your account is active. Match history and ratings are preserved to maintain accurate player statistics. You can request deletion of your account and associated data at any time.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Security Measures</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Encryption in transit (TLS/SSL) and at rest</li>
                    <li>Row-Level Security (RLS) policies for data access control</li>
                    <li>Regular security audits and updates</li>
                    <li>Secure authentication with optional biometric login</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rights">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Your Rights</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>You have the right to:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                  <li><strong>Export:</strong> Download your data in a portable format</li>
                  <li><strong>Opt-out:</strong> Disable marketing communications and notifications</li>
                </ul>
                <p className="mt-4">To exercise these rights, visit your Profile Settings or contact us directly.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="contact">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>Contact Us</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                <p>For privacy-related questions or requests, please contact your PULSE administrator or reach out through the in-app support system.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
