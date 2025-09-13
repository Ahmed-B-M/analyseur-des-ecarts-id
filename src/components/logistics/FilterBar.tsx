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
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FilterBarProps {
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  depots: string[];
  warehouses: string[];
}

const ALL_ITEMS_VALUE = '__ALL__';

export default function FilterBar({ filters, setFilters, depots, warehouses }: FilterBarProps) {

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters };
    if (value === ALL_ITEMS_VALUE || value === '') {
        delete newFilters[key];
    } else {
        newFilters[key] = value;
    }
    
    // When changing period, remove selectedDate
    if (key === 'period' && newFilters.selectedDate) {
        delete newFilters.selectedDate;
    }
    
    setFilters(newFilters);
  };
  
  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
  }
  
  const clearAllFilters = () => {
    const persistentFilters = ['period', 'punctualityThreshold', 'maxWeightThreshold'];
    const newFilters: Record<string, any> = {};
    persistentFilters.forEach(key => {
        if(filters[key]) {
            newFilters[key] = filters[key];
        }
    });
    setFilters(newFilters);
  }

  const activeFilters = Object.keys(filters).filter(key => 
    !['period', 'punctualityThreshold', 'maxWeightThreshold'].includes(key) && filters[key]
  );
  
  const getFilterLabel = (key: string) => {
      switch(key) {
          case 'depot': return 'Dépôt';
          case 'entrepot': return 'Entrepôt';
          case 'selectedDate': return 'Date';
          case 'city': return 'Ville';
          case 'codePostal': return 'Code Postal';
          case 'heure': return 'Heure';
          default: return key;
      }
  }
  
  const getFilterValue = (key: string, value: any) => {
      if (key === 'selectedDate') {
          return format(new Date(value), 'd MMMM yyyy', { locale: fr });
      }
       if (key === 'heure') {
          return `${value}h - ${parseInt(value) + 1}h`;
      }
      return value;
  }

  return (
    <div className="p-4 bg-card rounded-lg border shadow-sm space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div>
          <Label htmlFor="period-select">Période</Label>
          <Select
            value={filters.period || 'all'}
            onValueChange={(value) => handleFilterChange('period', value)}
            disabled={!!filters.selectedDate}
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
                 <Badge key={key} variant="secondary" className="flex items-center gap-1.5">
                    <span>{getFilterLabel(key)}: {getFilterValue(key, filters[key])}</span>
                    <button onClick={() => clearFilter(key)} className="rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                        <X className="h-3 w-3" />
                    </button>
                 </Badge>
            ))}
            <button onClick={clearAllFilters} className="text-sm text-muted-foreground hover:text-foreground underline">
                Tout effacer
            </button>
         </div>
      )}
    </div>
  );
}
