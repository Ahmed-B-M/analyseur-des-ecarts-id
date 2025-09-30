
'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, Line } from 'recharts';
import { Calendar, Clock, Sigma } from 'lucide-react';
import type { PerformanceByDay, PerformanceByTimeSlot, DelayHistogramBin } from '@/lib/types';

interface TemporalAnalysisSectionProps {
  performanceByDay: PerformanceByDay[];
  performanceBySlot: PerformanceByTimeSlot[];
  delayHistogram: DelayHistogramBin[];
}

const PRIMARY_COLOR = "hsl(var(--primary))";
const ADVANCE_COLOR = "hsl(210 100% 56%)";

export function TemporalAnalysisSection({ performanceByDay, performanceBySlot, delayHistogram }: TemporalAnalysisSectionProps) {
  const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const sortedPerformanceByDay = (performanceByDay || []).sort((a,b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

  return (
    <section>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Calendar/>Performance par Jour</CardTitle>
               </CardHeader>
               <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                     <ComposedChart data={sortedPerformanceByDay}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="day" fontSize={12} />
                       <YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft', fontSize: 12, offset: 10 }} />
                       <YAxis yAxisId="right" orientation="right" label={{ value: 'Retard Moyen (min)', angle: -90, position: 'insideRight', fontSize: 12, offset: 10 }} />
                       <Tooltip />
                       <Legend wrapperStyle={{fontSize: "12px"}}/>
                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={PRIMARY_COLOR} stackId="a" />
                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} stackId="a" />
                       <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                     </ComposedChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Clock/>Performance par Créneau de 2h</CardTitle>
               </CardHeader>
               <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                     <ComposedChart data={performanceBySlot}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="slot" fontSize={12}/>
                       <YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft', fontSize: 12, offset: 10 }} />
                       <YAxis yAxisId="right" orientation="right" label={{ value: 'Retard Moyen (min)', angle: -90, position: 'insideRight', fontSize: 12, offset: 10 }}/>
                       <Tooltip />
                       <Legend wrapperStyle={{fontSize: "12px"}}/>
                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={PRIMARY_COLOR} stackId="a" />
                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} stackId="a" />
                       <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                     </ComposedChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
             <Card>
               <CardHeader>
                 <CardTitle className="flex items-center gap-2"><Sigma />Répartition des Écarts</CardTitle>
               </CardHeader>
               <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                     <BarChart data={delayHistogram}>
                       <CartesianGrid strokeDasharray="3 3" />
                       <XAxis dataKey="range" fontSize={10} angle={-45} textAnchor="end" height={80} interval={0} />
                       <YAxis />
                       <Tooltip />
                       <Bar dataKey="count" name="Nb. de Tâches">
                          {(delayHistogram || []).map((entry, index) => {
                             let color = '#a0aec0'; // default grey
                             if (entry.range.includes('retard')) color = PRIMARY_COLOR;
                             if (entry.range.includes('avance')) color = ADVANCE_COLOR;
                             if (entry.range.includes('l\'heure')) color = '#48bb78'; // green
                             return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                       </Bar>
                     </BarChart>
                  </ResponsiveContainer>
               </CardContent>
             </Card>
        </div>
    </section>
  );
}
