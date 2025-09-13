'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MergedData } from '@/lib/types';

const ITEMS_PER_PAGE = 25;

type SortKey = keyof MergedData | `tournee.${keyof NonNullable<MergedData['tournee']>}`;


export default function DetailedDataView({ data }: { data: MergedData[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const search = searchTerm.toLowerCase();
      return (
        item.nomTournee?.toLowerCase().includes(search) ||
        item.tournee?.livreur?.toLowerCase().includes(search) ||
        item.ville?.toLowerCase().includes(search) ||
        item.codePostal?.toLowerCase().includes(search)
      );
    });
  }, [data, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      let aValue, bValue;
      if (sortConfig.key.startsWith('tournee.')) {
        const subKey = sortConfig.key.split('.')[1] as keyof NonNullable<MergedData['tournee']>;
        aValue = a.tournee?.[subKey];
        bValue = b.tournee?.[subKey];
      } else {
        aValue = a[sortConfig.key as keyof MergedData];
        bValue = b[sortConfig.key as keyof MergedData];
      }

      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
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
  };
  
  const renderSortIcon = (key: SortKey) => {
    if (!sortConfig || sortConfig.key !== key) {
        return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    }
    return sortConfig.direction === 'asc' ? '▲' : '▼';
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Rechercher dans les données..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('nomTournee')} className="cursor-pointer">Tournée {renderSortIcon('nomTournee')}</TableHead>
              <TableHead onClick={() => handleSort('tournee.livreur')} className="cursor-pointer">Livreur {renderSortIcon('tournee.livreur')}</TableHead>
              <TableHead onClick={() => handleSort('ville')} className="cursor-pointer">Ville {renderSortIcon('ville')}</TableHead>
              <TableHead onClick={() => handleSort('heurePrevue')} className="cursor-pointer">Prévu {renderSortIcon('heurePrevue')}</TableHead>
              <TableHead onClick={() => handleSort('heureRealisee')} className="cursor-pointer">Réalisé {renderSortIcon('heureRealisee')}</TableHead>
              <TableHead onClick={() => handleSort('notation')} className="cursor-pointer">Note {renderSortIcon('notation')}</TableHead>
              <TableHead>Commentaire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? paginatedData.map((item, index) => (
              <TableRow key={`${item.tourneeUniqueId}-${index}`}>
                <TableCell>{item.nomTournee}</TableCell>
                <TableCell>{item.tournee?.livreur}</TableCell>
                <TableCell>{item.ville}, {item.codePostal}</TableCell>
                <TableCell>{new Date(item.heurePrevue * 1000).toISOString().substr(11, 5)}</TableCell>
                <TableCell>{new Date(item.heureRealisee * 1000).toISOString().substr(11, 5)}</TableCell>
                <TableCell>{item.notation ?? 'N/A'}</TableCell>
                <TableCell className="max-w-xs truncate">{item.commentaire}</TableCell>
              </TableRow>
            )) : (
                <TableRow><TableCell colSpan={7} className="text-center">Aucune donnée trouvée.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {currentPage} sur {totalPages}
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
      </div>
    </div>
  );
}
