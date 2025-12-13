import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export const PurchasePayments: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-heading font-bold text-foreground">Make Payments</h1>
    <p className="text-muted-foreground">Record payments to suppliers</p>
    <Card><CardContent className="py-12 text-center"><CreditCard className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><p>Pay supplier bills and track cash outflow</p></CardContent></Card>
  </div>
);

export default PurchasePayments;
