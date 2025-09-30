
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Scatter, Tooltip, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from 'recharts';
import { MergedData } from '@/lib/types';

interface SlotAnalysisChartProps {
  data: MergedData[];
}

// Helper to convert decimal hours to HH:mm format for tooltips and ticks
const formatDecimalHour = (hour: number | string) => {
    const numHour = typeof hour === 'string' ? parseFloat(hour) : hour;
    if (isNaN(numHour) || numHour < 0) return 'N/A';
    const h = Math.floor(numHour);
    const m = Math.round((numHour - h) * 60);
    return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
};


// Custom Tooltip for better readability
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const promised = data.promisedRange;
    const actual = data.actualRange;
    return (
      <div className="bg-background border p-3 rounded-md shadow-lg">
        <p className="font-bold text-lg mb-2">{`Créneau : ${data.slotLabel}`}</p>
        <p><span className="font-semibold text-gray-500">Promis :</span> {formatDecimalHour(promised[0])} - {formatDecimalHour(promised[1])}</p>
        <p><span className="font-semibold text-green-600">Réel :</span> {formatDecimalHour(actual[0])} - {formatDecimalHour(actual[1])}</p>
        <p><span className="font-semibold text-red-600">Médiane :</span> {formatDecimalHour(data.median)}</p>
      </div>
    );
  }
  return null;
};

// Custom shape to render two overlapping bars, creating a Gantt-like effect
const GanttBar = (props: any) => {
    const { x, y, width, height, payload, xAxis } = props;
    const { promisedRange, actualRange } = payload;

    if (!xAxis || typeof xAxis.scale !== 'function') {
        return null;
    }

    // Calculate pixel positions for promised and actual ranges
    const promisedStartPx = xAxis.scale(promisedRange[0]);
    const promisedEndPx = xAxis.scale(promisedRange[1]);
    const actualStartPx = xAxis.scale(actualRange[0]);
    const actualEndPx = xAxis.scale(actualRange[1]);
    
    const promisedWidth = promisedEndPx - promisedStartPx;
    const actualWidth = actualEndPx - actualStartPx;

    return (
        <g>
            {/* Promised Range (background bar) */}
            <rect x={promisedStartPx} y={y} width={promisedWidth} height={height} fill="hsl(var(--muted))" />
            {/* Actual Range (foreground bar) */}
            <rect x={actualStartPx} y={y + height * 0.2} width={actualWidth} height={height * 0.6} fill="hsl(var(--primary) / 0.6)" stroke="hsl(var(--primary))" />
        </g>
    );
};


export default function SlotAnalysisChart({ data }: SlotAnalysisChartProps) {
    const chartData = useMemo(() => {
        const slotData = data.reduce((acc, item) => {
            if (item.heureDebutCreneau && item.heureFinCreneau && item.heureArriveeReelle) {
                const slotStart = formatDecimalHour(item.heureDebutCreneau / 3600);
                const slotEnd = formatDecimalHour(item.heureFinCreneau / 3600);
                const slotLabel = `${slotStart}-${slotEnd}`;

                if (!acc[slotLabel]) {
                    acc[slotLabel] = {
                        deliveries: [],
                        promisedStart: item.heureDebutCreneau / 3600,
                        promisedEnd: item.heureFinCreneau / 3600
                    };
                }
                acc[slotLabel].deliveries.push(item.heureArriveeReelle / 3600);
            }
            return acc;
        }, {} as Record<string, { deliveries: number[], promisedStart: number, promisedEnd: number }>);

        return Object.entries(slotData).map(([slotLabel, values]) => {
            if (values.deliveries.length === 0) return null;
            const sortedDeliveries = values.deliveries.sort((a, b) => a - b);
            
            const min = sortedDeliveries[0];
            const max = sortedDeliveries[sortedDeliveries.length - 1];
            const median = sortedDeliveries[Math.floor(sortedDeliveries.length / 2)];
            
            return {
                slotLabel,
                actualRange: [min, max],
                promisedRange: [values.promisedStart, values.promisedEnd],
                median: median,
            };
        }).filter(Boolean as any as (value: any) => value is Exclude<any, null>).sort((a, b) => a.promisedRange[0] - b.promisedRange[0]);

    }, [data]);

    const allHours = useMemo(() => {
        if (!chartData.length) return { min: 6, max: 22 };
        const allValues = chartData.flatMap(d => [...d.actualRange, ...d.promisedRange]);
        return {
            min: Math.floor(Math.min(...allValues)),
            max: Math.ceil(Math.max(...allValues)),
        }
    }, [chartData]);


    if (!chartData.length) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analyse des Créneaux de Livraison</CardTitle>
                <CardDescription>
                    Comparaison des créneaux promis (gris) avec les plages de livraison réelles (vert) et l'heure médiane (point rouge).
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ResponsiveContainer width="100%" height={chartData.length * 50 + 50}>
                    <ComposedChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          type="number"
                          domain={[allHours.min, allHours.max]}
                          tickFormatter={formatDecimalHour}
                          allowDecimals={false}
                        />
                        <YAxis dataKey="slotLabel" type="category" width={80} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        
                        {/* This bar is a placeholder to pass data to the custom shape */}
                        <Bar dataKey="actualRange" name="Plage de livraison" shape={<GanttBar />} />
                        
                        <Scatter name="Heure médiane" dataKey="median" fill="hsl(var(--destructive))" />
                    </ComposedChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    );
}
