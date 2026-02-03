import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Save, RefreshCw } from "lucide-react";

interface EmailTemplate {
  id: string;
  type: string;
  subject: string;
  body_template: string;
  enabled: boolean;
}

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  registration_confirmation: {
    subject: "Registration Confirmed: [event_name]",
    body: "Hi [player_name],\n\nThank you for registering for [event_name]!\n\nRegistration Details:\n- Team: [team_name]\n- Division: [division_name]\n- Status: [registration_status]\n\nWe'll notify you once the tournament director reviews your registration.\n\nQuestions? Contact us at [organizer_email].\n\nSee you on the courts!\nThe [event_name] Team"
  },
  payment_received: {
    subject: "Payment Confirmed: [event_name]",
    body: "Hi [player_name],\n\nWe've received your payment for [event_name]!\n\nPayment Details:\n- Amount: $[payment_total]\n- Team: [team_name]\n- Division: [division_name]\n\nYour spot is now secured. Look for check-in details as the event approaches.\n\nSee you there!\nThe [event_name] Team"
  },
  check_in_reminder: {
    subject: "Check-in Reminder: [event_name] Starts Tomorrow!",
    body: "Hi [player_name],\n\nThis is a friendly reminder that [event_name] starts tomorrow!\n\nEvent Details:\n- Date: [event_date]\n- Location: [event_location]\n- Your Division: [division_name]\n\nPlease arrive at least [check_in_window] minutes before your first match.\n\nDon't forget to bring:\n- Your paddle\n- Comfortable court shoes\n- Water and snacks\n\nSee you on the courts!\nThe [event_name] Team"
  },
  court_assignment: {
    subject: "Court Assignment: [event_name] - Match Ready",
    body: "Hi [player_name],\n\nYour match is ready!\n\nMatch Details:\n- Court: [court_number]\n- Time: [match_time]\n- Opponent: [opponent_team]\n- Division: [division_name]\n\nPlease report to the court promptly. Matches not started within 10 minutes may be forfeited.\n\nGood luck!\nThe [event_name] Team"
  },
  match_results: {
    subject: "Match Results: [event_name]",
    body: "Hi [player_name],\n\nYour match result has been recorded:\n\n[team1_name]: [team1_score]\n[team2_name]: [team2_score]\n\nThe [event_name] Team"
  }
};

const TEMPLATE_TYPES = [
  { id: "registration_confirmation", label: "Registration Confirmation" },
  { id: "payment_received", label: "Payment Received" },
  { id: "check_in_reminder", label: "Check-in Reminder" },
  { id: "court_assignment", label: "Court Assignment" },
  { id: "match_results", label: "Match Results" }
];

const AVAILABLE_VARIABLES: Record<string, string[]> = {
  registration_confirmation: [
    "player_name", "event_name", "team_name", "division_name", 
    "registration_status", "entry_fee", "organizer_email"
  ],
  payment_received: [
    "player_name", "event_name", "team_name", "division_name", "payment_total"
  ],
  check_in_reminder: [
    "player_name", "event_name", "event_date", "event_location", 
    "division_name", "check_in_window", "court_number", "match_time"
  ],
  court_assignment: [
    "player_name", "event_name", "court_number", "match_time", 
    "opponent_team", "division_name"
  ],
  match_results: [
    "player_name", "event_name", "team1_name", "team1_score", 
    "team2_name", "team2_score", "next_court", "next_time", "next_opponent"
  ]
};

interface EmailTemplateEditorProps {
  eventId: string;
}

export function EmailTemplateEditor({ eventId }: EmailTemplateEditorProps) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [activeTemplate, setActiveTemplate] = useState<string>("registration_confirmation");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, [eventId]);

  useEffect(() => {
    loadTemplate(activeTemplate);
  }, [activeTemplate, templates]);

  const fetchTemplates = async () => {
    setLoading(true);
    
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tournament_email_templates?event_id=eq.${eventId}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${token}`,
          },
        }
      );
      if (response.ok) {
        const jsonData = await response.json();
        setTemplates(jsonData as EmailTemplate[]);
      }
    } catch (err) {
      console.error("Error fetching templates:", err);
    }
    
    setLoading(false);
  };

  const loadTemplate = (type: string) => {
    const existing = templates.find(t => t.type === type);
    if (existing) {
      setSubject(existing.subject);
      setBody(existing.body_template);
      setEnabled(existing.enabled);
    } else {
      const defaults = DEFAULT_TEMPLATES[type];
      if (defaults) {
        setSubject(defaults.subject);
        setBody(defaults.body);
        setEnabled(true);
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);

    const existing = templates.find(t => t.type === activeTemplate);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    
    try {
      if (existing) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tournament_email_templates?id=eq.${existing.id}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${token}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              subject,
              body_template: body,
              enabled,
              updated_at: new Date().toISOString()
            }),
          }
        );

        if (!response.ok) {
          toast.error("Failed to update template");
        } else {
          toast.success("Template saved!");
          fetchTemplates();
        }
      } else {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/tournament_email_templates`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${token}`,
              Prefer: "return=minimal",
            },
            body: JSON.stringify({
              event_id: eventId,
              type: activeTemplate,
              subject,
              body_template: body,
              enabled
            }),
          }
        );

        if (!response.ok) {
          toast.error("Failed to save template");
        } else {
          toast.success("Template created!");
          fetchTemplates();
        }
      }
    } catch (err) {
      toast.error("Failed to save template");
    }

    setSaving(false);
  };

  const handleResetToDefault = () => {
    const defaults = DEFAULT_TEMPLATES[activeTemplate];
    if (defaults) {
      setSubject(defaults.subject);
      setBody(defaults.body);
      toast.info("Reset to default template");
    }
  };

  const currentVariables = AVAILABLE_VARIABLES[activeTemplate] || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Templates
        </CardTitle>
        <CardDescription>
          Customize automated emails sent to players during the tournament
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTemplate} onValueChange={setActiveTemplate}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            {TEMPLATE_TYPES.map(type => (
              <TabsTrigger key={type.id} value={type.id} className="text-xs">
                {type.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TEMPLATE_TYPES.map(type => (
            <TabsContent key={type.id} value={type.id} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={enabled}
                    onCheckedChange={setEnabled}
                  />
                  <Label>Send this email automatically</Label>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetToDefault}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Reset to Default
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>

              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Email content..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Available Variables</Label>
                <div className="flex flex-wrap gap-1">
                  {currentVariables.map(variable => (
                    <Badge
                      key={variable}
                      variant="secondary"
                      className="cursor-pointer text-xs"
                      onClick={() => {
                        setBody(prev => prev + `[${variable}]`);
                      }}
                    >
                      [{variable}]
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Click a variable to add it to the email body
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Template"}
                </Button>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
