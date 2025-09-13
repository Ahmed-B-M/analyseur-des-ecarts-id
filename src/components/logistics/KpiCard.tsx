'use client';
import type { Kpi, ComparisonKpi } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

export function KpiCard({ title, value, description, icon: Icon, variant = "default" }: Kpi & { variant?: "default" | "inline" }) {
  if (variant === "inline") {
      return (
          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                {Icon && <Icon className="w-5 h-5 text-muted-foreground" />}
                <p className="font-medium text-sm">{title}</p>
              </div>
              <p className="font-bold text-lg">{value}</p>
          </div>
      )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}


export function ComparisonKpiCard({ title, value1, label1, value2, label2, change, changeType }: ComparisonKpi) {
  const changeColor = changeType === 'increase' ? 'text-red-500' : changeType === 'decrease' ? 'text-green-500' : 'text-muted-foreground';
  const ChangeIcon = changeType === 'increase' ? ArrowUp : ArrowDown;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-baseline">
          <div>
            <p className="text-xs text-muted-foreground">{label1}</p>
            <p className="text-2xl font-bold">{value1}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground text-right">{label2}</p>
            <p className="text-2xl font-bold">{value2}</p>
          </div>
        </div>
         <div className={cn("flex items-center text-xs mt-2", changeColor)}>
           <ChangeIcon className="h-3 w-3 mr-1" />
           {change}
        </div>
      </CardContent>
    </Card>
  );
}
