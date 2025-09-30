
'use client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ComposedChart, AreaChart, Area, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { WorkloadByHour, AvgWorkload, AvgWorkloadBySlot } from '@/lib/types';

interface WorkloadAnalysisSectionProps {
  workloadByHour: WorkloadByHour[];
  avgWorkload: AvgWorkload;
  avgWorkloadByDriverBySlot: AvgWorkloadBySlot[];
}

const PRIMARY_COLOR = "hsl(var(--primary))";
const ACCENT_COLOR = "hsl(var(--accent))";
const ADVANCE_COLOR = "hsl(210 100% 56%)";

export function WorkloadAnalysisSection({
  workloadByHour,
  avgWorkload,
  avgWorkloadByDriverBySlot
}: WorkloadAnalysisSectionProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Analyse de la Charge & Performance Humaine</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Charge, Retards et Avances par Heure</CardTitle>
            <CardDescription>Volume de tâches, retards et avances au fil de la journée.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={workloadByHour}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: 'Nb. Écarts', angle: -90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Area yAxisId="left" type="monotone" dataKey="planned" name="Planifié" stroke={ACCENT_COLOR} fill={ACCENT_COLOR} fillOpacity={0.3} />
                <Area yAxisId="left" type="monotone" dataKey="real" name="Réalisé" stroke={PRIMARY_COLOR} fill={PRIMARY_COLOR} fillOpacity={0.3} />
                <Line yAxisId="right" type="monotone" dataKey="delays" name="Retards" stroke={PRIMARY_COLOR} dot={false} strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="advances" name="Avances" stroke={ADVANCE_COLOR} dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Intensité du Travail par Créneau de 2h</CardTitle>
            <CardDescription className="flex items-center gap-2">
              <span>Nb. moyen de tâches / tournée active.</span>
              <span className="font-semibold text-xs rounded bg-muted px-1.5 py-0.5">
                Moy Plan.: {avgWorkload.avgPlanned.toFixed(2)}
              </span>
              <span className="font-semibold text-xs rounded bg-muted px-1.5 py-0.5">
                Moy Réel: {avgWorkload.avgReal.toFixed(2)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={avgWorkloadByDriverBySlot}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="slot" />
                <YAxis label={{ value: 'Tâches / Tournée', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="avgPlanned" name="Planifié / Tournée" stroke={ACCENT_COLOR} fill={ACCENT_COLOR} fillOpacity={0.3} />
                <Area type="monotone" dataKey="avgReal" name="Réalisé / Tournée" stroke={PRIMARY_COLOR} fill={PRIMARY_COLOR} fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
