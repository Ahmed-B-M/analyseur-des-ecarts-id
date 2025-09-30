
'use client';

import { useLogistics } from '@/context/LogisticsContext';
import { useMemo, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Percent, Loader2 } from 'lucide-react';
import HotZonesChart from '@/components/logistics/HotZonesChart';
import DepotAnalysisTable from '@/components/logistics/DepotAnalysisTable';
import PostalCodeTable from '@/components/logistics/PostalCodeTable';
import FilterBar from '@/components/logistics/FilterBar';
import { Button } from '@/components/ui/button';
import { MergedData } from '@/lib/types';
import { exportToXlsx } from '@/lib/exportUtils';
import SlotAnalysisChart from '@/components/logistics/SlotAnalysisChart';
import DeliveryVolumeChart from '@/components/logistics/DeliveryVolumeChart';

export default function RapportRDPage() {
    const { state, dispatch } = useLogistics();
    const router = useRouter();
    const { analysisData, filteredData, rawData } = state;

    const setFilters = useCallback((newFilters: Record<string, any>) => {
        dispatch({ type: 'SET_FILTERS', filters: newFilters });
    }, [dispatch]);

    const handleTop20Percent = useCallback(() => {
        if (!rawData) return;

        const postalCodeCounts = rawData.reduce((acc, item) => {
            if (item.codePostal) {
                acc[item.codePostal] = (acc[item.codePostal] || 0) + 1;
            }
            return acc;
        }, {} as Record<string, number>);

        const sortedPostalCodes = Object.keys(postalCodeCounts).sort((a, b) => postalCodeCounts[b] - postalCodeCounts[a]);
        const top20PercentCount = Math.ceil(sortedPostalCodes.length * 0.2);
        
        setFilters({ ...state.filters, topPostalCodes: top20PercentCount });

    }, [rawData, state.filters, setFilters]);

    const chartData = useMemo(() => {
        if (!analysisData) return [];
        
        return (analysisData.performanceByPostalCode || []).map(item => ({
            codePostal: item.key,
            entrepot: filteredData?.find(d => d.codePostal === item.key)?.tournee?.entrepot || 'N/A',
            totalLivraisons: item.totalTasks,
            retardPercent: (100 - item.punctualityRateRealized),
        }));
    }, [analysisData, filteredData]);
    
    const handleExport = () => {
        if (!analysisData) return;
        
        const depotExportData = analysisData.performanceByDepot.map(d => ({
            entrepot: d.key,
            totalLivraisons: d.totalTasks,
            ponctualitePrev: d.punctualityRatePlanned,
            ponctualiteRealisee: d.punctualityRateRealized,
        }));
        
        const postalCodeExportData = analysisData.performanceByPostalCode.map(d => ({
            codePostal: d.key,
            totalLivraisons: d.totalTasks,
            livraisonsRetard: 100 - d.punctualityRateRealized,
        }));

        const sheets = [
            { data: depotExportData, sheetName: 'Analyse Entrepôts' },
            { data: postalCodeExportData, sheetName: 'Classement Codes Postaux' },
        ];
        
        const today = new Date().toLocaleDateString('fr-CA');
        exportToXlsx(sheets, `Rapport_RD_${today}`);
    };

    const handleDownloadReport = () => {
        router.push('/report');
    };

    if (!rawData) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <p className="text-lg text-muted-foreground">Veuillez charger les fichiers de données sur la page principale.</p>
                 <Button onClick={() => router.push('/')} className="mt-4">
                    Retour à l'accueil
                </Button>
            </div>
        );
    }
    
    if (!analysisData || !filteredData) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground mt-4">Analyse des données en cours...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <FilterBar 
            filters={state.filters} 
            setFilters={setFilters} 
            depots={analysisData.depots} 
            warehouses={analysisData.warehouses}
            cities={analysisData.cities}
            allData={rawData}
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

            <DeliveryVolumeChart data={filteredData} />
            <SlotAnalysisChart data={filteredData} />
            
            <HotZonesChart data={chartData} />
            
            <DepotAnalysisTable data={filteredData} />

            <PostalCodeTable data={filteredData} />
        </div>
    );
}
