
'use client';

import { useState, useCallback } from 'react';
import { useLogistics } from '@/context/LogisticsContext';
import FileUpload from '@/components/logistics/FileUpload';
import FilterBar from '@/components/logistics/FilterBar';
import AnalysisDashboard from '@/components/logistics/AnalysisDashboard';
import DetailedDataView from '@/components/logistics/DetailedDataView';
import { Logo } from '@/components/logistics/Logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, BarChart2, Calendar, List, LayoutDashboard, TrendingUp, MessageCircleWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from './DateRangePicker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import CalendarView from './CalendarView';
import ComparisonView from './ComparisonView';
import DepotComparison from './DepotComparison';
import Link from 'next/link';
import NegativeCommentsTable from './NegativeCommentsTable';


export default function Dashboard() {
  const { state, dispatch } = useLogistics();
  const { analysisData } = state;
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
            
            {analysisData && (
            <Button onClick={() => dispatch({type: 'RESET'})} variant="outline" size="sm">Réinitialiser</Button>
            )}
         </div>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
        {!state.analysisData && (
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
        
        {state.isLoading && !state.analysisData && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Analyse des données en cours...</p>
            <p className="text-sm text-muted-foreground">Cela peut prendre quelques instants.</p>
          </div>
        )}

        {state.analysisData && (
          <div className="space-y-6">
            <FilterBar 
              filters={state.filters} 
              setFilters={setFilters} 
              depots={state.analysisData.depots}
              warehouses={state.analysisData.warehouses}
              cities={(state.analysisData?.cities || [])}
              allData={state.analysisData.rawData}
            />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-6 max-w-6xl mx-auto">
                    <TabsTrigger value="dashboard"><BarChart2 className="w-4 h-4 mr-2" />Tableau de Bord</TabsTrigger>
                    <TabsTrigger value="comparison"><TrendingUp className="w-4 h-4 mr-2" />Analyse Comparative</TabsTrigger>
                    <TabsTrigger value="depotComparison"><LayoutDashboard className="w-4 h-4 mr-2" />Comparaison Dépôts</TabsTrigger>
                    <TabsTrigger value="negativeComments"><MessageCircleWarning className="w-4 h-4 mr-2" />Avis Négatifs</TabsTrigger>
                    <TabsTrigger value="calendar"><Calendar className="w-4 h-4 mr-2" />Analyse par Période</TabsTrigger>
                    <TabsTrigger value="data"><List className="w-4 h-4 mr-2" />Données Détaillées</TabsTrigger>
                </TabsList>
                <div className="flex justify-center gap-4 my-4">
                    <Link href="/depot-analysis" passHref>
                      <Button variant="outline"><LayoutDashboard className="w-4 h-4 mr-2" />RDP</Button>
                    </Link>
                    <Link href="/rapport-rd" passHref>
                      <Button variant="outline"><LayoutDashboard className="w-4 h-4 mr-2" />Rapport RD</Button>
                    </Link>
                </div>
              <TabsContent value="dashboard" className="mt-6">
                <AnalysisDashboard 
                  analysisData={state.analysisData}
                  onFilterAndSwitch={applyFilterAndSwitchTab}
                />
              </TabsContent>
              <TabsContent value="comparison" className="mt-6">
                <ComparisonView
                    allData={state.analysisData.rawData}
                    filters={state.filters}
                />
              </TabsContent>
              <TabsContent value="depotComparison" className="mt-6">
                <DepotComparison
                    allData={state.analysisData.rawData}
                    filters={state.filters}
                    depots={state.analysisData.depots}
                />
              </TabsContent>
              <TabsContent value="negativeComments" className="mt-6">
                 <NegativeCommentsTable data={state.analysisData.filteredData} />
              </TabsContent>
              <TabsContent value="calendar" className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1">
                         <CalendarView 
                            data={state.analysisData.rawData}
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
                <DetailedDataView data={state.analysisData.filteredData} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </main>
    </div>
  );
}
