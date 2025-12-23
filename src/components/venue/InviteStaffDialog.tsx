import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface InviteStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueId: string;
  onSuccess: () => void;
}

export function InviteStaffDialog({ open, onOpenChange, venueId, onSuccess }: InviteStaffDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'manager' | 'staff'>('staff');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      // Find user by email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (profileError || !profile) {
        toast.error('User not found. They must have a Pulse account first.');
        return;
      }

      // Check if already a staff member
      const { data: existingStaff } = await supabase
        .from('venue_staff')
        .select('id')
        .eq('venue_id', venueId)
        .eq('user_id', profile.id)
        .single();

      if (existingStaff) {
        toast.error('This user is already a staff member');
        return;
      }

      // Add as staff member
      const { error } = await supabase
        .from('venue_staff')
        .insert({
          venue_id: venueId,
          user_id: profile.id,
          role: role,
          is_active: true
        });

      if (error) throw error;

      toast.success(`${email} has been added as ${role}`);
      setEmail('');
      setRole('staff');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error inviting staff:', error);
      toast.error('Failed to invite staff member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Staff Member</DialogTitle>
          <DialogDescription>
            Add a team member to help manage your venue. They must have a Pulse account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="staff@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: 'manager' | 'staff') => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">
                  <div className="flex flex-col items-start">
                    <span>Manager</span>
                    <span className="text-xs text-muted-foreground">Manage courts, events, and bookings</span>
                  </div>
                </SelectItem>
                <SelectItem value="staff">
                  <div className="flex flex-col items-start">
                    <span>Staff</span>
                    <span className="text-xs text-muted-foreground">View access and check-in assistance</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
