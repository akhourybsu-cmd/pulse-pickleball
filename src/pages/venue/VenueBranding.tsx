import { useState, useEffect } from 'react';
import { useMode } from '@/contexts/ModeContext';
import { useVenueSettings, VenueSettings } from '@/hooks/useVenueSettings';
import { useVenueTheme } from '@/components/layout/VenueShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Save, Palette, Image, Upload } from 'lucide-react';

export default function VenueBranding() {
  const { currentVenueId } = useMode();
  const { settings, loading, saving, updateSettings } = useVenueSettings(currentVenueId);
  const venueTheme = useVenueTheme();
  
  const [formData, setFormData] = useState<Partial<VenueSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const handleChange = (field: string, value: string | boolean | null) => {
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

  const logoShape = (formData as any).logo_shape || 'circle';
  const coverFocalPoint = (formData as any).cover_focal_point || 'center';

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Branding</h1>
          <p className="text-muted-foreground">Customize your venue's visual identity</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || saving}
          style={{ backgroundColor: venueTheme.primary }}
          className="hover:opacity-90"
        >
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Logo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logo
            </CardTitle>
            <CardDescription>Your venue's logo image</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            
            {/* Logo Preview */}
            {formData.logo_url && (
              <div className="p-4 bg-muted rounded-lg flex items-center justify-center">
                <img 
                  src={formData.logo_url} 
                  alt="Logo preview"
                  className={`h-24 w-24 object-cover ${logoShape === 'circle' ? 'rounded-full' : 'rounded-lg'}`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Logo Shape */}
            <div className="space-y-2">
              <Label>Logo Shape</Label>
              <RadioGroup
                value={logoShape}
                onValueChange={(value) => handleChange('logo_shape', value)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="circle" id="circle" />
                  <Label htmlFor="circle" className="cursor-pointer">Circle</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="square" id="square" />
                  <Label htmlFor="square" className="cursor-pointer">Square</Label>
                </div>
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        {/* Cover Image */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Cover Image
            </CardTitle>
            <CardDescription>Hero banner for your venue page</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banner_url">Cover Image URL</Label>
              <Input
                id="banner_url"
                type="url"
                value={formData.banner_url || ''}
                onChange={(e) => handleChange('banner_url', e.target.value)}
                placeholder="https://..."
              />
            </div>
            
            {/* Cover Preview */}
            {formData.banner_url && (
              <div 
                className="relative h-32 bg-muted rounded-lg overflow-hidden"
                style={{
                  backgroundImage: `url(${formData.banner_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: coverFocalPoint === 'top' ? 'top' : 'center'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-2 left-2 text-white text-xs bg-black/50 px-2 py-1 rounded">
                  Preview
                </div>
              </div>
            )}

            {/* Focal Point */}
            <div className="space-y-2">
              <Label>Cover Focal Point</Label>
              <RadioGroup
                value={coverFocalPoint}
                onValueChange={(value) => handleChange('cover_focal_point', value)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="top" id="top" />
                  <Label htmlFor="top" className="cursor-pointer">Top</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="center" id="center" />
                  <Label htmlFor="center" className="cursor-pointer">Center</Label>
                </div>
              </RadioGroup>
              <p className="text-xs text-muted-foreground">
                Choose which part of the image should be visible when cropped
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Brand Colors */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand Colors
            </CardTitle>
            <CardDescription>Customize your venue's color scheme</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Brand Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color || '#22c55e'}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color || '#22c55e'}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    placeholder="#22c55e"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for buttons, links, and accents</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color || '#1a1a1a'}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    className="w-16 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color || '#1a1a1a'}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    placeholder="#1a1a1a"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Used for headers and backgrounds</p>
              </div>
            </div>

            {/* Color Preview */}
            <div className="p-6 rounded-lg border space-y-4">
              <h4 className="font-medium">Color Preview</h4>
              <div className="flex flex-wrap gap-4">
                <div className="space-y-2">
                  <div 
                    className="w-20 h-20 rounded-lg shadow-md" 
                    style={{ backgroundColor: formData.primary_color || '#22c55e' }}
                  />
                  <p className="text-xs text-center text-muted-foreground">Primary</p>
                </div>
                <div className="space-y-2">
                  <div 
                    className="w-20 h-20 rounded-lg shadow-md" 
                    style={{ backgroundColor: formData.secondary_color || '#1a1a1a' }}
                  />
                  <p className="text-xs text-center text-muted-foreground">Secondary</p>
                </div>
              </div>
              
              {/* Sample Button */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Sample button:</p>
                <Button
                  style={{ backgroundColor: formData.primary_color || '#22c55e' }}
                  className="hover:opacity-90"
                >
                  Create Tournament
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
