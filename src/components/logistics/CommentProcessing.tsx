
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { MergedData } from '@/lib/types';
import { commentCategories, categorizeComment, CommentCategory } from '@/lib/comment-categorization';

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
    onCommentProcessed: (processedComment: { id: string; category: string; action: string }) => void;
    processedCommentIds: string[];
}

const CommentProcessing: React.FC<CommentProcessingProps> = ({ data, onCommentProcessed, processedCommentIds }) => {
  const [comments, setComments] = useState<Comment[]>([]);

  useEffect(() => {
    const unprocessedComments = data
      .filter(item => {
          const commentId = `${item.tourneeUniqueId}-${item.sequence || item.ordre}`;
          return item.commentaire && item.notation != null && item.notation <= 3 && !processedCommentIds.includes(commentId)
      })
      .map((item) => ({
        id: `${item.tourneeUniqueId}-${item.sequence || item.ordre}`,
        comment: item.commentaire || '',
        category: categorizeComment(item.commentaire),
        action: '',
        date: item.date,
        livreur: item.livreur || 'N/A',
        entrepot: item.entrepot,
        nomTournee: item.nomTournee,
        sequence: item.sequence,
      }));
    setComments(unprocessedComments);
  }, [data, processedCommentIds]);


  const handleProcessComment = (comment: Comment) => {
    if (comment.action.trim() === '') {
        // Optional: Add some user feedback, e.g., a toast notification
        alert("Veuillez saisir une action corrective avant de traiter le commentaire.");
        return;
    }
    onCommentProcessed({
        id: comment.id,
        category: comment.category,
        action: comment.action,
    });
  };

  const handleActionChange = (id: string, action: string) => {
    setComments(comments.map(c => c.id === id ? { ...c, action } : c));
  };

  const handleCategoryChange = (id: string, category: CommentCategory) => {
    setComments(comments.map(c => c.id === id ? { ...c, category } : c));
  };
  
  if (!comments.length) {
      return <div className="text-center p-4">Aucun commentaire négatif à traiter.</div>
  }

  return (
    <div>
      <Table>
        <TableHeader>
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
          {comments.map(comment => (
            <TableRow key={comment.id}>
              <TableCell>{comment.date}</TableCell>
              <TableCell>{comment.livreur}</TableCell>
              <TableCell>{comment.entrepot}</TableCell>
              <TableCell>{comment.nomTournee}</TableCell>
              <TableCell>{comment.sequence}</TableCell>
              <TableCell>{comment.comment}</TableCell>
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
