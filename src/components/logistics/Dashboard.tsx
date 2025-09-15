'use client';

import { useEffect, useReducer, useMemo, useState, useCallback } from 'react';
import type { Tournee, Tache, MergedData, AnalysisData } from '@/lib/types';
import FileUpload from '@/components/logistics/FileUpload';
import FilterBar from '@/components/logistics/FilterBar';
import AnalysisDashboard from '@/components/logistics/AnalysisDashboard';
import DetailedDataView from '@/components/logistics/DetailedDataView';
import { Logo } from '@/components/logistics/Logo';
import { analyzeData } from '@/lib/dataAnalyzer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, AlertCircle, BarChart2, Calendar, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DateRange } from 'react-day-picker';
import { DateRangePicker } from './DateRangePicker';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import CalendarView from './CalendarView';

type State = {
  tourneesFile: File | null;
  tachesFile: File | null;
  isLoading: boolean;
  error: string | null;
  data: { tournees: Tournee[]; taches: Tache[] } | null;
  filters: Record<string, any>;
};

type Action =
  | { type: 'SET_FILE'; fileType: 'tournees' | 'taches'; file: File | null }
  | { type: 'START_PROCESSING' }
  | { type: 'PROCESSING_SUCCESS'; data: { tournees: Tournee[]; taches: Tache[] } }
  | { type: 'PROCESSING_ERROR'; error: string }
  | { type: 'SET_FILTERS'; filters: Record<string, any> }
  | { type: 'RESET' };

const initialState: State = {
  tourneesFile: null,
  tachesFile: null,
  isLoading: false,
  error: null,
  data: null,
  filters: { 
    punctualityThreshold: 15,
  },
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_FILE':
      return { ...state, [`${action.fileType}File`]: action.file, error: null };
    case 'START_PROCESSING':
      return { ...state, isLoading: true, error: null };
    case 'PROCESSING_SUCCESS': {
        if (!action.data || action.data.tournees.length === 0 || action.data.taches.length === 0) {
            return { ...state, isLoading: false, error: "Aucune donnée valide n'a été extraite des fichiers. Veuillez vérifier les en-têtes et le contenu." };
        }
        
        return { ...state, isLoading: false, data: action.data, error: null };
    }
    case 'PROCESSING_ERROR':
      return { ...state, isLoading: false, error: action.error };
    case 'SET_FILTERS':
       return { ...state, filters: action.filters };
    case 'RESET':
      return {...initialState};
    default:
      return state;
  }
}

export default function Dashboard() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [worker, setWorker] = useState<Worker | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const newWorker = new Worker(new URL('../../workers/parser.worker.ts', import.meta.url));
    setWorker(newWorker);

    newWorker.onmessage = (event) => {
      const { type, data, error } = event.data;
      if (type === 'success') {
        dispatch({ type: 'PROCESSING_SUCCESS', data });
      } else {
        dispatch({ type: 'PROCESSING_ERROR', error });
      }
    };

    newWorker.onerror = (error) => {
      dispatch({ type: 'PROCESSING_ERROR', error: `Erreur du worker: ${error.message}` });
    };

    return () => {
      newWorker.terminate();
    };
  }, []);
  
  const handleProcess = () => {
      if (state.tourneesFile && state.tachesFile && worker) {
        dispatch({ type: 'START_PROCESSING' });
        worker.postMessage({
            tourneesFile: state.tourneesFile,
            tachesFile: state.tachesFile,
        });
    }
  }

  const mergedData: MergedData[] = useMemo(() => {
    if (!state.data) return [];
    const tourneeMap = new Map(state.data.tournees.map((t) => [t.uniqueId, t]));
    return state.data.taches.map((tache) => ({
      ...tache,
      tournee: tourneeMap.get(tache.tourneeUniqueId) || null,
    }));
  }, [state.data]);

  const filteredData = useMemo(() => {
    if (!state.data) return [];
    
    return mergedData.filter(item => {
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
  }, [mergedData, state.filters, state.data]);

  const analysisData: AnalysisData | null = useMemo(() => {
    if (!filteredData.length) return null;
    return analyzeData(filteredData, state.filters);
  }, [filteredData, state.filters]);

  const handleSetFile = (fileType: 'tournees' | 'taches', file: File | null) => {
    dispatch({ type: 'SET_FILE', fileType, file });
  };
  
  const setFilters = useCallback((newFilters: Record<string, any>) => {
    dispatch({ type: 'SET_FILTERS', filters: newFilters });
  }, []);

  const applyFilterAndSwitchTab = useCallback((filter: Record<string, any>) => {
    setFilters({...state.filters, ...filter, selectedDate: undefined, dateRange: undefined});
    setActiveTab('data');
  }, [setFilters, state.filters]);

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
                <Button onClick={handleProcess} disabled={!state.tourneesFile || !state.tachesFile || state.isLoading} size="lg">
                     {state.isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Traitement des données...
                        </>
                    ) : 'Lancer l\'analyse'}
                </Button>
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
            />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 max-w-lg mx-auto">
                <TabsTrigger value="dashboard"><BarChart2 className="w-4 h-4 mr-2" />Tableau de Bord</TabsTrigger>
                <TabsTrigger value="calendar"><Calendar className="w-4 h-4 mr-2" />Analyse par Période</TabsTrigger>
                <TabsTrigger value="data"><List className="w-4 h-4 mr-2" />Données Détaillées</TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard" className="mt-6">
                <AnalysisDashboard 
                  analysisData={analysisData}
                  onFilterAndSwitch={applyFilterAndSwitchTab}
                  allData={mergedData}
                  filters={state.filters}
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
