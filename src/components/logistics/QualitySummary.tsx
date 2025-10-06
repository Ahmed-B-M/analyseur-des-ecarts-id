
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
import { MergedData, SuiviCommentaire } from '@/lib/types';
import { useMemo } from 'react';
import { getCarrierFromDriverName, getNomDepot } from '@/lib/utils';
import { CommentCategory, categorizeComment } from '@/lib/comment-categorization';
import GlobalCommentView from './GlobalCommentView';
import { CategorizedComment } from './CommentCategorizationTable';
import QualityEmailGenerator from './QualityEmailGenerator';

interface QualitySummaryProps {
    data: MergedData[];
    processedActions: SuiviCommentaire[];
    savedCategorizedComments: CategorizedComment[];
    uncategorizedCommentsForSummary: any[];
}

const QualitySummary = ({ data, processedActions, savedCategorizedComments, uncategorizedCommentsForSummary }: QualitySummaryProps) => {

  const allCommentsForSummary = useMemo(() => {
    const allCategorized = [...savedCategorizedComments, ...uncategorizedCommentsForSummary];
    const uniqueComments = new Map<string, any>();
    allCategorized.forEach(comment => {
        if(!uniqueComments.has(comment.id)) {
            uniqueComments.set(comment.id, comment);
        }
    });
    return Array.from(uniqueComments.values());
  }, [savedCategorizedComments, uncategorizedCommentsForSummary]);

  const commentsMap = useMemo(() => {
    return new Map(allCommentsForSummary.map(c => [c.id, c.category]));
  }, [allCommentsForSummary]);

  const negativeRatingsData = useMemo(() => {
    return data
      .filter(d => d.notation != null && d.notation <= 3)
      .map(item => {
        const commentId = `${item.nomTournee}|${item.date}|${item.entrepot}-${item.sequence || item.ordre}`;
        const category = commentsMap.get(commentId) || (item.commentaire ? categorizeComment(item.commentaire) : 'Autre');
        return {
          ...item,
          category: category,
        };
      });
  }, [data, commentsMap]);

  const allDataWithNotes = useMemo(() => {
    return data.filter(d => d.notation != null);
  }, [data]);


  const summaryByDepot = useMemo(() => {
    const allDataGrouped = allDataWithNotes.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        if (!acc[depot]) {
            acc[depot] = { totalRatingValue: 0, ratedTasksCount: 0 };
        }
        acc[depot].ratedTasksCount++;
        acc[depot].totalRatingValue += curr.notation!;
        return acc;
    }, {} as Record<string, { totalRatingValue: number, ratedTasksCount: number }>);
    
    const allCommentsInData = data.filter(d => d.commentaire);
    
    const commentCounts = allCommentsInData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        acc[depot] = (acc[depot] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const grouped = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        if(!acc[depot]) {
            acc[depot] = { negativeRatingsCount: 0 };
        }
        acc[depot].negativeRatingsCount++;
        return acc;
    }, {} as Record<string, { negativeRatingsCount: number }>);

    return Object.keys(allDataGrouped)
      .map((depot) => {
        const depotNegativeStats = grouped[depot] || { negativeRatingsCount: 0 };
        const depotAllStats = allDataGrouped[depot];
        return {
          depot,
          totalRatings: depotAllStats?.ratedTasksCount || 0,
          negativeRatingsCount: depotNegativeStats.negativeRatingsCount,
          averageRating: (depotAllStats?.ratedTasksCount || 0) > 0 ? (depotAllStats.totalRatingValue / depotAllStats.ratedTasksCount).toFixed(2) : 'N/A',
          commentCount: commentCounts[depot] || 0,
        }
      })
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatingsData, allDataWithNotes, data]);


  const summaryByCarrier = useMemo(() => {
    const allDataGrouped = allDataWithNotes.reduce((acc, curr) => {
      const depot = getNomDepot(curr.entrepot);
      const carrier = getCarrierFromDriverName(curr.livreur) || 'Inconnu';
      const key = `${depot}|${carrier}`;
      if (!acc[key]) {
        acc[key] = { totalRatingValue: 0, ratedTasksCount: 0 };
      }
        acc[key].ratedTasksCount++;
        acc[key].totalRatingValue += curr.notation!;
      return acc;
    }, {} as Record<string, { totalRatingValue: number, ratedTasksCount: number }>);

    const allCommentsInData = data.filter(d => d.commentaire);

    const commentCounts = allCommentsInData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur) || 'Inconnu';
        const key = `${depot}|${carrier}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    
    const grouped = negativeRatingsData.reduce((acc, curr) => {
        const depot = getNomDepot(curr.entrepot);
        const carrier = getCarrierFromDriverName(curr.livreur) || 'Inconnu';
        const key = `${depot}|${carrier}`;

        if (!acc[key]) {
            acc[key] = { depot, carrier, negativeRatingsCount: 0 };
        }
        acc[key].negativeRatingsCount++;
        return acc;
    }, {} as Record<string, { depot: string, carrier: string, negativeRatingsCount: number }>);
    
    return Object.keys(allDataGrouped).map(key => {
      const negativeStats = grouped[key] || { depot: key.split('|')[0], carrier: key.split('|')[1], negativeRatingsCount: 0 };
      const allStats = allDataGrouped[key];
      return {
        ...negativeStats,
        totalRatings: allStats?.ratedTasksCount || 0,
        averageRating: (allStats?.ratedTasksCount || 0) > 0 ? (allStats.totalRatingValue / allStats.ratedTasksCount).toFixed(2) : 'N/A',
        commentCount: commentCounts[key] || 0,
      }
    })
    .filter(item => item.negativeRatingsCount > 0)
    .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [negativeRatingsData, allDataWithNotes, data]);


  const summaryByDriver = useMemo(() => {
    const allDataGrouped = allDataWithNotes.reduce((acc, curr) => {
     const depot = getNomDepot(curr.entrepot);
     const carrier = getCarrierFromDriverName(curr.livreur) || 'Inconnu';
     const driver = curr.livreur || 'Inconnu';
     const key = `${depot}|${carrier}|${driver}`;

     if (!acc[key]) {
       acc[key] = { totalRatingValue: 0, ratedTasksCount: 0 };
     }
       acc[key].ratedTasksCount++;
       acc[key].totalRatingValue += curr.notation!;
     return acc;
   }, {} as Record<string, { totalRatingValue: number, ratedTasksCount: number }>);
   
    const groupedByDriver = negativeRatingsData.reduce((acc, curr) => {
       const depot = getNomDepot(curr.entrepot);
       const carrier = getCarrierFromDriverName(curr.livreur) || 'Inconnu';
       const driver = curr.livreur || 'Inconnu';
       const key = `${depot}|${carrier}|${driver}`;

       if (!acc[key]) {
           acc[key] = {
               depot,
               carrier,
               driver,
               negativeRatings: []
           };
       }
       acc[key].negativeRatings.push(curr);
       return acc;
   }, {} as Record<string, { depot: string; carrier: string; driver: string; negativeRatings: typeof negativeRatingsData }>);

   return Object.entries(groupedByDriver).map(([key, groupData]) => {
       const allStats = allDataGrouped[key] || { totalRatingValue: 0, ratedTasksCount: 0 };
       
       const categoryCounts: Record<string, number> = {};
       groupData.negativeRatings.forEach(item => {
           if (item.commentaire) {
               categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
           }
       });

       const categorySummary = Object.entries(categoryCounts)
           .sort(([, countA], [, countB]) => countB - countA)
           .map(([cat, count]) => `${count} ${cat}`)
           .join(', ');

       return {
           depot: groupData.depot,
           carrier: groupData.carrier,
           driver: groupData.driver,
           totalRatings: allStats.ratedTasksCount,
           negativeRatingsCount: groupData.negativeRatings.length,
           averageRating: allStats.ratedTasksCount > 0 ? (allStats.totalRatingValue / allStats.ratedTasksCount).toFixed(2) : 'N/A',
           categorySummary: categorySummary || 'N/A',
       }
   })
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
  }, [negativeRatingsData, allDataWithNotes]);


  
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

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse de la Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucune donnée à afficher pour la sélection actuelle.</p>
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
                <TableHeader><TableRow><TableHead>Dépôt (Total Notes)</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur toutes les notes)</TableHead><TableHead>Nb. Commentaires Associés</TableHead></TableRow></TableHeader>
                <TableBody>
                  {summaryByDepot.map(({ depot, totalRatings, negativeRatingsCount, averageRating, commentCount }) => (
                    <TableRow key={depot}><TableCell>{depot} ({totalRatings})</TableCell><TableCell>{negativeRatingsCount}</TableCell><TableCell>{averageRating}</TableCell><TableCell>{commentCount}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="carrier">
              <Table>
                <TableHeader><TableRow><TableHead>Dépôt</TableHead><TableHead>Transporteur (Total Notes)</TableHead><TableHead>Nb. Mauvaises Notes</TableHead><TableHead>Note Moyenne (sur toutes les notes)</TableHead><TableHead>Nb. Commentaires Associés</TableHead></TableRow></TableHeader>
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
                    <TableHead>Livreur (Total Notes)</TableHead>
                    <TableHead>Nb. Mauvaises Notes</TableHead>
                    <TableHead>Note Moyenne (sur toutes les notes)</TableHead>
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

    