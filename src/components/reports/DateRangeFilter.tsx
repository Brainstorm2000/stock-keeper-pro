import { useState } from 'react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangeFilterProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

const presets = [
  { label: 'Today', getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'This Week', getRange: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'This Month', getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'This Quarter', getRange: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
  { label: 'This Year', getRange: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
  { label: 'Last 30 Days', getRange: () => ({ from: startOfDay(subDays(new Date(), 30)), to: endOfDay(new Date()) }) },
  { label: 'Last 90 Days', getRange: () => ({ from: startOfDay(subDays(new Date(), 90)), to: endOfDay(new Date()) }) },
];

export function DateRangeFilter({ dateRange, onDateRangeChange }: DateRangeFilterProps) {
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((preset) => (
        <Button
          key={preset.label}
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => onDateRangeChange(preset.getRange())}
        >
          {preset.label}
        </Button>
      ))}

      <div className="flex items-center gap-1 ml-2">
        <Popover open={fromOpen} onOpenChange={setFromOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('text-xs w-[130px] justify-start', !dateRange.from && 'text-muted-foreground')}>
              <CalendarIcon className="mr-1 h-3 w-3" />
              {format(dateRange.from, 'MMM dd, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange.from}
              onSelect={(d) => { if (d) { onDateRangeChange({ ...dateRange, from: startOfDay(d) }); setFromOpen(false); } }}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
        <span className="text-xs text-muted-foreground">to</span>
        <Popover open={toOpen} onOpenChange={setToOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn('text-xs w-[130px] justify-start', !dateRange.to && 'text-muted-foreground')}>
              <CalendarIcon className="mr-1 h-3 w-3" />
              {format(dateRange.to, 'MMM dd, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateRange.to}
              onSelect={(d) => { if (d) { onDateRangeChange({ ...dateRange, to: endOfDay(d) }); setToOpen(false); } }}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
