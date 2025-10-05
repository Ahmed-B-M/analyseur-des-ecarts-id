
'use client';
import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import type { MergedData } from '@/lib/types';
import { format, isSameDay, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { Button } from '../ui/button';
import { CalendarDays } from 'lucide-react';

interface CalendarViewProps {
  data: MergedData[];
  onDateSelect: (date: string | undefined) => void;
  onWeekSelect: (range: DateRange | undefined) => void;
}

export default function CalendarView({ data, onDateSelect, onWeekSelect }: CalendarViewProps) {
  const [date, setDate] = useState<Date | undefined>();
  const [hoveredDay, setHoveredDay] = useState<Date | undefined>();

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
    // Clear week selection when a single day is clicked
    onWeekSelect(undefined);
  };

  const handleWeekSelect = () => {
    if(date) {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      onWeekSelect({ from: start, to: end });
      onDateSelect(undefined); // Clear single day selection
    }
  };

  const selectedWeek = useMemo(() => {
    const day = date || hoveredDay;
    if (!day) return undefined;
    const start = startOfWeek(day, { weekStartsOn: 1 });
    const end = endOfWeek(day, { weekStartsOn: 1 });
    return { from: start, to: end };
  }, [date, hoveredDay]);
  
  // Clear hover when mouse leaves the calendar
  const handleMouseLeave = () => {
    setHoveredDay(undefined);
  };
  
  const getWeekButtonLabel = () => {
    if (!selectedWeek?.from || !selectedWeek?.to) return "Sélectionner une semaine";
    return `Appliquer Semaine du ${format(selectedWeek.from, 'd MMM', {locale: fr})} au ${format(selectedWeek.to, 'd MMM', {locale: fr})}`
  }
  
  return (
    <Card className="flex flex-col">
      <CardContent className="p-2 md:p-4 flex justify-center flex-grow">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDayClick}
          modifiers={{ 
            hoverRange: selectedWeek ? { from: selectedWeek.from, to: selectedWeek.to } : undefined
          }}
          modifiersClassNames={{ 
            hoverRange: 'bg-primary/20'
          }}
          className="rounded-md border"
          locale={fr}
          showOutsideDays
          onDayMouseEnter={(day) => setHoveredDay(day)}
          onDayMouseLeave={() => setHoveredDay(undefined)}
          onMouseLeave={handleMouseLeave}
          components={{
            DayContent: ({ date: calendarDate }) => {
                const dayStr = format(calendarDate, 'yyyy-MM-dd');
                const toursCount = toursByDay[dayStr]?.size || 0;
                return (
                    <div className="relative h-full w-full flex items-center justify-center">
                        <p>{format(calendarDate, 'd')}</p>
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
       <div className="p-4 pt-0">
          <Button onClick={handleWeekSelect} disabled={!date} className="w-full">
            <CalendarDays className="mr-2 h-4 w-4" />
            {getWeekButtonLabel()}
          </Button>
      </div>
    </Card>
  );
}
