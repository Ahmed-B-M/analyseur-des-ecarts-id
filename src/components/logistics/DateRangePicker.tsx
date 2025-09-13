'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps extends React.ComponentProps<'div'> {
  onDateChange: (range: DateRange | undefined) => void;
  disabled?: boolean;
}

export function DateRangePicker({ className, onDateChange, disabled }: DateRangePickerProps) {
  const [date, setDate] = useState<DateRange | undefined>(undefined);

  const handleDateSelect = (range: DateRange | undefined) => {
    setDate(range);
    onDateChange(range);
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'd LLL, y', { locale: fr })} -{' '}
                  {format(date.to, 'd LLL, y', { locale: fr })}
                </>
              ) : (
                format(date.from, 'd LLL, y', { locale: fr })
              )
            ) : (
              <span>Choisir une date ou période</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={handleDateSelect}
            numberOfMonths={2}
            locale={fr}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
