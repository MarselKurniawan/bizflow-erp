import React, { useState, useEffect } from 'react';
import { Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface AgedInvoice {
  customer_name: string;
  customer_code: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  outstanding_amount: number;
  days_overdue: number;
  age_bucket: string;
}

interface AgingSummary {
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  over_90: number;
}

export const AgedReceivables: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [invoices, setInvoices] = useState<AgedInvoice[]>([]);
  const [summary, setSummary] = useState<AgingSummary>({
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    over_90: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);

    const { data, error } = await supabase
      .from('invoices')
      .select('*, customers(code, name)')
      .eq('company_id', selectedCompany.id)
      .gt('outstanding_amount', 0)
      .neq('status', 'cancelled')
      .order('due_date');

    if (error) {
      console.error('Error fetching aged receivables:', error);
      toast.error('Failed to load report data');
      setIsLoading(false);
      return;
    }

    const asOf = new Date(asOfDate);
    const newSummary: AgingSummary = {
      current: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_61_90: 0,
      over_90: 0,
    };

    const agedInvoices: AgedInvoice[] = (data || []).map((inv: any) => {
      const dueDate = new Date(inv.due_date);
      const diffTime = asOf.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let ageBucket = 'Current';
      if (diffDays <= 0) {
        ageBucket = 'Current';
        newSummary.current += inv.outstanding_amount;
      } else if (diffDays <= 30) {
        ageBucket = '1-30 Days';
        newSummary.days_1_30 += inv.outstanding_amount;
      } else if (diffDays <= 60) {
        ageBucket = '31-60 Days';
        newSummary.days_31_60 += inv.outstanding_amount;
      } else if (diffDays <= 90) {
        ageBucket = '61-90 Days';
        newSummary.days_61_90 += inv.outstanding_amount;
      } else {
        ageBucket = 'Over 90 Days';
        newSummary.over_90 += inv.outstanding_amount;
      }

      return {
        customer_name: inv.customers?.name || 'Unknown',
        customer_code: inv.customers?.code || '',
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date,
        total_amount: inv.total_amount,
        outstanding_amount: inv.outstanding_amount,
        days_overdue: Math.max(0, diffDays),
        age_bucket: ageBucket,
      };
    });

    setInvoices(agedInvoices);
    setSummary(newSummary);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany, asOfDate]);

  const totalOutstanding = Object.values(summary).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Aged Receivables</h1>
          <p className="text-muted-foreground mt-1">Outstanding customer invoices by age</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">As of Date</label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="input-field"
              />
            </div>
            <Button onClick={fetchData} variant="outline">
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Aging Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-bold text-success">{formatCurrency(summary.current)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">1-30 Days</p>
            <p className="text-lg font-bold text-warning">{formatCurrency(summary.days_1_30)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">31-60 Days</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(summary.days_31_60)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">61-90 Days</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(summary.days_61_90)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Over 90 Days</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(summary.over_90)}</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading report...</div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Outstanding Receivables</h3>
              <p className="text-muted-foreground">All customer invoices have been paid</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Invoice #</th>
                    <th>Invoice Date</th>
                    <th>Due Date</th>
                    <th className="text-center">Days Overdue</th>
                    <th>Age Bucket</th>
                    <th className="text-right">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv, index) => (
                    <tr key={index}>
                      <td>
                        <div>
                          <p className="font-medium">{inv.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{inv.customer_code}</p>
                        </div>
                      </td>
                      <td className="font-mono">{inv.invoice_number}</td>
                      <td>{formatDate(inv.invoice_date)}</td>
                      <td>{formatDate(inv.due_date)}</td>
                      <td className="text-center">
                        <span className={cn(
                          'font-medium',
                          inv.days_overdue === 0 ? 'text-success' :
                          inv.days_overdue <= 30 ? 'text-warning' : 'text-destructive'
                        )}>
                          {inv.days_overdue}
                        </span>
                      </td>
                      <td>
                        <span className={cn(
                          'badge-status',
                          inv.age_bucket === 'Current' ? 'bg-success/10 text-success' :
                          inv.age_bucket === '1-30 Days' ? 'bg-warning/10 text-warning' :
                          'bg-destructive/10 text-destructive'
                        )}>
                          {inv.age_bucket}
                        </span>
                      </td>
                      <td className="text-right font-medium">{formatCurrency(inv.outstanding_amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-bold">
                    <td colSpan={6}>Total Outstanding</td>
                    <td className="text-right text-primary">{formatCurrency(totalOutstanding)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AgedReceivables;
