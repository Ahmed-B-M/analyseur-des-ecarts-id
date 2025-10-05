
'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLogistics } from '@/context/LogisticsContext';
import FileUpload from '@/components/logistics/FileUpload';
import FilterBar from '@/components/logistics/FilterBar';
import { Logo } from '@/components/logistics/Logo';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardTabs from './DashboardTabs';


export default function Dashboard() {
  const { state, dispatch } = useLogistics();
  const { analysisData, rawData, filteredData, tourneesFiles, tachesFiles } = state;
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleSetFiles = (fileType: 'tournees' | 'taches', files: File[]) => {
    dispatch({ type: 'ADD_FILES', fileType, files });
  };
  
  const handleRemoveFile = (fileType: 'tournees' | 'taches', fileName: string) => {
    dispatch({ type: 'REMOVE_FILE', fileType, fileName });
  };

  const handleAnalyse = () => {
    if (tourneesFiles.length > 0 && tachesFiles.length > 0) {
      dispatch({ type: 'START_PROCESSING' });
    }
  };
  
  const setFilters = useCallback((newFilters: Record<string, any>) => {
    dispatch({ type: 'SET_FILTERS', filters: newFilters });
  }, [dispatch]);

  const applyFilterAndSwitchTab = useCallback((filter: Record<string, any>) => {
    setFilters({...state.filters, ...filter, selectedDate: undefined, dateRange: undefined});
    setActiveTab('data');
  }, [setFilters, state.filters]);

  const carriers = useMemo(() => {
    if (!rawData) return [];
    const carrierSet = new Set<string>();
    rawData.forEach(item => {
      if (item.carrier) {
        carrierSet.add(item.carrier);
      }
    });
    return Array.from(carrierSet).sort();
  }, [rawData]);
  

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
        {!rawData && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="grid md:grid-cols-2 gap-8 h-64">
                <FileUpload
                title="1. Fichiers Tournées"
                onFilesSelect={(files) => handleSetFiles('tournees', files)}
                onFileRemove={(fileName) => handleRemoveFile('tournees', fileName)}
                files={state.tourneesFiles}
                />
                <FileUpload
                title="2. Fichiers Tâches"
                onFilesSelect={(files) => handleSetFiles('taches', files)}
                onFileRemove={(fileName) => handleRemoveFile('taches', fileName)}
                files={state.tachesFiles}
                />
            </div>
             <div className="flex flex-col items-center gap-4">
                <Button 
                    onClick={handleAnalyse} 
                    disabled={state.isLoading || state.tourneesFiles.length === 0 || state.tachesFiles.length === 0}
                    size="lg"
                >
                    {state.isLoading ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyse en cours...
                        </>
                    ) : 'Lancer l\'Analyse'}
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
        
        {state.isLoading && !rawData && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg text-muted-foreground">Analyse des données en cours...</p>
            <p className="text-sm text-muted-foreground">Cela peut prendre quelques instants.</p>
          </div>
        )}

        {rawData && analysisData && (
          <div className="space-y-6">
            <FilterBar 
              filters={state.filters} 
              setFilters={setFilters} 
              depots={analysisData.depots}
              warehouses={analysisData.warehouses}
              cities={analysisData.cities}
              carriers={carriers}
              allData={rawData}
            />
            <DashboardTabs 
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              analysisData={analysisData}
              filteredData={filteredData}
              rawData={rawData}
              filters={state.filters}
              setFilters={setFilters}
              applyFilterAndSwitchTab={applyFilterAndSwitchTab}
            />
          </div>
        )}
      </main>
    </div>
  );
}
