import type { AnalysisData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import { Info, Calendar } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WeeklySummaryProps {
    analysisData: AnalysisData | null;
    filters: Record<string, any>;
}

function getWeekTitle(range: DateRange): string {
    if (!range.from || !range.to) return "Résumé de la semaine";
    const fromMonth = range.from.getMonth();
    const toMonth = range.to.getMonth();
    const fromYear = range.from.getFullYear();
    const toYear = range.to.getFullYear();

    if (fromYear !== toYear) {
        return `Semaine du ${format(range.from, 'd MMM yyyy', { locale: fr })} au ${format(range.to, 'd MMM yyyy', { locale: fr })}`;
    }
    if (fromMonth !== toMonth) {
        return `Semaine du ${format(range.from, 'd MMM', { locale: fr })} au ${format(range.to, 'd MMM yyyy', { locale: fr })}`;
    }
    return `Semaine du ${format(range.from, 'd', { locale: fr })} au ${format(range.to, 'd MMMM yyyy', { locale: fr })}`;
}


export default function WeeklySummary({ analysisData, filters }: WeeklySummaryProps) {
    const weekRange = filters.dateRange as DateRange | undefined;

    if (!weekRange) {
        return (
            <Card className="h-full">
                <CardContent className="flex flex-col items-center justify-center text-center p-8 h-full">
                    <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold">Aucune semaine sélectionnée</h3>
                    <p className="text-muted-foreground mt-1">Cliquez sur un jour dans le calendrier pour voir le résumé de la semaine correspondante.</p>
                </CardContent>
            </Card>
        )
    }

    if (!analysisData) {
        return (
            <Card className="h-full">
                 <CardHeader>
                    <CardTitle>{getWeekTitle(weekRange)}</CardTitle>
                    <CardDescription>Période du {format(weekRange.from!, 'd LLL y', { locale: fr })} au {format(weekRange.to!, 'd LLL y', { locale: fr })}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center p-8">
                    <Info className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold">Aucune donnée pour cette semaine</h3>
                    <p className="text-muted-foreground mt-1">Aucune tournée ou tâche ne correspond à la semaine sélectionnée.</p>
                </CardContent>
            </Card>
        );
    }


    return (
        <Card>
            <CardHeader>
                <CardTitle>{getWeekTitle(weekRange)}</CardTitle>
                <CardDescription>
                    Résumé des performances pour la semaine du {format(weekRange.from!, 'd LLL y', { locale: fr })} au {format(weekRange.to!, 'd LLL y', { locale: fr })}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <section>
                    <h3 className="text-lg font-semibold mb-3">Indicateurs Clés</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                        {analysisData.generalKpis.slice(0,4).map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
                    </div>
                </section>
                <section>
                    <h3 className="text-lg font-semibold mb-3">Synthèse des Écarts (Planifié vs. Réalisé)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                        {analysisData.discrepancyKpis.slice(0,4).map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
                    </div>
                </section>
            </CardContent>
        </Card>
    );
}
