import React, { useState, useEffect } from 'react';
import { ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, Calendar, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface CashflowItem {
  id: string;
  date: string;
  type: 'increase' | 'decrease';
  amount: number;
  category: 'beban' | 'non_beban';
  source: string;
  reference: string;
}

export const Cashflow: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [transactions, setTransactions] = useState<CashflowItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const fetchCashflow = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);

    // Get all payments (incoming = increase, outgoing = decrease)
    const { data: payments, error } = await supabase
      .from('payments')
      .select(`
        id,
        payment_date,
        payment_type,
        amount,
        payment_number,
        customer:customers(name),
        supplier:suppliers(name),
        cash_account:chart_of_accounts!payments_cash_account_id_fkey(name)
      `)
      .eq('company_id', selectedCompany.id)
      .gte('payment_date', dateFrom)
      .lte('payment_date', dateTo)
      .order('payment_date', { ascending: false });

    if (error) {
      console.error('Error fetching cashflow:', error);
      setIsLoading(false);
      return;
    }

    // Transform to cashflow items
    const items: CashflowItem[] = (payments || []).map((p: any) => ({
      id: p.id,
      date: p.payment_date,
      type: p.payment_type === 'incoming' ? 'increase' : 'decrease',
      amount: p.amount,
      // Outgoing payments to suppliers are beban (expenses)
      // Incoming payments from customers are non_beban
      category: p.payment_type === 'outgoing' ? 'beban' : 'non_beban',
      source: p.payment_type === 'incoming' 
        ? (p.customer?.name || 'Customer Payment')
        : (p.supplier?.name || 'Supplier Payment'),
      reference: p.payment_number,
    }));

    setTransactions(items);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCashflow();
  }, [selectedCompany, dateFrom, dateTo]);

  const filteredTransactions = transactions.filter(t => 
    filterCategory === 'all' || t.category === filterCategory
  );

  const totalIncrease = filteredTransactions
    .filter(t => t.type === 'increase')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalDecrease = filteredTransactions
    .filter(t => t.type === 'decrease')
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashflow = totalIncrease - totalDecrease;

  const bebanTotal = filteredTransactions
    .filter(t => t.category === 'beban')
    .reduce((sum, t) => sum + t.amount, 0);

  const nonBebanTotal = filteredTransactions
    .filter(t => t.category === 'non_beban')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Cashflow</h1>
          <p className="text-muted-foreground mt-1">Arus kas masuk dan keluar</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="form-label">Dari Tanggal</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="form-label">Sampai Tanggal</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="form-label">Kategori</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="beban">Beban</SelectItem>
                  <SelectItem value="non_beban">Non-Beban</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <ArrowUpCircle className="w-6 h-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pemasukan</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalIncrease)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ArrowDownCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalDecrease)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          'border',
          netCashflow >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-warning/5 border-warning/20'
        )}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                netCashflow >= 0 ? 'bg-primary/10' : 'bg-warning/10'
              )}>
                {netCashflow >= 0 ? (
                  <TrendingUp className="w-6 h-6 text-primary" />
                ) : (
                  <TrendingDown className="w-6 h-6 text-warning" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Cashflow</p>
                <p className={cn(
                  'text-2xl font-bold',
                  netCashflow >= 0 ? 'text-primary' : 'text-warning'
                )}>
                  {formatCurrency(netCashflow)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Beban</span>
                <span className="font-medium text-destructive">{formatCurrency(bebanTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Non-Beban</span>
                <span className="font-medium text-success">{formatCurrency(nonBebanTotal)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detail Transaksi</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : filteredTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Tidak ada transaksi dalam periode ini
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Referensi</th>
                    <th>Sumber</th>
                    <th>Kategori</th>
                    <th className="text-right">Increase</th>
                    <th className="text-right">Decrease</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id}>
                      <td>{formatDate(txn.date)}</td>
                      <td className="font-mono text-sm">{txn.reference}</td>
                      <td>{txn.source}</td>
                      <td>
                        <span className={cn(
                          'badge-status',
                          txn.category === 'beban' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                        )}>
                          {txn.category === 'beban' ? 'Beban' : 'Non-Beban'}
                        </span>
                      </td>
                      <td className="text-right">
                        {txn.type === 'increase' ? (
                          <span className="text-success font-medium">
                            +{formatCurrency(txn.amount)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="text-right">
                        {txn.type === 'decrease' ? (
                          <span className="text-destructive font-medium">
                            -{formatCurrency(txn.amount)}
                          </span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={4}>Total</td>
                    <td className="text-right text-success">{formatCurrency(totalIncrease)}</td>
                    <td className="text-right text-destructive">{formatCurrency(totalDecrease)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Cashflow;
