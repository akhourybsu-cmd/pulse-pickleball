import { AccountPageHeader } from '@/components/profile/AccountPageHeader';
import { withAuthDeadline } from '@/lib/authDeadline';
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function DataExport() {
  const navigate = useNavigate();
  const lock = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExportData = async () => {
    if (lock.current) return;
    lock.current = true;
    setExporting(true);
    try {
      const { data, error } = await withAuthDeadline(signal => supabase.rpc('export_user_data').abortSignal(signal), 30_000);
      
      if (error) throw error;
      
      if (!data) {
        throw new Error('No data returned from export');
      }

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pulse-data-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setExported(true);
      toast.success('Your data has been exported successfully!');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Failed to export data: ' + error.message);
    } finally {
      lock.current = false;
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AccountPageHeader icon={Download} title="Export your data" subtitle="Download a copy of your player records." />
      
      <div className="flex-1 container max-w-2xl mx-auto px-4 py-8 space-y-6">

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Your export contains the records listed below in JSON format. Keep the downloaded file somewhere private.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>What's Included in Your Export</CardTitle>
            <CardDescription>
              Your export will contain all the following data in JSON format:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">Profile Information</p>
                    <p className="text-sm text-muted-foreground">
                      Name, email, rating, stats, preferences
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">Match History</p>
                    <p className="text-sm text-muted-foreground">
                      All matches, scores, and statistics
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">Badges & Achievements</p>
                    <p className="text-sm text-muted-foreground">
                      Earned badges and progress
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">Event Participation</p>
                    <p className="text-sm text-muted-foreground">
                      Round-robin, tournaments, calendar events
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">Social Activity</p>
                    <p className="text-sm text-muted-foreground">
                      Posts, comments, reactions
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">LFG Posts</p>
                    <p className="text-sm text-muted-foreground">
                      Looking for game posts you've created
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">Queue History</p>
                    <p className="text-sm text-muted-foreground">
                      Session queue entries
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-1" />
                  <div>
                    <p className="font-medium">Disputes & Reports</p>
                    <p className="text-sm text-muted-foreground">
                      Match contests and issue reports
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Download Your Data</CardTitle>
            <CardDescription>
              Click the button below to generate and download a complete export of your data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <p className="text-sm font-medium">Export Format</p>
              <p className="text-sm text-muted-foreground">
                Your data will be exported as a JSON file that you can view with any text editor 
                or import into other applications. The file name will include today's date.
              </p>
            </div>

            <Button 
              onClick={handleExportData} 
              disabled={exporting}
              size="lg"
              className="w-full"
            >
              {exporting ? (
                <>
                  <Download className="w-5 h-5 mr-2 animate-pulse" />
                  Exporting Your Data...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Export All My Data
                </>
              )}
            </Button>

            {exported && (
              <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  Your data has been successfully exported! Check your downloads folder.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy & Security</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Secure Export:</strong> Your data is generated on-demand and never stored on our servers. 
              The export is created directly in your browser.
            </p>
            <p>
              <strong>What Happens Next:</strong> This export is for your records only. Downloading your data 
              does not delete it from PULSE. Your account remains active.
            </p>
            <p>
              <strong>Data Deletion:</strong> If you wish to delete your account and all associated data, 
              please contact support or use the account deletion feature in your profile settings.
            </p>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate('/player/profile')}>
            Back to Profile Settings
          </Button>
        </div>
      </div>


    </div>
  );
}