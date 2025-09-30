
'use client';
import { KpiCard, ComparisonKpiCard } from '../KpiCard';
import type { Kpi, ComparisonKpi } from '@/lib/types';

interface GlobalKpiSectionProps {
  generalKpis: Kpi[];
  discrepancyKpis: ComparisonKpi[];
}

export function GlobalKpiSection({ generalKpis, discrepancyKpis }: GlobalKpiSectionProps) {
  return (
    <section>
      <h2 className="text-2xl font-bold mb-4">Vue d'Ensemble & Synthèse Globale</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
        {generalKpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {discrepancyKpis.map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
      </div>
    </section>
  );
}
