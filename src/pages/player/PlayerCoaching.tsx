import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

export default function PlayerCoaching() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-[1280px]">
      <h1 className="text-2xl font-bold mb-6">Coaching</h1>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Find and book lessons with certified pickleball coaches in your area.
            This feature is under development.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
