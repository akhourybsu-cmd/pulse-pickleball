import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Cookie, Settings, BarChart3, Shield } from "lucide-react";

export const CookiePolicy = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cookie className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Cookie Policy</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last updated: January 3, 2026</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            This Cookie Policy explains how PULSE uses cookies and similar technologies to recognize you when you visit our platform. It explains what these technologies are, why we use them, and your rights to control their use.
          </p>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="what">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Cookie className="h-4 w-4 text-primary" />
                  <span>What Are Cookies?</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>Cookies are small text files that are stored on your device when you visit a website or use an app. They help the platform remember your preferences and improve your experience.</p>
                <p>PULSE also uses similar technologies like local storage and session storage to provide functionality and remember your settings.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="essential">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Essential Cookies</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>These cookies are strictly necessary for PULSE to function. They cannot be disabled.</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Authentication</p>
                      <p className="text-sm">Keeps you logged in and secures your session</p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Required</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Security Tokens</p>
                      <p className="text-sm">Protects against cross-site request forgery</p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Required</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Theme Preference</p>
                      <p className="text-sm">Remembers your light/dark mode setting</p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Required</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="functional">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <span>Functional Cookies</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>These cookies enable enhanced functionality and personalization.</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Tutorial Progress</p>
                      <p className="text-sm">Tracks which onboarding steps you've completed</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Dashboard Preferences</p>
                      <p className="text-sm">Remembers your preferred view and layout</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Recent Courts</p>
                      <p className="text-sm">Quick access to courts you've recently viewed</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="analytics">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span>Analytics Cookies</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>These cookies help us understand how users interact with PULSE so we can improve the experience.</p>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Usage Analytics</p>
                      <p className="text-sm">Anonymous data about feature usage and navigation</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-foreground">Error Tracking</p>
                      <p className="text-sm">Helps us identify and fix bugs faster</p>
                    </div>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">Optional</span>
                  </div>
                </div>
                <p className="text-sm">Note: We do not use third-party advertising cookies. Analytics data is anonymized and never sold.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="manage">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <span>Managing Your Preferences</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>You can control cookies through:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Browser Settings:</strong> Most browsers allow you to block or delete cookies</li>
                  <li><strong>Device Settings:</strong> Mobile devices have privacy controls for app data</li>
                  <li><strong>PULSE Settings:</strong> Toggle optional features in your profile settings</li>
                </ul>
                <p className="mt-4 text-sm">Note: Disabling essential cookies will prevent PULSE from functioning properly. You may not be able to log in or access your account.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
