'use client';
import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import type { MergedData } from '@/lib/types';
import { format, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

interface CalendarViewProps {
  data: MergedData[];
  onDateSelect: (date: string | undefined) => void;
  onWeekSelect: (range: DateRange | undefined) => void;
}

export default function CalendarView({ data, onDateSelect, onWeekSelect }: CalendarViewProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [week, setWeek] = useState<DateRange | undefined>();

  const toursByDay = data.reduce((acc, item) => {
    if (item.tournee) {
      const day = item.date;
      if (!acc[day]) {
        acc[day] = new Set();
      }
      acc[day].add(item.tournee.uniqueId);
    }
    return acc;
  }, {} as Record<string, Set<string>>);

  const handleDayClick = (day: Date | undefined) => {
    setDate(day);

    if (day) {
        const start = startOfWeek(day, { weekStartsOn: 1 }); // Monday
        const end = endOfWeek(day, { weekStartsOn: 1 });
        const newWeek = { from: start, to: end };
        setWeek(newWeek);
        onWeekSelect(newWeek);
    } else {
        setWeek(undefined);
        onWeekSelect(undefined);
    }
    
    // Also trigger single day selection if needed, or decide on a primary interaction
    onDateSelect(day ? format(day, 'yyyy-MM-dd') : undefined);
  };
  
  useEffect(() => {
    // Select current week on initial load
    handleDayClick(new Date());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardContent className="p-2 md:p-6 flex justify-center">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDayClick}
          modifiers={{ range: week || {} }}
          modifiersClassNames={{ range: 'bg-primary/20' }}
          className="rounded-md border"
          locale={fr}
          showOutsideDays
          components={{
            DayContent: ({ date, ...props }) => {
                const dayStr = format(date, 'yyyy-MM-dd');
                const toursCount = toursByDay[dayStr]?.size || 0;
                return (
                    <div className="relative h-full w-full flex items-center justify-center">
                        <p>{format(date, 'd')}</p>
                        {toursCount > 0 && (
                            <div className="absolute bottom-1 w-5 h-5 bg-primary/80 text-primary-foreground text-xs rounded-full flex items-center justify-center">
                                {toursCount}
                            </div>
                        )}
                    </div>
                )
            }
          }}
        />
      </CardContent>
    </Card>
  );
}
