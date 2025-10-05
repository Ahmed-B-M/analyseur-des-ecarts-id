
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MergedData } from '@/lib/types';

interface DeliveryVolumeChartProps {
  data: MergedData[];
}

const getSlotLabel = (startSeconds: number, endSeconds: number): string => {
    if (isNaN(startSeconds) || isNaN(endSeconds) || startSeconds < 0 || endSeconds < 0) return 'N/A';
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
    if (!data || data.length === 0) {
      return { chartData: [], slots: [], totalEarly: 0, totalLate: 0 };
    }

    let totalEarly = 0;
    let totalLate = 0;

    // 1. Find all unique slots and create a sorted list
    const slotSet = new Set<string>();
    data.forEach(item => {
      if (item.heureDebutCreneau && item.heureFinCreneau) {
        const slotLabel = getSlotLabel(item.heureDebutCreneau, item.heureFinCreneau);
        if (slotLabel !== 'N/A') {
          slotSet.add(slotLabel);
        }
      }
    });
    const sortedSlots = Array.from(slotSet).sort();
    
    // 2. Initialize hourly buckets from 6am to 10pm
    const hourlyBuckets: Record<string, any> = {};
    for (let i = 6; i < 23; i++) {
        const hourLabel = `${String(i).padStart(2, '0')}h`;
        hourlyBuckets[hourLabel] = { hour: hourLabel };
        sortedSlots.forEach(slot => {
            hourlyBuckets[hourLabel][`${slot}-onTime`] = 0;
            hourlyBuckets[hourLabel][`${slot}-offTime`] = 0;
        });
    }

    // 3. Populate the buckets
    data.forEach(item => {
        if (!item.heureCloture || !item.heureDebutCreneau || !item.heureFinCreneau) {
            return;
        }

        const slotLabel = getSlotLabel(item.heureDebutCreneau, item.heureFinCreneau);
        if (slotLabel === 'N/A' || !sortedSlots.includes(slotLabel)) {
            return;
        }

        const closureDate = new Date(item.heureCloture * 1000);
        const closureHour = closureDate.getUTCHours();
        const closureHourLabel = `${String(closureHour).padStart(2, '0')}h`;

        // Find the correct bucket
        const bucket = hourlyBuckets[closureHourLabel];
        if (bucket) {
            const isLate = item.retardStatus === 'late';
            const isEarly = item.retardStatus === 'early';
            
            if (isLate) totalLate++;
            if (isEarly) totalEarly++;

            if (isLate || isEarly) {
                bucket[`${slotLabel}-offTime`]++;
            } else {
                bucket[`${slotLabel}-onTime`]++;
            }
        }
    });
    
    // 4. Convert to array and filter out empty hours
    const finalChartData = Object.values(hourlyBuckets).filter(bucket => {
        // Check if this hour has any data at all
        return sortedSlots.some(slot => bucket[`${slot}-onTime`] > 0 || bucket[`${slot}-offTime`] > 0);
    });

    return { chartData: finalChartData, slots: sortedSlots, totalEarly, totalLate };
  }, [data]);

  if (!chartData.length) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Volume de Clôtures par Heure et Créneau</CardTitle>
                 <CardDescription>
                    Aucune donnée de clôture disponible pour la sélection actuelle.
                </CardDescription>
            </CardHeader>
            <CardContent className="text-center text-muted-foreground p-8">
                <p>Veuillez ajuster les filtres ou vérifier les données importées.</p>
            </CardContent>
        </Card>
    );
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
