'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

interface FilterBarProps {
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  depots: string[];
  warehouses: string[];
}

const ALL_ITEMS_VALUE = '__ALL__';

export default function FilterBar({ filters, setFilters, depots, warehouses }: FilterBarProps) {

  const handleFilterChange = (key: string, value: any) => {
    if (value === ALL_ITEMS_VALUE) {
        const newFilters = { ...filters };
        delete newFilters[key];
        setFilters(newFilters);
    } else {
        setFilters({ ...filters, [key]: value });
    }
  };
  
  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
  }

  const activeFilters = Object.keys(filters).filter(key => key !== 'period' && filters[key]);

  return (
    <div className="p-4 bg-card rounded-lg border shadow-sm space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <Label htmlFor="period-select">Période</Label>
          <Select
            value={filters.period || 'all'}
            onValueChange={(value) => handleFilterChange('period', value)}
          >
            <SelectTrigger id="period-select">
              <SelectValue placeholder="Sélectionner une période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout</SelectItem>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="depot-select">Dépôt</Label>
          <Select
            value={filters.depot || ALL_ITEMS_VALUE}
            onValueChange={(value) => handleFilterChange('depot', value)}
          >
            <SelectTrigger id="depot-select">
              <SelectValue placeholder="Tous les dépôts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_VALUE}>Tous les dépôts</SelectItem>
              {depots.map(depot => (
                <SelectItem key={depot} value={depot}>{depot}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="warehouse-select">Entrepôt</Label>
           <Select
            value={filters.entrepot || ALL_ITEMS_VALUE}
            onValueChange={(value) => handleFilterChange('entrepot', value)}
          >
            <SelectTrigger id="warehouse-select">
              <SelectValue placeholder="Tous les entrepôts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_VALUE}>Tous les entrepôts</SelectItem>
              {warehouses.map(warehouse => (
                <SelectItem key={warehouse} value={warehouse}>{warehouse}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="punctuality-threshold">Seuil Ponctualité (min)</Label>
          <Input 
            id="punctuality-threshold" 
            type="number" 
            placeholder="ex: 15"
            value={filters.punctualityThreshold || ''}
            onChange={(e) => handleFilterChange('punctualityThreshold', e.target.value ? parseInt(e.target.value) : undefined)}
           />
        </div>
        <div>
          <Label htmlFor="max-weight-threshold">Seuil Poids Max (kg)</Label>
          <Input 
            id="max-weight-threshold" 
            type="number" 
            placeholder="ex: 500"
            value={filters.maxWeightThreshold || ''}
            onChange={(e) => handleFilterChange('maxWeightThreshold', e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
      </div>
      {activeFilters.length > 0 && (
         <div className="flex items-center gap-2 pt-2 flex-wrap">
            <span className="text-sm font-medium">Filtres actifs:</span>
            {activeFilters.map(key => (
                 <div key={key} className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-full">
                    <span>{key}: {filters[key]}</span>
                    <button onClick={() => clearFilter(key)} className="rounded-full hover:bg-primary/20">
                        <X className="h-3 w-3" />
                    </button>
                 </div>
            ))}
            <button onClick={() => setFilters({ period: filters.period })} className="text-sm text-muted-foreground hover:text-foreground underline">
                Tout effacer
            </button>
         </div>
      )}
    </div>
  );
}
