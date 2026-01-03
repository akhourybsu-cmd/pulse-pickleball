import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Server, Globe, Shield, Clock } from "lucide-react";

export const DataProcessingDisclosure = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Server className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Data Processing Disclosure</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Last updated: January 3, 2026</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            This disclosure provides transparency about the third-party services ("sub-processors") that process data on behalf of PULSE, where your data is stored, and the security measures we employ.
          </p>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="subprocessors">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  <span>Sub-Processors</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <p>PULSE uses the following sub-processors to provide our services:</p>
                
                <div className="space-y-4 mt-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-foreground">Supabase (via Lovable Cloud)</h4>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Infrastructure</span>
                    </div>
                    <p className="text-sm mb-2">Database hosting, authentication, file storage, and edge functions</p>
                    <p className="text-xs text-muted-foreground">Location: United States (AWS infrastructure)</p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-foreground">Lovable Platform</h4>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Hosting</span>
                    </div>
                    <p className="text-sm mb-2">Application hosting and deployment infrastructure</p>
                    <p className="text-xs text-muted-foreground">Location: Global CDN with US primary</p>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-foreground">AI Gateway (Optional)</h4>
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded">AI Features</span>
                    </div>
                    <p className="text-sm mb-2">Powers optional AI-assisted features like match analysis</p>
                    <p className="text-xs text-muted-foreground">Data: Anonymized, not stored after processing</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="locations">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>Data Locations</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-3">Primary Data Storage</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span><strong>User Data:</strong> United States (AWS us-east-1)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span><strong>Match History:</strong> United States (AWS us-east-1)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span><strong>File Uploads:</strong> United States (AWS S3)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span><strong>Static Assets:</strong> Global CDN (edge locations)</span>
                    </li>
                  </ul>
                </div>

                <p className="text-sm">For users in the European Economic Area (EEA), data transfers to the United States are conducted under Standard Contractual Clauses (SCCs) as approved by the European Commission.</p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="security">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span>Security Measures</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div className="grid gap-4">
                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium text-foreground mb-2">Encryption</h4>
                    <ul className="text-sm space-y-1">
                      <li>• TLS 1.3 encryption for all data in transit</li>
                      <li>• AES-256 encryption for data at rest</li>
                      <li>• Secure password hashing with bcrypt</li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium text-foreground mb-2">Access Control</h4>
                    <ul className="text-sm space-y-1">
                      <li>• Row-Level Security (RLS) on all user data</li>
                      <li>• Role-based access control for admin functions</li>
                      <li>• Secure API authentication with JWT tokens</li>
                    </ul>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4">
                    <h4 className="font-medium text-foreground mb-2">Infrastructure</h4>
                    <ul className="text-sm space-y-1">
                      <li>• SOC 2 Type II compliant hosting providers</li>
                      <li>• Automated security scanning and updates</li>
                      <li>• Regular penetration testing</li>
                      <li>• DDoS protection and rate limiting</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="retention">
              <AccordionTrigger className="text-left">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Data Retention Schedule</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="font-medium text-foreground">Account Information</span>
                    <span className="text-sm">Until account deletion + 30 days</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="font-medium text-foreground">Match History</span>
                    <span className="text-sm">Until account deletion</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="font-medium text-foreground">Rating Data</span>
                    <span className="text-sm">Anonymized after account deletion</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="font-medium text-foreground">Authentication Logs</span>
                    <span className="text-sm">90 days</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="font-medium text-foreground">Analytics Data</span>
                    <span className="text-sm">Anonymized, retained indefinitely</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="font-medium text-foreground">Backup Data</span>
                    <span className="text-sm">30 days rolling</span>
                  </div>
                </div>

                <p className="text-sm mt-4">Upon account deletion, your data is removed from active systems within 30 days. Backup copies are purged according to our retention schedule.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
