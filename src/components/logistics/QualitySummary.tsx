
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
import { MergedData } from '@/lib/types';
import { useMemo } from 'react';
import { getCarrierFromDriverName, getNomDepot } from '@/lib/utils';
import CommentCategorizationTable from './CommentCategorizationTable';
import { categorizeComment, CommentCategory } from '@/lib/comment-categorization';
import EmailGenerator from './EmailGenerator';

interface QualitySummaryProps {
    data: MergedData[];
}

const QualitySummary = ({ data }: QualitySummaryProps) => {

  const ratings = useMemo(() => (data || []).filter(
    (d: MergedData) => d.notation
  ), [data]);

  const negativeRatings = useMemo(() => (data || []).filter(
    (d: MergedData) => d.notation && d.notation <= 3
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

    const negativeRatingsGrouped = negativeRatings.reduce((acc, curr) => {
      const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
      if (!acc[depot]) {
        acc[depot] = { negativeRatingCount: 0, commentCount: 0 };
      }
      acc[depot].negativeRatingCount++;
      if (curr.commentaire) {
        acc[depot].commentCount++;
      }
      return acc;
    }, {} as Record<string, { negativeRatingCount: number; commentCount: number }>);

    const allDepots = new Set([...Object.keys(allRatingsGrouped), ...Object.keys(negativeRatingsGrouped)]);
    
    const combined = Array.from(allDepots).map(depot => {
      const allStats = allRatingsGrouped[depot] || { totalRating: 0, ratingCount: 0 };
      const negativeStats = negativeRatingsGrouped[depot] || { negativeRatingCount: 0, commentCount: 0 };
      
      return {
        depot,
        totalRatings: allStats.ratingCount,
        negativeRatingsCount: negativeStats.negativeRatingCount,
        averageRating: allStats.ratingCount > 0 ? (allStats.totalRating / allStats.ratingCount).toFixed(2) : 'N/A',
        commentCount: negativeStats.commentCount,
      };
    });

    return combined
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [ratings, negativeRatings]);

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

    const negativeRatingsGrouped = negativeRatings.reduce((acc, curr) => {
      const key = `${getNomDepot(curr.tournee?.entrepot || 'Inconnu')} | ${getCarrierFromDriverName(curr.livreur || '') || 'Inconnu'}`;
      if (!acc[key]) {
        acc[key] = { depot: getNomDepot(curr.tournee?.entrepot || 'Inconnu'), carrier: getCarrierFromDriverName(curr.livreur || '') || 'Inconnu', negativeRatingCount: 0, commentCount: 0 };
      }
      acc[key].negativeRatingCount++;
      if (curr.commentaire) {
        acc[key].commentCount++;
      }
      return acc;
    }, {} as Record<string, { depot: string; carrier: string; negativeRatingCount: number; commentCount: number }>);
    
    const allKeys = new Set([...Object.keys(allRatingsGrouped), ...Object.keys(negativeRatingsGrouped)]);

    const combined = Array.from(allKeys).map(key => {
        const allStats = allRatingsGrouped[key];
        const negativeStats = negativeRatingsGrouped[key];

        const depot = allStats?.depot || negativeStats?.depot;
        const carrier = allStats?.carrier || negativeStats?.carrier;
        const totalRatings = allStats?.ratingCount || 0;
        const averageRating = allStats && allStats.ratingCount > 0 ? (allStats.totalRating / allStats.ratingCount).toFixed(2) : 'N/A';
        const negativeRatingsCount = negativeStats?.negativeRatingCount || 0;
        const commentCount = negativeStats?.commentCount || 0;

        return { depot, carrier, totalRatings, averageRating, negativeRatingsCount, commentCount };
    });

    return combined
      .filter(item => item.negativeRatingsCount > 0)
      .sort((a, b) => b.negativeRatingsCount - a.negativeRatingsCount);
  }, [ratings, negativeRatings]);


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

    const negativeRatingsGrouped = negativeRatings.reduce((acc, curr) => {
      const depot = getNomDepot(curr.tournee?.entrepot || 'Inconnu');
      const carrier = getCarrierFromDriverName(curr.livreur || '') || 'Inconnu';
      const driver = curr.livreur || 'Inconnu';
      const key = `${depot}|${carrier}|${driver}`;

      if (!acc[key]) {
        acc[key] = { negativeRatingCount: 0, commentCount: 0, categoryCounts: {} as Record<CommentCategory, number> };
      }
      acc[key].negativeRatingCount++;
      if (curr.commentaire) {
        acc[key].commentCount++;
        const category = categorizeComment(curr.commentaire);
        acc[key].categoryCounts[category] = (acc[key].categoryCounts[category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, { negativeRatingCount: number; commentCount: number; categoryCounts: Record<CommentCategory, number> }>);

    const allKeys = new Set([...Object.keys(allRatingsGrouped), ...Object.keys(negativeRatingsGrouped)]);

    const combined = Array.from(allKeys).map(key => {
      const allStats = allRatingsGrouped[key];
      const negativeStats = negativeRatingsGrouped[key];

      const [depot, carrier, driver] = allStats ? [allStats.depot, allStats.carrier, allStats.driver] : key.split('|');
      const totalRatings = allStats?.ratingCount || 0;
      const averageRating = allStats && allStats.ratingCount > 0 ? (allStats.totalRating / allStats.ratingCount).toFixed(2) : 'N/A';
      const negativeRatingsCount = negativeStats?.negativeRatingCount || 0;
      const categorySummary = negativeStats 
        ? Object.entries(negativeStats.categoryCounts)
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
  }, [ratings, negativeRatings]);
  
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

  if (negativeRatings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analyse de la Qualité</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucune note négative ({"<="} 3) à afficher pour la sélection actuelle.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <div className="flex justify-end">
        <EmailGenerator 
            data={data} 
            summaryByDepot={summaryByDepot}
            summaryByCarrier={summaryByCarrier}
            summaryByDriver={summaryByDriver}
            unassignedDrivers={unassignedDrivers}
        />
      </div>
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

      <CommentCategorizationTable data={data} />
    </div>
  );
};

export default QualitySummary;
