'use client';
import { useEffect, useState } from 'react';
import type { VisualReportData, Kpi } from '@/lib/types';
import { Logo } from './Logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Printer, Loader2, AlertCircle, FileText, Target, Search, MapPin, BarChart2, Calendar, Clock, AlertTriangle, Timer, Route, Warehouse, Award, TrendingUp, Hourglass } from 'lucide-react';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Legend, Line, Area } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type ExtendedVisualReportData = VisualReportData & {
    extra: {
        negativeReviewsKpi: Kpi;
        overloadedToursPercentage: number;
        durationDiscrepancyPercentage: number;
        planningAnomalyPercentage: number;
        exemplaryDrivers: any[];
        top10PositiveDuration: any[];
        top10Anomalies: any[];
        top10Overloaded: any[];
        totalCumulativeDelayHours: number;
        totalAdditionalServiceHours: number;
        top20percentWarehousesByOverrun: any[];
    }
}

const ReportBlock = ({ title, icon: Icon, aiComment, children, className }: { title: string, icon: React.ElementType, aiComment?: string, children: React.ReactNode, className?: string }) => (
    <div className={className}>
        <div className="flex items-start gap-3 mb-4">
            <Icon className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
            <div>
                <h2 className="text-xl font-bold">{title}</h2>
                {aiComment && <p className="text-sm text-gray-600 italic">"{aiComment}"</p>}
            </div>
        </div>
        {children}
    </div>
);

function formatSecondsToClock(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
        return format(new Date(dateString), 'dd/MM/yy', { locale: fr });
    } catch {
        return dateString;
    }
}

export default function VisualReport() {
    const [reportData, setReportData] = useState<ExtendedVisualReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const dataString = sessionStorage.getItem('visualReportData');
            if (dataString) {
                setReportData(JSON.parse(dataString));
            }
        } catch (error) {
            console.error("Failed to parse report data from session storage", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handlePrint = () => window.print();

    if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin" /></div>;
    if (!reportData) return <div className="flex items-center justify-center min-h-screen"><AlertCircle className="w-12 h-12" /> No Report Data</div>;

    const { analysis, ai, filters, extra } = reportData;

    const renderDateFilter = () => {
        if (filters.dateRange?.from) return `Période du ${format(new Date(filters.dateRange.from), 'd MMM', { locale: fr })} au ${format(new Date(filters.dateRange.to || filters.dateRange.from), 'd MMM yyyy', { locale: fr })}`;
        if (filters.selectedDate) return `Rapport du ${format(new Date(filters.selectedDate), 'd MMMM yyyy', { locale: fr })}`;
        return "Période non spécifiée";
    };

    const workloadByHourData = (analysis.workloadByHour || []).filter(d => {
        const hour = parseInt(d.hour.split(':')[0]);
        return hour >= 5 && hour <= 23;
    });

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white print:shadow-none font-sans text-gray-800">
            <header className="flex justify-between items-center pb-4 border-b-2 border-black">
                <Logo className="h-42 w-auto" />
                <div className="text-right">
                    <h1 className="text-2xl font-bold">{ai.title}</h1>
                    <p className="text-sm text-gray-500">{renderDateFilter()}</p>
                </div>
            </header>

            <main className="mt-6">
                <div className="no-print flex justify-end mb-6">
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimer / PDF</Button>
                </div>

                {/* --- PAGE 1: Synthesis & KPIs --- */}
                <div className="break-after-page space-y-8">
                    <Card className="bg-blue-50 border-blue-200 print:shadow-none print:border-none">
                        <CardHeader><CardTitle className="text-lg text-blue-900 flex items-center gap-2"><FileText /> Synthèse Globale</CardTitle></CardHeader>
                        <CardContent><p className="text-gray-700 leading-relaxed whitespace-pre-line">{ai.globalSynthesis}</p></CardContent>
                    </Card>

                    <ReportBlock title="Indicateurs Clés (KPIs)" icon={Target} aiComment={ai.kpiComments.punctuality}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Ponctualité'))!} />
                            <KpiCard {...extra.negativeReviewsKpi} />
                            <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Retard'))!} />
                        </div>
                    </ReportBlock>

                    <ReportBlock title="Impact des Écarts sur la Qualité" icon={TrendingUp} aiComment={ai.kpiComments.quality}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(analysis.qualityKpis || []).map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
                        </div>
                    </ReportBlock>

                    <ReportBlock title="Écarts Planifié vs. Réalisé" icon={BarChart2} aiComment={ai.kpiComments.discrepancy}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(analysis.discrepancyKpis || []).filter(k => !k.title.toLowerCase().includes('distance')).map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
                        </div>
                    </ReportBlock>
                    
                    <ReportBlock title="Quantification des Inefficacités" icon={Hourglass} aiComment={ai.kpiComments.inefficiency}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <KpiCard title="Heures de Retard Cumulées" value={`${extra.totalCumulativeDelayHours.toFixed(1)}h`} description="Temps d'attente total subi par les clients." />
                            <KpiCard title="Heures de Service Additionnelles" value={`${extra.totalAdditionalServiceHours.toFixed(1)}h`} description="Temps de travail au-delà de la planification." />
                        </div>
                    </ReportBlock>
                </div>

                {/* --- PAGE 2: Graphical Analysis --- */}
                <div className="break-after-page space-y-8">
                    <ReportBlock title="Analyse de la Charge de Travail" icon={Clock} aiComment={ai.chartsInsights.workloadAnalysis}>
                        <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Charge & Écarts par Heure</CardTitle></CardHeader><CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                                <ComposedChart data={workloadByHourData}>
                                    <XAxis dataKey="hour" fontSize={10} /><YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft', fontSize: 12 }} fontSize={10} /><YAxis yAxisId="right" orientation="right" label={{ value: 'Nb. Écarts', angle: -90, position: 'insideRight', fontSize: 12 }} fontSize={10} /><Tooltip /><Legend />
                                    <Area yAxisId="left" type="monotone" dataKey="planned" name="Planifié" stroke="#a1a1aa" fill="#a1a1aa" fillOpacity={0.3} />
                                    <Area yAxisId="left" type="monotone" dataKey="real" name="Réalisé" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                                    <Line yAxisId="right" type="monotone" dataKey="delays" name="Retards" stroke="hsl(var(--accent))" dot={false} strokeWidth={2} />
                                    <Line yAxisId="right" type="monotone" dataKey="advances" name="Avances" stroke="#2563eb" dot={false} strokeWidth={2} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent></Card>
                    </ReportBlock>
                     <ReportBlock title="Performance par Entrepôt" icon={Warehouse} aiComment={ai.chartsInsights.warehouseOverrun}>
                        <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Top 20% des Entrepôts par Dépassements</CardTitle></CardHeader><CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                                <ComposedChart data={extra.top20percentWarehousesByOverrun}>
                                    <XAxis dataKey="entrepot" fontSize={10} /><YAxis yAxisId="left" label={{ value: 'Poids (kg)', angle: -90, position: 'insideLeft', fontSize: 12 }} fontSize={10} /><YAxis yAxisId="right" orientation="right" label={{ value: 'Temps (h)', angle: -90, position: 'insideRight', fontSize: 12 }} fontSize={10} /><Tooltip /><Legend />
                                    <Bar yAxisId="left" dataKey="totalWeightOverrun" name="Dépassement Poids" fill="hsl(var(--primary))" />
                                    <Line yAxisId="right" type="monotone" dataKey="totalTimeOverrun" name="Dépassement Temps" stroke="hsl(var(--accent))" strokeWidth={2} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent></Card>
                    </ReportBlock>
                </div>

                {/* --- PAGE 3: Detailed Anomalies & Drivers --- */}
                <div className="space-y-8">
                    <ReportBlock title="Analyse Détaillée des Anomalies" icon={Search}>
                        <div className="space-y-6">
                            <Card className="print:shadow-none"><CardHeader>
                                <CardTitle className="text-base flex items-center justify-between"><span><AlertTriangle className="inline mr-2" />Dépassements de Charge</span> <span className="font-bold text-lg text-red-600">{extra.overloadedToursPercentage.toFixed(1)}%</span></CardTitle>
                                <CardDescription>{ai.anomaliesComments.overloaded}</CardDescription></CardHeader><CardContent>
                                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Poids Planifié</TableHead><TableHead>Poids Réel</TableHead></TableRow></TableHeader>
                                    <TableBody>{(extra.top10Overloaded || []).map((t: any, i: number) => (<TableRow key={i}><TableCell>{formatDate(t.date)}</TableCell><TableCell>{t.nom}</TableCell><TableCell>{t.entrepot}</TableCell><TableCell>{t.poidsPrevu.toFixed(2)} kg</TableCell><TableCell className="font-bold text-red-600">{t.poidsReel.toFixed(2)} kg</TableCell></TableRow>))}</TableBody></Table>
                            </CardContent></Card>

                            <Card className="print:shadow-none mt-6"><CardHeader>
                                <CardTitle className="text-base flex items-center justify-between"><span><Timer className="inline mr-2" />Écarts de Durée de Service</span><span className="font-bold text-lg text-red-600">{extra.durationDiscrepancyPercentage.toFixed(1)}%</span></CardTitle>
                                <CardDescription>{ai.anomaliesComments.duration}</CardDescription></CardHeader><CardContent>
                                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Prévu</TableHead><TableHead>Réalisé</TableHead><TableHead>Écart</TableHead></TableRow></TableHeader>
                                    <TableBody>{(extra.top10PositiveDuration || []).map((t: any, i: number) => (<TableRow key={i}><TableCell>{formatDate(t.date)}</TableCell><TableCell>{t.nom}</TableCell><TableCell>{t.entrepot}</TableCell><TableCell>{formatSecondsToClock(t.dureeEstimee)}</TableCell><TableCell>{formatSecondsToClock(t.dureeReelle)}</TableCell><TableCell className="font-bold text-red-600">+{formatSecondsToClock(t.ecart)}</TableCell></TableRow>))}</TableBody></Table>
                            </CardContent></Card>

                            <Card className="print:shadow-none mt-6"><CardHeader>
                                <CardTitle className="text-base flex items-center justify-between"><span><Route className="inline mr-2" />Anomalies de Planification</span><span className="font-bold text-lg text-red-600">{extra.planningAnomalyPercentage.toFixed(1)}%</span></CardTitle>
                                <CardDescription>{ai.anomaliesComments.planning}</CardDescription></CardHeader><CardContent>
                                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Départ Prévu</TableHead><TableHead>Départ Réel</TableHead><TableHead># Tâches en Retard</TableHead></TableRow></TableHeader>
                                    <TableBody>{(extra.top10Anomalies || []).map((t: any, i: number) => (<TableRow key={i}><TableCell>{formatDate(t.date)}</TableCell><TableCell>{t.nom}</TableCell><TableCell>{t.entrepot}</TableCell><TableCell>{formatSecondsToClock(t.heureDepartPrevue)}</TableCell><TableCell className="text-blue-600 font-semibold">{formatSecondsToClock(t.heureDepartReelle)}</TableCell><TableCell className="font-bold">{t.tasksInDelay}</TableCell></TableRow>))}</TableBody></Table>
                            </CardContent></Card>
                        </div>
                    </ReportBlock>
                    
                    <ReportBlock title="Analyse Humaine" icon={Award} aiComment={ai.geoDriverComments.driver}>
                        <Card className="print:shadow-none">
                            <CardHeader><CardTitle className="text-base">Livreurs Exemplaires (Performants malgré la surcharge)</CardTitle></CardHeader>
                            <CardContent>
                                <Table><TableHeader><TableRow><TableHead>Livreur</TableHead><TableHead>Ponctualité</TableHead><TableHead>Nb. Tournées Surchargées</TableHead></TableRow></TableHeader>
                                <TableBody>{(extra.exemplaryDrivers || []).map((d: any, i: number) => (<TableRow key={i}><TableCell>{d.key}</TableCell><TableCell className="font-bold text-green-600">{d.punctualityRate.toFixed(1)}%</TableCell><TableCell>{d.overweightToursCount}</TableCell></TableRow>))}</TableBody></Table>
                            </CardContent>
                        </Card>
                    </ReportBlock>
                </div>
            </main>

            <footer className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
                Rapport généré le {format(new Date(), 'dd/MM/yyyy à HH:mm')}
            </footer>
        </div>
    );
}
