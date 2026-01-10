import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, X, AlertCircle, ChevronRight, Rocket } from 'lucide-react';
import { PublishReadinessResult } from '@/hooks/usePublishReadiness';
import { cn } from '@/lib/utils';

interface PublishReadinessCardProps {
  readiness: PublishReadinessResult;
  isPublished?: boolean;
  onPublish?: () => void;
  onUnpublish?: () => void;
  saving?: boolean;
  venueTheme?: { primary: string; secondary?: string };
  compact?: boolean;
}

export function PublishReadinessCard({
  readiness,
  isPublished = false,
  onPublish,
  onUnpublish,
  saving,
  venueTheme,
  compact = false
}: PublishReadinessCardProps) {
  const { isReady, requiredItems, recommendedItems, completionPercentage, missingRequired } = readiness;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5" />
              Publish Readiness
            </CardTitle>
            <CardDescription>
              {isPublished 
                ? 'Your venue is live and visible to players'
                : 'Complete these items to publish your venue'
              }
            </CardDescription>
          </div>
          {onPublish && onUnpublish && (
            isPublished ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onUnpublish}
                disabled={saving}
              >
                Unpublish
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={onPublish}
                disabled={!isReady || saving}
                style={isReady && venueTheme ? { backgroundColor: venueTheme.primary } : undefined}
                className={cn(!isReady && 'opacity-50 cursor-not-allowed')}
              >
                {saving ? 'Publishing...' : 'Publish Venue'}
              </Button>
            )
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Setup progress</span>
            <span className="font-medium">{completionPercentage}%</span>
          </div>
          <Progress 
            value={completionPercentage} 
            className="h-2"
            style={{ '--progress-color': venueTheme?.primary } as React.CSSProperties}
          />
        </div>

        {/* Required Items */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-1">
            Required
            {!isReady && <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
          </h4>
          <div className="space-y-1">
            {requiredItems.map(item => (
              <div 
                key={item.id}
                className={cn(
                  'flex items-center justify-between py-1.5 px-2 rounded-md text-sm',
                  item.isComplete ? 'bg-green-50 dark:bg-green-950/20' : 'bg-amber-50 dark:bg-amber-950/20'
                )}
              >
                <div className="flex items-center gap-2">
                  {item.isComplete ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-amber-600" />
                  )}
                  <span className={cn(!item.isComplete && 'text-amber-700 dark:text-amber-400')}>
                    {item.label}
                  </span>
                </div>
                {!item.isComplete && item.link && (
                  <Link to={item.link}>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recommended Items */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Recommended</h4>
          <div className="space-y-1">
            {recommendedItems.map(item => (
              <div 
                key={item.id}
                className={cn(
                  'flex items-center justify-between py-1.5 px-2 rounded-md text-sm',
                  item.isComplete ? 'bg-muted/50' : ''
                )}
              >
                <div className="flex items-center gap-2">
                  {item.isComplete ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
                  )}
                  <span className={cn(item.isComplete && 'text-muted-foreground')}>
                    {item.label}
                  </span>
                </div>
                {!item.isComplete && item.link && (
                  <Link to={item.link}>
                    <Button variant="ghost" size="sm" className="h-6 px-2">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
