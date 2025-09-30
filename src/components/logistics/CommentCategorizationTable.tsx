
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";

// Define the type for a single category row
export type CategoryRow = {
  category: string;
  count: number;
  percentage: number;
  action: string;
};

// Define the props for the component
interface CommentCategorizationTableProps {
  data: CategoryRow[];
  onActionChange: (category: string, action: string) => void;
}

export function CommentCategorizationTable({ data, onActionChange }: CommentCategorizationTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Catégorisation des Commentaires</CardTitle>
        <CardDescription>
          Analyse des commentaires clients négatifs et actions correctives.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Nombre</TableHead>
              <TableHead className="text-right">Pourcentage</TableHead>
              <TableHead>Actions Mises en Place</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.category}>
                <TableCell className="font-medium">{item.category}</TableCell>
                <TableCell className="text-right">{item.count}</TableCell>
                <TableCell className="text-right">{item.percentage.toFixed(2)}%</TableCell>
                <TableCell>
                  <Input
                    value={item.action}
                    onChange={(e) => onActionChange(item.category, e.target.value)}
                    placeholder="Décrire l'action..."
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
