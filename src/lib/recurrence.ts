/**
 * Recurrence Rule Parser and Generator
 * Supports RRULE format for recurring events
 */

import { addDays, addWeeks, addMonths, format, isBefore, isAfter, isSameDay, startOfDay } from 'date-fns';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface RecurrenceConfig {
  frequency: RecurrenceFrequency;
  interval: number; // Every N periods
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
  dayOfMonth?: number; // For monthly recurrence
  exceptions?: Date[]; // Skip these dates
  until?: Date; // End date
  count?: number; // Max occurrences
}

export interface RecurrenceRule {
  rule: string; // RRULE string
  config: RecurrenceConfig;
}

/**
 * Parse an RRULE string into RecurrenceConfig
 */
export function parseRRule(rule: string): RecurrenceConfig | null {
  if (!rule || !rule.startsWith('RRULE:')) {
    return null;
  }

  const parts = rule.replace('RRULE:', '').split(';');
  const config: RecurrenceConfig = {
    frequency: 'weekly',
    interval: 1,
  };

  for (const part of parts) {
    const [key, value] = part.split('=');
    
    switch (key) {
      case 'FREQ':
        if (value === 'DAILY') config.frequency = 'daily';
        else if (value === 'WEEKLY') config.frequency = 'weekly';
        else if (value === 'MONTHLY') config.frequency = 'monthly';
        break;
        
      case 'INTERVAL':
        config.interval = parseInt(value) || 1;
        if (config.frequency === 'weekly' && config.interval === 2) {
          config.frequency = 'biweekly';
          config.interval = 1;
        }
        break;
        
      case 'BYDAY':
        config.daysOfWeek = value.split(',').map(day => {
          const dayMap: Record<string, number> = {
            'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
          };
          return dayMap[day] ?? 0;
        });
        break;
        
      case 'BYMONTHDAY':
        config.dayOfMonth = parseInt(value);
        break;
        
      case 'UNTIL':
        // Format: YYYYMMDD or YYYYMMDDTHHMMSSZ
        const year = parseInt(value.substring(0, 4));
        const month = parseInt(value.substring(4, 6)) - 1;
        const day = parseInt(value.substring(6, 8));
        config.until = new Date(year, month, day);
        break;
        
      case 'COUNT':
        config.count = parseInt(value);
        break;
    }
  }

  return config;
}

/**
 * Convert RecurrenceConfig to RRULE string
 */
export function toRRule(config: RecurrenceConfig): string {
  const parts: string[] = [];

  // Frequency
  const freqMap: Record<RecurrenceFrequency, string> = {
    'daily': 'DAILY',
    'weekly': 'WEEKLY',
    'biweekly': 'WEEKLY',
    'monthly': 'MONTHLY',
  };
  parts.push(`FREQ=${freqMap[config.frequency]}`);

  // Interval
  if (config.frequency === 'biweekly') {
    parts.push('INTERVAL=2');
  } else if (config.interval > 1) {
    parts.push(`INTERVAL=${config.interval}`);
  }

  // Days of week
  if (config.daysOfWeek && config.daysOfWeek.length > 0) {
    const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    const days = config.daysOfWeek.map(d => dayMap[d]).join(',');
    parts.push(`BYDAY=${days}`);
  }

  // Day of month
  if (config.dayOfMonth && config.frequency === 'monthly') {
    parts.push(`BYMONTHDAY=${config.dayOfMonth}`);
  }

  // Until
  if (config.until) {
    const until = format(config.until, 'yyyyMMdd');
    parts.push(`UNTIL=${until}`);
  }

  // Count
  if (config.count) {
    parts.push(`COUNT=${config.count}`);
  }

  return `RRULE:${parts.join(';')}`;
}

/**
 * Generate occurrence dates from recurrence config
 */
export function generateOccurrences(
  config: RecurrenceConfig,
  startDate: Date,
  windowWeeks: number = 8,
  maxOccurrences: number = 50
): Date[] {
  const occurrences: Date[] = [];
  const windowEnd = addWeeks(startDate, windowWeeks);
  const effectiveEnd = config.until && isBefore(config.until, windowEnd) 
    ? config.until 
    : windowEnd;
  const maxCount = config.count || maxOccurrences;
  
  let currentDate = startOfDay(startDate);
  
  while (
    occurrences.length < maxCount &&
    isBefore(currentDate, effectiveEnd)
  ) {
    // Check if this date should be included
    let shouldInclude = true;
    
    // Check day of week constraint
    if (config.daysOfWeek && config.daysOfWeek.length > 0) {
      shouldInclude = config.daysOfWeek.includes(currentDate.getDay());
    }
    
    // Check day of month constraint
    if (config.dayOfMonth && config.frequency === 'monthly') {
      shouldInclude = currentDate.getDate() === config.dayOfMonth;
    }
    
    // Check exceptions
    if (config.exceptions) {
      const isException = config.exceptions.some(ex => 
        isSameDay(currentDate, ex)
      );
      if (isException) shouldInclude = false;
    }
    
    if (shouldInclude && isAfter(currentDate, startDate) || isSameDay(currentDate, startDate)) {
      occurrences.push(new Date(currentDate));
    }
    
    // Advance to next potential date
    switch (config.frequency) {
      case 'daily':
        currentDate = addDays(currentDate, config.interval);
        break;
      case 'weekly':
        currentDate = addDays(currentDate, 1);
        // If we've moved to a new week, apply interval
        if (currentDate.getDay() === 0 && config.interval > 1) {
          currentDate = addWeeks(currentDate, config.interval - 1);
        }
        break;
      case 'biweekly':
        currentDate = addDays(currentDate, 1);
        if (currentDate.getDay() === 0) {
          currentDate = addWeeks(currentDate, 1);
        }
        break;
      case 'monthly':
        currentDate = addMonths(currentDate, config.interval);
        break;
    }
  }
  
  return occurrences;
}

/**
 * Get human-readable description of recurrence
 */
export function describeRecurrence(config: RecurrenceConfig): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  let description = '';
  
  switch (config.frequency) {
    case 'daily':
      description = config.interval === 1 ? 'Every day' : `Every ${config.interval} days`;
      break;
    case 'weekly':
      description = config.interval === 1 ? 'Every week' : `Every ${config.interval} weeks`;
      break;
    case 'biweekly':
      description = 'Every 2 weeks';
      break;
    case 'monthly':
      description = config.interval === 1 ? 'Every month' : `Every ${config.interval} months`;
      break;
  }
  
  if (config.daysOfWeek && config.daysOfWeek.length > 0) {
    const days = config.daysOfWeek.map(d => dayNames[d]).join(', ');
    description += ` on ${days}`;
  }
  
  if (config.until) {
    description += ` until ${format(config.until, 'MMM d, yyyy')}`;
  }
  
  if (config.count) {
    description += ` (${config.count} times)`;
  }
  
  return description;
}

/**
 * Common recurrence presets
 */
export const RECURRENCE_PRESETS = {
  weekly: {
    label: 'Weekly',
    config: { frequency: 'weekly' as RecurrenceFrequency, interval: 1 },
  },
  biweekly: {
    label: 'Every 2 weeks',
    config: { frequency: 'biweekly' as RecurrenceFrequency, interval: 1 },
  },
  monthly: {
    label: 'Monthly',
    config: { frequency: 'monthly' as RecurrenceFrequency, interval: 1 },
  },
  weekdays: {
    label: 'Weekdays',
    config: { frequency: 'weekly' as RecurrenceFrequency, interval: 1, daysOfWeek: [1, 2, 3, 4, 5] },
  },
  weekends: {
    label: 'Weekends',
    config: { frequency: 'weekly' as RecurrenceFrequency, interval: 1, daysOfWeek: [0, 6] },
  },
};
