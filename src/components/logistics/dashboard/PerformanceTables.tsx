
'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUpDown, Filter, TrendingDown } from 'lucide-react';
import type { AnalysisData, PerformanceByDriver, PerformanceByGeo, PerformanceByGroup } from '@/lib/types';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type SortConfig<T> = {
    key: keyof T;
    direction: 'asc' | 'desc';
} | null;

const PRIMARY_COLOR = "hsl(var(--primary))";

function formatSecondsToTime(seconds: number): string {
    const isNegative = seconds < 0;
    seconds = Math.abs(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return `${isNegative ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PerformanceTables({ analysisData }: { analysisData: AnalysisData }) {
  const [showTop20Only, setShowTop20Only] = useState(false);
  
  const [sorts, setSorts] = useState<{ [key: string]: SortConfig<any> }>({
      driver: { key: 'totalTours', direction: 'desc' },
      depot: { key: 'totalTasks', direction: 'desc' },
      warehouse: { key: 'totalTasks', direction: 'desc' },
      city: { key: 'totalTasks', direction: 'desc' },
      postalCode: { key: 'totalTasks', direction: 'desc' },
  });

  const sortedData = useMemo(() => {
    const sortFn = <T,>(data: T[] | undefined, config: SortConfig<T>): T[] => {
        if (!data) return [];
        if (!config) return data;
        const sorted = [...data].sort((a, b) => {
            const aValue = a[config.key];
            const bValue = b[config.key];
            if (aValue == null) return 1;
            if (bValue == null) return -1;
            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return config.direction === 'asc' ? aValue - bValue : bValue - aValue;
            }
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                return config.direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            }
            return 0;
        });
        return sorted;
    }

    const maybeSlice = <T extends { totalTasks: number }>(data: T[] | undefined): T[] => {
        if (!data || !showTop20Only) return data || [];
        const sortedByVolume = [...data].sort((a, b) => b.totalTasks - a.totalTasks);
        const sliceCount = Math.ceil(sortedByVolume.length * 0.2);
        return sortedByVolume.slice(0, sliceCount);
    }
    
    return {
      performanceByDriver: sortFn<PerformanceByDriver>(analysisData.performanceByDriver, sorts.driver),
      performanceByCity: sortFn<PerformanceByGeo>(maybeSlice(analysisData.performanceByCity), sorts.city),
      performanceByPostalCode: sortFn<PerformanceByGeo>(maybeSlice(analysisData.performanceByPostalCode), sorts.postalCode),
      performanceByDepot: sortFn<PerformanceByGroup>(maybeSlice(analysisData.performanceByDepot), sorts.depot),
      performanceByWarehouse: sortFn<PerformanceByGroup>(maybeSlice(analysisData.performanceByWarehouse), sorts.warehouse),
    };
  }, [analysisData, sorts, showTop20Only]);
  
  const handleSort = <T,>(table: string, key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    const currentSort = sorts[table];
    if (currentSort && currentSort.key === key && currentSort.direction === 'asc') {
        direction = 'desc';
    }
    setSorts(prev => ({...prev, [table]: { key, direction } }));
  };

  const renderSortIcon = (table: string, key: string) => {
    const sortConfig = sorts[table];
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30 group-hover:opacity-80" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  };

  const performanceFocusData = useMemo(() => {
    const data = [
      ...(analysisData.performanceByDepot || []).map(d => ({ ...d, type: 'Dépôt' })),
      ...(analysisData.performanceByWarehouse || []).map(d => ({ ...d, type: 'Entrepôt' })),
      ...(analysisData.performanceByCity || []).map(d => ({ ...d, type: 'Ville' })),
    ];
    return data
      .map(d => ({
        key: `${d.type}: ${d.key}`,
        numberOfDelays: Math.round(d.totalTasks * (1 - d.punctualityRateRealized / 100)),
      }))
      .sort((a, b) => b.numberOfDelays - a.numberOfDelays)
      .slice(0, 10);
  }, [analysisData]);


  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Analyse des Performances par Groupe</CardTitle>
          <div className="flex items-center space-x-2">
              <Switch
                  id="top-20-filter"
                  checked={showTop20Only}
                  onCheckedChange={setShowTop20Only}
              />
              <Label htmlFor="top-20-filter" className="flex items-center gap-2">
                  <Filter className="w-4 h-4"/>
                  Afficher uniquement le Top 20% (par volume)
              </Label>
          </div>
      </CardHeader>
      <CardContent>
          <Tabs defaultValue="driver" className="w-full">
              <TabsList>
                  <TabsTrigger value="driver">Par Livreur</TabsTrigger>
                  <TabsTrigger value="depot">Par Dépôt</TabsTrigger>
                  <TabsTrigger value="warehouse">Par Entrepôt</TabsTrigger>
                  <TabsTrigger value="city">Par Ville</TabsTrigger>
                  <TabsTrigger value="postalCode">Par Code Postal</TabsTrigger>
              </TabsList>
              <TabsContent value="driver" className="mt-4">
                  <ScrollArea className="h-96">
                       <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'key')}>Livreur {renderSortIcon('driver', 'key')}</TableHead>
                                    <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'totalTours')}>Nb. Tournées {renderSortIcon('driver', 'totalTours')}</TableHead>
                                    <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'punctualityRate')}>Ponctualité {renderSortIcon('driver', 'punctualityRate')}</TableHead>
                                    <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'avgDelay')}>Retard Moyen (min) {renderSortIcon('driver', 'avgDelay')}</TableHead>
                                    <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'overweightToursCount')}>Dépassements Poids {renderSortIcon('driver', 'overweightToursCount')}</TableHead>
                                    <TableHead className="cursor-pointer group" onClick={() => handleSort('driver', 'avgRating')}>Notation Moy. {renderSortIcon('driver', 'avgRating')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {(sortedData.performanceByDriver || []).map(driver => (
                                    <TableRow key={driver.key}>
                                        <TableCell>{driver.key}</TableCell>
                                        <TableCell>{driver.totalTours}</TableCell>
                                        <TableCell>{driver.punctualityRate.toFixed(1)}%</TableCell>
                                        <TableCell>{driver.avgDelay.toFixed(1)}</TableCell>
                                        <TableCell>{driver.overweightToursCount}</TableCell>
                                        <TableCell>{driver.avgRating?.toFixed(2) || 'N/A'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                   </ScrollArea>
              </TabsContent>
              <TabsContent value="depot" className="mt-4">
                 <ScrollArea className="h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'key')}>Dépôt {renderSortIcon('depot', 'key')}</TableHead>
                          <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'totalTasks')}>Nb. Tâches {renderSortIcon('depot', 'totalTasks')}</TableHead>
                          <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('depot', 'punctualityRateRealized')}</TableHead>
                          <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('depot', 'avgDurationDiscrepancy')}</TableHead>
                          <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('depot', 'avgWeightDiscrepancy')}</TableHead>
                          <TableHead className="cursor-pointer group" onClick={() => handleSort('depot', 'lateWithBadReviewPercentage')}>% Insat. {renderSortIcon('depot', 'lateWithBadReviewPercentage')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(sortedData.performanceByDepot || []).map(item => (
                          <TableRow key={item.key}>
                            <TableCell className="font-medium">{item.key}</TableCell>
                            <TableCell>{item.totalTasks}</TableCell>
                            <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                            <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                            <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                            <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                 </ScrollArea>
              </TabsContent>
              <TabsContent value="warehouse" className="mt-4">
                   <ScrollArea className="h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                             <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'key')}>Entrepôt {renderSortIcon('warehouse', 'key')}</TableHead>
                             <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'totalTasks')}>Nb. Tâches {renderSortIcon('warehouse', 'totalTasks')}</TableHead>
                             <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('warehouse', 'punctualityRateRealized')}</TableHead>
                             <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('warehouse', 'avgDurationDiscrepancy')}</TableHead>
                             <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('warehouse', 'avgWeightDiscrepancy')}</TableHead>
                             <TableHead className="cursor-pointer group" onClick={() => handleSort('warehouse', 'lateWithBadReviewPercentage')}>% Insat. {renderSortIcon('warehouse', 'lateWithBadReviewPercentage')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(sortedData.performanceByWarehouse || []).map(item => (
                            <TableRow key={item.key}>
                              <TableCell className="font-medium">{item.key}</TableCell>
                              <TableCell>{item.totalTasks}</TableCell>
                              <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                              <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                              <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                              <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                   </ScrollArea>
              </TabsContent>
              <TabsContent value="city" className="mt-4">
                   <ScrollArea className="h-96">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'key')}>Ville {renderSortIcon('city', 'key')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'totalTasks')}>Nb. Tâches {renderSortIcon('city', 'totalTasks')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('city', 'punctualityRateRealized')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('city', 'avgDurationDiscrepancy')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('city', 'avgWeightDiscrepancy')}</TableHead>
                            <TableHead className="cursor-pointer group" onClick={() => handleSort('city', 'lateWithBadReviewPercentage')}>% Insat. {renderSortIcon('city', 'lateWithBadReviewPercentage')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedData.performanceByCity.map(item => (
                             <TableRow key={item.key}>
                              <TableCell className="font-medium">{item.key}</TableCell>
                              <TableCell>{item.totalTasks}</TableCell>
                              <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                              <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                              <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                              <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                   </ScrollArea>
              </TabsContent>
              <TabsContent value="postalCode" className="mt-4">
                   <ScrollArea className="h-96">
                       <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'key')}>Code Postal {renderSortIcon('postalCode', 'key')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'totalTasks')}>Tâches {renderSortIcon('postalCode', 'totalTasks')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'punctualityRateRealized')}>Ponctualité {renderSortIcon('postalCode', 'punctualityRateRealized')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('postalCode', 'avgDurationDiscrepancy')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('postalCode', 'avgWeightDiscrepancy')}</TableHead>
                                <TableHead className="cursor-pointer group" onClick={() => handleSort('postalCode', 'lateWithBadReviewPercentage')}>% Insat. sur Retard {renderSortIcon('postalCode', 'lateWithBadReviewPercentage')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedData.performanceByPostalCode?.map(item => (
                                <TableRow key={item.key}>
                                    <TableCell>{item.key}</TableCell>
                                    <TableCell>{item.totalTasks}</TableCell>
                                    <TableCell><span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span><span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span></TableCell>
                                    <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                                    <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                                    <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                   </ScrollArea>
              </TabsContent>
          </Tabs>
      </CardContent>
    </Card>
  )
}
