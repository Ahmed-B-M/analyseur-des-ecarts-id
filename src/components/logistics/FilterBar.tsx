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
import { X, SlidersHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DateRangePicker } from './DateRangePicker';
import { DateRange } from 'react-day-picker';
import { Switch } from '../ui/switch';
import { Button } from '../ui/button';
import MadDelayManager from './MadDelayManager';
import { useState } from 'react';

interface FilterBarProps {
  filters: Record<string, any>;
  setFilters: (filters: Record<string, any>) => void;
  depots: string[];
  warehouses: string[];
  cities: string[];
  allData: any[]; // Used for MAD delay manager
}

const ALL_ITEMS_VALUE = '__ALL__';

export default function FilterBar({ filters, setFilters, depots, warehouses, cities, allData }: FilterBarProps) {
  const [isMadManagerOpen, setIsMadManagerOpen] = useState(false);

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...filters };
    if (value === ALL_ITEMS_VALUE || value === '' || value === undefined) {
        delete newFilters[key];
    } else {
        newFilters[key] = value;
    }
    
    if (key === 'dateRange') {
        if(value) delete newFilters.selectedDate;
        else delete newFilters.dateRange
    } else if (key === 'selectedDate') {
        if(value) delete newFilters.dateRange;
        else delete newFilters.selectedDate;
    }
    
    setFilters(newFilters);
  };
  
  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
  }
  
  const clearAllFilters = () => {
    const persistentFilters = ['punctualityThreshold', 'tours100Mobile', 'excludeMadDelays', 'madDelays'];
    const newFilters: Record<string, any> = {};
    persistentFilters.forEach(key => {
        if(filters[key] !== undefined) {
            newFilters[key] = filters[key];
        }
    });
    setFilters(newFilters);
  }

  const activeFilters = Object.keys(filters).filter(key => 
    !['punctualityThreshold', 'madDelays', 'lateTourTolerance'].includes(key) && filters[key] !== undefined && filters[key] !== null && filters[key] !== false
  );
  
  const getFilterLabel = (key: string) => {
      switch(key) {
          case 'depot': return 'Dépôt';
          case 'entrepot': return 'Entrepôt';
          case 'selectedDate': return 'Date';
          case 'dateRange': return 'Période';
          case 'city': return 'Ville';
          case 'codePostal': return 'Code Postal';
          case 'heure': return 'Heure';
          case 'tours100Mobile': return '100% Mobile';
          case 'excludeMadDelays': return 'Exclure MAD';
          case 'topPostalCodes': return 'Top Codes Postaux';
          case 'lateTourTolerance': return 'Tolérance Retard Tournée';
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
      if (key === 'dateRange' && typeof value === 'object' && value && value.from && value.to) {
         if (value.from.getTime() === value.to.getTime()) {
            return format(value.from, 'd MMMM yyyy', { locale: fr });
         }
        return `${format(value.from, 'd MMM', { locale: fr })} - ${format(value.to, 'd MMM yyyy', { locale: fr })}`;
      }
      if (key === 'dateRange' && typeof value === 'object' && value && value.from) {
        return `Depuis le ${format(value.from, 'd MMMM yyyy', { locale: fr })}`;
      }
       if (key === 'dateRange' && typeof value === 'object' && value && value.to) {
        return `Jusqu'au ${format(value.to, 'd MMMM yyyy', { locale: fr })}`;
      }
      if (key === 'tours100Mobile' && value === true) {
        return "Oui";
      }
      if (key === 'excludeMadDelays' && value === true) {
        return "Oui";
      }
      return value;
  }

  return (
    <div className="p-4 bg-card rounded-lg border shadow-sm space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
        <div>
          <Label>Période d'Analyse</Label>
          <DateRangePicker 
            onDateChange={(range) => handleFilterChange('dateRange', range)}
            date={filters.dateRange}
            disabled={!!filters.selectedDate}
          />
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
          <Label htmlFor="city-select">Ville</Label>
           <Select
            value={filters.city || ALL_ITEMS_VALUE}
            onValueChange={(value) => handleFilterChange('city', value)}
          >
            <SelectTrigger id="city-select">
              <SelectValue placeholder="Toutes les villes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ITEMS_VALUE}>Toutes les villes</SelectItem>
              {cities.map(city => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="top-postal-codes">Top Codes Postaux</Label>
          <Input 
            id="top-postal-codes" 
            type="number" 
            placeholder="ex: 10"
            value={filters.topPostalCodes || ''}
            onChange={(e) => handleFilterChange('topPostalCodes', e.target.value ? parseInt(e.target.value) : undefined)}
           />
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
          <Label htmlFor="late-tour-tolerance">Tolérance Retard Tournée (min)</Label>
          <Input
            id="late-tour-tolerance"
            type="number"
            placeholder="ex: 0"
            value={filters.lateTourTolerance || ''}
            onChange={(e) => handleFilterChange('lateTourTolerance', e.target.value ? parseInt(e.target.value) : undefined)}
           />
        </div>
        <div className="flex items-center space-x-2 pb-2">
            <Switch 
                id="tours-100-mobile"
                checked={filters.tours100Mobile || false}
                onCheckedChange={(checked) => handleFilterChange('tours100Mobile', checked)}
            />
            <Label htmlFor="tours-100-mobile">Tournées 100% mobile</Label>
        </div>
         <div className="flex items-center space-x-2 pb-2">
            <Switch 
                id="exclude-mad-delays"
                checked={filters.excludeMadDelays || false}
                onCheckedChange={(checked) => handleFilterChange('excludeMadDelays', checked)}
            />
            <Label htmlFor="exclude-mad-delays">Exclure retards MAD</Label>
        </div>
         <div className="pb-2">
            <Button variant="outline" onClick={() => setIsMadManagerOpen(true)}>
                <SlidersHorizontal className="mr-2" />
                Gérer les retards MAD
            </Button>
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
       <MadDelayManager 
        isOpen={isMadManagerOpen} 
        onOpenChange={setIsMadManagerOpen}
        allData={allData}
        madDelays={filters.madDelays || []}
        setMadDelays={(delays) => handleFilterChange('madDelays', delays)}
      />
    </div>
  );
}
