import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  UserCheck, 
  AlertTriangle, 
  Scale, 
  Ban, 
  Gavel, 
  Users, 
  MessageSquare,
  Shield,
  Building2,
  RefreshCw,
  Globe,
  Mail,
  BarChart3
} from "lucide-react";

export const TermsOfService = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Terms of Service</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Last updated: January 3, 2026</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              App Store Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            Welcome to PULSE. These Terms of Service ("Terms") govern your access to and use of the PULSE platform, including our mobile applications, websites, features, and services (collectively, the "Service").
          </p>
          <p className="text-muted-foreground mb-6">
            By creating an account or using PULSE, you agree to these Terms. If you do not agree, please do not use the Service.
          </p>

          <Accordion type="single" collapsible className="w-full">
            {/* 1. Eligibility */}
            <AccordionItem value="eligibility">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary" />
                  <span>1. Eligibility</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>
                  You must be at least 13 years old to use PULSE. If you are under 18, you must have permission from a parent or legal guardian.
                </p>
                <p>
                  By using PULSE, you confirm that you meet these requirements.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 2. Account Responsibilities */}
            <AccordionItem value="account">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>2. Account Responsibilities</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">You are responsible for:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Maintaining the confidentiality of your account</li>
                    <li>All activity that occurs under your account</li>
                    <li>Providing accurate and up-to-date information</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-foreground mb-2">You may not:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Impersonate another person</li>
                    <li>Create accounts for others without permission</li>
                    <li>Use PULSE for fraudulent or misleading purposes</li>
                  </ul>
                </div>
                <p className="text-sm italic">
                  We reserve the right to suspend or terminate accounts that violate these Terms.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 3. Match Results, Ratings, and Statistics */}
            <AccordionItem value="ratings">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span>3. Match Results, Ratings & Statistics</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE allows users to record matches, scores, and gameplay data.</p>
                <div>
                  <h4 className="font-medium text-foreground mb-2">You acknowledge and agree that:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ratings and statistics are estimates, not guarantees of skill</li>
                    <li>Match results are entered by users and may contain errors</li>
                    <li>PULSE is not responsible for disputes arising from incorrect or disputed match data</li>
                    <li>Ratings, rankings, and analytics are provided for informational and recreational purposes only</li>
                  </ul>
                </div>
                <p className="text-sm italic">
                  PULSE may adjust rating algorithms, formulas, or display methods at any time.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 4. Community, Groups, and User Conduct */}
            <AccordionItem value="community">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span>4. Community, Groups & User Conduct</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE includes community features such as groups, posts, chats, and comments.</p>
                <div>
                  <h4 className="font-medium text-foreground mb-2">By participating, you agree to:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Be respectful and courteous</li>
                    <li>Avoid harassment, hate speech, threats, or abusive behavior</li>
                    <li>Avoid spam, scams, or unauthorized promotions</li>
                    <li>Follow applicable laws and local regulations</li>
                  </ul>
                </div>
                <p>
                  Group owners and moderators may establish additional rules for their groups.
                </p>
                <div>
                  <h4 className="font-medium text-foreground mb-2">PULSE reserves the right to:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Remove content</li>
                    <li>Suspend or remove users</li>
                    <li>Remove or disable groups that violate these Terms or create a negative experience for others</li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* 5. User-Generated Content */}
            <AccordionItem value="content">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>5. User-Generated Content</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>
                  You retain ownership of content you post on PULSE (including text, images, and messages).
                </p>
                <div>
                  <h4 className="font-medium text-foreground mb-2">By posting content, you grant PULSE a non-exclusive, worldwide, royalty-free license to:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Host, store, display, and distribute your content</li>
                    <li>Use it as necessary to operate and improve the Service</li>
                  </ul>
                </div>
                <p>
                  You represent that you have the rights to any content you post and that it does not infringe on others' rights.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 6. Venues, Events, and Third Parties */}
            <AccordionItem value="venues">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>6. Venues, Events & Third Parties</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE may display or facilitate information about venues, events, leagues, or third-party services.</p>
                <div>
                  <h4 className="font-medium text-foreground mb-2">You understand that:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>PULSE does not operate or control third-party venues or events unless explicitly stated</li>
                    <li>Participation in events or use of venues is at your own risk</li>
                    <li>PULSE is not responsible for injuries, cancellations, disputes, or losses related to third-party activities</li>
                  </ul>
                </div>
                <p className="text-sm italic">
                  "Official" or "Verified" labels do not imply endorsement unless explicitly stated.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 7. Prohibited Uses */}
            <AccordionItem value="prohibited">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-primary" />
                  <span>7. Prohibited Uses</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>You may not use PULSE to:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Violate laws or regulations</li>
                  <li>Harass, threaten, or abuse others</li>
                  <li>Upload malicious code or attempt to disrupt the Service</li>
                  <li>Collect data about other users without permission</li>
                  <li>Misrepresent scores, results, or identities</li>
                </ul>
                <p className="text-sm italic">
                  Violation of these rules may result in suspension or termination.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 8. Suspension and Termination */}
            <AccordionItem value="suspension">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Gavel className="h-4 w-4 text-primary" />
                  <span>8. Suspension & Termination</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div>
                  <h4 className="font-medium text-foreground mb-2">We may suspend or terminate your access to PULSE at any time, with or without notice, if:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>You violate these Terms</li>
                    <li>Your behavior harms other users or the platform</li>
                    <li>Required by law or safety concerns</li>
                  </ul>
                </div>
                <p>
                  You may stop using PULSE at any time by closing your account.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 9. Disclaimer of Warranties */}
            <AccordionItem value="disclaimer">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <span>9. Disclaimer of Warranties</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE is provided "as is" and "as available."</p>
                <div>
                  <h4 className="font-medium text-foreground mb-2">We make no warranties regarding:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Accuracy of ratings or match data</li>
                    <li>Availability or reliability of the Service</li>
                    <li>Fitness for a particular purpose</li>
                  </ul>
                </div>
                <p className="text-sm italic">
                  Use of the Service is at your own risk.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 10. Limitation of Liability */}
            <AccordionItem value="liability">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Scale className="h-4 w-4 text-primary" />
                  <span>10. Limitation of Liability</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>To the maximum extent permitted by law:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>PULSE shall not be liable for indirect, incidental, or consequential damages</li>
                  <li>PULSE is not liable for disputes between users</li>
                  <li>PULSE is not liable for injuries, losses, or damages related to gameplay, venues, or events</li>
                </ul>
                <p>
                  Our total liability will not exceed the amount you paid to PULSE in the past 12 months, if any.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 11. Indemnification */}
            <AccordionItem value="indemnification">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>11. Indemnification</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>You agree to indemnify and hold harmless PULSE from any claims, damages, or expenses arising from:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your use of the Service</li>
                  <li>Your content</li>
                  <li>Your violation of these Terms</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 12. Changes to These Terms */}
            <AccordionItem value="changes">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  <span>12. Changes to These Terms</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>We may update these Terms from time to time. When we do:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>We will update the "Last updated" date</li>
                  <li>Continued use of PULSE constitutes acceptance of the revised Terms</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            {/* 13. Governing Law */}
            <AccordionItem value="governing">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>13. Governing Law</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>
                  These Terms are governed by the laws of the United States and the applicable state or jurisdiction where PULSE operates, without regard to conflict of law principles.
                </p>
              </AccordionContent>
            </AccordionItem>

            {/* 14. Contact */}
            <AccordionItem value="contact">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <span>14. Contact</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>
                  If you have questions about these Terms, please contact us through the in-app support system or submit a request through your profile settings. We will respond within a reasonable timeframe.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Compliance Footer */}
          <div className="mt-8 pt-6 border-t">
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge variant="secondary" className="text-xs">COPPA Compliant</Badge>
              <Badge variant="secondary" className="text-xs">App Store Ready</Badge>
              <Badge variant="secondary" className="text-xs">Play Store Ready</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
