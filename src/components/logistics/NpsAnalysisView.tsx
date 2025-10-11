
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

const ITEMS_PER_PAGE = 25;

type NpsCategory = 'Promoter' | 'Passive' | 'Detractor';

const getNpsCategory = (note: number | null): NpsCategory | null => {
    if (note === null) return null;
    if (note >= 9) return 'Promoter';
    if (note >= 7) return 'Passive';
    return 'Detractor';
};

export default function NpsAnalysisView({ data }: { data: MergedData[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof MergedData | 'depot' | 'carrier' | 'npsCategory'; direction: 'asc' | 'desc' } | null>({ key: 'noteRecommandation', direction: 'asc' });

  const verbatimsData = useMemo(() => {
    return data.filter(item => item.verbatimData);
  }, [data]);


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

  type SortKey = keyof MergedData | 'depot' | 'carrier' | 'npsCategory' | 'noteRecommandation' | 'verbatim';
  
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
    <Card>
      <CardHeader>
        <CardTitle>Analyse NPS &amp; Verbatims</CardTitle>
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
                        <TableCell>{item.idTache}</TableCell>
                        <TableCell>{getNomDepot(item.entrepot)}</TableCell>
                        <TableCell>{getCarrierFromDriverName(item.livreur) || 'N/A'}</TableCell>
                        <TableCell>{item.livreur}</TableCell>
                        <TableCell>{item.verbatimData?.noteRecommandation}</TableCell>
                        <TableCell>
                            {npsCategory && (
                                <Badge className={cn({
                                    'bg-green-600 hover:bg-green-700': npsCategory === 'Promoter',
                                    'bg-yellow-500 hover:bg-yellow-600': npsCategory === 'Passive',
                                    'bg-red-600 hover:bg-red-700': npsCategory === 'Detractor',
                                })}>
                                    {npsCategory}
                                </Badge>
                            )}
                        </TableCell>
                        <TableCell className="max-w-md whitespace-pre-wrap">{item.verbatimData?.verbatim}</TableCell>
                    </TableRow>
                )
              }) : (
                  <TableRow><TableCell colSpan={7} className="text-center h-24">Aucune donnée de verbatim à afficher. Veuillez charger un fichier de verbatims.</TableCell></TableRow>
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
  );
}
