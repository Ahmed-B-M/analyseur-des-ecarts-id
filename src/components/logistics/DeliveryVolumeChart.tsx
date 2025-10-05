
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MergedData } from '@/lib/types';

interface DeliveryVolumeChartProps {
  data: MergedData[];
}

// Helper function to format seconds into a slot label like "08h-10h"
const getSlotLabel = (startSeconds: number, endSeconds: number): string => {
    if (isNaN(startSeconds) || isNaN(endSeconds)) return 'N/A';
    const startDate = new Date(startSeconds * 1000);
    const endDate = new Date(endSeconds * 1000);
    const startHour = startDate.getUTCHours();
    const endHour = endDate.getUTCHours();
    if (isNaN(startHour) || isNaN(endHour)) return 'N/A';
    return `${String(startHour).padStart(2, '0')}h-${String(endHour).padStart(2, '0')}h`;
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
    
    // First, find all unique hours present in closure times to build the X-axis
    const allHours = new Set<string>();
    data.forEach(item => {
        if(item.heureCloture) {
            const deliveryHour = new Date(item.heureCloture * 1000).getUTCHours();
            if (!isNaN(deliveryHour)) {
                allHours.add(`${String(deliveryHour).padStart(2, '0')}h`);
            }
        }
    });
    const sortedHours = Array.from(allHours).sort();

    // Initialize the main data structure
    sortedHours.forEach(hour => {
        volumeByHourAndSlot[hour] = {};
    });

    data.forEach(item => {
      if (item.heureDebutCreneau && item.heureFinCreneau && item.heureCloture) {
        
        const slotLabel = getSlotLabel(item.heureDebutCreneau, item.heureFinCreneau);
        if (slotLabel === 'N/A') return;
        allSlots.add(slotLabel);

        const deliveryHour = new Date(item.heureCloture * 1000).getUTCHours();
        if (isNaN(deliveryHour)) return;
        const deliveryHourLabel = `${String(deliveryHour).padStart(2, '0')}h`;
        
        // Ensure the hour exists in our structure
        if (!volumeByHourAndSlot[deliveryHourLabel]) {
          return; // Skip if hour is outside our sorted range
        }

        // Initialize slot if not present for this hour
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

    const sortedSlots = Array.from(allSlots).sort();
    
    // Convert the aggregated data into the format Recharts expects
    const finalChartData = sortedHours.map(hour => {
        const hourData = volumeByHourAndSlot[hour];
        const chartEntry: { [key: string]: string | number } = { hour };

        sortedSlots.forEach(slot => {
            const slotData = hourData[slot] || { onTime: 0, offTime: 0 };
            chartEntry[`${slot}-onTime`] = slotData.onTime;
            chartEntry[`${slot}-offTime`] = slotData.offTime;
        });
        
        return chartEntry;
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
