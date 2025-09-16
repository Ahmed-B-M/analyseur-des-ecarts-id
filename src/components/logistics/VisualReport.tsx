
'use client';
import { useEffect, useState } from 'react';
import type { VisualReportData, Kpi, OverloadedTourInfo, WeeklyAnalysis, DepotWeeklyAnalysis, PerformanceByGroup } from '@/lib/types';
import { Logo } from './Logo';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Printer, Loader2, AlertCircle, FileText, Target, Search, MapPin, BarChart2, Calendar, Clock, AlertTriangle, Timer, Route, Warehouse, Award, TrendingUp, Hourglass, Lightbulb, Info, Users, Sigma, Percent, ArrowDown, ArrowUp } from 'lucide-react';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Legend, Line, Area, Cell } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import ComparisonView from './ComparisonView';
import DepotComparison from './DepotComparison';

type ExtendedVisualReportData = VisualReportData & {
    extra: {
        negativeReviewsKpi: Kpi;
        overloadedToursPercentage: number;
        durationDiscrepancyPercentage: number;
        planningAnomalyPercentage: number;
        exemplaryDrivers: any[];
        top10PositiveDuration: any[];
        top10Anomalies: any[];
        top10Overloaded: OverloadedTourInfo[];
        totalCumulativeDelayHours: number;
        totalAdditionalServiceHours: number;
        top20percentWarehousesByOverrun: any[];
        firstTaskLatePercentage: number;
        weeklyAnalyses: WeeklyAnalysis[];
        depotWeeklyAnalyses: DepotWeeklyAnalysis[];
        depots: string[];
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

function formatSecondsToTime(seconds: number): string {
    const isNegative = seconds < 0;
    seconds = Math.abs(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return `${isNegative ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
        return format(new Date(dateString), 'dd/MM/yy', { locale: fr });
    } catch {
        return dateString;
    }
}

const PRIMARY_COLOR = "hsl(var(--primary))";
const ACCENT_COLOR = "hsl(var(--accent))";
const ADVANCE_COLOR = "hsl(210 100% 56%)"; // A distinct blue for "advance"


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
        if (filters.dateRange?.from && filters.dateRange?.to) return `Période du ${format(new Date(filters.dateRange.from), 'd MMM', { locale: fr })} au ${format(new Date(filters.dateRange.to), 'd MMM yyyy', { locale: fr })}`;
        if (filters.selectedDate) return `Rapport du ${format(new Date(filters.selectedDate), 'd MMMM yyyy', { locale: fr })}`;
        return "Période non spécifiée";
    };

    const workloadByHourData = (analysis.workloadByHour || []).filter(d => {
        const hour = parseInt(d.hour.split(':')[0]);
        return hour >= 5 && hour <= 23;
    });
    
    const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const sortedPerformanceByDay = (analysis.performanceByDayOfWeek || []).sort((a,b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

    const slotOrder = ['Matin (06-12h)', 'Après-midi (12-18h)', 'Soir (18-00h)'];
    const sortedPerformanceBySlot = (analysis.performanceByTimeSlot || []).sort((a,b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot));


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
                <Alert className="no-print mb-6">
                  <Info className="h-4 w-4" />
                  <AlertTitle>Conseils d'utilisation</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                        <li>Cliquez sur **Imprimer / PDF** pour générer un fichier PDF de haute qualité, idéal pour l'archivage et le partage.</li>
                        <li>Pour une consultation future interactive (graphiques), sauvegardez cette page via `Fichier > Enregistrer la page sous...` dans votre navigateur.</li>
                    </ul>
                  </AlertDescription>
                </Alert>


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
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Ponctualité'))!} />
                             <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Tournées'))!} />
                            <KpiCard {...extra.negativeReviewsKpi} />
                            <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Retard'))!} />
                            <KpiCard title="% Tournées en Dépassement de Poids" value={`${extra.overloadedToursPercentage.toFixed(1)}%`} icon="Percent" description="Tournées dépassant la capacité de poids." />
                            <KpiCard title="% Anomalies 1ère Tâche" value={`${extra.firstTaskLatePercentage.toFixed(1)}%`} icon="Percent" description="Parti à l'heure, 1ère livraison en retard." />
                        </div>
                    </ReportBlock>

                    <ReportBlock title="Écarts Planifié vs. Réalisé" icon={BarChart2} aiComment={ai.kpiComments.discrepancy}>
                        <Card className="print:shadow-none mb-4">
                            <CardHeader><CardTitle className="text-base">Synthèse des Écarts Globaux</CardTitle></CardHeader>
                            <CardContent>
                                <Table>
                                    <TableBody>
                                        <TableRow><TableCell className="font-medium">Taux Ponctualité Planifié</TableCell><TableCell className="text-right font-semibold">{analysis.globalSummary.punctualityRatePlanned.toFixed(1)}%</TableCell></TableRow>
                                        <TableRow><TableCell className="font-medium">Taux Ponctualité Réalisé</TableCell><TableCell className="text-right font-semibold">{analysis.globalSummary.punctualityRateRealized.toFixed(1)}%</TableCell></TableRow>
                                        <TableRow><TableCell className="font-medium">Écart Durée Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{formatSecondsToTime(analysis.globalSummary.avgDurationDiscrepancyPerTour)}</TableCell></TableRow>
                                        <TableRow><TableCell className="font-medium">Écart Poids Moyen / Tournée</TableCell><TableCell className="text-right font-semibold">{analysis.globalSummary.avgWeightDiscrepancyPerTour.toFixed(2)} kg</TableCell></TableRow>
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(analysis.discrepancyKpis || []).filter(k => !k.title.toLowerCase().includes('distance') && !k.title.toLowerCase().includes('tâches')).map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
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
                     <ReportBlock title="Analyse de la Charge & Performance Globale" icon={Clock} aiComment={ai.chartsInsights.workloadAnalysis}>
                        <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Charge & Écarts par Heure</CardTitle></CardHeader><CardContent>
                            <ResponsiveContainer width="100%" height={250}>
                                <ComposedChart data={workloadByHourData}>
                                    <XAxis dataKey="hour" fontSize={10} /><YAxis yAxisId="left" label={{ value: 'Nb. Tâches', angle: -90, position: 'insideLeft', fontSize: 12 }} fontSize={10} /><YAxis yAxisId="right" orientation="right" label={{ value: 'Nb. Écarts', angle: -90, position: 'insideRight', fontSize: 12 }} fontSize={10} /><Tooltip /><Legend />
                                    <Area yAxisId="left" type="monotone" dataKey="planned" name="Planifié" stroke={ACCENT_COLOR} fill={ACCENT_COLOR} fillOpacity={0.3} />
                                    <Area yAxisId="left" type="monotone" dataKey="real" name="Réalisé" stroke={PRIMARY_COLOR} fill={PRIMARY_COLOR} fillOpacity={0.3} />
                                    <Line yAxisId="right" type="monotone" dataKey="delays" name="Retards" stroke={ACCENT_COLOR} dot={false} strokeWidth={2} />
                                    <Line yAxisId="right" type="monotone" dataKey="advances" name="Avances" stroke={ADVANCE_COLOR} dot={false} strokeWidth={2} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </CardContent></Card>
                    </ReportBlock>
                     <ReportBlock title="Analyse Temporelle Détaillée" icon={Calendar} aiComment={ai.temporalAnalysisComments.byDay}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Performance par Jour</CardTitle></CardHeader><CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                     <ComposedChart data={sortedPerformanceByDay}>
                                       <XAxis dataKey="day" fontSize={10} />
                                       <YAxis yAxisId="left" label={{ value: 'Nb. Écarts', angle: -90, position: 'insideLeft', fontSize: 10, offset: 10 }} fontSize={10}/>
                                       <YAxis yAxisId="right" orientation="right" label={{ value: 'Retard Moyen (min)', angle: -90, position: 'insideRight', fontSize: 10, offset: 10 }} fontSize={10}/>
                                       <Tooltip />
                                       <Legend wrapperStyle={{fontSize: "10px"}}/>
                                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={ACCENT_COLOR} />
                                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} />
                                       <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                                     </ComposedChart>
                                </ResponsiveContainer>
                            </CardContent></Card>
                            <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Performance par Créneau</CardTitle><CardDescription>{ai.temporalAnalysisComments.bySlot}</CardDescription></CardHeader><CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                     <ComposedChart data={sortedPerformanceBySlot}>
                                       <XAxis dataKey="slot" fontSize={10}/>
                                       <YAxis yAxisId="left" label={{ value: 'Nb. Écarts', angle: -90, position: 'insideLeft', fontSize: 10, offset: 10 }} fontSize={10}/>
                                       <YAxis yAxisId="right" orientation="right" label={{ value: 'Retard Moyen (min)', angle: -90, position: 'insideRight', fontSize: 10, offset: 10 }} fontSize={10}/>
                                       <Tooltip />
                                       <Legend wrapperStyle={{fontSize: "10px"}}/>
                                       <Bar yAxisId="left" dataKey="delays" name="Retards" fill={ACCENT_COLOR} />
                                       <Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} />
                                       <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                                     </ComposedChart>
                                </ResponsiveContainer>
                            </CardContent></Card>
                        </div>
                    </ReportBlock>
                     <ReportBlock title="Répartition des Écarts" icon={Sigma} aiComment={ai.temporalAnalysisComments.histogram}>
                        <Card className="print:shadow-none"><CardContent className="pt-6">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={analysis.delayHistogram}>
                                    <XAxis dataKey="range" fontSize={10} angle={-30} textAnchor="end" height={50} />
                                    <YAxis fontSize={10}/>
                                    <Tooltip />
                                    <Bar dataKey="count" name="Nb. de Tâches">
                                      {(analysis.delayHistogram || []).map((entry, index) => (
                                         <Cell key={`cell-${index}`} fill={entry.range.includes('retard') ? ACCENT_COLOR : entry.range.includes('avance') ? ADVANCE_COLOR : '#a0aec0'} />
                                      ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent></Card>
                    </ReportBlock>
                </div>

                {/* --- PAGE 3: Detailed Anomalies --- */}
                <div className="break-after-page space-y-8">
                    <ReportBlock title="Analyse Détaillée des Anomalies" icon={Search}>
                        <div className="space-y-6">
                            <Card className="print:shadow-none"><CardHeader>
                                <CardTitle className="text-base flex items-center justify-between"><span><AlertTriangle className="inline mr-2 text-amber-600" />Dépassements de Charge</span> <span className="font-bold text-lg text-red-600">{extra.overloadedToursPercentage.toFixed(1)}% des tournées</span></CardTitle>
                                <CardDescription>{ai.anomaliesComments.overloaded}</CardDescription></CardHeader><CardContent>
                                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Poids Planifié</TableHead><TableHead>Poids Réel</TableHead><TableHead>Dépassement</TableHead></TableRow></TableHeader>
                                    <TableBody>{(extra.top10Overloaded || []).map((t: OverloadedTourInfo, i: number) => (<TableRow key={i}><TableCell>{formatDate(t.date)}</TableCell><TableCell>{t.nom}</TableCell><TableCell>{t.entrepot}</TableCell><TableCell>{t.poidsPrevu.toFixed(2)} kg</TableCell><TableCell className="font-bold text-red-600">{t.poidsReel.toFixed(2)} kg</TableCell><TableCell className="font-bold text-red-600">+{t.depassementPoids.toFixed(2)} kg</TableCell></TableRow>))}</TableBody></Table>
                            </CardContent></Card>

                            <Card className="print:shadow-none mt-6"><CardHeader>
                                <CardTitle className="text-base flex items-center justify-between"><span><Timer className="inline mr-2 text-blue-600" />Écarts de Durée de Service</span><span className="font-bold text-lg text-red-600">{extra.durationDiscrepancyPercentage.toFixed(1)}% des tournées</span></CardTitle>
                                <CardDescription>{ai.anomaliesComments.duration}</CardDescription></CardHeader><CardContent>
                                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Prévu</TableHead><TableHead>Réalisé</TableHead><TableHead>Écart</TableHead></TableRow></TableHeader>
                                    <TableBody>{(extra.top10PositiveDuration || []).map((t: any, i: number) => (<TableRow key={i}><TableCell>{formatDate(t.date)}</TableCell><TableCell>{t.nom}</TableCell><TableCell>{t.entrepot}</TableCell><TableCell>{formatSecondsToClock(t.dureeEstimee)}</TableCell><TableCell>{formatSecondsToClock(t.dureeReelle)}</TableCell><TableCell className="font-bold text-red-600">+{formatSecondsToClock(t.ecart)}</TableCell></TableRow>))}</TableBody></Table>
                            </CardContent></Card>

                            <Card className="print:shadow-none mt-6"><CardHeader>
                                <CardTitle className="text-base flex items-center justify-between"><span><Route className="inline mr-2 text-violet-600" />Anomalies de Planification</span><span className="font-bold text-lg text-red-600">{extra.planningAnomalyPercentage.toFixed(1)}% des tournées</span></CardTitle>
                                <CardDescription>{ai.anomaliesComments.planning}</CardDescription></CardHeader><CardContent>
                                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Départ Prévu</TableHead><TableHead>Départ Réel</TableHead><TableHead># Tâches en Retard</TableHead></TableRow></TableHeader>
                                    <TableBody>{(extra.top10Anomalies || []).map((t: any, i: number) => (<TableRow key={i}><TableCell>{formatDate(t.date)}</TableCell><TableCell>{t.nom}</TableCell><TableCell>{t.entrepot}</TableCell><TableCell>{formatSecondsToClock(t.heureDepartPrevue)}</TableCell><TableCell className="text-blue-600 font-semibold">{formatSecondsToClock(t.heureDepartReelle)}</TableCell><TableCell className="font-bold">{t.tasksInDelay}</TableCell></TableRow>))}</TableBody></Table>
                            </CardContent></Card>
                        </div>
                    </ReportBlock>
                </div>
                 {/* --- PAGE 4: Geo, Drivers --- */}
                <div className="break-after-page space-y-8">
                     <ReportBlock title="Analyse Géographique & Performance Entrepôt" icon={MapPin}>
                         <Card className="print:shadow-none mb-6">
                            <CardHeader><CardTitle className="text-base">Synthèse IA par Zone</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                <h4 className="font-semibold">Entrepôts</h4>
                                <p className="text-sm text-gray-600 italic">"{ai.geoDriverComments.warehouse}"</p>
                                <h4 className="font-semibold mt-4">Villes</h4>
                                <p className="text-sm text-gray-600 italic">"{ai.geoDriverComments.city}"</p>
                            </CardContent>
                        </Card>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Card className="print:shadow-none">
                                <CardHeader><CardTitle className="text-base">Top 20% Entrepôts par Dépassements</CardTitle><CardDescription>{ai.chartsInsights.warehouseOverrun}</CardDescription></CardHeader>
                                <CardContent>
                                     <ResponsiveContainer width="100%" height={200}>
                                        <ComposedChart data={extra.top20percentWarehousesByOverrun}>
                                            <XAxis dataKey="entrepot" fontSize={10} /><YAxis yAxisId="left" label={{ value: 'Poids (kg)', angle: -90, position: 'insideLeft', fontSize: 12 }} fontSize={10} /><YAxis yAxisId="right" orientation="right" label={{ value: 'Temps (h)', angle: -90, position: 'insideRight', fontSize: 12 }} fontSize={10} /><Tooltip /><Legend />
                                            <Bar yAxisId="left" dataKey="totalWeightOverrun" name="Dépassement Poids" fill={PRIMARY_COLOR} />
                                            <Line yAxisId="right" type="monotone" dataKey="totalTimeOverrun" name="Dépassement Temps" stroke={ACCENT_COLOR} strokeWidth={2} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                             <Card className="print:shadow-none">
                                <CardHeader><CardTitle className="text-base">Top 5 Villes par Retards</CardTitle></CardHeader>
                                <CardContent>
                                     <ResponsiveContainer width="100%" height={200}>
                                        <BarChart layout="vertical" data={(analysis.delaysByCity || []).slice(0, 5).reverse()} margin={{ left: 80 }}>
                                            <XAxis type="number" fontSize={10} />
                                            <YAxis dataKey="key" type="category" fontSize={10} width={80} />
                                            <Tooltip />
                                            <Bar dataKey="count" name="Retards" fill={ACCENT_COLOR} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </ReportBlock>

                     <ReportBlock title="Analyse des Livreurs" icon={Users} aiComment={ai.geoDriverComments.driver}>
                        <Card className="print:shadow-none">
                            <CardHeader>
                                <CardTitle className="text-base">Livreurs Exemplaires (Performants malgré la surcharge)</CardTitle>
                            </CardHeader>
                             <CardContent>
                                 <ResponsiveContainer width="100%" height={200}>
                                    <ComposedChart data={extra.exemplaryDrivers || []}>
                                        <XAxis dataKey="key" fontSize={10} />
                                        <YAxis yAxisId="left" dataKey="punctualityRate" domain={[80, 100]} label={{ value: 'Ponctualité (%)', angle: -90, position: 'insideLeft', fontSize: 12 }} fontSize={10} />
                                        <YAxis yAxisId="right" orientation="right" label={{ value: 'Nb. Tournées Surchargées', angle: -90, position: 'insideRight', fontSize: 12 }} fontSize={10} />
                                        <Tooltip />
                                        <Legend />
                                        <Bar yAxisId="right" dataKey="overweightToursCount" name="Tournées Surchargées" fill="#a1a1aa" />
                                        <Line yAxisId="left" type="monotone" dataKey="punctualityRate" name="Ponctualité" stroke={PRIMARY_COLOR} strokeWidth={2} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </ReportBlock>
                </div>
                 {/* --- PAGE 5: Weekly Comparison --- */}
                <div className="break-after-page space-y-8">
                     <ReportBlock title="Analyse Comparative Hebdomadaire" icon={TrendingUp}>
                        <ComparisonView weeklyAnalyses={extra.weeklyAnalyses} isForReport={true} />
                     </ReportBlock>
                </div>

                {/* --- PAGE 6: Depot Comparison --- */}
                <div className="break-after-page space-y-8">
                     <ReportBlock title="Analyse Comparative par Dépôt" icon={Warehouse}>
                        <DepotComparison depotWeeklyAnalyses={extra.depotWeeklyAnalyses} isForReport={true} />
                    </ReportBlock>
                </div>

                {/* --- PAGE 7: Recommendations --- */}
                <div className="space-y-8">
                     <ReportBlock title="Recommandations" icon={Lightbulb}>
                        <Card className="print:shadow-none bg-amber-50 border-amber-200">
                            <CardContent className="pt-6 space-y-4">
                                <div>
                                    <h4 className="font-semibold">Planification</h4>
                                    <p className="text-gray-700">{ai.recommendations.planning}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold">Opérations</h4>
                                    <p className="text-gray-700">{ai.recommendations.operations}</p>
                                </div>
                                <div>
                                    <h4 className="font-semibold">Qualité de Service</h4>
                                    <p className="text-gray-700">{ai.recommendations.quality}</p>
                                </div>
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
