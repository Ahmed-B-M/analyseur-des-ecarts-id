
'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useRouter } from 'next/navigation';
import { useLogistics } from '@/context/LogisticsContext';

const reportSections = [
    { id: 'globalKpis', label: 'Indicateurs Clés Globaux' },
    { id: 'discrepancyAnalysis', label: 'Analyse des Écarts' },
    { id: 'qualityImpact', label: 'Impact Qualité (Notes Clients)' },
    { id: 'anomalies', label: 'Anomalies (Surcharge, etc.)' },
    { id: 'temporalAnalysis', label: 'Analyse Temporelle (Jours/Créneaux)' },
    { id: 'geoAnalysis', label: 'Analyse Géographique (Top Villes/CP)' },
];

type ReportDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export default function ReportDialog({ isOpen, onOpenChange }: ReportDialogProps) {
  const router = useRouter();
  const { state } = useLogistics();
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({
    globalKpis: true,
    discrepancyAnalysis: true,
    qualityImpact: true,
    anomalies: true,
    temporalAnalysis: true,
    geoAnalysis: true,
  });
  const [tone, setTone] = useState<'Neutre et Factuel' | 'Orienté Solutions'>('Neutre et Factuel');

  const handleSectionChange = (sectionId: string, checked: boolean) => {
    setSelectedSections(prev => ({ ...prev, [sectionId]: checked }));
  };
  
  const handleGenerateReport = () => {
    const config = {
        sections: selectedSections,
        tone,
        filters: state.filters, // Pass current filters
    };
    
    // Encode config to pass in URL
    const query = encodeURIComponent(JSON.stringify(config));
    
    // Open the report in a new tab
    window.open(`/report?config=${query}`, '_blank');
    
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurer le Rapport A4</DialogTitle>
          <DialogDescription>
            Sélectionnez les sections à inclure et le ton du rapport. Le rapport sera généré avec les filtres actuellement actifs.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6 py-4">
            <div>
                <h4 className="font-semibold mb-3">Sections du Rapport</h4>
                <div className="space-y-2">
                    {reportSections.map(section => (
                        <div key={section.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={section.id} 
                                checked={selectedSections[section.id]}
                                onCheckedChange={(checked) => handleSectionChange(section.id, !!checked)}
                            />
                            <Label htmlFor={section.id}>{section.label}</Label>
                        </div>
                    ))}
                </div>
            </div>
            <div>
                <h4 className="font-semibold mb-3">Ton de la Synthèse</h4>
                 <RadioGroup value={tone} onValueChange={(value) => setTone(value as any)}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Neutre et Factuel" id="tone-neutral" />
                        <Label htmlFor="tone-neutral">Neutre et Factuel</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Orienté Solutions" id="tone-solutions" />
                        <Label htmlFor="tone-solutions">Orienté Solutions</Label>
                    </div>
                </RadioGroup>
            </div>
        </div>
        <DialogFooter>
          <Button onClick={handleGenerateReport}>Générer le Rapport</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
