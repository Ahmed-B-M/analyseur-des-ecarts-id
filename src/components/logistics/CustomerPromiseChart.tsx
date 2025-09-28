
'use client';

import { ComposedChart, Area, Line, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface PromiseData {
  hour: string;
  customerPromise: number;
  urbantzPlan: number;
  realized: number;
  late: number;
}

interface CustomerPromiseChartProps {
  data: PromiseData[];
}

export default function CustomerPromiseChart({ data }: CustomerPromiseChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse de Distribution : Promesse, Plan & Réalité</CardTitle>
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
        <CardTitle>Analyse de Distribution : Promesse, Plan & Réalité</CardTitle>
        <CardDescription>
          Ce graphique compare la demande client (lissée), le plan d'Urbantz (prévu) et les livraisons terminées (réalisé) à la minute près. La ligne rouge montre les livraisons en retard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" interval="preserveStartEnd" tickFormatter={(tick) => tick.endsWith(':00') ? tick.substring(0, 2) + 'h' : ''} />
            <YAxis allowDecimals={true} />
            <Tooltip formatter={(value: number) => value.toFixed(2)} />
            <Legend verticalAlign="top" />
            <Area type="monotone" dataKey="customerPromise" stroke="#8884d8" fill="#8884d8" name="Promesse Client (Lissée)" dot={false} />
            <Area type="monotone" dataKey="urbantzPlan" stroke="#82ca9d" fill="#82ca9d" name="Plan Urbantz (Prévu)" dot={false} />
            <Area type="monotone" dataKey="realized" stroke="#ffc658" fill="#ffc658" name="Réalisé (Clôture)" dot={false} />
            <Line type="monotone" dataKey="late" stroke="#ef4444" name="Retards" dot={false} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
