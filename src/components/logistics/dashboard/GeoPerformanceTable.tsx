
'use client';
import type { ReactNode } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PerformanceByGeo } from '@/lib/types';

interface GeoPerformanceTableProps {
    data: PerformanceByGeo[];
    onSort: (key: keyof PerformanceByGeo) => void;
    renderSortIcon: (key: keyof PerformanceByGeo) => ReactNode;
    groupTitle: string;
}

function formatSecondsToTime(seconds: number): string {
    const isNegative = seconds < 0;
    seconds = Math.abs(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    return `${isNegative ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function GeoPerformanceTable({ data, onSort, renderSortIcon, groupTitle }: GeoPerformanceTableProps) {
    return (
        <ScrollArea className="h-96">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('key')}>{groupTitle} {renderSortIcon('key')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('totalTasks')}>Nb. Tâches {renderSortIcon('totalTasks')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('punctualityRateRealized')}>Ponctualité {renderSortIcon('punctualityRateRealized')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('avgDurationDiscrepancy')}>Écart Durée {renderSortIcon('avgDurationDiscrepancy')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('avgWeightDiscrepancy')}>Écart Poids {renderSortIcon('avgWeightDiscrepancy')}</TableHead>
                        <TableHead className="cursor-pointer group" onClick={() => onSort('lateWithBadReviewPercentage')}>% Insat. / Retard {renderSortIcon('lateWithBadReviewPercentage')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(data || []).map(item => (
                        <TableRow key={item.key}>
                            <TableCell className="font-medium">{item.key}</TableCell>
                            <TableCell>{item.totalTasks}</TableCell>
                            <TableCell>
                                <span className={cn(item.punctualityRateRealized < item.punctualityRatePlanned - 2 && "text-destructive font-bold")}>{item.punctualityRateRealized.toFixed(1)}%</span>
                                <span className="text-xs text-muted-foreground"> ({item.punctualityRatePlanned.toFixed(1)}%)</span>
                            </TableCell>
                            <TableCell className={cn(item.avgDurationDiscrepancy > 600 && "text-destructive font-bold")}>{formatSecondsToTime(item.avgDurationDiscrepancy)}</TableCell>
                            <TableCell className={cn(item.avgWeightDiscrepancy > 20 && "text-destructive font-bold")}>{item.avgWeightDiscrepancy.toFixed(1)} kg</TableCell>
                            <TableCell>{item.lateWithBadReviewPercentage.toFixed(1)}%</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </ScrollArea>
    );
}
