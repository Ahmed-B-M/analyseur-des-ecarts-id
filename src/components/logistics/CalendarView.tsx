'use client';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import type { MergedData } from '@/lib/types';
import { format, isSameDay } from 'date-fns';

interface CalendarViewProps {
  data: MergedData[];
  onDateSelect: (date: string | undefined) => void;
}

export default function CalendarView({ data, onDateSelect }: CalendarViewProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());

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
    onDateSelect(day ? format(day, 'yyyy-MM-dd') : undefined);
  };
  
  return (
    <Card>
      <CardContent className="p-2 md:p-6 flex justify-center">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDayClick}
          className="rounded-md border"
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
