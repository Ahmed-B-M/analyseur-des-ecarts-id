
'use client';

import { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { PostalCodeStats } from '@/lib/types';

type ChartData = {
  codePostal: string;
  entrepot: string;
  totalLivraisons: number;
  livraisonsRetard: string; // This is a percentage string like "50.0%"
  lateCount: number; // We need the actual count of late deliveries
};

type HotZonesChartProps = {
  data: ChartData[];
};

// Simple color mapping for depots
const depotColors: { [key: string]: string } = {};
const availableColors = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const getColorForDepot = (depot: string) => {
  if (!depotColors[depot]) {
    depotColors[depot] = availableColors[Object.keys(depotColors).length % availableColors.length];
  }
  return depotColors[depot];
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const retardPercent = parseFloat(data.livraisonsRetard.replace('%',''));
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Code Postal
            </span>
            <span className="font-bold text-muted-foreground">
              {data.codePostal}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Entrepôt
            </span>
            <span className="font-bold">{data.entrepot}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Nb. Livraisons
            </span>
            <span className="font-bold">{data.totalLivraisons}</span>
          </div>
           <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              % Retard
            </span>
            <span className="font-bold">{retardPercent.toFixed(2)}%</span>
          </div>
           <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Nb. Retards
            </span>
            <span className="font-bold">{data.lateCount}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
};


export default function HotZonesChart({ data }: HotZonesChartProps) {
    const impactfulData = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }
        // Select postal codes with the highest number of late deliveries
        return [...data].sort((a, b) => b.lateCount - a.lateCount);
    }, [data]);

    const depots = useMemo(() => {
        return [...new Set(impactfulData.map(d => d.entrepot))].map(depot => ({
            value: depot,
            color: getColorForDepot(depot)
        }));
    }, [impactfulData]);

    const chartDisplayData = useMemo(() => {
      return impactfulData.map(d => ({
        ...d,
        retardPercent: parseFloat(d.livraisonsRetard.replace('%', ''))
      }));
    }, [impactfulData]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Carte des Zones Critiques par Code Postal</CardTitle>
        <CardDescription>
          Analyse des codes postaux ayant le plus grand nombre de livraisons en retard, croisant volume et pourcentage de retard.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[800px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart
              margin={{
                top: 20,
                right: 20,
                bottom: 20,
                left: 20,
              }}
            >
              <XAxis 
                type="number" 
                dataKey="retardPercent" 
                name="% Retard" 
                unit="%"
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(tick) => `${tick}%`}
                label={{ value: '% Livraisons en Retard', position: 'insideBottom', offset: -15, fill: 'hsl(var(--foreground))' }}
              />
              <YAxis 
                type="number" 
                dataKey="totalLivraisons" 
                name="Nb. Livraisons"
                stroke="hsl(var(--muted-foreground))"
                label={{ value: 'Nb. Livraisons', angle: -90, position: 'insideLeft', offset: 10, fill: 'hsl(var(--foreground))' }}
               />
              <ZAxis type="number" dataKey="totalLivraisons" range={[50, 1000]} name="Volume" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
               {depots.map(depot => (
                 <Scatter key={depot.value} name={depot.value} data={chartDisplayData.filter(d => d.entrepot === depot.value)} fill={depot.color} shape="circle" />
               ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
         <div className="mt-4 text-center text-sm text-muted-foreground">
            <p><strong>Lecture du graphique :</strong></p>
            <ul className="list-disc list-inside">
                <li><strong>Position horizontale (de gauche à droite) :</strong> Plus une bulle est à droite, plus le taux de retard est élevé.</li>
                <li><strong>Position verticale (de bas en haut) :</strong> Plus une bulle est haute, plus le nombre de livraisons est important.</li>
                <li><strong>Taille de la bulle :</strong> Représente également le volume de livraisons.</li>
            </ul>
            <p className="mt-2 font-bold">Les bulles en haut à droite sont les zones les plus critiques (volume élevé et taux de retard élevé).</p>
        </div>
      </CardContent>
    </Card>
  );
}
