import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface PlayStyleTabProps {
  formData: {
    home_court_id: string | null;
    handedness: string | null;
    play_side: string | null;
    paddle_brand: string | null;
    paddle_model: string | null;
  };
  onFormChange: (updates: Partial<PlayStyleTabProps['formData']>) => void;
  courts: Court[];
}

export function PlayStyleTab({
  formData,
  onFormChange,
  courts,
}: PlayStyleTabProps) {
  return (
    <div className="space-y-6">
      {/* Home Court */}
      <Card>
        <CardHeader>
          <CardTitle>Home Court</CardTitle>
          <CardDescription>Where you play most often</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="home_court">Select Your Home Court</Label>
            <Select
              value={formData.home_court_id || ""}
              onValueChange={(value) => onFormChange({ home_court_id: value })}
            >
              <SelectTrigger id="home_court">
                <SelectValue placeholder="Select your home court" />
              </SelectTrigger>
              <SelectContent>
                {courts.map((court) => (
                  <SelectItem key={court.id} value={court.id}>
                    {court.name} - {court.city}, {court.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">This helps other players find you and connects you to your local community</p>
          </div>
        </CardContent>
      </Card>

      {/* Play Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Play Preferences</CardTitle>
          <CardDescription>Your gameplay style</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="handedness">Handedness</Label>
              <Select
                value={formData.handedness || ""}
                onValueChange={(value) => onFormChange({ handedness: value })}
              >
                <SelectTrigger id="handedness">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right-Handed</SelectItem>
                  <SelectItem value="left">Left-Handed</SelectItem>
                  <SelectItem value="ambidextrous">Ambidextrous</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="play_side">Play Side Preference</Label>
              <Select
                value={formData.play_side || ""}
                onValueChange={(value) => onFormChange({ play_side: value })}
              >
                <SelectTrigger id="play_side">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forehand">Forehand Side</SelectItem>
                  <SelectItem value="backhand">Backhand Side</SelectItem>
                  <SelectItem value="either">Either Side</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Which side of the court you prefer in doubles</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equipment */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment</CardTitle>
          <CardDescription>Your paddle setup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="paddle_brand">Paddle Brand</Label>
              <Input
                id="paddle_brand"
                value={formData.paddle_brand || ""}
                onChange={(e) => onFormChange({ paddle_brand: e.target.value })}
                placeholder="e.g., Selkirk, Joola, CRBN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paddle_model">Paddle Model</Label>
              <Input
                id="paddle_model"
                value={formData.paddle_model || ""}
                onChange={(e) => onFormChange({ paddle_model: e.target.value })}
                placeholder="e.g., Vanguard Power Air"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Share your gear with other players</p>
        </CardContent>
      </Card>
    </div>
  );
}
