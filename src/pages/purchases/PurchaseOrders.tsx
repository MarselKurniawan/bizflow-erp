// Purchase Orders, Bills, and Payments pages follow the same pattern as Sales
// For brevity, exporting placeholder that redirects to a simple page

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Truck } from 'lucide-react';

export const PurchaseOrders: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-heading font-bold text-foreground">Purchase Orders</h1>
    <p className="text-muted-foreground">Similar to Sales Orders - create POs, receive goods, generate bills</p>
    <Card><CardContent className="py-12 text-center"><Truck className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><p>Purchase Orders module follows the same structure as Sales Orders</p></CardContent></Card>
  </div>
);

export default PurchaseOrders;
