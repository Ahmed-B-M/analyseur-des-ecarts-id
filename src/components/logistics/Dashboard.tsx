
'use client';

import { useState, useCallback } from 'react';
import { useLogistics } from '@/context/LogisticsContext';
import FileUpload from '@/components/logistics/FileUpload';
import FilterBar from '@/components/logistics/FilterBar';
import { Logo } from '@/components/logistics/Logo';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DashboardTabs from './DashboardTabs';


export default function Dashboard() {
  const { state, dispatch } = useLogistics();
  const { analysisData, rawData, filteredData } = state;
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleSetFile = (fileType: 'tournees' | 'taches', file: File | null) => {
    dispatch({ type: 'SET_FILE', fileType, file });
  };
  
  const setFilters = useCallback((newFilters: Record<string, any>) => {
    dispatch({ type: 'SET_FILTERS', filters: newFilters });
  }, [dispatch]);

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
        {!rawData && (
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
