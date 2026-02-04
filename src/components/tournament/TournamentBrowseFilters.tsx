import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, X } from "lucide-react";
import type { DateRangeFilter, RegistrationStatus } from "@/hooks/useBrowseTournaments";

interface TournamentBrowseFiltersProps {
  search: string;
  location: string;
  dateRange: DateRangeFilter;
  registrationStatus: RegistrationStatus;
  onSearchChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onDateRangeChange: (value: DateRangeFilter) => void;
  onRegistrationStatusChange: (value: RegistrationStatus) => void;
  onClearFilters: () => void;
}

const dateRangeOptions: { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'next_3_months', label: 'Next 3 Months' },
];

const registrationOptions: { value: RegistrationStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open Now' },
  { value: 'opening_soon', label: 'Opening Soon' },
];

export function TournamentBrowseFilters({
  search,
  location,
  dateRange,
  registrationStatus,
  onSearchChange,
  onLocationChange,
  onDateRangeChange,
  onRegistrationStatusChange,
  onClearFilters,
}: TournamentBrowseFiltersProps) {
  const hasActiveFilters = search || location || dateRange !== 'all' || registrationStatus !== 'all';

  return (
    <div className="space-y-4">
      {/* Search and Location Inputs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tournaments..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="relative flex-1 max-w-xs">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="City or State..."
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground mr-2">Date:</span>
        {dateRangeOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={dateRange === option.value ? "default" : "outline"}
            onClick={() => onDateRangeChange(option.value)}
            className="h-8"
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground mr-2">Registration:</span>
        {registrationOptions.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={registrationStatus === option.value ? "default" : "outline"}
            onClick={() => onRegistrationStatusChange(option.value)}
            className="h-8"
          >
            {option.label}
          </Button>
        ))}
        
        {hasActiveFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onClearFilters}
            className="h-8 ml-auto text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}
