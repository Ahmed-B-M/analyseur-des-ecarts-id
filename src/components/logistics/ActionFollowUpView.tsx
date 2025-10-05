
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
import { Loader2, AlertCircle, Trash2 } from 'lucide-react';
import type { SuiviCommentaire } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useMemoFirebase } from '@/firebase/provider';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { getNomDepot } from '@/lib/utils';
import { commentCategories, type CommentCategory } from '@/lib/comment-categorization';
import { CategorizedComment } from './CommentCategorizationTable';

export type SuiviCommentaireWithId = SuiviCommentaire & { id: string };

// Sanitize an ID the same way as when saving
const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '_');


const ActionFollowUpView = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [editableActions, setEditableActions] = useState<Record<string, string>>({});
    const [editingId, setEditingId] = useState<string | null>(null);

    const suiviCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'suiviCommentaires');
    }, [firestore]);

    const categorizedCommentsCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'commentCategories');
    }, [firestore]);


    const { data: suivis, isLoading: isLoadingSuivis, error: errorSuivis } = useCollection<SuiviCommentaireWithId>(suiviCollectionRef);
    const { data: savedCategorizedComments, isLoading: isLoadingCategories, error: errorCategories } = useCollection<CategorizedComment>(categorizedCommentsCollectionRef);

    const categorizedCommentsMap = useMemo(() => {
        if (!savedCategorizedComments) return new Map();
        return new Map(savedCategorizedComments.map(c => [sanitizeId(c.id), c.category]));
    }, [savedCategorizedComments]);

     useEffect(() => {
        if (suivis) {
            const initialActions = suivis.reduce((acc, suivi) => {
                acc[suivi.id] = suivi.actionCorrective;
                return acc;
            }, {} as Record<string, string>);
            setEditableActions(initialActions);
        }
    }, [suivis]);


    const handleStatusChange = (id: string, newStatus: "À traiter" | "En cours" | "Résolu") => {
        if (!firestore) return;
        
        const docRef = doc(firestore, 'suiviCommentaires', id);

        updateDocumentNonBlocking(docRef, { statut: newStatus });

        toast({
            title: "Statut mis à jour",
            description: `Le statut du suivi a été changé à "${newStatus}".`,
        });
    };
    
    const handleCategoryChange = (id: string, newCategory: CommentCategory) => {
        if (!firestore) return;
        
        const docRef = doc(firestore, 'suiviCommentaires', id);

        updateDocumentNonBlocking(docRef, { categorie: newCategory });

        toast({
            title: "Catégorie mise à jour",
            description: `La catégorie a été changée à "${newCategory}".`,
        });
    };

    const handleActionChange = (id: string, value: string) => {
        setEditableActions(prev => ({ ...prev, [id]: value }));
    };

    const handleSaveAction = (id: string) => {
        if (!firestore) return;
        const newAction = editableActions[id];
        if (newAction === undefined) return;

        const docRef = doc(firestore, 'suiviCommentaires', id);
        updateDocumentNonBlocking(docRef, { actionCorrective: newAction });
        setEditingId(null);
        toast({
            title: "Action corrective mise à jour.",
        });
    };

    const handleDelete = (id: string) => {
        if(!firestore) return;
        const docRef = doc(firestore, 'suiviCommentaires', id);
        deleteDocumentNonBlocking(docRef);
        toast({
            title: "Suivi supprimé",
            description: "Le commentaire associé réapparaîtra dans la section 'Traitement Avis'.",
        })
    }

    const sortedSuivis = useMemo(() => {
        if (!suivis) return [];
        return [...suivis].sort((a, b) => {
            const statusOrder = { "À traiter": 0, "En cours": 1, "Résolu": 2 };
            const statusDiff = statusOrder[a.statut] - statusOrder[b.statut];
            if (statusDiff !== 0) return statusDiff;
            return new Date(b.traiteLe).getTime() - new Date(a.traiteLe).getTime();
        });
    }, [suivis]);


    if (isLoadingSuivis || isLoadingCategories) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-12 h-12 animate-spin text-primary"/>
                <p className="ml-4 text-lg text-muted-foreground">Chargement du suivi des actions...</p>
            </div>
        );
    }

    if (errorSuivis || errorCategories) {
        return (
             <div className="flex flex-col items-center justify-center min-h-[400px] text-destructive">
                <AlertCircle className="w-12 h-12 mb-4" />
                <h3 className="text-xl font-bold">Erreur de chargement</h3>
                <p className="text-center">Impossible de charger les données depuis Firestore.<br/> Assurez-vous que les règles de sécurité autorisent la lecture des collections 'suiviCommentaires' et 'commentCategories'.</p>
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Suivi des Actions Correctives</CardTitle>
                <CardDescription>
                    Liste des actions correctives enregistrées. Cliquez sur une action pour la modifier ou supprimez-la pour la renvoyer au traitement.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border max-h-[70vh] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Date Action</TableHead>
                                <TableHead>Date Livraison</TableHead>
                                <TableHead>Dépôt</TableHead>
                                <TableHead>Livreur</TableHead>
                                <TableHead>Commentaire</TableHead>
                                <TableHead>Catégorie</TableHead>
                                <TableHead>Action Corrective</TableHead>
                                <TableHead>Statut</TableHead>
                                <TableHead>Opérations</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedSuivis.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                        Aucune action corrective enregistrée pour le moment.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedSuivis.map((suivi) => {
                                    const commentId = `${suivi.nomTournee}|${suivi.date}|${suivi.entrepot}-${suivi.sequence}`;
                                    const sanitizedCommentId = sanitizeId(commentId);
                                    const finalCategory = categorizedCommentsMap.get(sanitizedCommentId) || suivi.categorie;

                                    return (
                                    <TableRow key={suivi.id}>
                                        <TableCell>{new Date(suivi.traiteLe).toLocaleDateString('fr-FR')}</TableCell>
                                        <TableCell>{suivi.date}</TableCell>
                                        <TableCell>{getNomDepot(suivi.entrepot)}</TableCell>
                                        <TableCell>{suivi.livreur}</TableCell>
                                        <TableCell className="max-w-xs truncate">{suivi.commentaire}</TableCell>
                                        <TableCell>
                                             <Select 
                                                value={finalCategory} 
                                                onValueChange={(newCategory: CommentCategory) => handleCategoryChange(suivi.id, newCategory)}
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
                                        <TableCell onClick={() => setEditingId(suivi.id)} className="cursor-pointer">
                                            {editingId === suivi.id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        value={editableActions[suivi.id] || ''}
                                                        onChange={(e) => handleActionChange(suivi.id, e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveAction(suivi.id)}
                                                        autoFocus
                                                        onBlur={() => handleSaveAction(suivi.id)}
                                                    />
                                                </div>
                                            ) : (
                                                <span className="max-w-xs truncate block">{editableActions[suivi.id]}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Select 
                                                value={suivi.statut} 
                                                onValueChange={(newStatus: "À traiter" | "En cours" | "Résolu") => handleStatusChange(suivi.id, newStatus)}
                                            >
                                                <SelectTrigger className="w-36">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="À traiter">À traiter</SelectItem>
                                                    <SelectItem value="En cours">En cours</SelectItem>
                                                    <SelectItem value="Résolu">Résolu</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon">
                                                        <Trash2 className="w-4 h-4 text-destructive" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Renvoyer au traitement ?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Cette action supprimera le suivi actuel et fera réapparaître le commentaire dans l'onglet "Traitement Avis". Êtes-vous sûr ?
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(suivi.id)}>Confirmer</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                )})
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

export default ActionFollowUpView;
