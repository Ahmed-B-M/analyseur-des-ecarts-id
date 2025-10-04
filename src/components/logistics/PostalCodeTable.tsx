'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { PostalCodeStats } from '@/lib/types';

type SortConfig = { key: string | null; direction: 'ascending' | 'descending' };

interface PostalCodeTableProps {
    data: PostalCodeStats[];
}

export default function PostalCodeTable({ data = [] }: PostalCodeTableProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'livraisonsRetard', direction: 'descending' });

    const top20Data = useMemo(() => {
        if (!data || data.length === 0) {
            return [];
        }
        const sortedByVolume = [...data].sort((a, b) => b.totalLivraisons - a.totalLivraisons);
        const top20Count = Math.ceil(sortedByVolume.length * 0.2);
        return sortedByVolume.slice(0, top20Count);
    }, [data]);

    const sortedData = useMemo(() => {
        const sortableData = [...top20Data];
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
    }, [top20Data, sortConfig]);

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
                <CardTitle>Classement des Codes Postaux par Retards (Top 20%)</CardTitle>
                <CardDescription>
                    Focus sur les 20% des codes postaux avec le plus grand volume de livraisons, classés par taux de retard.
                </CardDescription>
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
