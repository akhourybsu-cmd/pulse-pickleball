import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Download, 
  Calendar as CalendarIcon, 
  FileSpreadsheet, 
  DollarSign,
  TrendingUp,
  Users,
  Loader2
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { useVenueTransactions, useTransactionSummary, exportTransactionsToCSV, formatCents } from '@/hooks/useFinancialTransactions';

interface AnalyticsExportProps {
  venueId: string;
  className?: string;
}

export function AnalyticsExport({ venueId, className }: AnalyticsExportProps) {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date()),
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data: transactions, isLoading: txLoading } = useVenueTransactions(venueId, {
    start_date: dateRange.start.toISOString(),
    end_date: dateRange.end.toISOString(),
  });

  const { data: summary, isLoading: summaryLoading } = useTransactionSummary(venueId, {
    start: dateRange.start.toISOString(),
    end: dateRange.end.toISOString(),
  });

  const handleExport = async () => {
    if (!transactions || transactions.length === 0) return;
    
    setIsExporting(true);
    
    try {
      // Cast transactions to the expected type for CSV export
      const csv = exportTransactionsToCSV(transactions as any);
      
      // Create and download the file
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `transactions_${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setIsExporting(false);
    }
  };

  // Quick date range presets
  const setPreset = (preset: 'today' | 'week' | 'month' | 'last_month') => {
    const today = new Date();
    switch (preset) {
      case 'today':
        setDateRange({ start: today, end: today });
        break;
      case 'week':
        setDateRange({ start: subDays(today, 7), end: today });
        break;
      case 'month':
        setDateRange({ start: startOfMonth(today), end: today });
        break;
      case 'last_month':
        const lastMonth = subDays(startOfMonth(today), 1);
        setDateRange({ start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
        break;
    }
  };

  const isLoading = txLoading || summaryLoading;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Financial Reports
            </CardTitle>
            <CardDescription>
              Export transactions and view summaries
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Date Range Selector */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPreset('today')}
            >
              Today
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPreset('week')}
            >
              Last 7 days
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPreset('month')}
            >
              This month
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPreset('last_month')}
            >
              Last month
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.start, 'MMM d')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.start}
                  onSelect={(date) => date && setDateRange(prev => ({ ...prev, start: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">to</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[140px] justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.end, 'MMM d')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dateRange.end}
                  onSelect={(date) => date && setDateRange(prev => ({ ...prev, end: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : summary ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-green-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Payments</span>
              </div>
              <p className="text-2xl font-bold">{formatCents(summary.totalPayments)}</p>
            </div>
            
            <div className="p-4 bg-red-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Refunds</span>
              </div>
              <p className="text-2xl font-bold">{formatCents(summary.totalRefunds)}</p>
            </div>
            
            <div className="p-4 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Net Revenue</span>
              </div>
              <p className="text-2xl font-bold">{formatCents(summary.netRevenue)}</p>
            </div>
            
            <div className="p-4 bg-purple-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Transactions</span>
              </div>
              <p className="text-2xl font-bold">{summary.transactionCount}</p>
            </div>
          </div>
        ) : null}

        {/* Export Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {transactions?.length || 0} transactions in selected period
          </p>
          <Button
            onClick={handleExport}
            disabled={isExporting || !transactions?.length}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
