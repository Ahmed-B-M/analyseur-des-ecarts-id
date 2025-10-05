
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

  const allCommentsForSummary = useMemo(() => {
    // Combine saved and unsaved comments for a complete view
    const allCategorized = [...savedCategorizedComments, ...uncategorizedCommentsForSummary];
    const uniqueComments = new Map<string, any>();
    allCategorized.forEach(comment => {
        if(!uniqueComments.has(comment.id)) {
            uniqueComments.set(comment.id, comment)
        }
    });
    return Array.from(uniqueComments.values());
  }, [savedCategorizedComments, uncategorizedCommentsForSummary]);

  // This is the main data source for this component.
  // It includes all deliveries with negative ratings, and enriches them with comment categories if available.
  const negativeRatingsData = useMemo(() => {
    const commentsMap = new Map(allCommentsForSummary.map(c => [c.id, c]));
    
    return data
      .filter(d => d.notation != null && d.notation <= 3)
      .map(item => {
        const commentId = `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`;
        const commentInfo = commentsMap.get(commentId);
        return {
          ...item,
          category: commentInfo ? commentInfo.category : 'Autre', // Use assigned category or default
        };
      });
  }, [data, allCommentsForSummary]);

  const summaryByDepot = useMemo(() => {
    const grouped = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        if(!acc[depot]) {
            acc[depot] = {
                totalRatings: 0,
                negativeRatingsCount: 0,
                commentCount: 0,
                totalRatingValue: 0,
            };
        }
        
        acc[depot].totalRatings++;
        acc[depot].negativeRatingsCount++;
        acc[depot].totalRatingValue += curr.notation!;
        if (curr.commentaire) {
          acc[depot].commentCount++;
        }
        
        return acc;
    }, {} as Record<string, { totalRatings: number, negativeRatingsCount: number, commentCount: number, totalRatingValue: number }>);

    return Object.entries(grouped).map(([depot, stats]) => ({
        depot,
        totalRatings: stats.totalRatings,
        negativeRatingsCount: stats.negativeRatingsCount,
        averageRating: stats.totalRatings > 0 ? (stats.totalRatingValue / stats.totalRatings).toFixed(2) : 'N/A',
        commentCount: stats.commentCount,
    })).filter(item => item.negativeRatingsCount > 0)
     .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatingsData]);


  const summaryByCarrier = useMemo(() => {
    const grouped = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur) || 'Inconnu';
        const key = `${depot}|${carrier}`;

        if (!acc[key]) {
            acc[key] = { depot, carrier, negativeRatingsCount: 0, commentCount: 0, totalRatingValue: 0, totalRatings: 0 };
        }
        
        acc[key].totalRatings++;
        acc[key].negativeRatingsCount++;
        acc[key].totalRatingValue += curr.notation!;
        if (curr.commentaire) {
            acc[key].commentCount++;
        }
        return acc;
    }, {} as Record<string, { depot: string, carrier: string, negativeRatingsCount: number, commentCount: number, totalRatingValue: number, totalRatings: number }>);
    
    return Object.values(grouped).map(stats => ({
        ...stats,
        averageRating: stats.totalRatings > 0 ? (stats.totalRatingValue / stats.totalRatings).toFixed(2) : 'N/A',
    }))
    .filter(item => item.negativeRatingsCount > 0)
    .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatingsData]);


  const summaryByDriver = useMemo(() => {
     const grouped = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur) || 'Inconnu';
        const driver = curr.livreur || 'Inconnu';
        const key = `${depot}|${carrier}|${driver}`;

        if (!acc[key]) {
            acc[key] = { depot, carrier, driver, negativeRatingsCount: 0, totalRatingValue: 0, totalRatings: 0, categoryCounts: {} as Record<CommentCategory, number> };
        }

        acc[key].totalRatings++;
        acc[key].negativeRatingsCount++;
        acc[key].totalRatingValue += curr.notation!;
        
        if (curr.commentaire) {
          const category = curr.category as CommentCategory;
          acc[key].categoryCounts[category] = (acc[key].categoryCounts[category] || 0) + 1;
        }

        return acc;
    }, {} as Record<string, { depot: string, carrier: string, driver: string, negativeRatingsCount: number, totalRatingValue: number, totalRatings: number, categoryCounts: Record<CommentCategory, number> }>);

    return Object.values(grouped).map(stats => ({
        ...stats,
        averageRating: stats.totalRatings > 0 ? (stats.totalRatingValue / stats.totalRatings).toFixed(2) : 'N/A',
        categorySummary: Object.entries(stats.categoryCounts).map(([cat, count]) => `${count} ${cat}`).join(', '),
    }))
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
  }, [negativeRatingsData]);

  
  const unassignedDrivers = useMemo(() => {
    const drivers = negativeRatingsData.reduce((acc, curr) => {
      const driverName = curr.livreur || 'Inconnu';
      if (driverName !== 'Inconnu' && !getCarrierFromDriverName(driverName)) {
        const depot = getNomDepot(curr.entrepot);
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
  }, [negativeRatingsData]);

  if (negativeRatingsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse de la Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucune note négative (≤ 3) à afficher pour la sélection actuelle.</p>
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
          <CardTitle>Synthèses Générales de la Qualité (Focus Avis Négatifs)</CardTitle>
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
                <TableHeader><TableRow><TableHead>Dépôt (Total Mauvaises Notes)</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur notes ≤ 3)</TableHead><TableHead>Nb. Commentaires Associés</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByDepot.map(({ depot, totalRatings, negativeRatingsCount, averageRating, commentCount }) => (
                    <TableRow key={depot}><TableCell>{depot} ({totalRatings})</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="carrier">
              <Table>
                <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Transporteur (Total Mauvaises Notes)</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur notes ≤ 3)</TableHead><TableHead>Nb. Commentaires Associés</TableHead></TableRow></TableHeader>
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
                    <TableHead>Livreur (Total Mauvaises Notes)</TableHead>
                    <TableHead>Nb. Mauvaises Notes</TableHead>
                    <TableHead>Note Moyenne (sur notes ≤ 3)</TableHead>
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
