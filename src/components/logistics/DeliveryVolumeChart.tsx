
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MergedData } from '@/lib/types';

interface DeliveryVolumeChartProps {
  data: MergedData[];
}

// Helper function to format seconds into HHh
const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return 'N/A';
    const date = new Date(seconds * 1000);
    const hours = date.getUTCHours();
    if (isNaN(hours)) return 'N/A';
    return `${String(hours).padStart(2, '0')}h`;
};


// Generate a color palette for the chart
const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F',
  '#FFBB28', '#FF8042', '#AF19FF', '#FF4560', '#775DD0', '#546E7A'
];

export default function DeliveryVolumeChart({ data }: DeliveryVolumeChartProps) {

  const { chartData, slots, totalEarly, totalLate } = useMemo(() => {
    const volumeByHourAndSlot: Record<string, Record<string, { onTime: number; offTime: number }>> = {};
    const allSlots = new Set<string>();
    let totalEarly = 0;
    let totalLate = 0;
    
    data.forEach(item => {
      if (item.heureDebutCreneau && item.heureFinCreneau && item.heureCloture) {
        const slotStart = formatTime(item.heureDebutCreneau);
        const slotEnd = formatTime(item.heureFinCreneau);
        if (slotStart === 'N/A' || slotEnd === 'N/A') return;
        const slotLabel = `${slotStart}-${slotEnd}`;
        allSlots.add(slotLabel);

        const deliveryHour = new Date(item.heureCloture * 1000).getUTCHours();
        if (isNaN(deliveryHour)) return;
        const deliveryHourLabel = `${String(deliveryHour).padStart(2, '0')}h`;

        if (!volumeByHourAndSlot[deliveryHourLabel]) {
          volumeByHourAndSlot[deliveryHourLabel] = {};
        }
        if (!volumeByHourAndSlot[deliveryHourLabel][slotLabel]) {
          volumeByHourAndSlot[deliveryHourLabel][slotLabel] = { onTime: 0, offTime: 0 };
        }

        const isLate = item.retardStatus === 'late';
        const isEarly = item.retardStatus === 'early';

        if (isLate) totalLate++;
        if (isEarly) totalEarly++;

        if (isLate || isEarly) {
          volumeByHourAndSlot[deliveryHourLabel][slotLabel].offTime++;
        } else {
          volumeByHourAndSlot[deliveryHourLabel][slotLabel].onTime++;
        }
      }
    });

    const sortedHours = Object.keys(volumeByHourAndSlot).sort();
    const sortedSlots = Array.from(allSlots).sort();

    const finalChartData = sortedHours.map(hour => {
      const entry: { [key: string]: string | number } = { hour };
      sortedSlots.forEach(slot => {
        const slotData = volumeByHourAndSlot[hour]?.[slot] || { onTime: 0, offTime: 0 };
        entry[`${slot}-onTime`] = slotData.onTime;
        entry[`${slot}-offTime`] = slotData.offTime;
      });
      return entry;
    });

    return { chartData: finalChartData, slots: sortedSlots, totalEarly, totalLate };
  }, [data]);

  if (!chartData.length) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume de Clôtures par Heure et Créneau</CardTitle>
        <CardDescription>
          Distribution des livraisons à l'heure (couleur pleine) et hors délai (hachuré).
          Total hors délai : <span className="font-bold text-destructive">{totalEarly + totalLate}</span> 
          (<span className="font-semibold">{totalEarly} en avance</span>, <span className="font-semibold">{totalLate} en retard</span>).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6">
                <path d="M-1,1 l2,-2 M0,6 l6,-6 M5,7 l2,-2" stroke="gray" strokeWidth="1" />
              </pattern>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            {slots.map((slot, index) => (
              <React.Fragment key={slot}>
                <Area
                  type="monotone"
                  dataKey={`${slot}-onTime`}
                  name={`${slot} (À l'heure)`}
                  stackId="1"
                  stroke={COLORS[index % COLORS.length]}
                  fill={COLORS[index % COLORS.length]}
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey={`${slot}-offTime`}
                  name={`${slot} (Hors délai)`}
                  stackId="1"
                  stroke={COLORS[index % COLORS.length]}
                  fill="url(#hatch)"
                  fillOpacity={0.5}
                />
              </React.Fragment>
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
