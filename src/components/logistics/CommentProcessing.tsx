
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { MergedData } from '@/lib/types';
import { commentCategories, categorizeComment, CommentCategory } from '@/lib/comment-categorization';
import { useToast } from '@/hooks/use-toast';
import { saveSuiviCommentaire, updateSuiviCommentaire } from '@/firebase/firestore/actions';
import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc } from 'firebase/firestore';
import { useMemoFirebase } from '@/firebase/provider';
import type { SuiviCommentaireWithId } from './ActionFollowUpView';
import { Loader2 } from 'lucide-react';
import type { CategorizedComment } from './CommentCategorizationTable';

interface Comment {
  id: string;
  comment: string;
  category: CommentCategory;
  action: string;
  date: string;
  livreur: string;
  entrepot: string;
  nomTournee: string;
  sequence: number | undefined;
}

interface CommentProcessingProps {
    data: MergedData[];
}

// Sanitize an ID the same way as when saving
const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9-]/g, '_');


const CommentProcessing = ({ data }: CommentProcessingProps) => {
  const [commentsToProcess, setCommentsToProcess] = useState<Comment[]>([]);
  const { toast } = useToast();
  const firestore = useFirestore();

  const suiviCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'suiviCommentaires');
  }, [firestore]);

  const categorizedCommentsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'commentCategories');
  }, [firestore]);


  const { data: existingSuivis, isLoading: isLoadingSuivis } = useCollection<SuiviCommentaireWithId>(suiviCollectionRef);
  const { data: savedCategorizedComments, isLoading: isLoadingCategories } = useCollection<CategorizedComment>(categorizedCommentsCollectionRef);


  const processedCommentIds = useMemo(() => {
      if (!existingSuivis) return new Set();
      return new Set(existingSuivis.map(s => `${s.nomTournee}|${s.date}|${s.entrepot}-${s.sequence}`));
  }, [existingSuivis]);

  const categorizedCommentsMap = useMemo(() => {
    if (!savedCategorizedComments) return new Map();
    return new Map(savedCategorizedComments.map(c => [sanitizeId(c.id), c.category]));
  }, [savedCategorizedComments]);


  useEffect(() => {
      if (isLoadingSuivis || isLoadingCategories) return;

      const unprocessedComments = data
          .filter(item => {
              const uniqueCommentId = `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`;
              return item.commentaire && item.notation != null && item.notation <= 3 && !processedCommentIds.has(uniqueCommentId);
          })
          .map((item) => {
              const id = `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`;
              const sanitizedCommentId = sanitizeId(id);
              const savedCategory = categorizedCommentsMap.get(sanitizedCommentId);

              return {
                id,
                comment: item.commentaire || '',
                category: savedCategory || categorizeComment(item.commentaire),
                action: '',
                date: item.date,
                livreur: item.livreur || 'N/A',
                entrepot: item.entrepot,
                nomTournee: item.nomTournee,
                sequence: item.sequence || item.ordre,
              }
          });
      setCommentsToProcess(unprocessedComments);
  }, [data, processedCommentIds, isLoadingSuivis, isLoadingCategories, categorizedCommentsMap]);

  const handleProcessComment = async (comment: Comment) => {
      if (!firestore) {
          toast({ variant: "destructive", title: "Erreur", description: "La connexion à Firestore n'est pas disponible." });
          return;
      }
      if (comment.action.trim() === '') {
          toast({ variant: "destructive", title: "Action requise", description: "Veuillez saisir une action corrective." });
          return;
      }

      try {
          await saveSuiviCommentaire(firestore, { ...comment });
          toast({ title: "Succès", description: "L'action corrective a été enregistrée." });
          
          setCommentsToProcess(prev => prev.filter(c => c.id !== comment.id));

      } catch (e: any) {
           toast({ variant: "destructive", title: "Erreur de sauvegarde", description: e.message });
      }
  };
  
    const handleCategoryChange = async (id: string, newCategory: CommentCategory) => {
        if (!firestore) return;
        const comment = commentsToProcess.find(c => c.id === id);
        if (!comment) return;

        setCommentsToProcess(commentsToProcess.map(c => c.id === id ? { ...c, category: newCategory } : c));
        
        const existingSuivi = existingSuivis?.find(s => `${s.nomTournee}|${s.date}|${s.entrepot}-${s.sequence}` === id);

        if(existingSuivi) {
            const docRef = doc(firestore, 'suiviCommentaires', existingSuivi.id);
            await updateSuiviCommentaire(docRef, { categorie: newCategory });
            toast({
                title: "Catégorie mise à jour",
                description: `La catégorie a été changée en "${newCategory}". Le rapport va s'actualiser.`
            });
        }
    };


  const handleActionChange = (id: string, action: string) => {
    setCommentsToProcess(commentsToProcess.map(c => c.id === id ? { ...c, action } : c));
  };
  
  if (isLoadingSuivis || isLoadingCategories) {
      return (
          <div className="flex items-center justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mr-3" />
              <span className="text-muted-foreground">Chargement des données de traitement...</span>
          </div>
      )
  }
  
  if (!commentsToProcess.length) {
      return <div className="text-center p-8 text-muted-foreground">Aucun nouveau commentaire négatif à traiter.</div>
  }

  return (
    <div className="max-h-[75vh] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Livreur</TableHead>
            <TableHead>Entrepôt</TableHead>
            <TableHead>Tournée</TableHead>
            <TableHead>Séquence</TableHead>
            <TableHead>Commentaire</TableHead>
            <TableHead>Catégorie</TableHead>
            <TableHead>Action Corrective</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {commentsToProcess.map(comment => (
            <TableRow key={comment.id}>
              <TableCell>{comment.date}</TableCell>
              <TableCell>{comment.livreur}</TableCell>
              <TableCell>{comment.entrepot}</TableCell>
              <TableCell>{comment.nomTournee}</TableCell>
              <TableCell>{comment.sequence}</TableCell>
              <TableCell className="max-w-xs whitespace-pre-wrap">{comment.comment}</TableCell>
              <TableCell>
                <Select onValueChange={(value: CommentCategory) => handleCategoryChange(comment.id, value)} value={comment.category}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {commentCategories.map(cat => (
                         <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input 
                  value={comment.action} 
                  onChange={(e) => handleActionChange(comment.id, e.target.value)}
                  placeholder="Ajouter une action corrective"
                />
              </TableCell>
              <TableCell>
                <Button onClick={() => handleProcessComment(comment)}>Traiter</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default CommentProcessing;
