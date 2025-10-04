'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight, MessageCircleWarning, Info, Warehouse, List } from 'lucide-react';
import type { MergedData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ITEMS_PER_PAGE = 10;
type SortKey = keyof MergedData | `tournee.${keyof NonNullable<MergedData['tournee']>}`;

function CommentsList({ data }: { data: MergedData[] }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>({ key: 'notation', direction: 'asc' });

    const sortedData = useMemo(() => {
        if (!sortConfig) return data;
        return [...data].sort((a, b) => {
            let aValue: any, bValue: any;
            if (sortConfig.key.startsWith('tournee.')) {
                const subKey = sortConfig.key.split('.')[1] as keyof NonNullable<MergedData['tournee']>;
                aValue = a.tournee?.[subKey];
                bValue = b.tournee?.[subKey];
            } else {
                aValue = a[sortConfig.key as keyof MergedData];
                bValue = b[sortConfig.key as keyof MergedData];
            }
            if (aValue == null) return 1;
            if (bValue == null) return -1;
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedData.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedData, currentPage]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

    const handleSort = (key: SortKey) => {
        setSortConfig(prev => ({ key, direction: prev && prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
        setCurrentPage(1);
    };

    const renderSortIcon = (key: SortKey) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    };

    return (
        <div className="space-y-4">
            <div className="rounded-md border h-[400px] overflow-y-auto relative">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead onClick={() => handleSort('date')} className="cursor-pointer">Date {renderSortIcon('date')}</TableHead>
                            <TableHead onClick={() => handleSort('livreur')} className="cursor-pointer">Livreur {renderSortIcon('livreur')}</TableHead>
                            <TableHead onClick={() => handleSort('ville')} className="cursor-pointer">Ville {renderSortIcon('ville')}</TableHead>
                            <TableHead onClick={() => handleSort('notation')} className="cursor-pointer">Note {renderSortIcon('notation')}</TableHead>
                            <TableHead>Commentaire</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length > 0 ? paginatedData.map((item, index) => (
                            <TableRow key={`${item.tourneeUniqueId}-${item.sequence}-${index}`}>
                                <TableCell>{item.date}</TableCell>
                                <TableCell>{item.livreur}</TableCell>
                                <TableCell>{item.ville}, {item.codePostal}</TableCell>
                                <TableCell><Badge variant={item.notation === 3 ? "secondary" : "destructive"}>{item.notation}</Badge></TableCell>
                                <TableCell className="max-w-sm whitespace-pre-wrap">{item.commentaire}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={5} className="text-center h-24">Aucun commentaire trouvé.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Page {currentPage} sur {totalPages} ({sortedData.length} résultats)</div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /> Préc.</Button>
                        <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Suiv. <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                </div>
            )}
        </div>
    );
}


function ByDepotView({ data }: { data: MergedData[] }) {
    const commentsByDepot = useMemo(() => {
        const grouped: Record<string, MergedData[]> = {};
        data.forEach(item => {
            const depot = item.entrepot?.split(' ')[0] || 'Inconnu';
            if (!grouped[depot]) grouped[depot] = [];
            grouped[depot].push(item);
        });
        return grouped;
    }, [data]);
    
    const sortedDepots = useMemo(() => {
        return Object.entries(commentsByDepot).sort((a,b) => b[1].length - a[1].length);
    }, [commentsByDepot]);

    if (sortedDepots.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground">
                Aucun commentaire négatif correspondant à votre recherche.
            </div>
        );
    }

    return (
        <Accordion type="multiple" className="w-full space-y-2" defaultValue={sortedDepots.length > 0 ? [sortedDepots[0][0]] : []}>
            {sortedDepots.map(([depot, comments]) => (
                <AccordionItem value={depot} key={depot}>
                    <AccordionTrigger className="bg-muted/50 px-4 rounded-md hover:bg-muted/80">
                        <div className='flex items-center gap-2'>
                            <Warehouse size={20} />
                            <span className='font-bold text-lg'>{depot}</span>
                            <Badge variant="secondary">{comments.length} avis</Badge>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border rounded-b-md">
                        <CommentsList data={comments} />
                    </AccordionContent>
                </AccordionItem>
            ))}
        </Accordion>
    );
}

function AllCommentsView({ data }: { data: MergedData[] }) {
    return <CommentsList data={data} />;
}

export default function NegativeCommentsTable({ data }: { data: MergedData[] }) {
    const [searchTerm, setSearchTerm] = useState('');

    const negativeCommentsData = useMemo(() => {
        return data.filter(item => item.notation != null && item.notation <= 3 && item.commentaire);
    }, [data]);

    const filteredData = useMemo(() => {
        if (!searchTerm) return negativeCommentsData;
        const search = searchTerm.toLowerCase();
        return negativeCommentsData.filter(item =>
            item.nomTournee?.toLowerCase().includes(search) ||
            item.livreur?.toLowerCase().includes(search) ||
            item.ville?.toLowerCase().includes(search) ||
            item.codePostal?.toLowerCase().includes(search) ||
            item.date?.toLowerCase().includes(search) ||
            item.entrepot?.toLowerCase().includes(search) ||
            item.commentaire?.toLowerCase().includes(search)
        );
    }, [negativeCommentsData, searchTerm]);
    
    if (data.length === 0) {
        return (
             <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircleWarning />Avis Négatifs (Note ≤ 3)</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center text-center p-8 border rounded-lg">
                        <Info className="w-12 h-12 text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold">Aucune donnée à afficher</h3>
                        <p className="text-muted-foreground mt-1">Veuillez vérifier les fichiers importés.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircleWarning />
                        <span>Avis Négatifs (Note ≤ 3) - {negativeCommentsData.length} commentaire(s)</span>
                    </div>
                </CardTitle>
                <CardDescription>Explorez les commentaires clients (note ≤ 3), groupés par dépôt ou en liste complète.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Input
                    placeholder="Rechercher un commentaire, un livreur, une ville..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                />
                <Tabs defaultValue="byDepot" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="byDepot"><Warehouse className="w-4 h-4 mr-2"/>Vue par Dépôt</TabsTrigger>
                        <TabsTrigger value="all"><List className="w-4 h-4 mr-2"/>Liste Complète</TabsTrigger>
                    </TabsList>
                    <TabsContent value="byDepot" className="mt-4">
                        <ByDepotView data={filteredData} />
                    </TabsContent>
                    <TabsContent value="all" className="mt-4">
                        <AllCommentsView data={filteredData} />
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}
