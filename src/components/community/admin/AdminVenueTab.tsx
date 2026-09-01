import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, BadgeCheck, ShieldQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { VenueCourtsSection } from './VenueCourtsSection';
import { VenueHoursSection } from './VenueHoursSection';

/**
 * Venue identity for a venue community.
 *
 * Every field here already existed on `venues` — the table has carried a full
 * branding kit (logo, cover, colours, tagline, welcome copy, socials) since it
 * was created, with nothing able to write to it. This is the editor for the
 * subset that actually changes how the community looks and reads.
 *
 * Images go in the existing `groups` storage bucket under the group's id,
 * because that bucket's RLS already keys on the first path segment being the
 * group UUID. A separate venue bucket would mean a second set of storage
 * policies for no gain.
 */

interface AdminVenueTabProps {
  groupId: string;
  venueId: string;
  /** Whether an admin has verified this venue — drives the badge, not access. */
  isVerified: boolean;
}

interface VenueForm {
  name: string;
  tagline: string;
  welcome_headline: string;
  welcome_message: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  cover_image_url: string | null;
  website_url: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  instagram_url: string;
  facebook_url: string;
}

const DEFAULT_PRIMARY = '#C9962F';
const DEFAULT_SECONDARY = '#1F2933';

const EMPTY: VenueForm = {
  name: '',
  tagline: '',
  welcome_headline: '',
  welcome_message: '',
  primary_color: DEFAULT_PRIMARY,
  secondary_color: DEFAULT_SECONDARY,
  logo_url: null,
  cover_image_url: null,
  website_url: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  instagram_url: '',
  facebook_url: '',
};

/** `#abc` and `#aabbcc`, the two forms a colour input round-trips. */
function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function AdminVenueTab({ groupId, venueId, isVerified }: AdminVenueTabProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<VenueForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);

  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('venues')
        .select(
          'name, tagline, welcome_headline, welcome_message, primary_color, secondary_color, ' +
            'logo_url, cover_image_url, website_url, phone, email, city, state, ' +
            'instagram_url, facebook_url',
        )
        .eq('id', venueId)
        .single();

      if (cancelled) return;

      if (error) {
        toast({
          title: 'Error loading venue',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        setForm({
          ...EMPTY,
          ...Object.fromEntries(
            Object.entries(data).map(([k, v]) => [
              k,
              // Colours need a real value for the colour input; everything else
              // is happier as an empty string than as null.
              v ?? (k === 'primary_color'
                ? DEFAULT_PRIMARY
                : k === 'secondary_color'
                  ? DEFAULT_SECONDARY
                  : k.endsWith('_url') && (k === 'logo_url' || k === 'cover_image_url')
                    ? null
                    : ''),
            ]),
          ),
        } as VenueForm);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [venueId, toast]);

  const set = useCallback(<K extends keyof VenueForm>(key: K, value: VenueForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  const upload = async (kind: 'logo' | 'cover', file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Not an image', description: 'Choose an image file.', variant: 'destructive' });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Keep it under 4MB.', variant: 'destructive' });
      return;
    }

    setUploading(kind);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      // First path segment must be the group id — that's what the bucket's
      // RLS checks.
      const path = `${groupId}/venue-${kind}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('groups')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('groups').getPublicUrl(path);

      const column = kind === 'logo' ? 'logo_url' : 'cover_image_url';
      const { error: updateError } = await supabase
        .from('venues')
        .update({ [column]: publicUrl })
        .eq('id', venueId);
      if (updateError) throw updateError;

      set(column as 'logo_url' | 'cover_image_url', publicUrl);
      toast({ title: kind === 'logo' ? 'Logo updated' : 'Cover updated' });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Could not upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (kind: 'logo' | 'cover') => {
    const column = kind === 'logo' ? 'logo_url' : 'cover_image_url';
    const { error } = await supabase
      .from('venues')
      .update({ [column]: null })
      .eq('id', venueId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    set(column as 'logo_url' | 'cover_image_url', null);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Give your venue a name.', variant: 'destructive' });
      return;
    }
    for (const key of ['primary_color', 'secondary_color'] as const) {
      if (form[key] && !isHex(form[key])) {
        toast({
          title: 'Invalid colour',
          description: 'Use a hex value like #C9962F.',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    // Blank a cleared field rather than storing "", so the app's `?? fallback`
    // checks behave.
    const blankToNull = (v: string) => (v.trim() === '' ? null : v.trim());

    const { error } = await supabase
      .from('venues')
      .update({
        name: form.name.trim(),
        tagline: blankToNull(form.tagline),
        welcome_headline: blankToNull(form.welcome_headline),
        welcome_message: blankToNull(form.welcome_message),
        primary_color: blankToNull(form.primary_color),
        secondary_color: blankToNull(form.secondary_color),
        website_url: blankToNull(form.website_url),
        phone: blankToNull(form.phone),
        email: blankToNull(form.email),
        city: blankToNull(form.city),
        state: blankToNull(form.state),
        instagram_url: blankToNull(form.instagram_url),
        facebook_url: blankToNull(form.facebook_url),
      })
      .eq('id', venueId);

    setSaving(false);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Venue updated' });
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Venue Identity</CardTitle>
              <CardDescription>
                How your venue appears across its community.
              </CardDescription>
            </div>
            {isVerified ? (
              <Badge variant="outline" className="shrink-0 gap-1 border-amber-500/40 text-amber-600">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="shrink-0 gap-1 text-muted-foreground">
                <ShieldQuestion className="h-3.5 w-3.5" />
                Unverified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Cover with the logo overlaid — the same arrangement the community
              header uses, so this reads as a preview rather than a form. */}
          <div>
            <Label className="mb-2 block">Cover image</Label>
            <div className="relative overflow-hidden rounded-xl ring-1 ring-border">
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                disabled={uploading !== null}
                className="group relative block h-32 w-full bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Upload cover image"
                style={
                  !form.cover_image_url && isHex(form.secondary_color)
                    ? { backgroundColor: form.secondary_color }
                    : undefined
                }
              >
                {form.cover_image_url && (
                  <img
                    src={form.cover_image_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                  <Camera className="h-6 w-6 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                {uploading === 'cover' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => logoInput.current?.click()}
                disabled={uploading !== null}
                className="group absolute bottom-3 left-3 h-16 w-16 overflow-hidden rounded-xl ring-2 ring-background bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Upload logo"
              >
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-muted-foreground">
                    {(form.name || 'V').slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                  <Camera className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </span>
                {uploading === 'logo' && (
                  <span className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </span>
                )}
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {form.logo_url && (
                <Button variant="ghost" size="sm" onClick={() => removeImage('logo')}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Remove logo
                </Button>
              )}
              {form.cover_image_url && (
                <Button variant="ghost" size="sm" onClick={() => removeImage('cover')}>
                  <X className="mr-1.5 h-3.5 w-3.5" /> Remove cover
                </Button>
              )}
            </div>

            <input
              ref={logoInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload('logo', f);
                e.target.value = '';
              }}
            />
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload('cover', f);
                e.target.value = '';
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue-name">Venue name</Label>
            <Input
              id="venue-name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={80}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue-tagline">Tagline</Label>
            <Input
              id="venue-tagline"
              placeholder="12 indoor courts, open 7 days"
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ColorField
              id="venue-primary"
              label="Primary colour"
              hint="Accents, buttons and highlights"
              value={form.primary_color}
              onChange={(v) => set('primary_color', v)}
            />
            <ColorField
              id="venue-secondary"
              label="Secondary colour"
              hint="Header band behind the logo"
              value={form.secondary_color}
              onChange={(v) => set('secondary_color', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Welcome</CardTitle>
          <CardDescription>Shown to people arriving at your community.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="venue-headline">Headline</Label>
            <Input
              id="venue-headline"
              placeholder="Welcome to Riverside"
              value={form.welcome_headline}
              onChange={(e) => set('welcome_headline', e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="venue-welcome">Message</Label>
            <Textarea
              id="venue-welcome"
              placeholder="Open play every weekday morning, clinics on Saturdays. New players welcome."
              value={form.welcome_message}
              onChange={(e) => set('welcome_message', e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact & Location</CardTitle>
          <CardDescription>How players reach you and find the courts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="venue-city">City</Label>
              <Input
                id="venue-city"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-state">State</Label>
              <Input
                id="venue-state"
                value={form.state}
                onChange={(e) => set('state', e.target.value)}
                maxLength={2}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue-phone">Phone</Label>
              <Input
                id="venue-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-email">Email</Label>
              <Input
                id="venue-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                maxLength={120}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="venue-website">Website</Label>
            <Input
              id="venue-website"
              placeholder="https://"
              value={form.website_url}
              onChange={(e) => set('website_url', e.target.value)}
              maxLength={200}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="venue-instagram">Instagram</Label>
              <Input
                id="venue-instagram"
                placeholder="https://instagram.com/..."
                value={form.instagram_url}
                onChange={(e) => set('instagram_url', e.target.value)}
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="venue-facebook">Facebook</Label>
              <Input
                id="venue-facebook"
                placeholder="https://facebook.com/..."
                value={form.facebook_url}
                onChange={(e) => set('facebook_url', e.target.value)}
                maxLength={200}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <VenueCourtsSection venueId={venueId} />

      <VenueHoursSection venueId={venueId} />

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving || uploading !== null}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save venue
        </Button>
      </div>
    </div>
  );
}

function ColorField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const valid = isHex(value);
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} picker`}
          // A colour input only accepts #rrggbb, so a half-typed or invalid
          // value in the text field must not be pushed into it.
          value={valid ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#C9962F"
          maxLength={7}
          className={cn('font-mono', !valid && value.trim() !== '' && 'border-destructive')}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
