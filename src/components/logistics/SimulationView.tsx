
'use client';

import { MergedData, SimulatedPromiseData, ActualSlotDistribution } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CustomerPromiseChart from './CustomerPromiseChart';

interface SimulationViewProps {
  actualSlotDistribution: ActualSlotDistribution[];
  simulatedPromiseData: SimulatedPromiseData[];
}

const SimulationView = ({ actualSlotDistribution, simulatedPromiseData }: SimulationViewProps) => {

    if (!actualSlotDistribution || actualSlotDistribution.length === 0) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Analyse des Créneaux Actuels et Simulation</CardTitle>
                <CardDescription>
                    Le tableau ci-dessous montre la répartition réelle des commandes par créneau. 
                    Le graphique simule l'impact d'une offre de créneaux plus flexibles (chevauchement toutes les 30 min) sur la distribution des livraisons.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="h-96 overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Entrepôt</TableHead>
                                <TableHead>Créneau Actuel</TableHead>
                                <TableHead className="text-right">% Commandes</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {actualSlotDistribution.map((row, i) => (
                                <TableRow key={i}>
                                    <TableCell>{row.warehouse}</TableCell>
                                    <TableCell>{row.slot}</TableCell>
                                    <TableCell className="text-right">{row.percentage}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                <div>
                   <CustomerPromiseChart data={simulatedPromiseData} />
                </div>
            </CardContent>
        </Card>
    );
};

export default SimulationView;
