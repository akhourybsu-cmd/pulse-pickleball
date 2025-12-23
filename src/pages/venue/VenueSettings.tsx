import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMode } from '@/contexts/ModeContext';
import { useVenueSettings, VenueSettings } from '@/hooks/useVenueSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Building2, MapPin, Phone, Clock, Palette, ExternalLink, Instagram, Facebook } from 'lucide-react';
import { StripeConnectCard } from '@/components/venue/StripeConnectCard';
import { useToast } from '@/hooks/use-toast';
const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HT)' },
];

export default function VenueSettingsPage() {
  const { currentVenueId } = useMode();
  const { settings, loading, saving, updateSettings } = useVenueSettings(currentVenueId);
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<Partial<VenueSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Handle Stripe Connect redirect
  useEffect(() => {
    const stripeStatus = searchParams.get('stripe');
    if (stripeStatus === 'success') {
      toast({
        title: "Stripe Connected",
        description: "Your payment account has been connected successfully!",
      });
    } else if (stripeStatus === 'refresh') {
      toast({
        title: "Stripe Setup",
        description: "Please complete your Stripe account setup.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const handleChange = (field: keyof VenueSettings, value: string | boolean | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    const success = await updateSettings(formData);
    if (success) {
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No venue selected</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Venue Settings</h1>
          <p className="text-muted-foreground">Customize how players see your venue</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>Essential details about your venue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Venue Name *</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter venue name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={formData.slug || ''}
                onChange={(e) => handleChange('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="venue-name"
              />
              <p className="text-xs text-muted-foreground">Used in your venue's public URL</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe your venue..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active Status</Label>
                <p className="text-xs text-muted-foreground">Venue is visible to players</p>
              </div>
              <Switch
                checked={formData.is_active ?? true}
                onCheckedChange={(checked) => handleChange('is_active', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </CardTitle>
            <CardDescription>Where your venue is located</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city || ''}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  value={formData.state || ''}
                  onValueChange={(value) => handleChange('state', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip_code">ZIP Code</Label>
              <Input
                id="zip_code"
                value={formData.zip_code || ''}
                onChange={(e) => handleChange('zip_code', e.target.value)}
                placeholder="12345"
                maxLength={10}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Contact Information
            </CardTitle>
            <CardDescription>How players can reach you</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="info@venue.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website || ''}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://www.venue.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Stripe Connect - Payment Processing */}
        {currentVenueId && (
          <StripeConnectCard 
            venueId={currentVenueId} 
            currentPlatformFee={(settings as any)?.platform_fee_percent || 10}
          />
        )}

        {/* Timezone & Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timezone & Preferences
            </CardTitle>
            <CardDescription>Regional settings for your venue</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select
                value={formData.timezone || ''}
                onValueChange={(value) => handleChange('timezone', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for booking times and event scheduling</p>
            </div>
          </CardContent>
        </Card>

        {/* Branding & Customization */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Branding & Customization
                </CardTitle>
                <CardDescription>Customize your public venue page appearance</CardDescription>
              </div>
              {formData.slug && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/v/${formData.slug}`} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Preview Public Page
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Logo & Banner */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo_url || ''}
                    onChange={(e) => handleChange('logo_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner_url">Banner Image URL</Label>
                  <Input
                    id="banner_url"
                    type="url"
                    value={(formData as any).banner_url || ''}
                    onChange={(e) => handleChange('banner_url' as any, e.target.value)}
                    placeholder="https://..."
                  />
                  <p className="text-xs text-muted-foreground">Hero image for your public venue page</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input
                    id="tagline"
                    value={(formData as any).tagline || ''}
                    onChange={(e) => handleChange('tagline' as any, e.target.value)}
                    placeholder="Where Champions Play"
                    maxLength={60}
                  />
                </div>
              </div>

              {/* Colors */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Primary Brand Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={(formData as any).primary_color || '#FF6B35'}
                      onChange={(e) => handleChange('primary_color' as any, e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={(formData as any).primary_color || '#FF6B35'}
                      onChange={(e) => handleChange('primary_color' as any, e.target.value)}
                      placeholder="#FF6B35"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondary_color">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondary_color"
                      type="color"
                      value={(formData as any).secondary_color || '#004E64'}
                      onChange={(e) => handleChange('secondary_color' as any, e.target.value)}
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={(formData as any).secondary_color || '#004E64'}
                      onChange={(e) => handleChange('secondary_color' as any, e.target.value)}
                      placeholder="#004E64"
                      className="flex-1"
                    />
                  </div>
                </div>
                
                {/* Color Preview */}
                <div className="p-4 rounded-lg border">
                  <p className="text-sm text-muted-foreground mb-2">Color Preview</p>
                  <div className="flex gap-2">
                    <div 
                      className="w-16 h-8 rounded" 
                      style={{ backgroundColor: (formData as any).primary_color || '#FF6B35' }}
                    />
                    <div 
                      className="w-16 h-8 rounded" 
                      style={{ backgroundColor: (formData as any).secondary_color || '#004E64' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-2">
                <Label htmlFor="social_facebook" className="flex items-center gap-2">
                  <Facebook className="h-4 w-4" />
                  Facebook URL
                </Label>
                <Input
                  id="social_facebook"
                  type="url"
                  value={(formData as any).social_facebook || ''}
                  onChange={(e) => handleChange('social_facebook' as any, e.target.value)}
                  placeholder="https://facebook.com/yourvenue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="social_instagram" className="flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  Instagram URL
                </Label>
                <Input
                  id="social_instagram"
                  type="url"
                  value={(formData as any).social_instagram || ''}
                  onChange={(e) => handleChange('social_instagram' as any, e.target.value)}
                  placeholder="https://instagram.com/yourvenue"
                />
              </div>
            </div>

            {/* White Label Toggle */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  Hide Pulse Branding
                  <Badge variant="secondary" className="text-xs">White Label</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only show a subtle "Powered by Pulse" in the footer
                </p>
              </div>
              <Switch
                checked={(formData as any).show_pulse_branding === false}
                onCheckedChange={(checked) => handleChange('show_pulse_branding' as any, !checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
