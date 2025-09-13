'use client';
import { useEffect, useState } from 'react';
import type { VisualReportData, OverloadedTourInfo, DurationDiscrepancy, LateStartAnomaly, Kpi } from '@/lib/types';
import { Logo } from './Logo';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Printer, Loader2, AlertCircle, FileText, Target, Search, MapPin, Users, BarChart2, Calendar, Clock, Sigma, AlertTriangle, Timer, Route, Warehouse, Award, TrendingUp } from 'lucide-react';
import { KpiCard, ComparisonKpiCard } from './KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, CartesianGrid, Legend, Line, Area } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from '../ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

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
    }
}

// Reusable component for report sections with AI commentary
const ReportBlock = ({ title, icon: Icon, aiComment, children }: { title: string, icon: React.ElementType, aiComment?: string, children: React.ReactNode }) => (
    <section className="break-after-page">
        <div className="flex items-start gap-3 mb-4">
            <Icon className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
            <div>
                <h2 className="text-xl font-bold">{title}</h2>
                {aiComment && <p className="text-sm text-gray-600 italic">"{aiComment}"</p>}
            </div>
        </div>
        {children}
    </section>
);

// Helper to format seconds into HH:MM
function formatSecondsToClock(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="w-12 h-12 animate-spin" /></div>;
    }
    
    if (!reportData) {
        return <div className="flex items-center justify-center min-h-screen"><AlertCircle className="w-12 h-12" /> No Report Data</div>;
    }
    
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
                <div className="flex items-center gap-6">
                    <Logo className="h-12 w-auto" />
                </div>
                <div className="text-right">
                    <h1 className="text-2xl font-bold">{ai.title}</h1>
                    <p className="text-sm text-gray-500">{renderDateFilter()}</p>
                </div>
            </header>

            <main className="mt-6 space-y-10">
                <div className="no-print flex justify-end">
                    <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimer / PDF</Button>
                </div>

                <Card className="bg-blue-50 border-blue-200 print:shadow-none print:border-none">
                    <CardHeader><CardTitle className="text-lg text-blue-900 flex items-center gap-2"><FileText /> Synthèse Managériale</CardTitle></CardHeader>
                    <CardContent><p className="text-gray-700 leading-relaxed">{ai.executiveSummary}</p></CardContent>
                </Card>

                <ReportBlock title="Indicateurs Clés (KPIs)" icon={Target} aiComment={`${ai.kpiComments.punctuality} ${ai.kpiComments.rating}`}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <KpiCard {...(analysis.generalKpis || []).find(k=>k.title.includes('Ponctualité'))!} />
                        <KpiCard {...extra.negativeReviewsKpi} />
                        <KpiCard {...(analysis.generalKpis || []).find(k=>k.title.includes('Retard'))!} />
                    </div>
                </ReportBlock>

                <ReportBlock title="Écarts Planifié vs. Réalisé" icon={BarChart2}>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {(analysis.discrepancyKpis || []).filter(k=>!k.title.toLowerCase().includes('distance')).map(kpi => <ComparisonKpiCard key={kpi.title} {...kpi} />)}
                    </div>
                </ReportBlock>
                
                <Separator/>

                <ReportBlock title="Analyse de la Charge de Travail" icon={Clock} aiComment={ai.chartsInsights.workloadAnalysis}>
                    <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base">Charge & Retards par Heure</CardTitle></CardHeader><CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                             <ComposedChart data={workloadByHourData}>
                               <XAxis dataKey="hour" fontSize={10} /><YAxis yAxisId="left" fontSize={10}/><YAxis yAxisId="right" orientation="right" fontSize={10} /><Tooltip/><Legend/>
                               <Area yAxisId="left" type="monotone" dataKey="planned" name="Planifié" stroke="#a1a1aa" fill="#a1a1aa" fillOpacity={0.3} />
                               <Area yAxisId="left" type="monotone" dataKey="real" name="Réalisé" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                               <Line yAxisId="right" type="monotone" dataKey="delays" name="Retards" stroke="#ef4444" dot={false} strokeWidth={2}/>
                             </ComposedChart>
                        </ResponsiveContainer>
                    </CardContent></Card>
                </ReportBlock>

                <Separator/>

                <ReportBlock title="Analyse des Anomalies de Tournées" icon={Search}>
                    <ScrollArea className="h-[400px] space-y-6 pr-4">
                        <Card className="print:shadow-none"><CardHeader>
                            <CardTitle className="text-base flex items-center justify-between"><span><AlertTriangle className="inline mr-2"/>Dépassements de Charge</span> <span className="font-bold text-lg text-red-600">{extra.overloadedToursPercentage.toFixed(1)}%</span></CardTitle>
                            <CardDescription>{ai.anomaliesComments.overloaded}</CardDescription></CardHeader><CardContent>
                            <Table><TableHeader><TableRow><TableHead>Tournée</TableHead><TableHead>Livreur</TableHead><TableHead>% Dépassement</TableHead></TableRow></TableHeader>
                            <TableBody>{(extra.top10Overloaded || []).map((t:any,i:number)=>(<TableRow key={i}><TableCell>{t.nom}</TableCell><TableCell>{t.livreur}</TableCell><TableCell className="font-bold text-red-600">+{t.tauxDepassementPoids.toFixed(1)}%</TableCell></TableRow>))}</TableBody></Table>
                        </CardContent></Card>

                        <Card className="print:shadow-none mt-6"><CardHeader>
                             <CardTitle className="text-base flex items-center justify-between"><span><Timer className="inline mr-2"/>Écarts de Durée de Service</span><span className="font-bold text-lg text-red-600">{extra.durationDiscrepancyPercentage.toFixed(1)}%</span></CardTitle>
                            <CardDescription>{ai.anomaliesComments.duration}</CardDescription></CardHeader><CardContent>
                             <Table><TableHeader><TableRow><TableHead>Tournée</TableHead><TableHead>Prévu</TableHead><TableHead>Réalisé</TableHead><TableHead>Écart</TableHead></TableRow></TableHeader>
                             <TableBody>{(extra.top10PositiveDuration || []).map((t:any, i:number)=>(<TableRow key={i}><TableCell>{t.nom}</TableCell><TableCell>{formatSecondsToClock(t.dureeEstimee)}</TableCell><TableCell>{formatSecondsToClock(t.dureeReelle)}</TableCell><TableCell className="font-bold text-red-600">+{formatSecondsToClock(t.ecart)}</TableCell></TableRow>))}</TableBody></Table>
                        </CardContent></Card>

                         <Card className="print:shadow-none mt-6"><CardHeader>
                            <CardTitle className="text-base flex items-center justify-between"><span><Route className="inline mr-2"/>Anomalies de Planification</span><span className="font-bold text-lg text-red-600">{extra.planningAnomalyPercentage.toFixed(1)}%</span></CardTitle>
                            <CardDescription>{ai.anomaliesComments.planning}</CardDescription></CardHeader><CardContent>
                             <Table><TableHeader><TableRow><TableHead>Tournée</TableHead><TableHead>Départ Prévu</TableHead><TableHead>Départ Réel</TableHead><TableHead># Tâches en Retard</TableHead></TableRow></TableHeader>
                            <TableBody>{(extra.top10Anomalies || []).map((t:any, i:number)=>(<TableRow key={i}><TableCell>{t.nom}</TableCell><TableCell>{formatSecondsToClock(t.heureDepartPrevue)}</TableCell><TableCell className="text-blue-600 font-semibold">{formatSecondsToClock(t.heureDepartReelle)}</TableCell><TableCell className="font-bold">{t.tasksInDelay}</TableCell></TableRow>))}</TableBody></Table>
                        </CardContent></Card>
                    </ScrollArea>
                </ReportBlock>
                
                <Separator/>

                <ReportBlock title="Analyse Géographique & Humaine" icon={MapPin}>
                     <div className="space-y-6">
                        <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Warehouse/>Performance par Entrepôt</CardTitle><CardDescription>{ai.geoDriverComments.warehouse}</CardDescription></CardHeader><CardContent>
                           <ResponsiveContainer width="100%" height={200}><BarChart data={(analysis.delaysByWarehouse || []).slice(0,5).reverse()} layout="vertical" margin={{ left: 80, right: 20 }}><XAxis type="number" fontSize={10} /><YAxis dataKey="key" type="category" fontSize={10} width={100}/><Tooltip /><Bar dataKey="count" name="Retards" barSize={15} fill={'hsl(var(--primary))'} /></BarChart></ResponsiveContainer>
                        </CardContent></Card>
                        
                        <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin/>Performance par Ville</CardTitle><CardDescription>{ai.geoDriverComments.city}</CardDescription></CardHeader><CardContent>
                           <ResponsiveContainer width="100%" height={200}><BarChart data={(analysis.delaysByCity || []).slice(0,5).reverse()} layout="vertical" margin={{ left: 80, right: 20 }}><XAxis type="number" fontSize={10} /><YAxis dataKey="key" type="category" fontSize={10}/><Tooltip /><Bar dataKey="count" name="Retards" barSize={15} fill={'hsl(var(--primary))'} /></BarChart></ResponsiveContainer>
                        </CardContent></Card>

                         <Card className="print:shadow-none"><CardHeader><CardTitle className="text-base flex items-center gap-2"><Award/>Livreurs Exemplaires (Performants malgré la surcharge)</CardTitle><CardDescription>{ai.geoDriverComments.driver}</CardDescription></CardHeader><CardContent>
                            <Table><TableHeader><TableRow><TableHead>Livreur</TableHead><TableHead>Ponctualité</TableHead><TableHead>Nb. Tournées Surchargées</TableHead></TableRow></TableHeader>
                             <TableBody>{(extra.exemplaryDrivers || []).map((d:any, i:number)=>(<TableRow key={i}><TableCell>{d.key}</TableCell><TableCell className="font-bold text-green-600">{d.punctualityRate.toFixed(1)}%</TableCell><TableCell>{d.overweightToursCount}</TableCell></TableRow>))}</TableBody></Table>
                        </CardContent></Card>
                    </div>
                </ReportBlock>

            </main>
            <footer className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
                Rapport généré le {format(new Date(), 'dd/MM/yyyy à HH:mm')}
            </footer>
        </div>
    );
}
