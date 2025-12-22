import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Settings, Building2, Clock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VenueSettings() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your venue preferences</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Venue Profile
            </CardTitle>
            <CardDescription>Update your venue information</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Edit Profile</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Operating Hours
            </CardTitle>
            <CardDescription>Set your venue's schedule</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Configure Hours</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing & Payments
            </CardTitle>
            <CardDescription>Manage pricing and payments</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">Manage Billing</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Advanced Settings
            </CardTitle>
            <CardDescription>Additional configuration options</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View Settings</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
