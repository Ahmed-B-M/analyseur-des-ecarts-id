"use client";

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useFirestore } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
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
import { SuiviCommentaire } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useMemoFirebase } from '@/firebase/provider';

export type SuiviCommentaireWithId = SuiviCommentaire & { id: string };

const ActionFollowUpView = () => {
    const firestore = useFirestore();
    const { toast } = useToast();

    const suiviCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'suiviCommentaires');
    }, [firestore]);


    const { data: suivis, isLoading, error } = useCollection<SuiviCommentaireWithId>(suiviCollectionRef);

    const handleStatusChange = (id: string, newStatus: "À traiter" | "En cours" | "Résolu") => {
        if (!firestore) return;
        
        const docRef = doc(firestore, 'suiviCommentaires', id);

        updateDocumentNonBlocking(docRef, { statut: newStatus });

        toast({
            title: "Statut mis à jour",
            description: `Le statut du suivi a été changé à "${newStatus}".`,
        });
    };

    const sortedSuivis = useMemo(() => {
        if (!suivis) return [];
        return [...suivis].sort((a, b) => {
            // Prioritize "À traiter" and "En cours"
            const statusOrder = { "À traiter": 0, "En cours": 1, "Résolu": 2 };
            const statusDiff = statusOrder[a.statut] - statusOrder[b.statut];
            if (statusDiff !== 0) return statusDiff;
            // Then sort by most recent date
            return new Date(b.traiteLe).getTime() - new Date(a.traiteLe).getTime();
        });
    }, [suivis]);


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-12 h-12 animate-spin text-primary"/>
                <p className="ml-4 text-lg text-muted-foreground">Chargement du suivi des actions...</p>
            </div>
        );
    }

    if (error) {
        return (
             <div className="flex flex-col items-center justify-center min-h-[400px] text-destructive">
                <AlertCircle className="w-12 h-12 mb-4" />
                <h3 className="text-xl font-bold">Erreur de chargement</h3>
                <p className="text-center">Impossible de charger les données depuis Firestore.<br/> Assurez-vous que les règles de sécurité autorisent la lecture de la collection 'suiviCommentaires'.</p>
            </div>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Suivi des Actions Correctives</CardTitle>
                <CardDescription>
                    Liste des actions correctives enregistrées suite aux commentaires négatifs des clients.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border max-h-[70vh] overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                                <TableHead>Date Action</TableHead>
                                <TableHead>Date Livraison</TableHead>
                                <TableHead>Livreur</TableHead>
                                <TableHead>Commentaire</TableHead>
                                <TableHead>Catégorie</TableHead>
                                <TableHead>Action Corrective</TableHead>
                                <TableHead>Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedSuivis.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        Aucune action corrective enregistrée pour le moment.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedSuivis.map((suivi) => (
                                    <TableRow key={suivi.id}>
                                        <TableCell>{new Date(suivi.traiteLe).toLocaleDateString('fr-FR')}</TableCell>
                                        <TableCell>{suivi.date}</TableCell>
                                        <TableCell>{suivi.livreur}</TableCell>
                                        <TableCell className="max-w-xs truncate">{suivi.commentaire}</TableCell>
                                        <TableCell>{suivi.categorie}</TableCell>
                                        <TableCell className="max-w-xs truncate">{suivi.actionCorrective}</TableCell>
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

export default ActionFollowUpView;
