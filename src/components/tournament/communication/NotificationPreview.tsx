import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Eye, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationPreviewProps {
  eventId: string;
  eventName: string;
  templateType: string;
  subject: string;
  body: string;
}

const SAMPLE_DATA: Record<string, Record<string, string>> = {
  registration_confirmation: {
    player_name: "Alex Johnson",
    event_name: "Summer Pickleball Championship",
    team_name: "The Dinkers",
    division_name: "3.5 Mixed Doubles",
    registration_status: "Pending Approval",
    fee_amount: "50",
    organizer_email: "organizer@tournament.com"
  },
  payment_received: {
    player_name: "Alex Johnson",
    event_name: "Summer Pickleball Championship",
    team_name: "The Dinkers",
    division_name: "3.5 Mixed Doubles",
    payment_amount: "50"
  },
  check_in_reminder: {
    player_name: "Alex Johnson",
    event_name: "Summer Pickleball Championship",
    event_date: "Saturday, June 15, 2025",
    event_location: "City Sports Complex",
    division_name: "3.5 Mixed Doubles",
    check_in_window: "30",
    court_number: "3",
    match_time: "9:00 AM"
  },
  court_assignment: {
    player_name: "Alex Johnson",
    event_name: "Summer Pickleball Championship",
    court_number: "5",
    match_time: "10:30 AM",
    opponent_team: "Paddle Warriors",
    division_name: "3.5 Mixed Doubles"
  },
  match_results: {
    player_name: "Alex Johnson",
    event_name: "Summer Pickleball Championship",
    team1_name: "The Dinkers",
    team1_score: "11",
    team2_name: "Paddle Warriors",
    team2_score: "8",
    is_winner: "true",
    next_court: "7",
    next_time: "11:45 AM",
    next_opponent: "Kitchen Kings"
  }
};

export function NotificationPreview({
  eventId,
  eventName,
  templateType,
  subject,
  body
}: NotificationPreviewProps) {
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const sampleData = SAMPLE_DATA[templateType] || {};

  const renderTemplate = (template: string): string => {
    let rendered = template;
    
    // Replace simple variables
    Object.entries(sampleData).forEach(([key, value]) => {
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });

    // Handle conditionals (simplified)
    rendered = rendered.replace(/{{#if (\w+)}}([\s\S]*?){{\/if}}/g, (match, variable, content) => {
      return sampleData[variable] ? content : '';
    });

    return rendered;
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error("Please enter an email address");
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.functions.invoke("send-tournament-notification", {
        body: {
          to: testEmail,
          subject: renderTemplate(subject),
          html: renderTemplate(body).replace(/\n/g, '<br>'),
          eventId,
          isTest: true
        }
      });

      if (error) throw error;

      setSent(true);
      toast.success("Test email sent!");
      setTimeout(() => setSent(false), 3000);
    } catch (error: any) {
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Email Preview
        </CardTitle>
        <CardDescription>
          See how your email will look with sample data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Preview */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Subject:</span>
              <span className="font-medium">{renderTemplate(subject)}</span>
            </div>
          </div>
          <div className="p-4 bg-background">
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {renderTemplate(body)}
            </pre>
          </div>
        </div>

        {/* Sample Data Reference */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs">Sample Data Used</Label>
          <div className="flex flex-wrap gap-1">
            {Object.entries(sampleData).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs font-mono">
                {key}: {value}
              </Badge>
            ))}
          </div>
        </div>

        <Separator />

        {/* Send Test */}
        <div className="space-y-3">
          <Label>Send Test Email</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="your@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleSendTest} 
              disabled={sending || !testEmail}
              variant={sent ? "secondary" : "default"}
            >
              {sent ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Sent!
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {sending ? "Sending..." : "Send Test"}
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Send a test email to yourself to verify the template looks correct
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
