
'use client';

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SlotData {
  slot: string;
  total: number;
  late: number;
}

interface SlotAnalysisChartProps {
  data: SlotData[];
}

export default function SlotAnalysisChart({ data }: SlotAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse des Créneaux Horaires</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Pas de données disponibles pour afficher le graphique des créneaux.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyse des Créneaux Horaires (Total vs. Retards)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="slot" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#8884d8" name="Total Livraisons" />
            <Bar dataKey="late" fill="#d9534f" name="Livraisons en Retard" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
