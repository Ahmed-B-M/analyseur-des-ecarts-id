
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
import { useMemo } from 'react';

interface QualitySummaryProps {
    data: MergedData[];
}

const QualitySummary = ({ data }: QualitySummaryProps) => {

  const negativeRatings = useMemo(() => (data || []).filter(
    (d: MergedData) => d.notation && d.notation <= 3
  ), [data]);

  const summaryByDepot = useMemo(() => {
    const grouped = negativeRatings.reduce((acc, curr) => {
      const depot = curr.depot || 'Inconnu';
      if (!acc[depot]) {
        acc[depot] = { totalRating: 0, ratingCount: 0, commentCount: 0 };
      }
      acc[depot].totalRating += curr.notation!;
      acc[depot].ratingCount++;
      if (curr.commentaire) {
        acc[depot].commentCount++;
      }
      return acc;
    }, {} as Record<string, { totalRating: number; ratingCount: number; commentCount: number }>);

    return Object.entries(grouped).map(([depot, stats]) => ({
      depot,
      negativeRatingsCount: stats.ratingCount,
      averageRating: stats.ratingCount > 0 ? (stats.totalRating / stats.ratingCount).toFixed(2) : 'N/A',
      commentCount: stats.commentCount,
    })).sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatings]);

  const summaryByCarrier = useMemo(() => {
     const grouped = negativeRatings.reduce((acc, curr) => {
      const key = `${curr.depot || 'Inconnu'} | ${curr.carrier || 'Inconnu'}`;
      if (!acc[key]) {
        acc[key] = { depot: curr.depot || 'Inconnu', carrier: curr.carrier || 'Inconnu', totalRating: 0, ratingCount: 0, commentCount: 0 };
      }
      acc[key].totalRating += curr.notation!;
      acc[key].ratingCount++;
      if (curr.commentaire) {
        acc[key].commentCount++;
      }
      return acc;
    }, {} as Record<string, { depot: string; carrier: string; totalRating: number; ratingCount: number; commentCount: number }>);

    return Object.values(grouped).map(stats => ({
        depot: stats.depot,
        carrier: stats.carrier,
        negativeRatingsCount: stats.ratingCount,
        averageRating: stats.ratingCount > 0 ? (stats.totalRating / stats.ratingCount).toFixed(2) : 'N/A',
        commentCount: stats.commentCount,
    })).sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatings]);


  const summaryByDriver = useMemo(() => {
    const grouped = negativeRatings.reduce((acc, curr) => {
      const driver = curr.livreur || 'Inconnu';
      if (!acc[driver]) {
        acc[driver] = { totalRating: 0, ratingCount: 0, commentCount: 0 };
      }
      acc[driver].totalRating += curr.notation!;
      acc[driver].ratingCount++;
      if (curr.commentaire) {
        acc[driver].commentCount++;
      }
      return acc;
    }, {} as Record<string, { totalRating: number; ratingCount: number; commentCount: number }>);

    return Object.entries(grouped).map(([driver, stats]) => ({
      driver,
      negativeRatingsCount: stats.ratingCount,
      averageRating: stats.ratingCount > 0 ? (stats.totalRating / stats.ratingCount).toFixed(2) : 'N/A',
      commentCount: stats.commentCount,
    })).sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatings]);


  if (negativeRatings.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">Aucune note négative ({"<="} 3) à afficher pour la sélection actuelle.</p>
      </div>
    );
  }

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Synthèse par Dépôt</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur notes {"<="} 3)</TableHead><TableHead>Nb. Commentaires (sur notes {"<="} 3)</TableHead></TableRow></TableHeader>
            <TableBody>
              {summaryByDepot.map(({ depot, negativeRatingsCount, averageRating, commentCount }) => (
                <TableRow key={depot}><TableCell>{depot}</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
       <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Synthèse par Transporteur et Dépôt</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Transporteur</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur notes {"<="} 3)</TableHead><TableHead>Nb. Commentaires (sur notes {"<="} 3)</TableHead></TableRow></TableHeader>
            <TableBody>
              {summaryByCarrier.map(({ depot, carrier, negativeRatingsCount, averageRating, commentCount }, index) => (
                <TableRow key={index}><TableCell>{depot}</TableCell><TableCell>{carrier}</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle>Synthèse par Livreur</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Livreur</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur notes {"<="} 3)</TableHead><TableHead>Nb. Commentaires (sur notes {"<="} 3)</TableHead></TableRow></TableHeader>
            <TableBody>
              {summaryByDriver.map(({ driver, negativeRatingsCount, averageRating, commentCount }) => (
                <TableRow key={driver}><TableCell>{driver}</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualitySummary;
