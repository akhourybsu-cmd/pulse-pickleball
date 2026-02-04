import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Loader2, X, Sparkles } from "lucide-react";
import { formatSlug, generateSlugFromName, validateSlug } from "@/lib/slugValidation";
import { supabase } from "@/integrations/supabase/client";

interface CustomUrlSectionProps {
  eventId: string;
  eventName: string;
  initialSlug?: string | null;
  onSlugChange?: (slug: string | null) => void;
}

export function CustomUrlSection({
  eventId,
  eventName,
  initialSlug,
  onSlugChange,
}: CustomUrlSectionProps) {
  const [slug, setSlug] = useState(initialSlug || "");
  const [originalSlug] = useState(initialSlug || "");
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    error?: string;
    available?: boolean;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Determine the base URL for display
  const baseUrl = typeof window !== "undefined" 
    ? window.location.origin.replace(/^https?:\/\//, "").replace("id-preview--ca6dbc43-755e-43df-a1af-7527a749b225.lovable.app", "pulsepb.com")
    : "pulsepb.com";

  const fullUrl = slug 
    ? `https://${baseUrl}/tournament/${slug}`
    : `https://${baseUrl}/tournament/${eventId}`;

  // Generate suggested slug from tournament name
  const suggestedSlug = generateSlugFromName(eventName);

  // Debounced validation
  useEffect(() => {
    if (!slug) {
      setValidationResult(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsValidating(true);
      const result = await validateSlug(slug, eventId);
      setValidationResult(result);
      setIsValidating(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, eventId]);

  const handleSlugChange = (value: string) => {
    // Auto-format as user types
    const formatted = formatSlug(value);
    setSlug(formatted);
  };

  const handleUseSuggested = () => {
    setSlug(suggestedSlug);
  };

  const handleSave = async () => {
    if (validationResult && !validationResult.valid) {
      toast.error(validationResult.error || "Invalid URL");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tournaments_events")
        .update({ slug: slug || null })
        .eq("id", eventId);

      if (error) throw error;

      toast.success(slug ? "Custom URL saved!" : "Custom URL removed");
      onSlugChange?.(slug || null);
    } catch (error) {
      console.error("Error saving slug:", error);
      toast.error("Failed to save custom URL");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("URL copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const hasChanges = slug !== (originalSlug || "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Custom URL
          <Badge variant="secondary" className="text-xs">Optional</Badge>
        </CardTitle>
        <CardDescription>
          Create a memorable, shareable link for your tournament
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* URL Input */}
        <div className="space-y-2">
          <Label htmlFor="custom-url">Tournament URL</Label>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-muted rounded-l-md px-3 py-2 text-sm text-muted-foreground border border-r-0 border-input">
              {baseUrl}/tournament/
            </div>
            <Input
              id="custom-url"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder={suggestedSlug || "your-tournament-name"}
              className="rounded-l-none flex-1"
              maxLength={50}
            />
          </div>
          
          {/* Validation Status */}
          <div className="min-h-[24px] flex items-center gap-2">
            {isValidating && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Checking availability...
              </span>
            )}
            {!isValidating && validationResult && slug && (
              <>
                {validationResult.valid ? (
                  <span className="text-sm text-primary flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    This URL is available!
                  </span>
                ) : (
                  <span className="text-sm text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {validationResult.error}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Suggested Slug */}
        {!slug && suggestedSlug && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUseSuggested}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Use suggested: {suggestedSlug}
          </Button>
        )}

        {/* Full URL Preview */}
        <div className="space-y-2">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            Full URL Preview
          </Label>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
            <code className="text-sm flex-1 break-all">
              {fullUrl}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyUrl}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(fullUrl, "_blank")}
              className="shrink-0"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Save Button */}
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={isSaving || (validationResult !== null && !validationResult.valid)}
            className="w-full"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Custom URL"
            )}
          </Button>
        )}

        {/* Help Text */}
        <p className="text-xs text-muted-foreground">
          Custom URLs make your tournament easier to share and remember. 
          Use lowercase letters, numbers, and hyphens only. 
          Leave empty to use the default URL.
        </p>
      </CardContent>
    </Card>
  );
}
