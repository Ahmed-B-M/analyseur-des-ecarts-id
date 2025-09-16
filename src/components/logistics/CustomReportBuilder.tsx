'use client'

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getWeek, parseISO } from 'date-fns';
import type { MergedData, CustomReportConfig } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import AiReportGenerator from './AiReportGenerator';
import { Badge } from '../ui/badge';
import { Building, Filter, Calendar, BarChart2, AlertTriangle, MapPin, TrendingUp, CheckSquare, Wand2, Palette } from 'lucide-react';


interface CustomReportBuilderProps {
  allData: MergedData[];
  depots: string[];
  warehouses: string[];
}

const sectionOptions = [
    { id: 'globalKpis', label: 'KPIs Globaux & Écarts', icon: BarChart2 },
    { id: 'qualityImpact', label: 'Impact sur la Qualité', icon: TrendingUp },
    { id: 'anomalies', label: 'Analyse des Anomalies (Surcharge, etc.)', icon: AlertTriangle },
    { id: 'temporalAnalysis', label: 'Analyse Temporelle (Jours, Créneaux)', icon: Calendar },
    { id: 'geoAnalysis', label: 'Analyse Géographique (Entrepôts, Villes)', icon: MapPin },
    { id: 'weeklyComparison', label: 'Analyse Comparative Hebdomadaire', icon: TrendingUp },
];

export default function CustomReportBuilder({ allData, depots, warehouses }: CustomReportBuilderProps) {
  
  const [config, setConfig] = useState<CustomReportConfig>({
    sections: {
      globalKpis: true,
      anomalies: true,
      temporalAnalysis: true,
    },
    filters: {
      depots: [],
      warehouses: [],
    },
    selectedWeeks: [],
    tone: 'Neutre et Factuel',
  });

  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    allData.forEach(item => {
      try {
        const date = parseISO(item.date);
        const weekNumber = getWeek(date, { weekStartsOn: 1 });
        const year = date.getFullYear();
        weeks.add(`${year}-W${String(weekNumber).padStart(2, '0')}`);
      } catch (e) {}
    });
    return Array.from(weeks).sort().reverse();
  }, [allData]);

  const handleSectionChange = (sectionId: keyof CustomReportConfig['sections'], checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [sectionId]: checked,
      },
    }));
  };

  const handleWeekChange = (week: string, checked: boolean) => {
    setConfig(prev => {
        const newWeeks = new Set(prev.selectedWeeks);
        if(checked) {
            newWeeks.add(week);
        } else {
            newWeeks.delete(week);
        }
        return {...prev, selectedWeeks: Array.from(newWeeks).sort() };
    });
  };

  const handleDepotChange = (depot: string, checked: boolean) => {
    setConfig(prev => {
        const newDepots = new Set(prev.filters.depots);
        if(checked) newDepots.add(depot);
        else newDepots.delete(depot);
        return {...prev, filters: {...prev.filters, depots: Array.from(newDepots)}};
    })
  }

  const handleWarehouseChange = (warehouse: string, checked: boolean) => {
    setConfig(prev => {
        const newWarehouses = new Set(prev.filters.warehouses);
        if(checked) newWarehouses.add(warehouse);
        else newWarehouses.delete(warehouse);
        return {...prev, filters: {...prev.filters, warehouses: Array.from(newWarehouses)}};
    })
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wand2 /> Constructeur de Rapport Personnalisé</CardTitle>
          <CardDescription>
            Cochez les sections, appliquez des filtres et sélectionnez les semaines pour générer un rapport sur mesure.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Column 1: Filters */}
        <div className="md:col-span-1 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Filter/>Filtres de Données</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><Building/>Par Dépôt</h4>
                        <ScrollArea className="h-32 border rounded-md p-2">
                           {depots.map(depot => (
                            <div key={depot} className="flex items-center space-x-2 my-1">
                                <Checkbox id={`depot-${depot}`} onCheckedChange={(c) => handleDepotChange(depot, !!c)} checked={config.filters.depots.includes(depot)} />
                                <Label htmlFor={`depot-${depot}`}>{depot}</Label>
                            </div>
                           ))}
                        </ScrollArea>
                    </div>
                     <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2"><Warehouse/>Par Entrepôt</h4>
                        <ScrollArea className="h-32 border rounded-md p-2">
                           {warehouses.map(wh => (
                            <div key={wh} className="flex items-center space-x-2 my-1">
                                <Checkbox id={`wh-${wh}`} onCheckedChange={(c) => handleWarehouseChange(wh, !!c)} checked={config.filters.warehouses.includes(wh)} />
                                <Label htmlFor={`wh-${wh}`}>{wh}</Label>
                            </div>
                           ))}
                        </ScrollArea>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Palette/>Ton de la Synthèse IA</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup value={config.tone} onValueChange={(v) => setConfig(p => ({...p, tone: v as any}))}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Neutre et Factuel" id="tone-neutral" />
                            <Label htmlFor="tone-neutral">Neutre et Factuel</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <RadioGroupItem value="Orienté Solutions" id="tone-solutions" />
                            <Label htmlFor="tone-solutions">Orienté Solutions</Label>
                        </div>
                    </RadioGroup>
                </CardContent>
            </Card>
        </div>


        {/* Column 2 & 3: Sections & Weeks */}
        <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><CheckSquare/>Sections à Inclure</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {sectionOptions.map(section => {
                       const Icon = section.icon;
                       return (
                        <div key={section.id} className="flex items-center space-x-2">
                            <Checkbox id={section.id} 
                                checked={!!config.sections[section.id as keyof typeof config.sections]}
                                onCheckedChange={(checked) => handleSectionChange(section.id as keyof typeof config.sections, !!checked)}
                            />
                            <Label htmlFor={section.id} className="flex items-center gap-2"><Icon className="w-4 h-4 text-muted-foreground"/>{section.label}</Label>
                        </div>
                    )})}
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Calendar/>Semaines à Comparer</CardTitle>
                    <CardDescription>Cochez pour inclure dans l'analyse comparative.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-64 border rounded-md p-2">
                        {availableWeeks.map(week => (
                            <div key={week} className="flex items-center space-x-2 my-1">
                                <Checkbox 
                                    id={`week-${week}`}
                                    onCheckedChange={(c) => handleWeekChange(week, !!c)}
                                    checked={config.selectedWeeks.includes(week)}
                                />
                                <Label htmlFor={`week-${week}`}>{week.replace('-W', ' Semaine ')}</Label>
                            </div>
                        ))}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
      </div>
      
      <AiReportGenerator reportConfig={config} data={allData} />
    </div>
  );
}
