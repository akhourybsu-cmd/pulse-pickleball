import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function VenueStaff() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-muted-foreground">Manage venue staff and permissions</p>
        </div>
        <Button>
          <Users className="h-4 w-4 mr-2" />
          Invite Staff
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Management</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Invite staff members to help manage your venue. They can be assigned 
            different roles with specific permissions.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
