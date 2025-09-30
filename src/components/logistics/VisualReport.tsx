
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
    const [reportData, setReportData] = useState<VisualReportData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        try {
            const dataString = sessionStorage.getItem('visualReportData');
            if (dataString) {
                const parsedData = JSON.parse(dataString);
                // Ensure default values for config if missing
                if (!parsedData.config) {
                    parsedData.config = { sections: {}, filters: { depots: [], warehouses: [] }, tone: 'Neutre et Factuel', selectedWeeks: [] };
                }
                if (!parsedData.config.sections) parsedData.config.sections = {};
                if (!parsedData.config.filters) parsedData.config.filters = { depots: [], warehouses: [] };

                setReportData(parsedData);
            }
        } catch (error) {
            console.error("Failed to parse report data from session storage", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handlePrint = () => window.print();

    if (isLoading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin" /></div>;
    if (!reportData) return <div className="flex flex-col gap-4 items-center justify-center min-h-screen"><AlertCircle className="w-12 h-12 text-destructive" /> <p className='font-semibold'>Aucune Donnée de Rapport Trouvée</p><p className='text-sm text-muted-foreground'>Veuillez retourner au tableau de bord et générer un nouveau rapport.</p></div>;

    const { analysis, ai, filters, extra, config } = reportData;

    const renderFilterSummary = () => {
        const parts = [];
        if (filters.depots?.length > 0) parts.push(`Dépôts: ${filters.depots.join(', ')}`);
        if (filters.warehouses?.length > 0) parts.push(`Entrepôts: ${filters.warehouses.join(', ')}`);
        if (config.selectedWeeks?.length > 0) parts.push(`Semaines: ${config.selectedWeeks.join(', ')}`);

        if (parts.length === 0) return "Filtres: Aucun";
        return `Filtres: ${parts.join(' | ')}`;
    }
    
    const dayOrder = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    const sortedPerformanceByDay = (analysis.performanceByDayOfWeek || []).sort((a,b) => dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day));

    const slotOrder = ['Matin (06-12h)', 'Après-midi (12-18h)', 'Soir (18-00h)'];
    const sortedPerformanceBySlot = (analysis.performanceByTimeSlot || []).sort((a,b) => slotOrder.indexOf(a.slot) - slotOrder.indexOf(b.slot));


    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white print:shadow-none font-sans text-gray-800">
            <header className="flex justify-between items-center pb-4 border-b-2 border-black">
                <Logo className="h-42 w-auto" />
                <div className="text-right">
                    <h1 className="text-2xl font-bold">{ai.title || "Rapport de Performance Opérationnelle"}</h1>
                    <p className="text-sm text-gray-500">{renderFilterSummary()}</p>
                </div>
            </header>

            <main className="mt-6">
                <div className="no-print flex justify-end mb-6">
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimer / PDF</Button>
                </div>

                <div className="space-y-8">
                     <Card className="bg-blue-50 border-blue-200 print:shadow-none print:border-none">
                        <CardHeader><CardTitle className="text-lg text-blue-900 flex items-center gap-2"><FileText /> Synthèse Globale</CardTitle></CardHeader>
                        <CardContent><p className="text-gray-700 leading-relaxed whitespace-pre-line">{ai.globalSynthesis}</p></CardContent>
                    </Card>
                    
                    {config.sections.globalKpis && (
                        <ReportBlock title="Indicateurs Clés (KPIs)" icon={Target} aiComment={ai.kpiComments?.punctuality}>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Ponctualité'))!} />
                                <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Tournées'))!} />
                                <KpiCard {...(analysis.generalKpis || []).find(k => k.title.includes('Retard'))!} />
                                <KpiCard title="% Tournées en Dépassement de Poids" value={`${(extra.overloadedToursPercentage || 0).toFixed(1)}%`} icon="Percent" />
                            </div>
                        </ReportBlock>
                    )}

                    {config.sections.discrepancyAnalysis && (
                        <ReportBlock title="Écarts Planifié vs. Réalisé" icon={BarChart2} aiComment={ai.kpiComments?.discrepancy}>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {(analysis.discrepancyKpis || []).filter(k => !k.title.toLowerCase().includes('distance') && !k.title.toLowerCase().includes('tâches')).map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
                            </div>
                        </ReportBlock>
                    )}

                    {config.sections.qualityImpact && extra.negativeReviewsKpi && (
                         <ReportBlock title="Impact Qualité" icon={Award} aiComment={ai.kpiComments?.quality}>
                            <div className="grid grid-cols-1 gap-4">
                               <KpiCard {...extra.negativeReviewsKpi} />
                            </div>
                        </ReportBlock>
                    )}

                    {config.sections.temporalAnalysis && (
                        <ReportBlock title="Analyse Temporelle" icon={Calendar} aiComment={ai.temporalAnalysisComments?.byDay}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Performance par Jour</CardTitle></CardHeader><CardContent>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <ComposedChart data={sortedPerformanceByDay}>
                                        <XAxis dataKey="day" fontSize={10} /><YAxis yAxisId="left" fontSize={10}/><YAxis yAxisId="right" orientation="right" fontSize={10}/><Tooltip /><Legend wrapperStyle={{fontSize: "10px"}}/>
                                        <Bar yAxisId="left" dataKey="delays" name="Retards" fill={ACCENT_COLOR} /><Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} />
                                        <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </CardContent></Card>
                                <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Performance par Créneau</CardTitle></CardHeader><CardContent>
                                    <ResponsiveContainer width="100%" height={200}>
                                        <ComposedChart data={sortedPerformanceBySlot}>
                                        <XAxis dataKey="slot" fontSize={10}/><YAxis yAxisId="left" fontSize={10}/><YAxis yAxisId="right" orientation="right" fontSize={10}/><Tooltip /><Legend wrapperStyle={{fontSize: "10px"}}/>
                                        <Bar yAxisId="left" dataKey="delays" name="Retards" fill={ACCENT_COLOR} /><Bar yAxisId="left" dataKey="advances" name="Avances" fill={ADVANCE_COLOR} />
                                        <Line yAxisId="right" type="monotone" dataKey="avgDelay" name="Retard Moyen" stroke="#ff7300" dot={false} strokeWidth={2} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                </CardContent></Card>
                            </div>
                        </ReportBlock>
                    )}
                    
                    {config.sections.anomalies && (
                        <ReportBlock title="Analyse des Anomalies" icon={Search} aiComment={ai.anomaliesComments?.overloaded}>
                            <div className="space-y-6">
                                <Card className="print:shadow-none"><CardHeader>
                                    <CardTitle className="text-base flex items-center justify-between"><span><AlertTriangle className="inline mr-2 text-amber-600" />Dépassements de Charge</span> <span className="font-bold text-lg text-red-600">{(extra.overloadedToursPercentage || 0).toFixed(1)}% des tournées</span></CardTitle>
                                    </CardHeader><CardContent>
                                    <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Tournée</TableHead><TableHead>Entrepôt</TableHead><TableHead>Poids Planifié</TableHead><TableHead>Poids Réel</TableHead><TableHead>Dépassement</TableHead></TableRow></TableHeader>
                                        <TableBody>{(extra.top10Overloaded || []).map((t: OverloadedTourInfo, i: number) => (<TableRow key={i}><TableCell>{formatDate(t.date)}</TableCell><TableCell>{t.nom}</TableCell><TableCell>{t.entrepot}</TableCell><TableCell>{t.poidsPrevu.toFixed(2)} kg</TableCell><TableCell className="font-bold text-red-600">{t.poidsReel.toFixed(2)} kg</TableCell><TableCell className="font-bold text-red-600">+{t.depassementPoids.toFixed(2)} kg</TableCell></TableRow>))}</TableBody></Table>
                                </CardContent></Card>
                            </div>
                        </ReportBlock>
                    )}

                    {config.sections.geoAnalysis && (
                        <ReportBlock title="Analyse Géographique & Entrepôt" icon={MapPin} aiComment={ai.geoDriverComments?.warehouse}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="print:shadow-none">
                                    <CardHeader><CardTitle className="text-base">Top 5 Entrepôts par Retards</CardTitle></CardHeader>
                                    <CardContent>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart layout="vertical" data={(analysis.delaysByWarehouse || []).slice(0, 5).reverse()} margin={{ left: 80 }}>
                                                <XAxis type="number" fontSize={10} /><YAxis dataKey="key" type="category" fontSize={10} width={80} /><Tooltip />
                                                <Bar dataKey="count" name="Retards" fill={ACCENT_COLOR} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                                <Card className="print:shadow-none">
                                    <CardHeader><CardTitle className="text-base">Top 5 Villes par Retards</CardTitle></CardHeader>
                                    <CardContent>
                                        <ResponsiveContainer width="100%" height={200}>
                                            <BarChart layout="vertical" data={(analysis.delaysByCity || []).slice(0, 5).reverse()} margin={{ left: 80 }}>
                                                <XAxis type="number" fontSize={10} /><YAxis dataKey="key" type="category" fontSize={10} width={80} /><Tooltip />
                                                <Bar dataKey="count" name="Retards" fill={ACCENT_COLOR} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </CardContent>
                                </Card>
                            </div>
                        </ReportBlock>
                    )}

                    {(config.selectedWeeks?.length || 0) > 0 && reportData.weeklyAnalyses && (
                        <ReportBlock title="Analyse Comparative Hebdomadaire" icon={TrendingUp}>
                           <ComparisonView weeklyAnalyses={reportData.weeklyAnalyses} isForReport={true} />
                        </ReportBlock>
                    )}

                    {ai.recommendations && (
                        <ReportBlock title="Recommandations" icon={Lightbulb}>
                            <Card className="print:shadow-none bg-amber-50 border-amber-200">
                                <CardContent className="pt-6 space-y-4">
                                    {ai.recommendations.planning && (
                                        <div><h4 className="font-semibold">Planification</h4><p className="text-gray-700">{ai.recommendations.planning}</p></div>
                                    )}
                                    {ai.recommendations.operations && (
                                         <div><h4 className="font-semibold">Opérations</h4><p className="text-gray-700">{ai.recommendations.operations}</p></div>
                                    )}
                                    {ai.recommendations.quality && (
                                        <div><h4 className="font-semibold">Qualité de Service</h4><p className="text-gray-700">{ai.recommendations.quality}</p></div>
                                    )}
                                </CardContent>
                            </Card>
                        </ReportBlock>
                    )}
                </div>
            </main>

            <footer className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
                Rapport généré le {format(new Date(), 'dd/MM/yyyy à HH:mm')}
            </footer>
        </div>
    );
}
