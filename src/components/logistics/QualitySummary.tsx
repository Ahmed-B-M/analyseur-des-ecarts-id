
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MergedData, SuiviCommentaire, DepotStats, PostalCodeStats } from '@/lib/types';
import { useMemo } from 'react';
import { getCarrierFromDriverName, getNomDepot } from '@/lib/utils';
import { CommentCategory } from '@/lib/comment-categorization';
import GlobalCommentView from './GlobalCommentView';
import { CategorizedComment } from './CommentCategorizationTable';
import QualityEmailGenerator from './QualityEmailGenerator';

interface QualitySummaryProps {
    data: MergedData[];
    processedActions: SuiviCommentaire[];
    savedCategorizedComments: CategorizedComment[];
    uncategorizedCommentsForSummary: any[];
    warehouseStats: DepotStats[];
    postalCodeStats: PostalCodeStats[];
}

const QualitySummary = ({ data, processedActions, savedCategorizedComments, uncategorizedCommentsForSummary }: QualitySummaryProps) => {

  const ratings = useMemo(() => (data || []).filter(
    (d: MergedData) => d.notation
  ), [data]);

  const allCommentsInData = useMemo(() => (data || []).filter(
    (d: MergedData) => d.commentaire
  ), [data]);

  const allCommentsForSummary = useMemo(() => {
    return [...savedCategorizedComments, ...uncategorizedCommentsForSummary];
  }, [savedCategorizedComments, uncategorizedCommentsForSummary]);

  const negativeRatingsData = useMemo(() => (data || []).filter(
    (d: MergedData) => d.notation != null && d.notation <= 3
  ), [data]);
  
  const summaryByDepot = useMemo(() => {
    const allRatingsGrouped = ratings.reduce((acc, curr) => {
      const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
      if (!acc[depot]) {
        acc[depot] = { totalRating: 0, ratingCount: 0 };
      }
      acc[depot].totalRating += curr.notation!;
      acc[depot].ratingCount++;
      return acc;
    }, {} as Record<string, { totalRating: number; ratingCount: number }>);

    const negativeRatingsGrouped = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
        if(!acc[depot]) {
            acc[depot] = { negativeRatingCount: 0 };
        }
        acc[depot].negativeRatingCount++;
        return acc;
    }, {} as Record<string, { negativeRatingCount: number }>);

    const commentsGrouped = allCommentsInData.reduce((acc, curr) => {
      const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
      if (!acc[depot]) {
        acc[depot] = { commentCount: 0 };
      }
      acc[depot].commentCount++;
      return acc;
    }, {} as Record<string, { commentCount: number }>);

    const allDepots = new Set([...Object.keys(allRatingsGrouped), ...Object.keys(negativeRatingsGrouped)]);
    
    const combined = Array.from(allDepots).map(depot => {
      const allStats = allRatingsGrouped[depot] || { totalRating: 0, ratingCount: 0 };
      const negativeStats = negativeRatingsGrouped[depot] || { negativeRatingCount: 0 };
      const commentStats = commentsGrouped[depot] || { commentCount: 0 };
      
      return {
        depot,
        totalRatings: allStats.ratingCount,
        negativeRatingsCount: negativeStats.negativeRatingCount,
        averageRating: allStats.ratingCount > 0 ? (allStats.totalRating / allStats.ratingCount).toFixed(2) : 'N/A',
        commentCount: commentStats.commentCount,
      };
    });

    return combined
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [ratings, negativeRatingsData, allCommentsInData]);

  const summaryByCarrier = useMemo(() => {
    const allRatingsGrouped = ratings.reduce((acc, curr) => {
      const key = `${getNomDepot(curr.tournee?.entrepot || 'Inconnu')} | ${getCarrierFromDriverName(curr.livreur || '') || 'Inconnu'}`;
      if (!acc[key]) {
        acc[key] = { depot: getNomDepot(curr.tournee?.entrepot || 'Inconnu'), carrier: getCarrierFromDriverName(curr.livreur || '') || 'Inconnu', totalRating: 0, ratingCount: 0 };
      }
      acc[key].totalRating += curr.notation!;
      acc[key].ratingCount++;
      return acc;
    }, {} as Record<string, { depot: string; carrier: string; totalRating: number; ratingCount: number }>);

    const negativeRatingsGrouped = negativeRatingsData.reduce((acc, curr) => {
       const key = `${getNomDepot(curr.tournee?.entrepot || 'Inconnu')} | ${getCarrierFromDriverName(curr.livreur || '') || 'Inconnu'}`;
      if (!acc[key]) {
        acc[key] = { depot: getNomDepot(curr.tournee?.entrepot || 'Inconnu'), carrier: getCarrierFromDriverName(curr.livreur || '') || 'Inconnu', negativeRatingCount: 0 };
      }
      acc[key].negativeRatingCount++;
      return acc;
    }, {} as Record<string, { depot: string; carrier: string; negativeRatingCount: number;}>);

    const commentsGrouped = allCommentsInData.reduce((acc, curr) => {
      const key = `${getNomDepot(curr.tournee?.entrepot || 'Inconnu')} | ${getCarrierFromDriverName(curr.livreur || '') || 'Inconnu'}`;
      if(!acc[key]) {
          acc[key] = { commentCount: 0 };
      }
      acc[key].commentCount++;
      return acc;
    }, {} as Record<string, { commentCount: number }>);
    
    const allKeys = new Set([...Object.keys(allRatingsGrouped), ...Object.keys(negativeRatingsGrouped)]);

    const combined = Array.from(allKeys).map(key => {
        const allStats = allRatingsGrouped[key];
        const negativeStats = negativeRatingsGrouped[key];
        const commentStats = commentsGrouped[key] || { commentCount: 0 };

        const depot = allStats?.depot || negativeStats?.depot;
        const carrier = allStats?.carrier || negativeStats?.carrier;
        const totalRatings = allStats?.ratingCount || 0;
        const averageRating = allStats && allStats.ratingCount > 0 ? (allStats.totalRating / allStats.ratingCount).toFixed(2) : 'N/A';
        const negativeRatingsCount = negativeStats?.negativeRatingCount || 0;
        const commentCount = commentStats.commentCount;

        return { depot, carrier, totalRatings, averageRating, negativeRatingsCount, commentCount };
    });

    return combined
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [ratings, negativeRatingsData, allCommentsInData]);


  const summaryByDriver = useMemo(() => {
    const allRatingsGrouped = ratings.reduce((acc, curr) => {
      const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
      const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
      const driver = curr.livreur || 'Inconnu';
      const key = `${depot}|${carrier}|${driver}`;

      if (!acc[key]) {
        acc[key] = { depot, carrier, driver, totalRating: 0, ratingCount: 0 };
      }
      acc[key].totalRating += curr.notation!;
      acc[key].ratingCount++;
      return acc;
    }, {} as Record<string, { depot: string; carrier: string; driver: string; totalRating: number; ratingCount: number }>);

    const negativeRatingsGrouped = negativeRatingsData.reduce((acc, curr) => {
      const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
      const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
      const driver = curr.livreur || 'Inconnu';
      const key = `${depot}|${carrier}|${driver}`;

      if (!acc[key]) {
        acc[key] = { negativeRatingCount: 0 };
      }
      acc[key].negativeRatingCount++;
      return acc;
    }, {} as Record<string, { negativeRatingCount: number }>);

    const commentsGrouped = allCommentsForSummary.reduce((acc, curr) => {
      const originalItem = data.find(item => `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}` === curr.id);
      if (!originalItem) return acc;

      const depot = getNomDepot(originalItem.tournee?.entrepot || 'Inconnu');
      const carrier = getCarrierFromDriverName(originalItem.livreur || '') || 'Inconnu';
      const driver = originalItem.livreur || 'Inconnu';
      const key = `${depot}|${carrier}|${driver}`;

      if (!acc[key]) {
        acc[key] = { categoryCounts: {} as Record<CommentCategory, number> };
      }
      acc[key].categoryCounts[curr.category as CommentCategory] = (acc[key].categoryCounts[curr.category as CommentCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, { categoryCounts: Record<CommentCategory, number> }>);

    const allKeys = new Set([...Object.keys(allRatingsGrouped), ...Object.keys(negativeRatingsGrouped)]);

    const combined = Array.from(allKeys).map(key => {
      const allStats = allRatingsGrouped[key];
      const negativeStats = negativeRatingsGrouped[key];
      const commentStats = commentsGrouped[key];

      const [depot, carrier, driver] = allStats ? [allStats.depot, allStats.carrier, allStats.driver] : key.split('|');
      const totalRatings = allStats?.ratingCount || 0;
      const averageRating = allStats && allStats.ratingCount > 0 ? (allStats.totalRating / allStats.ratingCount).toFixed(2) : 'N/A';
      const negativeRatingsCount = negativeStats?.negativeRatingCount || 0;
      const categorySummary = commentStats 
        ? Object.entries(commentStats.categoryCounts)
            .map(([cat, count]) => `${count} ${cat}`)
            .join(', ')
        : '';

      return { depot, carrier, driver, totalRatings, averageRating, negativeRatingsCount, categorySummary };
    });

    return combined
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => {
        if (a.depot < b.depot) return -1;
        if (a.depot > b.depot) return 1;
        if (a.carrier < b.carrier) return -1;
        if (a.carrier > b.carrier) return 1;
        if (a.driver < b.driver) return -1;
        if (a.driver > b.driver) return 1;
        return 0;
    });
  }, [ratings, allCommentsForSummary, data, negativeRatingsData]);
  
  const unassignedDrivers = useMemo(() => {
    const drivers = data.reduce((acc, curr) => {
      const driverName = curr.livreur || 'Inconnu';
      if (driverName !== 'Inconnu' && !getCarrierFromDriverName(driverName)) {
        const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
        if (!acc[driverName]) {
          acc[driverName] = new Set<string>();
        }
        acc[driverName].add(depot);
      }
      return acc;
    }, {} as Record<string, Set<string>>);
  
    return Object.entries(drivers).map(([driver, depots]) => ({
      driver,
      depots: Array.from(depots).join(', '),
    }));
  }, [data]);

  if (allCommentsForSummary.length === 0 && negativeRatingsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse de la Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucune note à afficher pour la sélection actuelle.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
       <div className="flex justify-end">
        <QualityEmailGenerator 
          summaryByDepot={summaryByDepot}
          summaryByCarrier={summaryByCarrier}
          summaryByDriver={summaryByDriver}
          unassignedDrivers={unassignedDrivers}
        />
      </div>

      <GlobalCommentView 
        data={data}
        processedActions={processedActions}
        categorizedComments={allCommentsForSummary}
      />

      <Card>
        <CardHeader>
          <CardTitle>Synthèses Générales de la Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="depot">
            <TabsList>
              <TabsTrigger value="depot">Par Dépôt</TabsTrigger>
              <TabsTrigger value="carrier">Par Transporteur</TabsTrigger>
              <TabsTrigger value="driver">Par Livreur</TabsTrigger>
            </TabsList>
            <TabsContent value="depot">
              <Table>
                <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (globale)</TableHead><TableHead>Nb. Commentaires</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByDepot.map(({ depot, totalRatings, negativeRatingsCount, averageRating, commentCount }) => (
                    <TableRow key={depot}><TableCell>{depot} ({totalRatings})</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="carrier">
              <Table>
                <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Transporteur</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (globale)</TableHead><TableHead>Nb. Commentaires</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByCarrier.map(({ depot, carrier, totalRatings, negativeRatingsCount, averageRating, commentCount }, index) => (
                    <TableRow key={index}><TableCell>{depot}</TableCell><TableCell>{carrier} ({totalRatings})</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="driver">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dépôt</TableHead>
                    <TableHead>Transporteur</TableHead>
                    <TableHead>Livreur</TableHead>
                    <TableHead>Nb. Mauvaises Notes</TableHead>
                    <TableHead>Note Moyenne (globale)</TableHead>
                    <TableHead>Catégories de Commentaires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaryByDriver.map(({ depot, carrier, driver, totalRatings, negativeRatingsCount, averageRating, categorySummary }, index) => (
                    <TableRow key={index}>
                      <TableCell>{depot}</TableCell>
                      <TableCell>{carrier}</TableCell>
                      <TableCell>{driver} ({totalRatings})</TableCell>
                      <TableCell>{negativeRatingsCount}</TableCell>
                      <TableCell>{averageRating}</TableCell>
                      <TableCell>{categorySummary}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {unassignedDrivers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Livreurs sans Transporteur Assigné</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Nom du Livreur</TableHead><TableHead>Dépôt(s)</TableHead></TableRow></TableHeader>
              <TableBody>
                {unassignedDrivers.map(({ driver, depots }) => (
                  <TableRow key={driver}><TableCell>{driver}</TableCell><TableCell>{depots}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default QualitySummary;
