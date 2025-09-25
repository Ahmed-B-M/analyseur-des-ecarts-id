'use client';

import { useReducer, useMemo, useState, useCallback } from 'react';
import { useLogistics } from '@/context/LogisticsContext';
import type { Tournee, Tache, MergedData, AnalysisData } from '@/lib/types';
import FileUpload from '@/components/logistics/FileUpload';
import FilterBar from '@/components/logistics/FilterBar';
import AnalysisDashboard from '@/components/logistics/AnalysisDashboard';
import DetailedDataView from '@/components/logistics/DetailedDataView';
import { Logo } from '@/components/logistics/Logo';
import { analyzeData } from '@/lib/dataAnalyzer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, BarChart2, Calendar, List, LayoutDashboard, TrendingUp, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from './DateRangePicker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import CalendarView from './CalendarView';
import ComparisonView from './ComparisonView';
import DepotComparison from './DepotComparison';
import CustomReportBuilder from './CustomReportBuilder';
import Link from 'next/link';


export default function Dashboard() {
  const { state, dispatch, mergedData, analysisData: contextAnalysisData } = useLogistics();
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleSetFile = (fileType: 'tournees' | 'taches', file: File | null) => {
    dispatch({ type: 'SET_FILE', fileType, file });
  };
  
  const setFilters = useCallback((newFilters: Record<string, any>) => {
    dispatch({ type: 'SET_FILTERS', filters: { ...state.filters, ...newFilters} });
  }, [dispatch, state.filters]);

  const applyFilterAndSwitchTab = useCallback((filter: Record<string, any>) => {
    setFilters({...state.filters, ...filter, selectedDate: undefined, dateRange: undefined});
    setActiveTab('data');
  }, [setFilters, state.filters]);

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
        const tourTasks = new Map<string, Tache[]>();
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

  const analysisData: AnalysisData | null = useMemo(() => {
    if (!filteredData.length) return null;
    return analyzeData(filteredData, state.filters);
  }, [filteredData, state.filters]);


  const depots = useMemo(() => {
    if (!state.data) return [];
    
    const depotNames = state.data.tournees.map(t => {
        const entrepot = t.entrepot || "";
        return entrepot.split(' ')[0];
    });

    return [...new Set(depotNames)].filter(Boolean).sort();
  }, [state.data]);

  const warehouses = useMemo(() => {
    if (!state.data) return [];
    return [...new Set(state.data.tournees.map(t => t.entrepot))];
  }, [state.data]);
  

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-body">
      <header className="flex items-center justify-between p-4 border-b border-border shadow-sm">
        <div className="flex items-center gap-3">
          <Logo className="h-32 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-primary">A-E-L - Analyse des Écarts Logistiques</h1>
            <p className="text-sm text-muted-foreground">Analyse des écarts de livraison pour Carrefour</p>
          </div>
        </div>
         <div className="flex items-center gap-2">
            
            {state.data && (
            <Button onClick={() => dispatch({type: 'RESET'})} variant="outline" size="sm">Réinitialiser</Button>
            )}
         </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
        {!state.data && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
                <FileUpload
                title="1. Fichier Tournées"
                onFileSelect={(file) => handleSetFile('tournees', file)}
                file={state.tourneesFile}
                />
                <FileUpload
                title="2. Fichier Tâches"
                onFileSelect={(file) => handleSetFile('taches', file)}
                file={state.tachesFile}
                />
            </div>
             <div className="flex flex-col items-center gap-4">
                {state.isLoading && (
                    <div className="flex items-center gap-2 text-primary">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Traitement des données en cours...
                    </div>
                )}
                {state.error && (
                <div className="md:col-span-2 flex items-center gap-2 text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <AlertCircle className="h-5 w-5" />
                    <p><strong>Erreur :</strong> {state.error}</p>
                </div>
                )}
            </div>
          </div>
        )}
        
        {state.isLoading && !state.data && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Analyse des données en cours...</p>
            <p className="text-sm text-muted-foreground">Cela peut prendre quelques instants.</p>
          </div>
        )}

        {state.data && (
          <div className="space-y-6">
            <FilterBar 
              filters={state.filters} 
              setFilters={setFilters} 
              depots={depots} 
              warehouses={warehouses}
              cities={(analysisData?.cities || [])}
              allData={mergedData}
            />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-7 max-w-6xl mx-auto">
                    <TabsTrigger value="dashboard"><BarChart2 className="w-4 h-4 mr-2" />Tableau de Bord</TabsTrigger>
                    <TabsTrigger value="comparison"><TrendingUp className="w-4 h-4 mr-2" />Analyse Comparative</TabsTrigger>
                    <TabsTrigger value="depotComparison"><LayoutDashboard className="w-4 h-4 mr-2" />Comparaison Dépôts</TabsTrigger>
                    <TabsTrigger value="customReport"><Wand2 className="w-4 h-4 mr-2" />Rapport Personnalisé</TabsTrigger>
                    <TabsTrigger value="calendar"><Calendar className="w-4 h-4 mr-2" />Analyse par Période</TabsTrigger>
                    <TabsTrigger value="data"><List className="w-4 h-4 mr-2" />Données Détaillées</TabsTrigger>
                    <Link href="/depot-analysis" passHref>
                      <TabsTrigger value="rdp" className="w-full"><LayoutDashboard className="w-4 h-4 mr-2" />RDP</TabsTrigger>
                    </Link>
                </TabsList>
              <TabsContent value="dashboard" className="mt-6">
                <AnalysisDashboard 
                  analysisData={analysisData}
                  onFilterAndSwitch={applyFilterAndSwitchTab}
                  allData={mergedData}
                  filters={state.filters}
                  depots={depots}
                />
              </TabsContent>
              <TabsContent value="comparison" className="mt-6">
                <ComparisonView
                    allData={mergedData}
                    filters={state.filters}
                />
              </TabsContent>
              <TabsContent value="depotComparison" className="mt-6">
                <DepotComparison
                    allData={mergedData}
                    filters={state.filters}
                    depots={depots}
                />
              </TabsContent>
              <TabsContent value="customReport" className="mt-6">
                <CustomReportBuilder
                  allData={mergedData}
                  depots={depots}
                  warehouses={warehouses}
                />
              </TabsContent>
              <TabsContent value="calendar" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                         <CalendarView 
                            data={mergedData}
                            onDateSelect={(date) => {
                                setFilters({ ...state.filters, selectedDate: date, dateRange: undefined });
                            }}
                            onWeekSelect={(week) => {
                                // This now only visually selects the week, it does not filter.
                                // Filtering is handled by DateRangePicker or day click.
                            }}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>Analyse par Période Personnalisée</CardTitle>
                                <CardDescription>
                                Sélectionnez une plage de dates pour mettre à jour l'ensemble du tableau de bord.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <DateRangePicker 
                                    className="max-w-sm"
                                    onDateChange={(range) => setFilters({ ...state.filters, dateRange: range, selectedDate: undefined })}
                                    date={state.filters.dateRange}
                                />
                            </CardContent>
                        </Card>
                    </div>
                </div>
              </TabsContent>
              <TabsContent value="data" className="mt-6">
                <DetailedDataView data={filteredData} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
