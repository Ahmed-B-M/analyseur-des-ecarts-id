'use client';
import { useEffect, useState } from 'react';
import type { VisualReportData, Kpi } from '@/lib/types';
import { Logo } from './Logo';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Printer, Loader2, AlertCircle, Info, Clock, MapPin, Users, Truck, BarChart2, AlertTriangle, Frown, Smile, Sigma, Lightbulb, Package, Route, Target, TrendingDown, ThumbsDown, CheckCircle, Search, FileText } from 'lucide-react';
import { KpiCard } from './KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Separator } from '../ui/separator';

export default function VisualReport() {
    const [reportData, setReportData] = useState<VisualReportData | null>(null);
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
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h3 className="text-xl font-semibold">Chargement du rapport...</h3>
            </div>
        );
    }
    
    if (!reportData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-8">
                <AlertCircle className="w-12 h-12 text-destructive mb-4" />
                <h3 className="text-xl font-semibold">Aucune donnée de rapport trouvée</h3>
                <p className="text-muted-foreground mt-1">Veuillez générer un rapport depuis le tableau de bord principal.</p>
            </div>
        );
    }
    
    const { analysis, ai, filters } = reportData;

    const getFilterValue = (key: string, value: any) => {
        if (!value) return 'N/A';
        if (key === 'dateRange' && typeof value === 'object' && value.from) {
           return `${format(new Date(value.from), 'd MMM yyyy', { locale: fr })} - ${format(new Date(value.to || value.from), 'd MMM yyyy', { locale: fr })}`;
        }
        if (key === 'selectedDate') {
            return format(new Date(value), 'd MMMM yyyy', { locale: fr });
        }
        return value;
    }

    const punctualityKpi = analysis.generalKpis.find(k => k.title.includes('Ponctualité'));
    const ratingKpi = analysis.generalKpis.find(k => k.title.includes('Notation'));

    const isPunctualityOk = punctualityKpi ? parseFloat(punctualityKpi.value) >= 95 : true;
    const isRatingOk = ratingKpi ? parseFloat(ratingKpi.value) >= 4.8 : true;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white print:shadow-none font-sans text-gray-800">
            <header className="flex justify-between items-center pb-4 border-b-2 border-black">
                 <div className="flex items-center gap-6">
                    <Logo className="h-12 w-auto" />
                    <Image src="/carrefour-logo.svg" alt="Carrefour Logo" width={120} height={40} className="object-contain" />
                </div>
                 <div className="text-right">
                    <h1 className="text-2xl font-bold">{ai.title}</h1>
                    <p className="text-sm text-gray-500">
                        Période : {getFilterValue(filters.dateRange ? 'dateRange' : 'selectedDate', filters.dateRange || filters.selectedDate)}
                    </p>
                </div>
            </header>

            <main className="mt-6 space-y-8">
                 {/* Print Button */}
                <div className="no-print flex justify-end">
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimer / Exporter en PDF
                    </Button>
                </div>

                {/* Executive Summary */}
                <Card className="bg-blue-50 border-blue-200 print:shadow-none print:border-none">
                    <CardHeader>
                        <CardTitle className="text-lg text-blue-900 flex items-center gap-2"><FileText /> Synthèse Managériale</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-700 leading-relaxed">{ai.executiveSummary}</p>
                    </CardContent>
                </Card>

                {/* Main KPIs Section */}
                <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Target/> Analyse des Indicateurs Clés (KPIs)</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className={`print:shadow-none ${isPunctualityOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Ponctualité</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{punctualityKpi?.value}</p>
                                <p className="text-xs text-muted-foreground">Objectif: 95%</p>
                            </CardContent>
                        </Card>
                        <Card className={`print:shadow-none ${isRatingOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Notation Client</CardTitle></CardHeader>
                            <CardContent>
                                <p className="text-3xl font-bold">{ratingKpi?.value}</p>
                                <p className="text-xs text-muted-foreground">Objectif: 4.8/5</p>
                            </CardContent>
                        </Card>
                         <KpiCard {...analysis.generalKpis.find(k=>k.title.includes('Retard'))!} />
                         <KpiCard {...analysis.generalKpis.find(k=>k.title.includes('Avance'))!} />
                    </div>
                    <div className="mt-4 bg-gray-50 p-4 rounded-lg border">
                        <p className="text-sm leading-relaxed"><span className="font-semibold text-gray-700">Analyse :</span> {ai.kpiAnalysis.punctuality} {ai.kpiAnalysis.rating} {ai.kpiAnalysis.delays}</p>
                    </div>
                </section>
                
                <Separator/>

                {/* Anomalies Section */}
                <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Search/> Analyse des Anomalies Opérationnelles</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                             <KpiCard icon="AlertTriangle" title="Tournées en Surcharge" value={analysis.overloadedTours.length.toString()} description="Dépassement de poids ou volume"/>
                             {ai.anomaliesAnalysis.overload && <p className="text-sm mt-2 p-2 bg-gray-50 rounded border">{ai.anomaliesAnalysis.overload}</p>}
                        </div>
                        <div>
                             <KpiCard icon="Route" title="Anomalies de Planification" value={analysis.lateStartAnomalies.length.toString()} description="Parties à l'heure, livrées en retard"/>
                             {ai.anomaliesAnalysis.planning && <p className="text-sm mt-2 p-2 bg-gray-50 rounded border">{ai.anomaliesAnalysis.planning}</p>}
                        </div>
                    </div>
                </section>

                <Separator/>

                {/* Geo & Driver Analysis */}
                <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><MapPin/> Analyse Géographique et par Livreur</h2>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="font-semibold mb-2">Performance par Ville</h3>
                            <Card className="print:shadow-none">
                                <CardContent className="pt-4">
                                     <ResponsiveContainer width="100%" height={200}>
                                        <BarChart data={analysis.delaysByCity.slice(0,5).reverse()} layout="vertical" margin={{ left: 80, right: 20 }}>
                                            <XAxis type="number" fontSize={10} />
                                            <YAxis dataKey="key" type="category" fontSize={10} tickLine={false} axisLine={false} />
                                            <Tooltip />
                                            <Bar dataKey="count" name="Retards" barSize={15} fill={'#E4002B'} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                            {ai.geoDriverAnalysis.city && <p className="text-sm mt-2 p-2 bg-gray-50 rounded border">{ai.geoDriverAnalysis.city}</p>}
                        </div>
                         <div>
                            <h3 className="font-semibold mb-2">Performance par Livreur</h3>
                            <p className="text-sm p-2 bg-gray-50 rounded border">{ai.geoDriverAnalysis.driver || "Aucune anomalie majeure par livreur."}</p>
                        </div>
                    </div>
                </section>

                <Separator/>

                {/* Customer Impact */}
                <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><TrendingDown/> Impact sur la Qualité Client</h2>
                     <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                        <p className="text-sm leading-relaxed">{ai.customerImpactAnalysis.mainReason}</p>
                     </div>
                </section>
                
                <Separator/>

                {/* Conclusion & Recommendations */}
                <section>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Lightbulb/> Conclusion et Recommandations</h2>
                    <Card className="print:shadow-none bg-gray-50/50">
                        <CardHeader>
                            <CardTitle className="text-base">Problèmes Principaux Identifiés</CardTitle>
                        </CardHeader>
                        <CardContent>
                             <p className="text-sm">{ai.conclusion.summary}</p>
                        </CardContent>
                    </Card>
                     <Card className="mt-4 print:shadow-none bg-green-50/50 border-green-200">
                        <CardHeader>
                            <CardTitle className="text-base">Plan d'Action Recommandé</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ul className="list-disc pl-5 space-y-2 text-sm">
                                {ai.conclusion.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                            </ul>
                        </CardContent>
                    </Card>
                </section>

            </main>
            <footer className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
                Rapport généré le {format(new Date(), 'dd/MM/yyyy à HH:mm')}
            </footer>
        </div>
    );
}
