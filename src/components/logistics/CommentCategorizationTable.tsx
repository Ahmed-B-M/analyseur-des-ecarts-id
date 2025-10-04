
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MergedData } from '@/lib/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { commentCategories, CommentCategory, categorizeComment } from '@/lib/comment-categorization';
import { useState, useMemo } from 'react';

interface CommentCategorizationTableProps {
  data: MergedData[];
}

const CommentCategorizationTable = ({ data }: CommentCategorizationTableProps) => {
  const negativeComments = useMemo(() => {
    return data
      .filter((d) => d.notation && d.notation <= 3 && d.commentaire)
      .map((d, index) => ({
        id: index,
        date: d.date,
        livreur: d.livreur || 'Inconnu',
        ville: d.ville,
        note: d.notation,
        comment: d.commentaire,
        category: categorizeComment(d.commentaire),
      }));
  }, [data]);

  const [categorizedComments, setCategorizedComments] = useState(negativeComments);

  const handleCategoryChange = (id: number, newCategory: CommentCategory) => {
    setCategorizedComments(prevComments =>
      prevComments.map(comment =>
        comment.id === id ? { ...comment, category: newCategory } : comment
      )
    );
  };
  
  const commentsByCategory = useMemo(() => {
    return categorizedComments.reduce((acc, comment) => {
      if (!acc[comment.category]) {
        acc[comment.category] = [];
      }
      acc[comment.category].push(comment);
      return acc;
    }, {} as Record<CommentCategory, typeof categorizedComments>);
  }, [categorizedComments]);


  if (negativeComments.length === 0) {
    return null;
  }

  return (
    <Card className="col-span-1 lg:col-span-2">
      <CardHeader>
        <CardTitle>Catégorisation des Commentaires</CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {commentCategories.map(category => {
            const comments = commentsByCategory[category] || [];
            if (comments.length === 0) return null;

            return (
              <AccordionItem value={category} key={category}>
                <AccordionTrigger>{category} ({comments.length})</AccordionTrigger>
                <AccordionContent>
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Livreur</TableHead>
                          <TableHead>Commentaire</TableHead>
                          <TableHead className="w-48">Catégorie</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comments.map(({ id, date, livreur, comment, category: currentCategory }) => (
                          <TableRow key={id}>
                            <TableCell>{date}</TableCell>
                            <TableCell>{livreur}</TableCell>
                            <TableCell>{comment}</TableCell>
                            <TableCell>
                              <Select
                                value={currentCategory}
                                onValueChange={(newCat: CommentCategory) => handleCategoryChange(id, newCat)}
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default CommentCategorizationTable;
