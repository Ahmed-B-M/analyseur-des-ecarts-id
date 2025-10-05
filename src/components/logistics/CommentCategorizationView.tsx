
"use client";

import { useState, useMemo, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useMemoFirebase } from '@/firebase/provider';
import { commentCategories, type CommentCategory } from '@/lib/comment-categorization';
import type { CategorizedComment } from './CommentCategorizationTable';

export type CategorizedCommentWithId = CategorizedComment & { id: string };

const CommentCategorizationView = () => {
    const firestore = useFirestore();
    const { toast } = useToast();

    const categorizedCommentsCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'commentCategories');
    }, [firestore]);


    const { data: comments, isLoading, error } = useCollection<CategorizedCommentWithId>(categorizedCommentsCollectionRef);

    const handleCategoryChange = (id: string, newCategory: CommentCategory) => {
        if (!firestore) return;
        
        const docRef = doc(firestore, 'commentCategories', id);

        updateDocumentNonBlocking(docRef, { category: newCategory });

        toast({
            title: "Catégorie mise à jour",
            description: `La catégorie a été changée à "${newCategory}".`,
        });
    };

    const sortedComments = useMemo(() => {
        if (!comments) return [];
        return [...comments].sort((a, b) => {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        });
    }, [comments]);


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-12 h-12 animate-spin text-primary"/>
                <p className="ml-4 text-lg text-muted-foreground">Chargement des commentaires catégorisés...</p>
            </div>
        );
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center min-h-[400px] text-destructive">
                <AlertCircle className="w-12 h-12 mb-4" />
                <h3 className="text-xl font-bold">Erreur de chargement</h3>
                <p className="text-center">Impossible de charger les données depuis Firestore.<br/> Assurez-vous que les règles de sécurité autorisent la lecture de la collection 'commentCategories'.</p>
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Consultation des Commentaires Catégorisés</CardTitle>
                <CardDescription>
                    Liste de tous les commentaires négatifs qui ont été catégorisés et sauvegardés. Vous pouvez modifier leur catégorie ici.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border max-h-[70vh] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Entrepôt</TableHead>
                                <TableHead>Livreur</TableHead>
                                <TableHead>Ville</TableHead>
                                <TableHead>Note</TableHead>
                                <TableHead>Commentaire</TableHead>
                                <TableHead>Catégorie</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedComments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        Aucun commentaire n'a encore été catégorisé et sauvegardé.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedComments.map((comment) => (
                                    <TableRow key={comment.id}>
                                        <TableCell>{comment.date}</TableCell>
                                        <TableCell>{comment.entrepot}</TableCell>
                                        <TableCell>{comment.livreur}</TableCell>
                                        <TableCell>{comment.ville}</TableCell>
                                        <TableCell>{comment.note}</TableCell>
                                        <TableCell className="max-w-xs truncate">{comment.comment}</TableCell>
                                        <TableCell>
                                             <Select 
                                                value={comment.category} 
                                                onValueChange={(newCategory: CommentCategory) => handleCategoryChange(comment.id, newCategory)}
                                            >
                                                <SelectTrigger className="w-48">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {commentCategories.map(cat => (
                                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default CommentCategorizationView;

    