
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { DepotStats } from '@/lib/types';


type SortConfig = { key: string | null; direction: 'ascending' | 'descending' };

interface DepotAnalysisTableProps {
    data: DepotStats[];
}

export default function DepotAnalysisTable({ data = [] }: DepotAnalysisTableProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ponctualiteRealisee', direction: 'ascending' });

    const sortedData = useMemo(() => {
        const sortableData = [...data];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                if(!a || !b) return 0;
                const key = sortConfig.key as keyof DepotStats;
                
                const parseValue = (value: any) => {
                     if (typeof value === 'string') {
                        if (value.endsWith('%')) return parseFloat(value.slice(0, -1));
                        const match = value.match(/\(([^)]+)\)/);
                        if (match) return parseFloat(match[1]);
                        if (value === 'N/A') return -Infinity;
                        return parseFloat(value) || value;
                    }
                    return value;
                }
                
                const aValue = parseValue(a[key]);
                const bValue = parseValue(b[key]);

                if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        return sortableData;
    }, [data, sortConfig]);

    const handleSort = (key: string) => {
        const direction = sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (columnKey: string) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 inline h-4 w-4" /> : <ArrowDown className="ml-2 inline h-4 w-4" />;
    };
    
    // Check if the noteMoyenne field is present in the data to decide which column to show
    const showNoteMoyenne = data.length > 0 && data[0].noteMoyenne !== undefined;


    return (
        <Card>
            <CardHeader>
                <CardTitle>Analyse Détaillée des Entrepôts</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                         <TableRow>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('entrepot')}>Entrepôt {renderSortIcon('entrepot')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('ponctualitePrev')}>Ponctualité Prév. {renderSortIcon('ponctualitePrev')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('ponctualiteRealisee')}>Ponctualité Réalisée {renderSortIcon('ponctualiteRealisee')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('tourneesPartiesHeureRetard')}>% Tournées Départ à l'heure / Arrivée en retard {renderSortIcon('tourneesPartiesHeureRetard')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('tourneesRetardAccumule')}>% Tournées Départ OK / Retard Liv. &gt; 15min {renderSortIcon('tourneesRetardAccumule')}</TableHead>
                                {showNoteMoyenne ? (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('noteMoyenne')}>Note Moyenne {renderSortIcon('noteMoyenne')}</TableHead>
                                ) : (
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('notesNegativesRetard')}>% Notes Négatives (1-3) en Retard {renderSortIcon('notesNegativesRetard')}</TableHead>
                                )}
                                <TableHead className="cursor-pointer" onClick={() => handleSort('depassementPoids')}>% Dépassement de Poids {renderSortIcon('depassementPoids')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauLePlusChoisi')}>Créneau le plus choisi {renderSortIcon('creneauLePlusChoisi')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauLePlusEnRetard')}>Créneau le plus en retard {renderSortIcon('creneauLePlusEnRetard')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('intensiteTravailPlanifie')}>Intensité Travail Planifié (moy. 2h) {renderSortIcon('intensiteTravailPlanifie')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('intensiteTravailRealise')}>Intensité Travail Réalisé (moy. 2h) {renderSortIcon('intensiteTravailRealise')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauPlusIntense')}>tranche horaire la plus intense {renderSortIcon('creneauPlusIntense')}</TableHead>
                                <TableHead className="cursor-pointer" onClick={() => handleSort('creneauMoinsIntense')}>Créneau le moins intense {renderSortIcon('creneauMoinsIntense')}</TableHead>
                            </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.map((row) => (
                            row && <TableRow key={row.entrepot}>
                                <TableCell>{row.entrepot.replace('Depot', 'Entrepôt')}</TableCell>
                                <TableCell>{row.ponctualitePrev}</TableCell>
                                <TableCell>{row.ponctualiteRealisee}</TableCell>
                                <TableCell>{row.tourneesPartiesHeureRetard}</TableCell>
                                <TableCell>{row.tourneesRetardAccumule}</TableCell>
                                {showNoteMoyenne ? (
                                    <TableCell>{row.noteMoyenne}</TableCell>
                                ) : (
                                    // @ts-ignore
                                    <TableCell>{row.notesNegativesRetard}</TableCell>
                                )}
                                <TableCell>{row.depassementPoids}</TableCell>
                                <TableCell>{row.creneauLePlusChoisi}</TableCell>
                                <TableCell>{row.creneauLePlusEnRetard}</TableCell>
                                <TableCell>{row.intensiteTravailPlanifie}</TableCell>
                                <TableCell>{row.intensiteTravailRealise}</TableCell>
                                <TableCell>{row.creneauPlusIntense}</TableCell>
                                <TableCell>{row.creneauMoinsIntense}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
