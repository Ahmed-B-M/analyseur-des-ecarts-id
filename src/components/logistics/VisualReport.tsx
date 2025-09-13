'use client';
import { useEffect, useState } from 'react';
import type { VisualReportData, Kpi } from '@/lib/types';
import { Logo } from './Logo';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Printer, Loader2, AlertCircle, Info, Clock, MapPin, Users, Truck, BarChart2, AlertTriangle, Frown, Smile, Sigma } from 'lucide-react';
import { KpiCard } from './KpiCard';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const iconMap = {
    Clock: Clock,
    MapPin: MapPin,
    Users: Users,
    Truck: Truck,
    BarChart2: BarChart2,
    AlertTriangle: AlertTriangle,
};

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

    const mainKpis = analysis.generalKpis.filter(kpi => 
        ['Tournées Analysées', 'Livraisons Analysées', 'Taux de Ponctualité (Réalisé)', 'Notation Moyenne Client'].includes(kpi.title)
    );
    const secondaryKpis = analysis.generalKpis.filter(kpi => 
        ['Livraisons en Retard', 'Livraisons en Avance', 'Avis Négatifs'].includes(kpi.title)
    );

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

    const punctualityKpi = mainKpis.find(k => k.title.includes('Ponctualité'));
    const ratingKpi = mainKpis.find(k => k.title.includes('Notation'));

    const isPunctualityOk = punctualityKpi ? parseFloat(punctualityKpi.value) >= 95 : true;
    const isRatingOk = ratingKpi ? parseFloat(ratingKpi.value) >= 4.8 : true;

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white print:shadow-none">
            <header className="flex justify-between items-center pb-4 border-b-2 border-black">
                 <div className="flex items-center gap-6">
                    <Logo className="h-12 w-auto" />
                    <Image src="/carrefour-logo.svg" alt="Carrefour Logo" width={120} height={40} className="object-contain" />
                </div>
                 <div className="text-right">
                    <h1 className="text-2xl font-bold text-gray-800">{ai.title}</h1>
                    <p className="text-sm text-gray-500">
                        Période : {getFilterValue(filters.dateRange ? 'dateRange' : 'selectedDate', filters.dateRange || filters.selectedDate)}
                    </p>
                </div>
            </header>

            <main className="mt-6 space-y-6">
                 {/* Print Button */}
                <div className="no-print flex justify-end">
                    <Button onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Imprimer / Exporter en PDF
                    </Button>
                </div>

                {/* Synthesis */}
                <Card className="bg-blue-50 border-blue-200 print:shadow-none">
                    <CardHeader>
                        <CardTitle className="text-lg text-blue-900">Synthèse de Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-700">{ai.synthesis}</p>
                    </CardContent>
                </Card>

                {/* Main KPIs */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className={`print:shadow-none ${isPunctualityOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <CardHeader className="pb-2">
                             <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Clock /> Taux de Ponctualité
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">{punctualityKpi?.value}</p>
                            <p className="text-xs text-muted-foreground">Objectif: 95%</p>
                        </CardContent>
                    </Card>
                     <Card className={`print:shadow-none ${isRatingOk ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Users /> Notation Moyenne
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-4xl font-bold">{ratingKpi?.value}</p>
                            <p className="text-xs text-muted-foreground">Objectif: 4.8/5</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid grid-cols-4 gap-4">
                    {mainKpis.filter(k => !k.title.includes('Ponctualité') && !k.title.includes('Notation')).map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
                    {secondaryKpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}
                </div>

                {/* AI Insights & Key Charts */}
                <section>
                    <h2 className="text-xl font-bold mb-4">Analyse Approfondie & Insights IA</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="print:shadow-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Sigma/> Répartition des Écarts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={analysis.delayHistogram}>
                                    <XAxis dataKey="range" fontSize={10} angle={-30} textAnchor="end" height={50} />
                                    <YAxis fontSize={10} />
                                    <Tooltip />
                                    <Bar dataKey="count" name="Nb. de Tâches">
                                        {analysis.delayHistogram.map((entry) => (
                                            <Cell key={entry.range} fill={entry.range.includes('retard') ? '#E4002B' : entry.range.includes('avance') ? '#00A1DE' : '#a0aec0'} />
                                        ))}
                                    </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <Card className="print:shadow-none">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><MapPin className="text-destructive"/> Top 5 Villes (Retards)</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={200}>
                                    <BarChart data={analysis.delaysByCity.slice(0,5).reverse()} layout="vertical" margin={{ left: 60, right: 20 }}>
                                        <XAxis type="number" fontSize={10} />
                                        <YAxis dataKey="key" type="category" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip />
                                        <Bar dataKey="count" name="Retards" barSize={15} fill={'#E4002B'} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        <div className="md:col-span-2 space-y-3">
                             <h3 className="font-semibold">Insights Clés de l'IA</h3>
                             {ai.keyInsights.map((insight, index) => {
                                const Icon = iconMap[insight.icon];
                                return (
                                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <Icon className="w-5 h-5 mt-0.5 text-primary shrink-0" />
                                    <p className="text-sm text-gray-800">{insight.text}</p>
                                </div>
                                )
                             })}
                        </div>
                    </div>
                </section>
            </main>
            <footer className="text-center text-xs text-gray-400 mt-8 pt-4 border-t">
                Rapport généré le {format(new Date(), 'dd/MM/yyyy à HH:mm')}
            </footer>
        </div>
    );
}
