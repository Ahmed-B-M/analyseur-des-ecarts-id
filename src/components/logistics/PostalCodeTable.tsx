
'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import type { PostalCodeStats } from '@/lib/types';

type SortConfig = { key: keyof PostalCodeStats; direction: 'ascending' | 'descending' };

interface PostalCodeTableProps {
    data: PostalCodeStats[];
}

export default function PostalCodeTable({ data = [] }: PostalCodeTableProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'lateCount', direction: 'descending' });

    const sortedData = useMemo(() => {
        const sortableData = [...data];
        if (sortConfig.key) {
            sortableData.sort((a, b) => {
                const key = sortConfig.key;

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

    const handleSort = (key: keyof PostalCodeStats) => {
        const direction = sortConfig.key === key && sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (columnKey: keyof PostalCodeStats) => {
        if (sortConfig.key !== columnKey) return null;
        return sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 inline h-4 w-4" /> : <ArrowDown className="ml-2 inline h-4 w-4" />;
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Classement des Codes Postaux les Plus Impactants</CardTitle>
                <CardDescription>
                    Codes postaux classés par nombre de livraisons en retard.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('codePostal')}>Code Postal {renderSortIcon('codePostal')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('entrepot')}>Entrepôt {renderSortIcon('entrepot')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('totalLivraisons')}>Nb. Livraisons {renderSortIcon('totalLivraisons')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('lateCount')}>Nb. Livraisons en Retard {renderSortIcon('lateCount')}</TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort('livraisonsRetard')}>% Livraisons en Retard {renderSortIcon('livraisonsRetard')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedData.map((row) => (
                            <TableRow key={`${row.codePostal}-${row.entrepot}`}>
                                <TableCell>{row.codePostal}</TableCell>
                                <TableCell>{row.entrepot}</TableCell>
                                <TableCell>{row.totalLivraisons}</TableCell>
                                <TableCell>{row.lateCount}</TableCell>
                                <TableCell>{row.livraisonsRetard}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
