import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import pulseLogo from '@/assets/pulse-logo-new.png';

const VenueInterestForm = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    venue_name: '',
    contact_name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    court_count: '',
    facility_type: '',
    current_booking_method: '',
    message: '',
    referral_source: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.venue_name || !formData.contact_name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('venue_inquiries')
        .insert([formData]);

      if (error) throw error;

      setIsSubmitted(true);
      toast.success('Thank you for your interest!');
    } catch (error) {
      console.error('Error submitting venue inquiry:', error);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Thank You!</CardTitle>
            <CardDescription className="text-base">
              We've received your venue inquiry. A member of our team will reach out to you within 1-2 business days to discuss how PULSE can help your facility.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={pulseLogo} alt="PULSE Logo" className="h-8 w-auto" />
          </button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-secondary/10 flex items-center justify-center">
              <Building className="h-7 w-7 text-secondary" />
            </div>
            <CardTitle className="text-2xl md:text-3xl">Partner With PULSE</CardTitle>
            <CardDescription className="text-base">
              Tell us about your venue and we'll reach out to discuss how PULSE can help manage your courts, events, and player community.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Venue Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Venue Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="venue_name">Venue / Facility Name *</Label>
                  <Input
                    id="venue_name"
                    value={formData.venue_name}
                    onChange={(e) => handleInputChange('venue_name', e.target.value)}
                    placeholder="e.g., Downtown Pickleball Club"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleInputChange('state', e.target.value)}
                      placeholder="State"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="court_count">Number of Courts</Label>
                    <Select value={formData.court_count} onValueChange={(value) => handleInputChange('court_count', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-4">1-4 courts</SelectItem>
                        <SelectItem value="5-10">5-10 courts</SelectItem>
                        <SelectItem value="11-20">11-20 courts</SelectItem>
                        <SelectItem value="20+">20+ courts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="facility_type">Facility Type</Label>
                    <Select value={formData.facility_type} onValueChange={(value) => handleInputChange('facility_type', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="indoor">Indoor</SelectItem>
                        <SelectItem value="outdoor">Outdoor</SelectItem>
                        <SelectItem value="mixed">Mixed (Indoor & Outdoor)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="current_booking_method">Current Booking Method</Label>
                  <Select value={formData.current_booking_method} onValueChange={(value) => handleInputChange('current_booking_method', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="How do you currently handle bookings?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No system in place</SelectItem>
                      <SelectItem value="paper">Paper / Walk-ins</SelectItem>
                      <SelectItem value="phone">Phone reservations</SelectItem>
                      <SelectItem value="other_software">Other booking software</SelectItem>
                      <SelectItem value="custom">Custom solution</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Contact Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Your Name *</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => handleInputChange('contact_name', e.target.value)}
                    placeholder="Full name"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="you@venue.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Additional Information</h3>
                
                <div className="space-y-2">
                  <Label htmlFor="referral_source">How did you hear about PULSE?</Label>
                  <Select value={formData.referral_source} onValueChange={(value) => handleInputChange('referral_source', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="search">Search Engine</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
                      <SelectItem value="referral">Referral from another venue</SelectItem>
                      <SelectItem value="player">Player recommendation</SelectItem>
                      <SelectItem value="event">At an event</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message / Questions</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => handleInputChange('message', e.target.value)}
                    placeholder="Tell us about your venue, your goals, or any questions you have about PULSE..."
                    rows={4}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full text-lg py-6" disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Inquiry'}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                We typically respond within 1-2 business days.
              </p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default VenueInterestForm;
