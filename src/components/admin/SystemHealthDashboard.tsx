/**
 * System Health Dashboard Component
 * 
 * Displays the results of health checks for admin users.
 * Can be accessed from admin panel or venue settings.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertTriangle,
  Activity,
  Shield,
  Database
} from 'lucide-react';
import { runAllHealthChecks, HealthCheckResult } from '@/lib/health-checks';
import { cn } from '@/lib/utils';

const CHECK_LABELS: Record<string, { label: string; category: string }> = {
  invalid_scores: { label: 'Match Scores', category: 'Matches' },
  duplicate_matches: { label: 'Duplicate Matches', category: 'Matches' },
  missing_participants: { label: 'Match Participants', category: 'Matches' },
  event_status_integrity: { label: 'Event Status', category: 'Events' },
  event_over_registration: { label: 'Event Capacity', category: 'Events' },
  player_state_integrity: { label: 'Player States', category: 'Users' },
  rating_integrity: { label: 'Rating Calculations', category: 'Ratings' }
};

export function SystemHealthDashboard() {
  const [results, setResults] = useState<HealthCheckResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runChecks = async () => {
    setIsLoading(true);
    try {
      const checkResults = await runAllHealthChecks();
      setResults(checkResults);
      setLastRun(new Date());
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const totalIssues = results.reduce((sum, r) => sum + (r.count || 0), 0);

  const groupedResults = results.reduce((acc, result) => {
    const category = CHECK_LABELS[result.check]?.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(result);
    return acc;
  }, {} as Record<string, HealthCheckResult[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </h2>
          {lastRun && (
            <p className="text-sm text-muted-foreground mt-1">
              Last checked: {lastRun.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button onClick={runChecks} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          {isLoading ? 'Running...' : 'Run Health Checks'}
        </Button>
      </div>

      {/* Summary Cards */}
      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{passedCount}</p>
                  <p className="text-sm text-muted-foreground">Checks Passed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <XCircle className={cn("h-8 w-8", failedCount > 0 ? "text-red-500" : "text-muted-foreground")} />
                <div>
                  <p className="text-2xl font-bold">{failedCount}</p>
                  <p className="text-sm text-muted-foreground">Checks Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className={cn("h-8 w-8", totalIssues > 0 ? "text-yellow-500" : "text-muted-foreground")} />
                <div>
                  <p className="text-2xl font-bold">{totalIssues}</p>
                  <p className="text-sm text-muted-foreground">Total Issues</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Health Data</h3>
            <p className="text-muted-foreground text-center mb-4">
              Run health checks to scan your system for potential issues.
            </p>
            <Button onClick={runChecks}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Health Checks
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results */}
      {Object.entries(groupedResults).map(([category, categoryResults]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              {category}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryResults.map((result) => (
                <div 
                  key={result.check}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    result.passed 
                      ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900"
                      : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {result.passed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {CHECK_LABELS[result.check]?.label || result.check}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {result.message}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.count !== undefined && result.count > 0 && (
                      <Badge variant="secondary">
                        {result.count} issue{result.count !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    {result.fixable && !result.passed && (
                      <Badge variant="outline" className="text-blue-600">
                        Fixable
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
