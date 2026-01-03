import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, UserCheck, AlertTriangle, Scale, Ban, Gavel } from "lucide-react";

export const TermsOfService = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Terms of Service</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last updated: January 3, 2026</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Welcome to PULSE! These Terms of Service ("Terms") govern your use of the PULSE pickleball rating and community platform. By creating an account or using PULSE, you agree to these Terms.
          </p>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="eligibility">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span>Account Eligibility & Responsibilities</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Eligibility</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>You must be at least 13 years old to use PULSE</li>
                    <li>Users under 18 require parental or guardian consent</li>
                    <li>You must provide accurate and complete registration information</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Account Security</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>You are responsible for maintaining the security of your account</li>
                    <li>Do not share your login credentials with others</li>
                    <li>Notify us immediately if you suspect unauthorized access</li>
                    <li>You are responsible for all activity under your account</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Accurate Information</h4>
                  <p>You agree to report match results accurately and honestly. Intentionally misreporting scores or match outcomes may result in account suspension or termination.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="conduct">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <span>Community Guidelines</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE is built on sportsmanship and community. When using PULSE, you agree to:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li><strong>Be Respectful:</strong> Treat all players with respect, both on and off the court</li>
                  <li><strong>Play Fair:</strong> Report accurate match results and don't manipulate ratings</li>
                  <li><strong>Be Honest:</strong> Don't create fake accounts or impersonate others</li>
                  <li><strong>Communicate Appropriately:</strong> Keep messages and posts respectful and relevant</li>
                  <li><strong>Respect Privacy:</strong> Don't share other players' personal information without consent</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="prohibited">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-primary" />
                  <span>Prohibited Activities</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>The following activities are strictly prohibited:</p>
                <ul className="list-disc list-inside space-y-2">
                  <li>Rating manipulation through fake matches or collusion</li>
                  <li>Creating multiple accounts to circumvent suspensions or manipulate rankings</li>
                  <li>Harassment, bullying, or threatening behavior toward other users</li>
                  <li>Posting spam, malware, or malicious content</li>
                  <li>Attempting to access other users' accounts or data</li>
                  <li>Using PULSE for any illegal purpose</li>
                  <li>Scraping or automated data collection without authorization</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ip">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Intellectual Property</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Our Content</h4>
                  <p>PULSE, including its logo, design, rating algorithms, and software, is owned by us and protected by intellectual property laws. You may not copy, modify, or distribute our content without permission.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Your Content</h4>
                  <p>You retain ownership of content you post (photos, comments, etc.). By posting content, you grant PULSE a license to display and use that content within the platform to provide our services.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="disclaimers">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <span>Disclaimers & Limitations</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Service Availability</h4>
                  <p>PULSE is provided "as is" without warranties. We strive for high availability but cannot guarantee uninterrupted service. We may modify or discontinue features at any time.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Physical Activity</h4>
                  <p>PULSE facilitates connections between players but is not responsible for injuries, accidents, or incidents that occur during pickleball activities. Play at your own risk and within your physical capabilities.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Limitation of Liability</h4>
                  <p>To the maximum extent permitted by law, PULSE shall not be liable for indirect, incidental, or consequential damages arising from your use of the platform.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="termination">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-primary" />
                  <span>Termination & Disputes</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">Account Termination</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>You may delete your account at any time through your profile settings</li>
                    <li>We may suspend or terminate accounts that violate these Terms</li>
                    <li>Upon termination, your right to use PULSE ceases immediately</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Dispute Resolution</h4>
                  <p>Any disputes arising from these Terms shall first be addressed through good-faith negotiation. If unresolved, disputes shall be settled through binding arbitration in accordance with applicable laws.</p>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">Changes to Terms</h4>
                  <p>We may update these Terms from time to time. Continued use of PULSE after changes constitutes acceptance of the new Terms. We will notify users of significant changes.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
