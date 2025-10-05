
'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { MergedData } from '@/lib/types';
import * as Recharts from 'recharts';

const { Defs, Pattern } = Recharts;


// Returns "HH:mm"
const formatMinute = (totalMinutes: number): string => {
    const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const minutes = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};


// Returns "HHh" or "HHhMM"
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

export default function DeliveryVolumeChart({ data }: { data: MergedData[] }) {

  const { chartData, slots } = useMemo(() => {
    if (!data || data.length === 0) {
      return { chartData: [], slots: [] };
    }

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

    const fifteenMinuteBuckets: Record<string, any> = {};
    const startTime = 5 * 60; // 05:00
    const endTime = 23 * 60 + 15; // 23:15
    for (let i = startTime; i <= endTime; i += 15) {
        const timeLabel = formatMinute(i);
        fifteenMinuteBuckets[timeLabel] = { time: timeLabel };
        sortedSlots.forEach(slot => {
            fifteenMinuteBuckets[timeLabel][`${slot}_onTime`] = 0;
            fifteenMinuteBuckets[timeLabel][`${slot}_offTime`] = 0;
        });
    }

    data.forEach(item => {
        if (!item.heureCloture || !item.heureDebutCreneau || !item.heureFinCreneau) {
            return;
        }

        const slotLabel = getSlotLabel(item.heureDebutCreneau, item.heureFinCreneau);
        const closureDate = new Date(item.heureCloture * 1000);
        const totalMinutes = closureDate.getUTCHours() * 60 + closureDate.getUTCMinutes();
        
        // Find the correct 15-minute bucket
        const bucketMinute = Math.floor(totalMinutes / 15) * 15;
        const bucketLabel = formatMinute(bucketMinute);

        if (fifteenMinuteBuckets[bucketLabel] && sortedSlots.includes(slotLabel)) {
            const isOnTime = item.retardStatus === 'onTime';
            if (isOnTime) {
                fifteenMinuteBuckets[bucketLabel][`${slotLabel}_onTime`]++;
            } else {
                fifteenMinuteBuckets[bucketLabel][`${slotLabel}_offTime`]++;
            }
        }
    });
    
    const finalChartData = Object.values(fifteenMinuteBuckets);

    return { chartData: finalChartData, slots: sortedSlots };
  }, [data]);
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background border p-2 rounded shadow-lg">
          <p className="font-bold">{`Heure: ${label}`}</p>
          <ul>
            {payload.map((pld: any, index: number) => {
              if (pld.value === 0) return null;
              const nameParts = pld.name.split(' - ');
              return (
                 <li key={index} style={{ color: pld.color }}>
                   {`${nameParts[0]}: ${pld.value} (${nameParts[1]})`}
                 </li>
              )
            })}
          </ul>
        </div>
      );
    }
    return null;
  };


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
        <CardTitle>Volume de Clôtures par Quart d'Heure et Créneau</CardTitle>
        <CardDescription>
          Distribution des livraisons par heure de clôture. Les zones pleines sont à l'heure, les zones hachurées sont hors délai (avance/retard).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={500}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <Defs>
              {slots.map((slot, index) => (
                <Pattern key={`pattern-${slot}`} id={`pattern_${index}`} patternUnits="userSpaceOnUse" width="8" height="8">
                   <rect width="8" height="8" fill={COLORS[index % COLORS.length]} fillOpacity={0.4} />
                   <path d="M-2 10 l12 -12 M0 8 l8 -8 M6 10 l4 -4" stroke="white" strokeWidth="1" />
                </Pattern>
              ))}
            </Defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tickFormatter={(time) => time.endsWith(':00') ? `${time.substring(0,2)}h` : ''} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {slots.map((slot, index) => [
              <Area
                key={`${slot}_onTime`}
                type="monotone"
                dataKey={`${slot}_onTime`}
                name={`${slot} - À l'heure`}
                stackId="1"
                stroke={COLORS[index % COLORS.length]}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={0.8}
              />,
              <Area
                key={`${slot}_offTime`}
                type="monotone"
                dataKey={`${slot}_offTime`}
                name={`${slot} - Hors délai`}
                stackId="1"
                stroke={COLORS[index % COLORS.length]}
                fill={`url(#pattern_${index})`}
              />
            ])}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
