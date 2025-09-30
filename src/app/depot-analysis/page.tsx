
'use client';

import { useLogistics } from '@/context/LogisticsContext';
import { useMemo, useCallback } from 'react';
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
import CustomerPromiseChart from '@/components/logistics/CustomerPromiseChart';
import SaturationChart from '@/components/logistics/SaturationChart';
import SimulationView from '@/components/logistics/SimulationView';

export default function DepotAnalysisPage() {
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
    
    const saturationData = useMemo(() => {
        if (!analysisData) return [];

        const hourlyBuckets: Record<string, { demand: number; capacity: number }> = {};
        for (let i = 6; i < 23; i++) {
            const hour = i.toString().padStart(2, '0');
            hourlyBuckets[`${hour}:00`] = { demand: 0, capacity: 0 };
        }

        (filteredData || []).forEach(task => {
            // Demand: Cumulative count of active slots
            const startHour = new Date(task.heureDebutCreneau * 1000).getUTCHours();
            const endHour = new Date(task.heureFinCreneau * 1000).getUTCHours();
            for (let i = startHour; i < endHour; i++) {
                const hourKey = `${i.toString().padStart(2, '0')}:00`;
                if (hourlyBuckets[hourKey]) {
                    hourlyBuckets[hourKey].demand++;
                }
            }

            // Capacity: Count of completed deliveries
            const closureHour = new Date(task.heureCloture * 1000).getUTCHours();
            const capacityHourKey = `${closureHour.toString().padStart(2, '0')}:00`;
            if (hourlyBuckets[capacityHourKey]) {
                hourlyBuckets[capacityHourKey].capacity++;
            }
        });
        
        const data = Object.entries(hourlyBuckets)
            .map(([hour, data]) => ({ hour, ...data }));
            
        return data
            .filter(item => item.demand > 0 || item.capacity > 0)
            .map(item => ({ hour: item.hour, gap: item.demand - item.capacity }));


    }, [filteredData]);

    const customerPromiseData = useMemo(() => {
    if (!filteredData) return [];

    const buckets: Record<string, { customerPromise: number; urbantzPlan: number; realized: number; late: number }> = {};
    const startTimestamp = new Date();
    startTimestamp.setUTCHours(6, 0, 0, 0);
    const endTimestamp = new Date();
    endTimestamp.setUTCHours(23, 0, 0, 0);

    for (let i = startTimestamp.getTime(); i < endTimestamp.getTime(); i += 60 * 1000) {
        const d = new Date(i);
        const hour = String(d.getUTCHours()).padStart(2, '0');
        const minute = String(d.getUTCMinutes()).padStart(2, '0');
        buckets[`${hour}:${minute}`] = { customerPromise: 0, urbantzPlan: 0, realized: 0, late: 0 };
    }

    const deliveriesBySlot = filteredData.reduce((acc, task) => {
        const start = new Date(task.heureDebutCreneau * 1000);
        const end = new Date(task.heureFinCreneau * 1000);
        const key = `${start.toISOString()}-${end.toISOString()}`;
        if (!acc[key]) {
            acc[key] = { count: 0, start, end };
        }
        acc[key].count++;
        return acc;
    }, {} as Record<string, { count: number; start: Date; end: Date }>);

    Object.values(deliveriesBySlot).forEach(slot => {
        const durationMinutes = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
        if (durationMinutes === 0) return;
        const weightPerMinute = slot.count / durationMinutes;

        for (let i = 0; i < durationMinutes; i++) {
            const intervalStart = new Date(slot.start.getTime() + i * 60 * 1000);
            const hour = String(intervalStart.getUTCHours()).padStart(2, '0');
            const minute = String(intervalStart.getUTCMinutes()).padStart(2, '0');
            const bucketKey = `${hour}:${minute}`;
            
            if (buckets[bucketKey]) {
                buckets[bucketKey].customerPromise += weightPerMinute;
            }
        }
    });

    const lateToleranceSeconds = (state.filters.punctualityThreshold || 959);

    filteredData.forEach(task => {
        // Urbantz Plan
        const approxDate = new Date(task.heureArriveeApprox * 1000);
        const approxHour = String(approxDate.getUTCHours()).padStart(2, '0');
        const approxMinute = String(approxDate.getUTCMinutes()).padStart(2, '0');
        const approxBucketKey = `${approxHour}:${approxMinute}`;
        if (buckets[approxBucketKey]) {
            buckets[approxBucketKey].urbantzPlan++;
        }

        // Realized
        const closureDate = new Date(task.heureCloture * 1000);
        const closureHour = String(closureDate.getUTCHours()).padStart(2, '0');
        const closureMinute = String(closureDate.getUTCMinutes()).padStart(2, '0');
        const closureBucketKey = `${closureHour}:${closureMinute}`;
        if (buckets[closureBucketKey]) {
            buckets[closureBucketKey].realized++;
            if (task.retard > lateToleranceSeconds) {
                buckets[closureBucketKey].late++;
            }
        }
    });
    
    return Object.entries(buckets).map(([hour, data]) => ({ ...data, hour }));

}, [filteredData, state.filters.punctualityThreshold]);
    
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
            { data: postalCodeExportData, sheetName: 'Classement Codes Postaux' }
        ];
        
        const today = new Date().toLocaleDateString('fr-CA');
        exportToXlsx(sheets, `RDP_Export_${today}`);
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
                    <Button onClick={() => router.push('/report')}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger le Rapport
                    </Button>
                </div>
            </div>

            <SimulationView data={filteredData} punctualityThreshold={state.filters.punctualityThreshold || 959} />

            <SaturationChart data={saturationData} />
            
            <CustomerPromiseChart data={customerPromiseData} />
            
            <HotZonesChart data={chartData} />

            <SlotAnalysisChart data={filteredData} />
            
            <DepotAnalysisTable data={filteredData} />

            <PostalCodeTable data={filteredData} />
        </div>
    );
}
