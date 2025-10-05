
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F',
  '#FFBB28', '#FF8042', '#AF19FF', '#FF4560', '#775DD0', '#546E7A'
];

export default function DeliveryVolumeChart({ data }: DeliveryVolumeChartProps) {

  const { chartData, slots } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], slots: [] };
    }

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
    const hourlyData: Record<string, any> = {};
    for (let i = 6; i < 23; i++) {
        const hourLabel = `${String(i).padStart(2, '0')}h`;
        hourlyData[hourLabel] = { hour: hourLabel };
        sortedSlots.forEach(slot => {
            hourlyData[hourLabel][slot] = 0;
        });
    }

    // 3. Populate the buckets
    data.forEach(item => {
        if (!item.heureCloture || !item.heureDebutCreneau || !item.heureFinCreneau) {
            return;
        }

        const slotLabel = getSlotLabel(item.heureDebutCreneau, item.heureFinCreneau);
        const closureDate = new Date(item.heureCloture * 1000);
        const closureHour = closureDate.getUTCHours();
        const closureHourLabel = `${String(closureHour).padStart(2, '0')}h`;

        // Find the correct bucket and slot to increment
        if (hourlyData[closureHourLabel] && sortedSlots.includes(slotLabel)) {
            hourlyData[closureHourLabel][slotLabel]++;
        }
    });
    
    // 4. Convert to array and filter out empty hours
    const finalChartData = Object.values(hourlyData).filter(hourData => {
        // Check if this hour has any data at all
        return sortedSlots.some(slot => hourData[slot] > 0);
    });

    return { chartData: finalChartData, slots: sortedSlots };
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
          Distribution des livraisons par heure de clôture, réparties par créneau promis au client.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Legend />
            {slots.map((slot, index) => (
              <Area
                key={slot}
                type="monotone"
                dataKey={slot}
                name={slot}
                stackId="1"
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
