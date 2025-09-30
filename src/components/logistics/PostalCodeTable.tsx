
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { MergedData } from '@/lib/types';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { useLogistics } from '@/context/LogisticsContext';

type SortConfig = { key: string | null; direction: 'ascending' | 'descending' };
type PostalCodeStats = ReturnType<typeof calculatePostalCodeStats>[0];

interface PostalCodeTableProps {
    data: MergedData[];
}

const calculatePostalCodeStats = (data: MergedData[], toleranceSeconds: number = 959) => {
    const postalCodeStats: Record<string, { total: number; late: number; depot: string }> = {};

    data.forEach(item => {
        if (item.codePostal && item.tournee) {
            if (!postalCodeStats[item.codePostal]) {
                postalCodeStats[item.codePostal] = { total: 0, late: 0, depot: item.tournee.entrepot };
            }
            postalCodeStats[item.codePostal].total++;
            // Le retard est défini par un dépassement du créneau horaire du client + la tolérance
            if (item.retard > toleranceSeconds) {
                postalCodeStats[item.codePostal].late++;
            }
        }
    });

    return Object.entries(postalCodeStats)
        .map(([codePostal, stats]) => ({
            codePostal,
            entrepot: stats.depot,
            totalLivraisons: stats.total,
            livraisonsRetard: stats.total > 0 ? ((stats.late / stats.total) * 100).toFixed(2) + '%' : '0.00%',
        }))
        .sort((a, b) => parseFloat(b.livraisonsRetard) - parseFloat(a.livraisonsRetard));
};

export default function PostalCodeTable({ data: filteredData }: PostalCodeTableProps) {
    const { state } = useLogistics();
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'livraisonsRetard', direction: 'descending' });

    const data = useMemo(() => {
        if (!filteredData) return [];
        return calculatePostalCodeStats(filteredData, state.filters.punctualityThreshold || 959);
    }, [filteredData, state.filters.punctualityThreshold]);

    const sortedData = useMemo(() => {
        const sortableData = [...data];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                const key = sortConfig.key as keyof PostalCodeStats;

                const parseValue = (value: any) => {
                    if (typeof value === 'string' && value.endsWith('%')) return parseFloat(value.slice(0, -1));
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Classement des Codes Postaux par Retards</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('codePostal')}>Code Postal {renderSortIcon('codePostal')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('entrepot')}>Entrepôt {renderSortIcon('entrepot')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('totalLivraisons')}>Nb. Livraisons {renderSortIcon('totalLivraisons')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('livraisonsRetard')}>% Livraisons en Retard {renderSortIcon('livraisonsRetard')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.map((row) => (
                            <TableRow key={row.codePostal}>
                                <TableCell>{row.codePostal}</TableCell>
                                <TableCell>{row.entrepot}</TableCell>
                                <TableCell>{row.totalLivraisons}</TableCell>
                                <TableCell>{row.livraisonsRetard}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
