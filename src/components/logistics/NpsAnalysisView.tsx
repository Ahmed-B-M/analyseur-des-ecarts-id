'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MergedData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { getCarrierFromDriverName, getNomDepot } from '@/lib/utils';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLogistics } from '@/context/LogisticsContext';
import { DateRange } from 'react-day-picker';
import { isWithinInterval, parseISO, format } from 'date-fns';

const ITEMS_PER_PAGE = 25;

type NpsCategory = 'Promoteur' | 'Passif' | 'Détracteur';

const getNpsCategory = (note: number | null): NpsCategory | null => {
    if (note === null || note === undefined) return null;
    if (note >= 9) return 'Promoteur';
    if (note >= 7) return 'Passif';
    return 'Détracteur';
};

const calculateNps = (notes: (number | null | undefined)[]) => {
    const validNotes = notes.filter(n => n !== null && n !== undefined) as number[];
    if (validNotes.length === 0) {
        return { nps: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };
    }
    const promoters = validNotes.filter(n => n >= 9).length;
    const detractors = validNotes.filter(n => n <= 6).length;
    const total = validNotes.length;
    const promoterPercent = (promoters / total) * 100;
    const detractorPercent = (detractors / total) * 100;
    const nps = Math.round(promoterPercent - detractorPercent);
    return { 
        nps, 
        promoters, 
        passives: total - promoters - detractors, 
        detractors, 
        total 
    };
};

export default function NpsAnalysisView({ data }: { data: MergedData[] }) {
  const { state } = useLogistics();
  const { filters } = state;
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof MergedData | 'depot' | 'carrier' | 'npsCategory' | 'dateRetrait'; direction: 'asc' | 'desc' } | null>({ key: 'noteRecommandation', direction: 'asc' });

  const verbatimsData = useMemo(() => {
    let verbatimItems = data.filter(item => item.verbatimData && item.verbatimData.noteRecommandation !== null);

    // Date filtering on verbatimData.dateRetrait
    if (filters.dateRange) {
        const { from, to } = filters.dateRange as DateRange;
        verbatimItems = verbatimItems.filter(item => {
            if (!item.verbatimData?.dateRetrait) return false;
            try {
                const verbatimDate = parseISO(item.verbatimData.dateRetrait);
                if (from && to) {
                    return isWithinInterval(verbatimDate, { start: from, end: to });
                } else if (from) {
                    return verbatimDate >= from;
                } else if (to) {
                    return verbatimDate <= to;
                }
                return true;
            } catch (e) {
                return false;
            }
        });
    } else if (filters.selectedDate) {
         const selectedDateStr = format(new Date(filters.selectedDate), 'yyyy-MM-dd');
         verbatimItems = verbatimItems.filter(item => {
            return item.verbatimData?.dateRetrait === selectedDateStr;
        });
    }
    
    // Apply other filters
    verbatimItems = verbatimItems.filter(item => {
        if (filters.depots && filters.depots.length > 0 && !filters.depots.includes(getNomDepot(item.entrepot))) return false;
        if (filters.warehouses && filters.warehouses.length > 0 && !filters.warehouses.includes(item.warehouse)) return false;
        if (filters.carriers && filters.carriers.length > 0 && (!item.carrier || !filters.carriers.includes(item.carrier))) return false;
        if (filters.city && item.ville !== filters.city) return false;
        if (filters.codePostal && item.codePostal !== filters.codePostal) return false;
        if (filters.driverName) {
            const driverName = item.livreur?.toLowerCase() || '';
            const filterValue = filters.driverName.toLowerCase();
            if (filters.driverNameFilterType === 'suffix') {
                if (!driverName.endsWith(filterValue)) return false;
            } else { // prefix by default
                if (!driverName.startsWith(filterValue)) return false;
            }
        }
        return true;
    });

    return verbatimItems;
  }, [data, filters]);

  const npsSummary = useMemo(() => {
    const allNotes = verbatimsData.map(d => d.verbatimData?.noteRecommandation);
    
    const byDepot = verbatimsData.reduce((acc, item) => {
        const depot = getNomDepot(item.entrepot);
        if (!acc[depot]) acc[depot] = [];
        acc[depot].push(item.verbatimData?.noteRecommandation);
        return acc;
    }, {} as Record<string, number[]>);

    const byCarrier = verbatimsData.reduce((acc, item) => {
        const carrier = getCarrierFromDriverName(item.livreur) || 'Inconnu';
        if (!acc[carrier]) acc[carrier] = [];
        acc[carrier].push(item.verbatimData?.noteRecommandation);
        return acc;
    }, {} as Record<string, number[]>);

    const byDriver = verbatimsData.reduce((acc, item) => {
        const driver = item.livreur || 'Inconnu';
        if (!acc[driver]) acc[driver] = [];
        acc[driver].push(item.verbatimData?.noteRecommandation);
        return acc;
    }, {} as Record<string, number[]>);

    return {
        global: calculateNps(allNotes),
        byDepot: Object.entries(byDepot).map(([name, notes]) => ({ name, ...calculateNps(notes) })).sort((a,b) => b.nps - a.nps),
        byCarrier: Object.entries(byCarrier).map(([name, notes]) => ({ name, ...calculateNps(notes) })).sort((a,b) => b.nps - a.nps),
        byDriver: Object.entries(byDriver).map(([name, notes]) => ({ name, ...calculateNps(notes) })).sort((a,b) => b.nps - a.nps),
    };

  }, [verbatimsData]);


  const filteredData = useMemo(() => {
    return verbatimsData.filter(item => {
      const search = searchTerm.toLowerCase();
      return (
        item.idTache?.toLowerCase().includes(search) ||
        item.livreur?.toLowerCase().includes(search) ||
        getNomDepot(item.entrepot)?.toLowerCase().includes(search) ||
        getCarrierFromDriverName(item.livreur)?.toLowerCase().includes(search) ||
        item.verbatimData?.verbatim?.toLowerCase().includes(search)
      );
    });
  }, [verbatimsData, searchTerm]);

  type SortKey = keyof MergedData | 'depot' | 'carrier' | 'npsCategory' | 'noteRecommandation' | 'verbatim' | 'dateRetrait';
  
  const sortedData = useMemo(() => {
    let dataToSort = [...filteredData];

    if (sortConfig) {
        dataToSort.sort((a, b) => {
            let aValue, bValue;

            if (sortConfig.key === 'noteRecommandation') {
                aValue = a.verbatimData?.noteRecommandation;
                bValue = b.verbatimData?.noteRecommandation;
            } else if (sortConfig.key === 'verbatim') {
                aValue = a.verbatimData?.verbatim;
                bValue = b.verbatimData?.verbatim;
            } else if (sortConfig.key === 'dateRetrait') {
                aValue = a.verbatimData?.dateRetrait;
                bValue = b.verbatimData?.dateRetrait;
            } else if (sortConfig.key === 'depot') {
                aValue = getNomDepot(a.entrepot);
                bValue = getNomDepot(b.entrepot);
            } else if (sortConfig.key === 'carrier') {
                aValue = getCarrierFromDriverName(a.livreur);
                bValue = getCarrierFromDriverName(b.livreur);
            } else if (sortConfig.key === 'npsCategory') {
                aValue = getNpsCategory(a.verbatimData?.noteRecommandation ?? null);
                bValue = getNpsCategory(b.verbatimData?.noteRecommandation ?? null);
            } else {
                aValue = a[sortConfig.key as keyof MergedData];
                bValue = b[sortConfig.key as keyof MergedData];
            }

            if (aValue == null) return 1;
            if (bValue == null) return -1;
            
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            
            return 0;
        });
    }
    return dataToSort;
  }, [filteredData, sortConfig]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage]);
  
  const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };
  
  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>Synthèse Net Promoter Score (NPS)</CardTitle>
                <CardDescription>
                    Score global et ventilation par dépôt, transporteur et livreur pour la période et les filtres sélectionnés.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-center items-center gap-8 p-6 bg-muted rounded-lg">
                    <div className="text-center">
                        <p className="text-sm text-muted-foreground">NPS Global</p>
                        <p className={cn("text-6xl font-bold", npsSummary.global.nps > 0 ? 'text-green-600' : 'text-red-600')}>{npsSummary.global.nps}</p>
                    </div>
                    <div className="text-sm space-y-1">
                        <p>Total des réponses : <strong>{npsSummary.global.total}</strong></p>
                        <p>Promoteurs (9-10) : <strong className="text-green-600">{npsSummary.global.promoters}</strong></p>
                        <p>Passifs (7-8) : <strong className="text-yellow-600">{npsSummary.global.passives}</strong></p>
                        <p>Détracteurs (0-6) : <strong className="text-red-600">{npsSummary.global.detractors}</strong></p>
                    </div>
                </div>

                <Tabs defaultValue="depot">
                    <TabsList>
                        <TabsTrigger value="depot">Par Dépôt</TabsTrigger>
                        <TabsTrigger value="carrier">Par Transporteur</TabsTrigger>
                        <TabsTrigger value="driver">Par Livreur</TabsTrigger>
                    </TabsList>
                    <TabsContent value="depot" className="mt-4">
                        <div className="max-h-80 overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow><TableHead>Dépôt</TableHead><TableHead>NPS</TableHead><TableHead>Total Réponses</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {npsSummary.byDepot.map(s => (
                                        <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell>{s.nps}</TableCell><TableCell>{s.total}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                    <TabsContent value="carrier" className="mt-4">
                        <div className="max-h-80 overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow><TableHead>Transporteur</TableHead><TableHead>NPS</TableHead><TableHead>Total Réponses</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {npsSummary.byCarrier.map(s => (
                                        <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell>{s.nps}</TableCell><TableCell>{s.total}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                    <TabsContent value="driver" className="mt-4">
                        <div className="max-h-80 overflow-y-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow><TableHead>Livreur</TableHead><TableHead>NPS</TableHead><TableHead>Total Réponses</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {npsSummary.byDriver.map(s => (
                                        <TableRow key={s.name}><TableCell>{s.name}</TableCell><TableCell>{s.nps}</TableCell><TableCell>{s.total}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Détail des Verbatims Clients</CardTitle>
            <CardDescription>
              Consultez les notes NPS et les verbatims clients associés aux livraisons.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Rechercher par N° commande, livreur, dépôt, transporteur, verbatim..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="max-w-md"
            />
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead onClick={() => handleSort('dateRetrait')} className="cursor-pointer">Date {renderSortIcon('dateRetrait')}</TableHead>
                    <TableHead onClick={() => handleSort('idTache')} className="cursor-pointer">N° Commande {renderSortIcon('idTache')}</TableHead>
                    <TableHead onClick={() => handleSort('depot')} className="cursor-pointer">Dépôt {renderSortIcon('depot')}</TableHead>
                    <TableHead onClick={() => handleSort('carrier')} className="cursor-pointer">Transporteur {renderSortIcon('carrier')}</TableHead>
                    <TableHead onClick={() => handleSort('livreur')} className="cursor-pointer">Livreur {renderSortIcon('livreur')}</TableHead>
                    <TableHead onClick={() => handleSort('noteRecommandation')} className="cursor-pointer">Note NPS {renderSortIcon('noteRecommandation')}</TableHead>
                    <TableHead onClick={() => handleSort('npsCategory')} className="cursor-pointer">Catégorie NPS {renderSortIcon('npsCategory')}</TableHead>
                    <TableHead onClick={() => handleSort('verbatim')} className="cursor-pointer">Verbatim {renderSortIcon('verbatim')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.length > 0 ? paginatedData.map((item) => {
                    const npsCategory = getNpsCategory(item.verbatimData?.noteRecommandation ?? null);
                    return (
                        <TableRow key={`${item.idTache}-${item.livreur}`}>
                            <TableCell>{item.verbatimData?.dateRetrait}</TableCell>
                            <TableCell>{item.idTache}</TableCell>
                            <TableCell>{getNomDepot(item.entrepot)}</TableCell>
                            <TableCell>{getCarrierFromDriverName(item.livreur) || 'N/A'}</TableCell>
                            <TableCell>{item.livreur}</TableCell>
                            <TableCell>{item.verbatimData?.noteRecommandation}</TableCell>
                            <TableCell>
                                {npsCategory && (
                                    <Badge className={cn({
                                        'bg-green-600 hover:bg-green-700 text-white': npsCategory === 'Promoteur',
                                        'bg-yellow-500 hover:bg-yellow-600 text-white': npsCategory === 'Passif',
                                        'bg-red-600 hover:bg-red-700 text-white': npsCategory === 'Détracteur',
                                    })}>
                                        {npsCategory}
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell className="max-w-md whitespace-pre-wrap">{item.verbatimData?.verbatim}</TableCell>
                        </TableRow>
                    )
                  }) : (
                      <TableRow><TableCell colSpan={8} className="text-center h-24">Aucune donnée de verbatim à afficher. Veuillez charger un fichier de verbatims.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} sur {totalPages} ({sortedData.length} résultats)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Suivant <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>}
          </CardContent>
        </Card>
    </div>
  );
}
