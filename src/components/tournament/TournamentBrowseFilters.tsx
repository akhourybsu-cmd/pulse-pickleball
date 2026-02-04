import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { DateRangeFilter, RegistrationStatus } from "@/hooks/useBrowseTournaments";

interface TournamentBrowseFiltersProps {
  dateRange: DateRangeFilter;
  registrationStatus: RegistrationStatus;
  onDateRangeChange: (value: DateRangeFilter) => void;
  onRegistrationStatusChange: (value: RegistrationStatus) => void;
  onClearFilters: () => void;
  hasActiveFilters?: boolean;
}

const dateRangeOptions: { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'next_3_months', label: 'Next 3 Mo' },
];

const registrationOptions: { value: RegistrationStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open Now' },
  { value: 'opening_soon', label: 'Opening Soon' },
];

export function TournamentBrowseFilters({
  dateRange,
  registrationStatus,
  onDateRangeChange,
  onRegistrationStatusChange,
  onClearFilters,
  hasActiveFilters = false,
}: TournamentBrowseFiltersProps) {
  return (
    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
      <div className="flex items-center gap-2 min-w-max pb-2">
        {/* Date filters */}
        {dateRangeOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={dateRange === option.value ? "default" : "outline"}
            onClick={() => onDateRangeChange(option.value)}
            className="h-8 text-xs sm:text-sm whitespace-nowrap"
          >
            {option.label}
          </Button>
        ))}
        
        <div className="w-px h-6 bg-border mx-1" />
        
        {/* Registration filters */}
        {registrationOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={registrationStatus === option.value ? "default" : "outline"}
            onClick={() => onRegistrationStatusChange(option.value)}
            className="h-8 text-xs sm:text-sm whitespace-nowrap"
          >
            {option.label}
          </Button>
        ))}
        
        {hasActiveFilters && (
          <>
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              size="sm"
              variant="ghost"
              onClick={onClearFilters}
              className="h-8 text-xs sm:text-sm text-muted-foreground whitespace-nowrap"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
