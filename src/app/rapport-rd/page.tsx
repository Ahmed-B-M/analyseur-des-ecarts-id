
'use client';

import { useLogistics } from '@/context/LogisticsContext';
import { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Percent, Sparkles } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import HotZonesChart from '@/components/logistics/HotZonesChart';
import DepotAnalysisTable from '@/components/logistics/DepotAnalysisTable';
import PostalCodeTable from '@/components/logistics/PostalCodeTable';
import FilterBar from '@/components/logistics/FilterBar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MergedData } from '@/lib/types';
import { exportToXlsx } from '@/lib/exportUtils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CommentCategorizationTable, CategoryRow } from '@/components/logistics/CommentCategorizationTable';
import SlotAnalysisChart from '@/components/logistics/SlotAnalysisChart';
import DeliveryVolumeChart from '@/components/logistics/DeliveryVolumeChart';

const COLORS = { 'Retard': '#E4002B', 'Avance': '#00C49F', 'Autre': '#FFBB28' };

export default function RapportRDPage() {
    const { state, dispatch, mergedData } = useLogistics();
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [commentActions, setCommentActions] = useState<Record<string, string>>({});

    const handleActionChange = (category: string, action: string) => {
        setCommentActions(prev => ({ ...prev, [category]: action }));
    };

    const commentCategorizationData: CategoryRow[] = useMemo(() => {
        return [];
    }, []);

    const handleBarClick = (data: any) => {
        setSelectedCategory(data.reason);
    };

    const selectedComments = useMemo(() => {
        if (!selectedCategory) return [];
        return [];
    }, [selectedCategory]);

    const setFilters = useCallback((newFilters: Record<string, any>) => {
        dispatch({ type: 'SET_FILTERS', filters: newFilters });
    }, [dispatch]);

    const handleTop20Percent = useCallback(() => {
        if (!mergedData) return;

        const postalCodeCounts = mergedData.reduce((acc, item) => {
            if (item.codePostal) {
                acc[item.codePostal] = (acc[item.codePostal] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const sortedPostalCodes = Object.keys(postalCodeCounts).sort((a, b) => postalCodeCounts[b] - postalCodeCounts[a]);
        const top20PercentCount = Math.ceil(sortedPostalCodes.length * 0.2);
        
        setFilters({ ...state.filters, topPostalCodes: top20PercentCount });

    }, [mergedData, state.filters, setFilters]);

    const filteredData = useMemo(() => {
        if (!mergedData) return [];

        let dataToFilter = mergedData;
        
        // MAD Delays Filter
        if (state.filters.excludeMadDelays && state.filters.madDelays && state.filters.madDelays.length > 0) {
            const madSet = new Set(state.filters.madDelays);
            dataToFilter = dataToFilter.filter(item => {
                if (!item.tournee) return false;
                const madKey = `${item.tournee.entrepot}|${item.date}`;
                return !madSet.has(madKey);
            });
        }

        // Special filter for "100% mobile" tours
        if (state.filters.tours100Mobile) {
            const tourTasks = new Map<string, any[]>();
            dataToFilter.forEach(task => {
                if (!tourTasks.has(task.tourneeUniqueId)) {
                    tourTasks.set(task.tourneeUniqueId, []);
                }
                tourTasks.get(task.tourneeUniqueId)!.push(task);
            });

            const mobileTourIds = new Set<string>();
            for (const [tourId, tasks] of tourTasks.entries()) {
                if (tasks.every(t => t.completedBy && t.completedBy.toLowerCase() === 'mobile')) {
                    mobileTourIds.add(tourId);
                }
            }
            
            dataToFilter = dataToFilter.filter(task => mobileTourIds.has(task.tourneeUniqueId));
        }

        // Top Postal Codes by delivery volume filter
        if (state.filters.topPostalCodes) {
            const postalCodeCounts = dataToFilter.reduce((acc, item) => {
                if (item.codePostal) {
                    acc[item.codePostal] = (acc[item.codePostal] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);

            const sortedPostalCodes = Object.keys(postalCodeCounts).sort((a, b) => postalCodeCounts[b] - postalCodeCounts[a]);
            const topCodes = new Set(sortedPostalCodes.slice(0, state.filters.topPostalCodes));
            
            dataToFilter = dataToFilter.filter(item => item.codePostal && topCodes.has(item.codePostal));
        }
        
        return dataToFilter.filter(item => {
            if (!item.tournee) return false;

            // Date filters
            if (state.filters.selectedDate) {
               if (item.date !== state.filters.selectedDate) return false;
            } else if (state.filters.dateRange) {
              const { from, to } = state.filters.dateRange as DateRange;
              const itemDate = new Date(item.date);
              itemDate.setHours(0,0,0,0); // Normalize item date
              if (from) {
                const fromDate = new Date(from);
                fromDate.setHours(0,0,0,0); // Normalize from date
                if (itemDate < fromDate) return false;
              }
              if (to) {
                const toDate = new Date(to);
                toDate.setHours(23,59,59,999); // Include the end date
                if (itemDate > toDate) return false;
              }
            }

            if (state.filters.depot && !item.tournee.entrepot.startsWith(state.filters.depot)) return false;
            if (state.filters.entrepot && item.tournee.entrepot !== state.filters.entrepot) return false;
            if (state.filters.city && item.ville !== state.filters.city) return false;
            if (state.filters.codePostal && item.codePostal !== state.filters.codePostal) return false;
            if (state.filters.heure && new Date(item.heureCloture * 1000).getUTCHours() !== parseInt(state.filters.heure)) return false;

            return true;
        });
    }, [mergedData, state.filters]);

    const chartData = useMemo(() => {
        if (!filteredData) return [];
        const postalCodeStats = filteredData.reduce((acc, item) => {
            if (item.codePostal && item.tournee) {
                if (!acc[item.codePostal]) {
                    acc[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
                }
                acc[item.codePostal].total++;
                if (item.heureArriveeReelle > (item.heureFinCreneau + (state.filters.punctualityThreshold || 959))) {
                    acc[item.codePostal].late++;
                }
            }
            return acc;
        }, {} as Record<string, { total: number; late: number; depot: string }>);

        return Object.entries(postalCodeStats).map(([codePostal, stats]) => ({
            codePostal,
            entrepot: stats.depot,
            totalLivraisons: stats.total,
            retardPercent: stats.total > 0 ? (stats.late / stats.total) * 100 : 0,
        }));
    }, [filteredData, state.filters.punctualityThreshold]);

    const depots = useMemo(() => {
        if (!mergedData) return [];
        const depotNames = mergedData.map(t => {
            const entrepot = t.tournee?.entrepot || "";
            return entrepot.split(' ')[0];
        });
        return [...new Set(depotNames)].filter(Boolean).sort();
    }, [mergedData]);

    const warehouses = useMemo(() => {
        if (!mergedData) return [];
        return [...new Set(mergedData.map(t => t.tournee?.entrepot).filter(Boolean) as string[])];
    }, [mergedData]);

    const cities = useMemo(() => {
        if (!mergedData) return [];
        return [...new Set(mergedData.map(t => t.ville).filter(Boolean) as string[])];
    }, [mergedData]);

    const handleExport = () => {
        if (!filteredData) return;
        
        const depotNames = [...new Set(filteredData.map(item => item.tournee?.entrepot).filter(Boolean) as string[])];
        const depotExportData = depotNames.map(name => calculateDepotStatsForExport(name, filteredData, state.filters.punctualityThreshold)).filter(Boolean);
        
        const postalCodeExportData = Object.entries(
            filteredData.reduce((acc, item) => {
                 if (item.codePostal && item.tournee) {
                    if (!acc[item.codePostal]) {
                        acc[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
                    }
                    acc[item.codePostal].total++;
                    if (item.heureArriveeReelle > (item.heureFinCreneau + (state.filters.punctualityThreshold || 959))) {
                        acc[item.codePostal].late++;
                    }
                }
                return acc;
            }, {} as Record<string, { total: number; late: number; depot: string }>)
        ).map(([codePostal, stats]) => ({
            codePostal,
            entrepot: stats.depot,
            totalLivraisons: stats.total,
            livraisonsRetard: stats.total > 0 ? ((stats.late / stats.total) * 100).toFixed(2) + '%' : '0.00%',
        }));

        const sheets = [
            { data: depotExportData, sheetName: 'Analyse Entrepôts' },
            { data: postalCodeExportData, sheetName: 'Classement Codes Postaux' },
            { data: commentCategorizationData, sheetName: 'Catégorisation Commentaires' }
        ];
        
        const today = new Date().toLocaleDateString('fr-CA');
        exportToXlsx(sheets, `Rapport_RD_${today}`);
    };

    const handleDownloadReport = () => {
        // Here, you would pass the commentCategorizationData to the report generation logic
        // For now, it just navigates to the report page
        router.push('/report');
    };
    
    const calculateDepotStatsForExport = (depotName: string, data: MergedData[], toleranceSeconds: number = 959) => {
        const depotData = data.filter(item => item.tournee?.entrepot === depotName);
        if (depotData.length === 0) return null;
        const totalDeliveries = depotData.length;
        const lateDeliveries = depotData.filter(d => d.heureArriveeReelle > d.heureFinCreneau + toleranceSeconds).length;
        return {
            Entrepot: depotName,
            'Total Livraisons': totalDeliveries,
            'Livraisons en Retard': lateDeliveries,
            '% Retard': totalDeliveries > 0 ? `${((lateDeliveries/totalDeliveries)*100).toFixed(2)}%` : '0.00%'
        }
    }

    if (!mergedData || mergedData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-lg text-muted-foreground">Veuillez charger les fichiers de données sur la page principale.</p>
                 <Button onClick={() => router.push('/')} className="mt-4">
                    Retour à l'accueil
                </Button>
            </div>
        );
    }

    return (
        <Dialog onOpenChange={() => setSelectedCategory(null)}>
            <div className="space-y-8">
                <FilterBar 
                filters={state.filters} 
                setFilters={setFilters} 
                depots={depots} 
                warehouses={warehouses}
                cities={cities}
                allData={mergedData}
                />

                <div className="flex justify-between items-center gap-2">
                    <Button variant="outline" onClick={handleTop20Percent}>
                        <Percent className="mr-2 h-4 w-4" />
                        Top 20% Codes Postaux
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExport}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Exporter en XLSX
                        </Button>
                        <Button onClick={handleDownloadReport}>
                            <Download className="mr-2 h-4 w-4" />
                            Télécharger le Rapport
                        </Button>
                    </div>
                </div>

                <DeliveryVolumeChart data={filteredData} punctualityThreshold={state.filters.punctualityThreshold} />
                <SlotAnalysisChart data={filteredData} />
                
                <HotZonesChart data={chartData} />
                
                <DepotAnalysisTable data={filteredData} />

                <PostalCodeTable data={filteredData} />
            </div>

            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Commentaires - {selectedCategory}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-96">
                    <div className="p-4 space-y-4">
                        {selectedComments.map((item: any, index: number) => (
                            <div key={index} className="border p-3 rounded-md bg-muted/50">
                                <p className="text-sm text-muted-foreground">ID: {item.id}</p>
                                <p className="font-medium">{item.comment}</p>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
