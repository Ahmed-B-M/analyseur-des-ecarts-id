
'use client';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Filter, ArrowUpDown } from 'lucide-react';
import type { AnalysisData, PerformanceByDriver, PerformanceByGeo, PerformanceByGroup } from '@/lib/types';
import { DriverPerformanceTable } from './DriverPerformanceTable';
import { GeoPerformanceTable } from './GeoPerformanceTable';

type SortConfig<T> = {
    key: keyof T;
    direction: 'asc' | 'desc';
} | null;

export function PerformanceTables({ analysisData }: { analysisData: AnalysisData }) {
  const [showTop20Only, setShowTop20Only] = useState(false);
  
  const [sorts, setSorts] = useState<{ [key: string]: SortConfig<any> }>({
      driver: { key: 'totalTours', direction: 'desc' },
      depot: { key: 'totalTasks', direction: 'desc' },
      warehouse: { key: 'totalTasks', direction: 'desc' },
      city: { key: 'totalTasks', direction: 'desc' },
      postalCode: { key: 'totalTasks', direction: 'desc' },
  });

  const processedData = useMemo(() => {
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

    const filterTop20 = <T extends { totalTasks: number }>(data: T[] | undefined): T[] => {
        if (!data || !showTop20Only) return data || [];
        
        const sortedByVolume = [...data].sort((a, b) => b.totalTasks - a.totalTasks);
        const sliceCount = Math.ceil(sortedByVolume.length * 0.2);
        const topKeys = new Set(sortedByVolume.slice(0, sliceCount).map((item: any) => item.key));
        
        return data.filter((item: any) => topKeys.has(item.key));
    };
    
    return {
      performanceByDriver: sortFn<PerformanceByDriver>(analysisData.performanceByDriver, sorts.driver),
      performanceByCity: filterTop20(sortFn<PerformanceByGeo>(analysisData.performanceByCity, sorts.city)),
      performanceByPostalCode: filterTop20(sortFn<PerformanceByGeo>(analysisData.performanceByPostalCode, sorts.postalCode)),
      performanceByDepot: filterTop20(sortFn<PerformanceByGroup>(analysisData.performanceByDepot, sorts.depot)),
      performanceByWarehouse: filterTop20(sortFn<PerformanceByGroup>(analysisData.performanceByWarehouse, sorts.warehouse)),
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
                  <DriverPerformanceTable
                    data={processedData.performanceByDriver}
                    onSort={(key) => handleSort('driver', key)}
                    renderSortIcon={(key) => renderSortIcon('driver', key)}
                  />
              </TabsContent>
              <TabsContent value="depot" className="mt-4">
                 <GeoPerformanceTable
                    data={processedData.performanceByDepot}
                    onSort={(key) => handleSort('depot', key)}
                    renderSortIcon={(key) => renderSortIcon('depot', key)}
                    groupTitle="Dépôt"
                 />
              </TabsContent>
              <TabsContent value="warehouse" className="mt-4">
                   <GeoPerformanceTable
                    data={processedData.performanceByWarehouse}
                    onSort={(key) => handleSort('warehouse', key)}
                    renderSortIcon={(key) => renderSortIcon('warehouse', key)}
                    groupTitle="Entrepôt"
                 />
              </TabsContent>
              <TabsContent value="city" className="mt-4">
                   <GeoPerformanceTable
                    data={processedData.performanceByCity}
                    onSort={(key) => handleSort('city', key)}
                    renderSortIcon={(key) => renderSortIcon('city', key)}
                    groupTitle="Ville"
                 />
              </TabsContent>
              <TabsContent value="postalCode" className="mt-4">
                   <GeoPerformanceTable
                    data={processedData.performanceByPostalCode}
                    onSort={(key) => handleSort('postalCode', key)}
                    renderSortIcon={(key) => renderSortIcon('postalCode', key)}
                    groupTitle="Code Postal"
                 />
              </TabsContent>
          </Tabs>
      </CardContent>
    </Card>
  )
}
