
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { MergedData, MadDelayData } from '@/lib/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MadDelayManagerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  allData: MergedData[];
  madDelays: string[]; // array of 'warehouse|date' strings
  setMadDelays: (delays: string[]) => void;
}

export default function MadDelayManager({ isOpen, onOpenChange, allData, madDelays, setMadDelays }: MadDelayManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDelays, setSelectedDelays] = useState(new Set(madDelays));
  
  useEffect(() => {
    setSelectedDelays(new Set(madDelays));
  }, [madDelays]);

  const warehouseDatePairs = useMemo(() => {
    const pairs: Record<string, { warehouse: string, date: string, tourCount: number }> = {};
    allData.forEach(item => {
      if (item.tournee) {
        const key = `${item.tournee.entrepot}|${item.date}`;
        if (!pairs[key]) {
          pairs[key] = { warehouse: item.tournee.entrepot, date: item.date, tourCount: 0 };
        }
      }
    });
    // Count tours per pair
     const tourCounts: Record<string, Set<string>> = {};
     allData.forEach(item => {
         if (item.tournee) {
             const key = `${item.tournee.entrepot}|${item.date}`;
             if(!tourCounts[key]) tourCounts[key] = new Set();
             tourCounts[key].add(item.tournee.uniqueId);
         }
     });

    Object.keys(pairs).forEach(key => {
        pairs[key].tourCount = tourCounts[key]?.size || 0;
    });

    return Object.values(pairs)
        .map(p => ({...p, id: `${p.warehouse}|${p.date}`}))
        .sort((a, b) => b.date.localeCompare(a.date) || a.warehouse.localeCompare(b.warehouse));
  }, [allData]);

  const filteredPairs = useMemo(() => {
    if (!searchTerm) return warehouseDatePairs;
    const lowerSearch = searchTerm.toLowerCase();
    return warehouseDatePairs.filter(pair => 
      pair.warehouse.toLowerCase().includes(lowerSearch) || 
      pair.date.toLowerCase().includes(lowerSearch)
    );
  }, [warehouseDatePairs, searchTerm]);

  const handleToggle = (id: string, checked: boolean) => {
    const newSelection = new Set(selectedDelays);
    if (checked) {
      newSelection.add(id);
    } else {
      newSelection.delete(id);
    }
    setSelectedDelays(newSelection);
  };
  
  const handleSelectAllFiltered = () => {
    const newSelection = new Set(selectedDelays);
    filteredPairs.forEach(pair => newSelection.add(pair.id));
    setSelectedDelays(newSelection);
  }

  const handleDeselectAllFiltered = () => {
      const newSelection = new Set(selectedDelays);
      const filteredIds = new Set(filteredPairs.map(p => p.id));
      for (const id of newSelection) {
        if (filteredIds.has(id)) {
            newSelection.delete(id);
        }
      }
      setSelectedDelays(newSelection);
  }

  const handleSave = () => {
    setMadDelays(Array.from(selectedDelays));
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Gérer les Retards de Mise à Disposition (MAD)</DialogTitle>
          <DialogDescription>
            Cochez les entrepôts/dates pour lesquels les retards sont dus à la préparation (MAD) et non au transport. 
            Les tournées correspondantes seront exclues de l'analyse si le filtre "Exclure retards MAD" est activé.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
            <Input 
                placeholder="Rechercher un entrepôt ou une date..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">{filteredPairs.length} résultat(s) affiché(s).</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleSelectAllFiltered}>Tout sélectionner</Button>
                    <Button variant="outline" size="sm" onClick={handleDeselectAllFiltered}>Tout désélectionner</Button>
                </div>
            </div>
            <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Entrepôt</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Nb. Tournées</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredPairs.map((pair) => (
                        <TableRow key={pair.id}>
                            <TableCell>
                                <Checkbox
                                    id={pair.id}
                                    checked={selectedDelays.has(pair.id)}
                                    onCheckedChange={(checked) => handleToggle(pair.id, !!checked)}
                                />
                            </TableCell>
                            <TableCell className="font-medium">{pair.warehouse}</TableCell>
                            <TableCell>{format(new Date(pair.date), 'eeee dd MMMM yyyy', { locale: fr })}</TableCell>
                            <TableCell>{pair.tourCount}</TableCell>
                        </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        <DialogFooter>
            <span className="text-sm text-muted-foreground mr-auto">
                {selectedDelays.size} jour(s) d'entrepôt marqué(s) comme MAD.
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave}>Enregistrer les modifications</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
