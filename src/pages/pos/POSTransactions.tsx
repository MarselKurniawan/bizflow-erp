import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Search, Eye, FileSpreadsheet, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface POSTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  subtotal: number;
  total_amount: number;
  total_cogs: number;
  notes: string | null;
  created_at: string;
}

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
  products?: { name: string; sku: string };
}

const POSTransactions = () => {
  const { selectedCompany } = useCompany();
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<POSTransaction | null>(null);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);

  const fetchTransactions = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pos_transactions')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (!error) {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const fetchTransactionItems = async (transactionId: string) => {
    const { data, error } = await supabase
      .from('pos_transaction_items')
      .select('*, products(name, sku)')
      .eq('pos_transaction_id', transactionId);

    if (!error) {
      setTransactionItems(data || []);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedCompany]);

  const handleViewDetails = async (transaction: POSTransaction) => {
    setSelectedTransaction(transaction);
    await fetchTransactionItems(transaction.id);
  };

  const filteredTransactions = transactions.filter(t =>
    t.transaction_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = transactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalCogs = transactions.reduce((sum, t) => sum + (t.total_cogs || 0), 0);
  const grossProfit = totalRevenue - totalCogs;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Riwayat Transaksi POS</h1>
        <p className="text-muted-foreground">Daftar semua transaksi penjualan POS</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pendapatan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total HPP</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totalCogs)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Laba Kotor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{formatCurrency(grossProfit)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nomor transaksi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Transaksi</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-right">Laba</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Memuat...</TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada transaksi POS
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions.map(transaction => (
                  <TableRow key={transaction.id}>
                    <TableCell className="font-medium">{transaction.transaction_number}</TableCell>
                    <TableCell>
                      {format(new Date(transaction.transaction_date), 'dd MMM yyyy', { locale: id })}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {formatCurrency(transaction.total_amount || 0)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {formatCurrency(transaction.total_cogs || 0)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency((transaction.total_amount || 0) - (transaction.total_cogs || 0))}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewDetails(transaction)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transaction Details Dialog */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Transaksi {selectedTransaction?.transaction_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Tanggal:</span>
                <p className="font-medium">
                  {selectedTransaction && format(new Date(selectedTransaction.transaction_date), 'dd MMMM yyyy', { locale: id })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Total:</span>
                <p className="font-medium text-lg">{formatCurrency(selectedTransaction?.total_amount || 0)}</p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">HPP</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionItems.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.products?.name}</p>
                        <p className="text-xs text-muted-foreground">{item.products?.sku}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(item.cost_price)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between">
                <span>Total Penjualan</span>
                <span className="font-medium">{formatCurrency(selectedTransaction?.total_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total HPP</span>
                <span>{formatCurrency(selectedTransaction?.total_cogs || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Laba Kotor</span>
                <span className="text-primary">
                  {formatCurrency((selectedTransaction?.total_amount || 0) - (selectedTransaction?.total_cogs || 0))}
                </span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSTransactions;
