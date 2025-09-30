
'use client';
import { KpiCard, ComparisonKpiCard } from '../KpiCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart2 } from 'lucide-react';
import type { Kpi, ComparisonKpi } from '@/lib/types';

interface QualityImpactSectionProps {
  qualityKpis: (Kpi | ComparisonKpi)[];
}

export function QualityImpactSection({ qualityKpis }: QualityImpactSectionProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Impact Qualité</h2>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart2 />Impact des Écarts sur la Qualité</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {qualityKpis.map(kpi => {
                  if ('value1' in kpi && 'value2' in kpi) {
                      return <ComparisonKpiCard key={kpi.title} {...kpi} />
                  }
                  return <KpiCard variant="inline" key={kpi.title} {...kpi} />
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
