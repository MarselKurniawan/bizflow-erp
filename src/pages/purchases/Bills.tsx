import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export const Bills: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-heading font-bold text-foreground">Bills</h1>
    <p className="text-muted-foreground">Track supplier bills and amounts payable</p>
    <Card><CardContent className="py-12 text-center"><FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" /><p>Bills are generated from Purchase Orders</p></CardContent></Card>
  </div>
);

export default Bills;
