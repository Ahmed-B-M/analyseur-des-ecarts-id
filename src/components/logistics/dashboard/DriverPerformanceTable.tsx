
'use client';
import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PerformanceByDriver } from '@/lib/types';

interface DriverPerformanceTableProps {
    data: PerformanceByDriver[];
    onSort: (key: keyof PerformanceByDriver) => void;
    renderSortIcon: (key: keyof PerformanceByDriver) => ReactNode;
}

export function DriverPerformanceTable({ data, onSort, renderSortIcon }: DriverPerformanceTableProps) {
    return (
        <ScrollArea className="h-96">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('key')}>Livreur {renderSortIcon('key')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('totalTours')}>Nb. Tournées {renderSortIcon('totalTours')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('punctualityRate')}>Ponctualité {renderSortIcon('punctualityRate')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('avgDelay')}>Retard Moyen (min) {renderSortIcon('avgDelay')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('overweightToursCount')}>Dépassements Poids {renderSortIcon('overweightToursCount')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('avgRating')}>Notation Moy. {renderSortIcon('avgRating')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(data || []).map(driver => (
                        <TableRow key={driver.key}>
                            <TableCell>{driver.key}</TableCell>
                            <TableCell>{driver.totalTours}</TableCell>
                            <TableCell>{driver.punctualityRate.toFixed(1)}%</TableCell>
                            <TableCell>{driver.avgDelay.toFixed(1)}</TableCell>
                            <TableCell>{driver.overweightToursCount}</TableCell>
                            <TableCell>{driver.avgRating?.toFixed(2) || 'N/A'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
