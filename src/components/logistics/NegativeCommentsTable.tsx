
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ChevronLeft, ChevronRight, MessageCircleWarning, Info, Save } from 'lucide-react';
import type { MergedData } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { categorizeComment, commentCategories, CommentCategory } from '@/lib/comment-categorization';
import { useFirestore } from '@/firebase';
import { batchSaveCategorizedComments } from '@/firebase/firestore/actions';
import { CategorizedComment } from './CommentCategorizationTable';

const ITEMS_PER_PAGE = 10;

interface CommentToCategorize {
    id: string;
    date: string;
    livreur: string;
    ville: string;
    codePostal: string;
    note: number;
    comment: string;
    category: CommentCategory;
}

function CommentsList({ commentsToCategorize, onSave }: { commentsToCategorize: CommentToCategorize[], onSave: (comments: CommentToCategorize[]) => void }) {
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: keyof CommentToCategorize; direction: 'asc' | 'desc' } | null>({ key: 'note', direction: 'asc' });
    const [localComments, setLocalComments] = useState<CommentToCategorize[]>([]);
    const { toast } = useToast();

     useEffect(() => {
        setLocalComments(commentsToCategorize);
        setCurrentPage(1); // Reset page when data changes
    }, [commentsToCategorize]);


    const sortedData = useMemo(() => {
        if (!sortConfig) return localComments;
        return [...localComments].sort((a, b) => {
            let aValue = a[sortConfig.key];
            let bValue = b[sortConfig.key];
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [localComments, sortConfig]);
    
    const handleCategoryChange = (id: string, newCategory: CommentCategory) => {
        setLocalComments(prev => prev.map(c => c.id === id ? { ...c, category: newCategory } : c));
    };

    const handleSaveComment = (commentId: string) => {
        const commentToSave = localComments.find(c => c.id === commentId);
        if (commentToSave) {
            onSave([commentToSave]);
            toast({ title: "Commentaire sauvegardé", description: "La catégorie a été enregistrée. La liste va s'actualiser." });
        }
    };

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedData.slice(start, start + ITEMS_PER_PAGE);
    }, [sortedData, currentPage]);

    const totalPages = Math.ceil(sortedData.length / ITEMS_PER_PAGE);

    const handleSort = (key: keyof CommentToCategorize) => {
        setSortConfig(prev => ({ key, direction: prev && prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
        setCurrentPage(1);
    };

    const renderSortIcon = (key: keyof CommentToCategorize) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
        return sortConfig.direction === 'asc' ? '▲' : '▼';
    };

    return (
        <div className="space-y-4">
            <div className="rounded-md border h-auto overflow-y-auto relative">
                <Table>
                    <TableHeader className="sticky top-0 bg-secondary">
                        <TableRow>
                            <TableHead onClick={() => handleSort('date')} className="cursor-pointer">Date</TableHead>
                            <TableHead onClick={() => handleSort('livreur')} className="cursor-pointer">Livreur</TableHead>
                            <TableHead onClick={() => handleSort('ville')} className="cursor-pointer">Ville</TableHead>
                            <TableHead onClick={() => handleSort('note')} className="cursor-pointer">Note</TableHead>
                            <TableHead>Commentaire</TableHead>
                            <TableHead className="w-52">Catégorie</TableHead>
                            <TableHead className="w-24">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {paginatedData.length > 0 ? paginatedData.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.date}</TableCell>
                                <TableCell>{item.livreur}</TableCell>
                                <TableCell>{item.ville}, {item.codePostal}</TableCell>
                                <TableCell><Badge variant={item.note === 3 ? "secondary" : "destructive"}>{item.note}</Badge></TableCell>
                                <TableCell className="max-w-sm whitespace-pre-wrap">{item.comment}</TableCell>
                                <TableCell>
                                     <Select
                                        value={item.category}
                                        onValueChange={(newCat: CommentCategory) => handleCategoryChange(item.id, newCat)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {commentCategories.map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <Button size="sm" onClick={() => handleSaveComment(item.id)}>
                                        <Save className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={7} className="text-center h-24">Aucun nouveau commentaire à catégoriser.</TableCell></TableRow>
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


export default function NegativeCommentsTable({ data, savedCategorizedComments }: { data: MergedData[], savedCategorizedComments: CategorizedComment[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    // Sanitize an ID the same way the backend does
    const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '_');

    const commentsToCategorize = useMemo(() => {
        const savedIds = new Set(savedCategorizedComments.map(c => sanitizeId(c.id)));
        
        return data
            .filter(item => {
                const itemId = `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`;
                const sanitizedItemId = sanitizeId(itemId);
                return (
                    item.notation != null &&
                    item.notation <= 3 &&
                    item.commentaire &&
                    !savedIds.has(sanitizedItemId)
                );
            })
            .map(item => ({
                id: `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`,
                date: item.date,
                livreur: item.livreur || 'N/A',
                ville: item.ville,
                codePostal: item.codePostal,
                note: item.notation!,
                comment: item.commentaire!,
                category: categorizeComment(item.commentaire),
            }));
    }, [data, savedCategorizedComments]);

    const handleSave = async (commentsToSave: CommentToCategorize[]) => {
        if (!firestore) {
            toast({ variant: 'destructive', title: "Erreur", description: "La base de données n'est pas connectée." });
            return;
        }
        try {
            await batchSaveCategorizedComments(firestore, commentsToSave);
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Erreur de sauvegarde", description: error.message });
        }
    };
    
    if (data.length === 0) {
        return (
             <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><MessageCircleWarning />Catégoriser les Avis Négatifs (Note ≤ 3)</CardTitle></CardHeader>
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
                        <span>Catégoriser les Avis Négatifs (Note ≤ 3)</span>
                    </div>
                </CardTitle>
                <CardDescription>
                    Analysez, modifiez la catégorie suggérée, puis sauvegardez chaque commentaire pour l'inclure dans les rapports. 
                    Un commentaire sauvegardé disparaît de cette liste.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <CommentsList 
                commentsToCategorize={commentsToCategorize} 
                onSave={handleSave}
               />
            </CardContent>
        </Card>
    );
}
