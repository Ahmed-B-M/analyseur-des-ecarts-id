
'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SaturationData {
  hour: string;
  gap: number;
}

interface SaturationChartProps {
  data: SaturationData[];
}

const SaturationChart = ({ data }: SaturationChartProps) => {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse de Saturation des Créneaux</CardTitle>
          <CardDescription>Aucune donnée à afficher pour cette sélection.</CardDescription>
        </CardHeader>
        <CardContent className="text-center text-muted-foreground">
          <p>Veuillez ajuster les filtres ou charger des données.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse de Saturation des Créneaux (Demande vs. Capacité Réalisée)</CardTitle>
        <CardDescription>
          Ce graphique montre l'écart entre le nombre de clients attendant une livraison (demande cumulée) et le nombre de livraisons terminées (capacité).
          Une barre rouge indique une saturation (plus de demande que de capacité), tandis qu'une barre verte indique une sur-capacité ou un rattrapage du retard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" />
            <YAxis allowDecimals={false} />
            <Tooltip
              formatter={(value: number) => [
                `${value > 0 ? '+' : ''}${value}`,
                value > 0 ? "Demande > Capacité (Saturation)" : "Capacité > Demande (Sur-capacité)"
              ]}
              labelFormatter={(label) => `Créneau de ${label}`}
            />
            <Legend verticalAlign="top" payload={[{ value: 'Saturation (Demande > Capacité)', type: 'rect', color: '#ef4444' }, { value: 'Sur-capacité (Capacité > Demande)', type: 'rect', color: '#22c55e' }]}/>
            <ReferenceLine y={0} stroke="#000" />
            <Bar dataKey="gap" name="Écart">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.gap > 0 ? '#ef4444' : '#22c55e'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

export default SaturationChart;
