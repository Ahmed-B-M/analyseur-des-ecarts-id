
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Clock, Warehouse } from 'lucide-react';
import type { DelayCount, DelayByHour } from '@/lib/types';
import { useMemo } from 'react';

interface DetailedAnalysisSectionProps {
  delaysByHour: DelayByHour[];
  advancesByHour: DelayByHour[];
  delaysByWarehouse: DelayCount[];
  advancesByWarehouse: DelayCount[];
  onFilterAndSwitch: (filter: Record<string, any>) => void;
}

const PRIMARY_COLOR = "hsl(var(--primary))";
const ADVANCE_COLOR = "hsl(210 100% 56%)";

const CustomYAxisTick = ({ y, payload }: any) => {
    return (
      <g transform={`translate(0,${y})`}>
        <text x={0} y={0} dy={4} textAnchor="start" fill="#666" fontSize={12} className="max-w-[70px] truncate">
          {payload.value}
        </text>
      </g>
    );
};

export function DetailedAnalysisSection({
  delaysByHour,
  advancesByHour,
  delaysByWarehouse,
  advancesByWarehouse,
  onFilterAndSwitch
}: DetailedAnalysisSectionProps) {

  const handleBarClick = (data: any, filterKey: string) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      if (payload.key) {
        onFilterAndSwitch({ [filterKey]: payload.key });
      } else if (filterKey === 'heure' && payload.hour) {
        onFilterAndSwitch({ [filterKey]: parseInt(payload.hour.split(':')[0]) });
      }
    }
  };

  const combinedHourlyData = useMemo(() => {
    const hourlyDataMap = new Map<string, {delays: number, advances: number}>();
    (delaysByHour || []).forEach(item => {
        const entry = hourlyDataMap.get(item.hour) || { delays: 0, advances: 0 };
        entry.delays += item.count;
        hourlyDataMap.set(item.hour, entry);
    });
    (advancesByHour || []).forEach(item => {
        const entry = hourlyDataMap.get(item.hour) || { delays: 0, advances: 0 };
        entry.advances += item.count;
        hourlyDataMap.set(item.hour, entry);
    });
    return Array.from(hourlyDataMap.entries()).map(([hour, data]) => ({ hour, ...data })).sort((a,b) => a.hour.localeCompare(b.hour));
  }, [delaysByHour, advancesByHour]);

  const combinedWarehouseData = useMemo(() => {
    const warehouseDataMap = new Map<string, {delays: number, advances: number}>();
    (delaysByWarehouse || []).forEach(item => {
        const entry = warehouseDataMap.get(item.key) || { delays: 0, advances: 0 };
        entry.delays += item.count;
        warehouseDataMap.set(item.key, entry);
    });
    (advancesByWarehouse || []).forEach(item => {
        const entry = warehouseDataMap.get(item.key) || { delays: 0, advances: 0 };
        entry.advances += item.count;
        warehouseDataMap.set(item.key, entry);
    });
    return Array.from(warehouseDataMap.entries()).map(([key, data]) => ({ key, ...data })).sort((a,b) => (b.delays + b.advances) - (a.delays + a.advances));
  }, [delaysByWarehouse, advancesByWarehouse]);


  return (
    <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock />Écarts par Heure</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={combinedHourlyData} onClick={(e) => handleBarClick(e, 'heure')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="delays" name="Retards" stackId="a" fill={PRIMARY_COLOR} className="cursor-pointer" />
                    <Bar dataKey="advances" name="Avances" stackId="a" fill={ADVANCE_COLOR} className="cursor-pointer" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Warehouse />Écarts par Entrepôt</CardTitle>
              </CardHeader>
              <CardContent>
                  <ScrollArea className="h-80">
                    <ResponsiveContainer width="100%" height={combinedWarehouseData.length * 40}>
                      <BarChart data={combinedWarehouseData} layout="vertical" margin={{ left: 100 }} onClick={(e) => handleBarClick(e, 'entrepot')}>
                          <XAxis type="number" />
                          <YAxis dataKey="key" type="category" width={100} tickLine={false} axisLine={false} tick={CustomYAxisTick} />
                          <Tooltip cursor={{fill: 'rgba(206, 206, 206, 0.2)'}} />
                          <Legend />
                          <Bar dataKey="delays" name="Retards" stackId="a" barSize={20} fill={PRIMARY_COLOR} className="cursor-pointer" />
                          <Bar dataKey="advances" name="Avances" stackId="a" barSize={20} fill={ADVANCE_COLOR} className="cursor-pointer" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ScrollArea>
              </CardContent>
            </Card>
        </div>
      </section>
  );
}
