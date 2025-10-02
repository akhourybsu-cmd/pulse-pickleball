import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { APP_VERSION } from "@/config/version";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "1.6.0",
    date: "2025-10-02",
    changes: [
      "Added session queue management system",
      "Implemented kiosk display mode for organizers",
      "Added QR code check-in functionality",
      "Enforced one active session per court rule",
      "Removed admin-only restriction for creating sessions",
      "Added organizer-specific kiosk access control",
      "Moved 'Record New Match' button to top of dashboard",
    ]
  },
  {
    version: "1.5.0",
    date: "2025-09-28",
    changes: [
      "Implemented PULSE rating system with cumulative calculations",
      "Added provisional match bonuses for new players",
      "Enhanced match type support (ladder, league, playoffs, casual)",
      "Added weekly rating snapshots",
      "Improved rating calculation with margin of victory multipliers",
    ]
  },
  {
    version: "1.4.0",
    date: "2025-09-20",
    changes: [
      "Launched badge system with achievement tracking",
      "Added court connector for finding playing partners",
      "Implemented real-time participant notifications",
      "Enhanced profile customization options",
      "Added paddle preferences and player metadata",
    ]
  },
  {
    version: "1.3.0",
    date: "2025-09-10",
    changes: [
      "Added match approval workflow",
      "Implemented contested match system",
      "Enhanced match history with detailed analytics",
      "Added point differential tracking",
      "Improved opponent rating calculations",
    ]
  },
  {
    version: "1.2.0",
    date: "2025-08-25",
    changes: [
      "Added user authentication system",
      "Implemented profile management",
      "Created admin dashboard",
      "Added court management functionality",
      "Enhanced security with Row-Level Security policies",
    ]
  },
  {
    version: "1.1.0",
    date: "2025-08-15",
    changes: [
      "Launched match recording feature",
      "Added basic rating system",
      "Implemented win/loss tracking",
      "Created match history view",
      "Added responsive design improvements",
    ]
  },
  {
    version: "1.0.0",
    date: "2025-08-01",
    changes: [
      "Initial release of PULSE",
      "Basic player profiles",
      "Court database setup",
      "Match tracking foundation",
      "Light/dark theme support",
    ]
  },
];

export default function Changelog() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Changelog</h1>
            <p className="text-muted-foreground">
              Complete transparency on all changes and updates to PULSE
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Current version: <span className="font-semibold">{APP_VERSION}</span>
            </p>
          </div>

          <div className="space-y-6">
            {changelog.map((entry, index) => (
              <Card key={entry.version} className={index === 0 ? "border-primary shadow-[var(--shadow-glow)]" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      Version {entry.version}
                      {index === 0 && (
                        <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                          Latest
                        </span>
                      )}
                    </CardTitle>
                    <span className="text-sm text-muted-foreground">{entry.date}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {entry.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span className="flex-1">{change}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8 p-4 bg-secondary/30 rounded-lg">
            <p className="text-sm text-muted-foreground text-center">
              Have suggestions or found a bug? Contact your administrator for support.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
