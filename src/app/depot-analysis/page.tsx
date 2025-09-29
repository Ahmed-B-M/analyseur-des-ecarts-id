
'use client';

import { useLogistics } from '@/context/LogisticsContext';
import { useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileSpreadsheet, Percent } from 'lucide-react';
import { DateRange } from 'react-day-picker';
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
    const { state, dispatch, mergedData } = useLogistics();
    const router = useRouter();

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
                if (item.heureArriveeReelle > (item.heureFinCreneau + (state.filters.punctualityThreshold || 15) * 60)) {
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

    const saturationData = useMemo(() => {
        if (!filteredData) return [];

        const hourlyBuckets: Record<string, { demand: number; capacity: number }> = {};
        for (let i = 6; i < 23; i++) {
            const hour = i.toString().padStart(2, '0');
            hourlyBuckets[`${hour}:00`] = { demand: 0, capacity: 0 };
        }

        filteredData.forEach(task => {
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

    const lateToleranceSeconds = (state.filters.punctualityThreshold || 15) * 60;

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
            if (task.heureCloture > task.heureFinCreneau + lateToleranceSeconds) {
                buckets[closureBucketKey].late++;
            }
        }
    });
    
    return Object.entries(buckets).map(([hour, data]) => ({ ...data, hour }));

}, [filteredData, state.filters.punctualityThreshold]);
    
    const slotChartData = useMemo(() => {
    if (!filteredData) return [];

    const hourlyBuckets: Record<string, { total: number; late: number }> = {};
    for (let i = 6; i < 23; i++) {
        const hour = i.toString().padStart(2, '0');
        hourlyBuckets[`${hour}:00`] = { total: 0, late: 0 };
    }

    const toleranceSeconds = (state.filters.punctualityThreshold || 15) * 60;

    filteredData.forEach(task => {
        const startHour = new Date(task.heureDebutCreneau * 1000).getUTCHours();
        const endHour = new Date(task.heureFinCreneau * 1000).getUTCHours();
        const isLate = task.heureCloture > (task.heureFinCreneau + toleranceSeconds);

        for (let i = startHour; i < endHour; i++) {
            const hourKey = `${i.toString().padStart(2, '0')}:00`;
            if (hourlyBuckets[hourKey]) {
                hourlyBuckets[hourKey].total++;
                if (isLate) {
                    hourlyBuckets[hourKey].late++;
                }
            }
        }
    });
    
    return Object.entries(hourlyBuckets)
        .map(([slot, data]) => ({ ...data, slot }))
        .filter(item => item.total > 0);

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
                    if (item.heureArriveeReelle > (item.heureFinCreneau + (state.filters.punctualityThreshold || 15) * 60)) {
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
            { data: postalCodeExportData, sheetName: 'Classement Codes Postaux' }
        ];
        
        const today = new Date().toLocaleDateString('fr-CA');
        exportToXlsx(sheets, `RDP_Export_${today}`);
    };
    
    const calculateDepotStatsForExport = (depotName: string, data: MergedData[], toleranceMinutes: number = 15) => {
        const depotData = data.filter(item => item.tournee?.entrepot === depotName);
        if (depotData.length === 0) return null;
        const totalDeliveries = depotData.length;
        const lateDeliveries = depotData.filter(d => d.heureArriveeReelle > d.heureFinCreneau + (toleranceMinutes*60)).length;
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
                    <Button onClick={() => router.push('/report')}>
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger le Rapport
                    </Button>
                </div>
            </div>

            <SimulationView data={filteredData} punctualityThreshold={state.filters.punctualityThreshold || 15} />

            <SaturationChart data={saturationData} />
            
            <CustomerPromiseChart data={customerPromiseData} />
            
            <HotZonesChart data={chartData} />

            <SlotAnalysisChart data={slotChartData} />
            
            <DepotAnalysisTable data={filteredData} />

            <PostalCodeTable data={filteredData} />
        </div>
    );
}
