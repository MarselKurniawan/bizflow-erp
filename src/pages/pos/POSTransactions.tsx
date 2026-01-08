import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Search, Eye, Printer, FileSpreadsheet, FileText } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface POSTransaction {
  id: string;
  transaction_number: string;
  transaction_date: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  total_cogs: number;
  customer_name: string | null;
  customer_phone: string | null;
  amount_paid: number;
  change_amount: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface TransactionItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_percent: number;
  discount_amount: number;
  tax_percent: number;
  tax_amount: number;
  total: number;
  products?: { name: string; sku: string };
}

interface TransactionPayment {
  id: string;
  amount: number;
  pos_payment_methods?: { name: string };
}

const POSTransactions = () => {
  const { selectedCompany } = useCompany();
  const [transactions, setTransactions] = useState<POSTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<POSTransaction | null>(null);
  const [transactionItems, setTransactionItems] = useState<TransactionItem[]>([]);
  const [transactionPayments, setTransactionPayments] = useState<TransactionPayment[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchTransactions = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    let query = supabase
      .from('pos_transactions')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('created_at', { ascending: false });

    if (dateFrom) {
      query = query.gte('transaction_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('transaction_date', dateTo);
    }

    const { data, error } = await query;

    if (!error) {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const fetchTransactionDetails = async (transactionId: string) => {
    const [itemsRes, paymentsRes] = await Promise.all([
      supabase
        .from('pos_transaction_items')
        .select('*, products(name, sku)')
        .eq('pos_transaction_id', transactionId),
      supabase
        .from('pos_transaction_payments')
        .select('*, pos_payment_methods(name)')
        .eq('pos_transaction_id', transactionId)
    ]);

    setTransactionItems(itemsRes.data || []);
    setTransactionPayments(paymentsRes.data || []);
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedCompany, dateFrom, dateTo]);

  const handleViewDetails = async (transaction: POSTransaction) => {
    setSelectedTransaction(transaction);
    await fetchTransactionDetails(transaction.id);
  };

  const printReceipt = (transaction: POSTransaction) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Struk ${transaction.transaction_number}</title>
        <style>
          body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
          .center { text-align: center; }
          .right { text-align: right; }
          hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 2px 0; }
          .bold { font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold">${selectedCompany?.name}</div>
          <div>${selectedCompany?.address || ''}</div>
        </div>
        <hr>
        <div>No: ${transaction.transaction_number}</div>
        <div>Tgl: ${format(new Date(transaction.transaction_date), 'dd/MM/yyyy HH:mm', { locale: id })}</div>
        <div>Pelanggan: ${transaction.customer_name || '-'}</div>
        <hr>
        <table>
          ${transactionItems.map(item => `
            <tr>
              <td colspan="2">${item.products?.name}</td>
            </tr>
            <tr>
              <td>${item.quantity} x ${formatCurrency(item.unit_price)}${item.discount_percent > 0 ? ` -${item.discount_percent}%` : ''}</td>
              <td class="right">${formatCurrency(item.total)}</td>
            </tr>
          `).join('')}
        </table>
        <hr>
        <table>
          <tr><td>Subtotal</td><td class="right">${formatCurrency(transaction.subtotal || 0)}</td></tr>
          ${(transaction.discount_amount || 0) > 0 ? `<tr><td>Diskon</td><td class="right">-${formatCurrency(transaction.discount_amount)}</td></tr>` : ''}
          ${(transaction.tax_amount || 0) > 0 ? `<tr><td>Pajak</td><td class="right">${formatCurrency(transaction.tax_amount)}</td></tr>` : ''}
          <tr class="bold"><td>TOTAL</td><td class="right">${formatCurrency(transaction.total_amount || 0)}</td></tr>
        </table>
        <hr>
        <table>
          ${transactionPayments.map(p => `
            <tr><td>${(p.pos_payment_methods as any)?.name || 'Unknown'}</td><td class="right">${formatCurrency(p.amount)}</td></tr>
          `).join('')}
          <tr><td>Kembali</td><td class="right">${formatCurrency(transaction.change_amount || 0)}</td></tr>
        </table>
        <hr>
        <div class="center">Terima kasih</div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const filteredTransactions = transactions.filter(t =>
    t.transaction_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalRevenue = filteredTransactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.total_amount || 0), 0);
  const totalCogs = filteredTransactions.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.total_cogs || 0), 0);
  const grossProfit = totalRevenue - totalCogs;

  const exportTransactions = (type: 'excel' | 'pdf') => {
    const data = filteredTransactions.map(t => ({
      'No. Transaksi': t.transaction_number,
      'Tanggal': format(new Date(t.transaction_date), 'dd MMM yyyy', { locale: id }),
      'Pelanggan': t.customer_name || '-',
      'Total': formatCurrency(t.total_amount || 0),
      'HPP': formatCurrency(t.total_cogs || 0),
      'Laba': formatCurrency((t.total_amount || 0) - (t.total_cogs || 0)),
      'Status': t.status === 'completed' ? 'Selesai' : t.status === 'held' ? 'Ditahan' : 'Dibatalkan'
    }));

    if (type === 'excel') {
      exportToExcel(data, 'Riwayat-Transaksi-POS');
    } else {
      const headers = ['No. Transaksi', 'Tanggal', 'Pelanggan', 'Total', 'HPP', 'Laba', 'Status'];
      const rows = filteredTransactions.map(t => [
        t.transaction_number,
        format(new Date(t.transaction_date), 'dd MMM yyyy', { locale: id }),
        t.customer_name || '-',
        formatCurrency(t.total_amount || 0),
        formatCurrency(t.total_cogs || 0),
        formatCurrency((t.total_amount || 0) - (t.total_cogs || 0)),
        t.status === 'completed' ? 'Selesai' : t.status === 'held' ? 'Ditahan' : 'Dibatalkan'
      ]);
      const html = generatePDFTable(headers, rows);
      exportToPDF('Riwayat Transaksi POS', html);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800">Selesai</Badge>;
      case 'held':
        return <Badge variant="outline">Ditahan</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Dibatalkan</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari nomor transaksi atau pelanggan..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
          placeholder="Dari tanggal"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
          placeholder="Sampai tanggal"
        />
        <Button variant="outline" size="sm" onClick={() => exportTransactions('excel')}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Excel
        </Button>
        <Button variant="outline" size="sm" onClick={() => exportTransactions('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          PDF
        </Button>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No. Transaksi</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Pelanggan</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-right">Laba</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">Memuat...</TableCell>
                </TableRow>
              ) : filteredTransactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                    <TableCell>{transaction.customer_name || '-'}</TableCell>
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
                      {getStatusBadge(transaction.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(transaction)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={async () => {
                            await fetchTransactionDetails(transaction.id);
                            printReceipt(transaction);
                          }}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
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
                  {selectedTransaction && format(new Date(selectedTransaction.transaction_date), 'dd MMMM yyyy HH:mm', { locale: id })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Pelanggan:</span>
                <p className="font-medium">{selectedTransaction?.customer_name || '-'}</p>
                {selectedTransaction?.customer_phone && (
                  <p className="text-xs text-muted-foreground">{selectedTransaction.customer_phone}</p>
                )}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-center">Qty</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead className="text-right">Diskon</TableHead>
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
                    <TableCell className="text-right">
                      {item.discount_percent > 0 ? `${item.discount_percent}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Payments */}
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">Pembayaran</p>
              <div className="space-y-1">
                {transactionPayments.map(payment => (
                  <div key={payment.id} className="flex justify-between text-sm">
                    <span>{(payment.pos_payment_methods as any)?.name || 'Unknown'}</span>
                    <span>{formatCurrency(payment.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 space-y-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(selectedTransaction?.subtotal || 0)}</span>
              </div>
              {(selectedTransaction?.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon</span>
                  <span>-{formatCurrency(selectedTransaction?.discount_amount || 0)}</span>
                </div>
              )}
              {(selectedTransaction?.tax_amount || 0) > 0 && (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span>{formatCurrency(selectedTransaction?.tax_amount || 0)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>{formatCurrency(selectedTransaction?.total_amount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Dibayar</span>
                <span>{formatCurrency(selectedTransaction?.amount_paid || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kembalian</span>
                <span>{formatCurrency(selectedTransaction?.change_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>HPP</span>
                <span>{formatCurrency(selectedTransaction?.total_cogs || 0)}</span>
              </div>
              <div className="flex justify-between font-bold text-primary">
                <span>Laba Kotor</span>
                <span>
                  {formatCurrency((selectedTransaction?.total_amount || 0) - (selectedTransaction?.total_cogs || 0))}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTransaction(null)}>Tutup</Button>
            <Button onClick={() => selectedTransaction && printReceipt(selectedTransaction)}>
              <Printer className="h-4 w-4 mr-2" />
              Cetak Struk
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSTransactions;
