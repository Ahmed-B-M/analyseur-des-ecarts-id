
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
import { commentCategories, CommentCategory } from '@/lib/comment-categorization';
import { useMemo } from 'react';

// Define the shape of the comment object with its category
export interface CategorizedComment {
    id: string;
    date: string;
    livreur: string;
    ville: string;
    note: number;
    comment: string;
    category: CommentCategory;
}

interface CommentCategorizationTableProps {
  categorizedComments: CategorizedComment[];
  onCategoryChange: (id: string, newCategory: CommentCategory) => void;
}

const CommentCategorizationTable = ({ categorizedComments, onCategoryChange }: CommentCategorizationTableProps) => {

  const commentsByCategory = useMemo(() => {
    return categorizedComments.reduce((acc, comment) => {
      if (!acc[comment.category]) {
        acc[comment.category] = [];
      }
      acc[comment.category].push(comment);
      return acc;
    }, {} as Record<CommentCategory, CategorizedComment[]>);
  }, [categorizedComments]);


  if (categorizedComments.length === 0) {
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
                                onValueChange={(newCat: CommentCategory) => onCategoryChange(id, newCat)}
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
