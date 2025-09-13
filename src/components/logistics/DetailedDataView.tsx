'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { MergedData } from '@/lib/types';
import { cn } from '@/lib/utils';


const ITEMS_PER_PAGE = 25;
const TOLERANCE_MINUTES = 15 * 60; // 15 minutes in seconds

type SortKey = keyof MergedData | `tournee.${keyof NonNullable<MergedData['tournee']>}`;

function formatSecondsToTime(seconds: number): string {
    if (isNaN(seconds) || seconds === 0) return '00:00';
    const date = new Date(seconds * 1000);
    return date.toISOString().substr(11, 5);
}

export default function DetailedDataView({ data }: { data: MergedData[] }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const search = searchTerm.toLowerCase();
      return (
        item.nomTournee?.toLowerCase().includes(search) ||
        item.livreur?.toLowerCase().includes(search) ||
        item.ville?.toLowerCase().includes(search) ||
        item.codePostal?.toLowerCase().includes(search) ||
        item.date?.toLowerCase().includes(search) ||
        item.entrepot?.toLowerCase().includes(search)
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
    setCurrentPage(1);
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
        placeholder="Rechercher par tournée, livreur, ville, date..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setCurrentPage(1);
        }}
        className="max-w-sm"
      />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead onClick={() => handleSort('date')} className="cursor-pointer">Date {renderSortIcon('date')}</TableHead>
              <TableHead onClick={() => handleSort('nomTournee')} className="cursor-pointer">Tournée {renderSortIcon('nomTournee')}</TableHead>
              <TableHead onClick={() => handleSort('entrepot')} className="cursor-pointer">Entrepôt {renderSortIcon('entrepot')}</TableHead>
              <TableHead onClick={() => handleSort('livreur')} className="cursor-pointer">Livreur {renderSortIcon('livreur')}</TableHead>
              <TableHead onClick={() => handleSort('ville')} className="cursor-pointer">Ville {renderSortIcon('ville')}</TableHead>
              <TableHead onClick={() => handleSort('heureDebutCreneau')} className="cursor-pointer">Créneau {renderSortIcon('heureDebutCreneau')}</TableHead>
              <TableHead onClick={() => handleSort('heureCloture')} className="cursor-pointer">Heure Clôture {renderSortIcon('heureCloture')}</TableHead>
              <TableHead onClick={() => handleSort('retard')} className="cursor-pointer">Retard {renderSortIcon('retard')}</TableHead>
              <TableHead onClick={() => handleSort('notation')} className="cursor-pointer">Note {renderSortIcon('notation')}</TableHead>
              <TableHead>Commentaire</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? paginatedData.map((item, index) => (
              <TableRow key={`${item.tourneeUniqueId}-${item.sequence}-${index}`}>
                <TableCell>{item.date}</TableCell>
                <TableCell>{item.nomTournee}</TableCell>
                <TableCell>{item.entrepot}</TableCell>
                <TableCell>{item.livreur}</TableCell>
                <TableCell>{item.ville}, {item.codePostal}</TableCell>
                <TableCell>{formatSecondsToTime(item.heureDebutCreneau)} - {formatSecondsToTime(item.heureFinCreneau)}</TableCell>
                <TableCell>{formatSecondsToTime(item.heureCloture)}</TableCell>
                <TableCell className={cn(
                  item.retard > TOLERANCE_MINUTES ? 'text-destructive' : item.retard < -TOLERANCE_MINUTES ? 'text-blue-500' : 'text-foreground'
                )}>
                  {item.retard > 0 ? '+' : ''}{Math.floor(item.retard / 60)} min
                </TableCell>
                <TableCell>{item.notation ?? 'N/A'}</TableCell>
                <TableCell className="max-w-xs truncate" title={item.commentaire || ''}>{item.commentaire}</TableCell>
              </TableRow>
            )) : (
                <TableRow><TableCell colSpan={10} className="text-center h-24">Aucune donnée à afficher.</TableCell></TableRow>
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
    </div>
  );
}
