import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Lock, Unlock, Eye, Calculator, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface CashSession {
  id: string;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
  status: string;
}

interface PaymentSummary {
  method_name: string;
  total: number;
}

const POSCashClosing = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CashSession | null>(null);
  
  const [closingBalance, setClosingBalance] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [sessionStats, setSessionStats] = useState<{
    totalSales: number;
    totalTransactions: number;
    paymentSummary: PaymentSummary[];
    // Extended stats for detailed report
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    serviceAmount: number;
    roundingAmount: number;
    totalGuests: number;
    avgPerGuest: number;
    totalInvoices: number;
    avgPerInvoice: number;
    complimentTotal: number;
    complimentCount: number;
  } | null>(null);

  const fetchSessions = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('pos_cash_sessions')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('opened_at', { ascending: false });
    
    if (!error) {
      setSessions(data || []);
      const open = data?.find(s => s.status === 'open');
      setCurrentSession(open || null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [selectedCompany]);

  const fetchSessionStats = async (sessionId: string) => {
    // Get transactions for this session with full details
    const { data: transactions } = await supabase
      .from('pos_transactions')
      .select('id, total_amount, subtotal, discount_amount, tax_amount, status')
      .eq('cash_session_id', sessionId)
      .eq('status', 'completed');
    
    const completedTransactions = transactions || [];
    const totalSales = completedTransactions.reduce((sum, t) => sum + (t.total_amount || 0), 0);
    const totalTransactions = completedTransactions.length;
    const subtotal = completedTransactions.reduce((sum, t) => sum + (t.subtotal || 0), 0);
    const discountAmount = completedTransactions.reduce((sum, t) => sum + (t.discount_amount || 0), 0);
    const taxAmount = completedTransactions.reduce((sum, t) => sum + (t.tax_amount || 0), 0);
    
    // Calculate service charge and rounding (estimated from difference)
    const calculatedTotal = subtotal - discountAmount + taxAmount;
    const roundingAmount = totalSales - calculatedTotal;
    const serviceAmount = 0; // Would need separate tracking for service charge

    // Get payment breakdown
    const { data: payments } = await supabase
      .from('pos_transaction_payments')
      .select(`
        amount,
        pos_payment_methods(name)
      `)
      .in('pos_transaction_id', completedTransactions.map(t => t.id));

    const paymentMap = new Map<string, number>();
    payments?.forEach(p => {
      const name = (p.pos_payment_methods as any)?.name || 'Unknown';
      paymentMap.set(name, (paymentMap.get(name) || 0) + p.amount);
    });

    const paymentSummary: PaymentSummary[] = Array.from(paymentMap.entries()).map(([name, total]) => ({
      method_name: name,
      total
    }));

    // Guest stats (estimate 1 guest per transaction for now, can be enhanced)
    const totalGuests = totalTransactions;
    const avgPerGuest = totalGuests > 0 ? totalSales / totalGuests : 0;

    // Invoice stats
    const totalInvoices = totalTransactions;
    const avgPerInvoice = totalInvoices > 0 ? totalSales / totalInvoices : 0;

    // Compliment (void/cancelled transactions) - for now set to 0
    const complimentTotal = 0;
    const complimentCount = 0;

    setSessionStats({ 
      totalSales, 
      totalTransactions, 
      paymentSummary,
      subtotal,
      discountAmount,
      taxAmount,
      serviceAmount,
      roundingAmount,
      totalGuests,
      avgPerGuest,
      totalInvoices,
      avgPerInvoice,
      complimentTotal,
      complimentCount
    });
  };

  const openCloseDialog = async () => {
    if (!currentSession) return;
    await fetchSessionStats(currentSession.id);
    
    // Calculate expected balance
    const cashPayments = sessionStats?.paymentSummary.find(p => 
      p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
    )?.total || 0;
    
    const expected = currentSession.opening_balance + cashPayments;
    setClosingBalance(expected.toString());
    setShowCloseDialog(true);
  };

  const closeSession = async (shouldPrint: boolean = false) => {
    if (!currentSession) return;
    
    const closing = parseFloat(closingBalance) || 0;
    const cashPayments = sessionStats?.paymentSummary.find(p => 
      p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
    )?.total || 0;
    const expected = currentSession.opening_balance + cashPayments;
    const diff = closing - expected;

    const { error } = await supabase
      .from('pos_cash_sessions')
      .update({
        closing_balance: closing,
        expected_balance: expected,
        difference: diff,
        closed_at: new Date().toISOString(),
        closed_by: user?.id,
        notes: closingNotes || null,
        status: 'closed'
      })
      .eq('id', currentSession.id);

    if (error) {
      toast.error('Gagal menutup sesi kasir');
      return;
    }

    if (shouldPrint) {
      printClosingReport({
        openedAt: currentSession.opened_at,
        closedAt: new Date().toISOString(),
        openingBalance: currentSession.opening_balance,
        closingBalance: closing,
        expectedBalance: expected,
        difference: diff,
        totalSales: sessionStats?.totalSales || 0,
        totalTransactions: sessionStats?.totalTransactions || 0,
        paymentSummary: sessionStats?.paymentSummary || [],
        subtotal: sessionStats?.subtotal || 0,
        discountAmount: sessionStats?.discountAmount || 0,
        taxAmount: sessionStats?.taxAmount || 0,
        serviceAmount: sessionStats?.serviceAmount || 0,
        roundingAmount: sessionStats?.roundingAmount || 0,
        totalGuests: sessionStats?.totalGuests || 0,
        avgPerGuest: sessionStats?.avgPerGuest || 0,
        totalInvoices: sessionStats?.totalInvoices || 0,
        avgPerInvoice: sessionStats?.avgPerInvoice || 0,
        complimentTotal: sessionStats?.complimentTotal || 0,
        complimentCount: sessionStats?.complimentCount || 0
      });
    }

    toast.success('Sesi kasir berhasil ditutup');
    setShowCloseDialog(false);
    setClosingBalance('');
    setClosingNotes('');
    fetchSessions();
  };

  const printClosingReport = (data: {
    openedAt: string;
    closedAt: string;
    openingBalance: number;
    closingBalance: number;
    expectedBalance: number;
    difference: number;
    totalSales: number;
    totalTransactions: number;
    paymentSummary: PaymentSummary[];
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    serviceAmount: number;
    roundingAmount: number;
    totalGuests: number;
    avgPerGuest: number;
    totalInvoices: number;
    avgPerInvoice: number;
    complimentTotal: number;
    complimentCount: number;
  }) => {
    const formatNumber = (num: number) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
    
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Penutupan Kas</title>
        <style>
          body { font-family: monospace; font-size: 11px; width: 80mm; margin: 0 auto; padding: 8px; line-height: 1.3; }
          .header { margin-bottom: 8px; }
          .header p { margin: 2px 0; }
          .section-title { font-weight: bold; margin: 8px 0 4px 0; text-decoration: underline; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .row-indent { padding-left: 8px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .total { font-weight: bold; }
          @media print { 
            body { width: 80mm; margin: 0; padding: 5px; } 
            @page { margin: 0; size: 80mm auto; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <p>Date: ${format(new Date(data.closedAt), 'MM/dd/yyyy')}</p>
          <p>Company: ${selectedCompany?.name || 'Company'}</p>
          <p>Report Time: ${format(new Date(data.closedAt), 'MM/dd/yyyy HH:mm:ss')}</p>
        </div>
        
        <div class="section-title">Revenue</div>
        <div class="row row-indent"><span>Subtotal</span></div>
        <div class="row"><span></span><span>${formatNumber(data.subtotal)}</span></div>
        <div class="row row-indent"><span>Discount</span></div>
        <div class="row"><span></span><span>${formatNumber(data.discountAmount)}</span></div>
        <div class="row row-indent"><span>PB1</span></div>
        <div class="row"><span></span><span>${formatNumber(data.taxAmount)}</span></div>
        <div class="row row-indent"><span>SERVICE CHARGE</span></div>
        <div class="row"><span></span><span>${formatNumber(data.serviceAmount)}</span></div>
        <div class="row row-indent"><span>ROUNDING</span></div>
        <div class="row"><span></span><span>${formatNumber(data.roundingAmount)}</span></div>
        <div class="divider"></div>
        <div class="row row-indent"><span>Total</span></div>
        <div class="row"><span></span><span>${formatNumber(data.totalSales)}</span></div>
        
        <div style="margin-top: 10px;">
          <div class="row row-indent"><span>Total Guest</span><span>${data.totalGuests}</span></div>
          <div class="row row-indent"><span>Avg. per Guest</span></div>
          <div class="row"><span></span><span>${formatNumber(data.avgPerGuest)}</span></div>
        </div>
        
        <div style="margin-top: 6px;">
          <div class="row row-indent"><span>No. of Inv.</span><span>${data.totalInvoices}</span></div>
          <div class="row row-indent"><span>Avg. per Inv.</span></div>
          <div class="row"><span></span><span>${formatNumber(data.avgPerInvoice)}</span></div>
        </div>
        
        <div class="section-title">Payments</div>
        ${data.paymentSummary.map(p => `
          <div class="row row-indent"><span>${p.method_name.toUpperCase()}</span></div>
          <div class="row"><span></span><span>${formatNumber(p.total)}</span></div>
        `).join('')}
        <div class="divider"></div>
        <div class="row row-indent"><span>Total</span></div>
        <div class="row"><span></span><span>${formatNumber(data.paymentSummary.reduce((sum, p) => sum + p.total, 0))}</span></div>
        
        <div class="section-title">Compliment</div>
        <div class="row row-indent"><span>Total Compliment</span><span>${formatNumber(data.complimentTotal)}</span></div>
        <div class="row row-indent"><span>No. of Inv</span><span>${data.complimentCount}</span></div>
        <div class="row row-indent"><span>Avg per Inv</span><span>${formatNumber(data.complimentCount > 0 ? data.complimentTotal / data.complimentCount : 0)}</span></div>
        
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const printSessionReport = (session: CashSession) => {
    if (!sessionStats) return;
    
    printClosingReport({
      openedAt: session.opened_at,
      closedAt: session.closed_at || new Date().toISOString(),
      openingBalance: session.opening_balance,
      closingBalance: session.closing_balance || 0,
      expectedBalance: session.expected_balance || 0,
      difference: session.difference || 0,
      totalSales: sessionStats.totalSales,
      totalTransactions: sessionStats.totalTransactions,
      paymentSummary: sessionStats.paymentSummary,
      subtotal: sessionStats.subtotal,
      discountAmount: sessionStats.discountAmount,
      taxAmount: sessionStats.taxAmount,
      serviceAmount: sessionStats.serviceAmount,
      roundingAmount: sessionStats.roundingAmount,
      totalGuests: sessionStats.totalGuests,
      avgPerGuest: sessionStats.avgPerGuest,
      totalInvoices: sessionStats.totalInvoices,
      avgPerInvoice: sessionStats.avgPerInvoice,
      complimentTotal: sessionStats.complimentTotal,
      complimentCount: sessionStats.complimentCount
    });
  };

  const viewDetails = async (session: CashSession) => {
    setSelectedSession(session);
    await fetchSessionStats(session.id);
    setShowDetailsDialog(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Penutupan Kas</h1>
        <p className="text-muted-foreground">Rekonsiliasi dan penutupan sesi kasir harian</p>
      </div>

      {/* Current Session Card */}
      {currentSession && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Unlock className="h-5 w-5 text-green-600" />
                  Sesi Aktif
                </CardTitle>
                <CardDescription>
                  Dibuka: {format(new Date(currentSession.opened_at), 'dd MMMM yyyy HH:mm', { locale: id })}
                </CardDescription>
              </div>
              <Button onClick={openCloseDialog}>
                <Lock className="h-4 w-4 mr-2" />
                Tutup Sesi
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Saldo Awal</p>
                <p className="text-xl font-bold">{formatCurrency(currentSession.opening_balance)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Sesi</CardTitle>
          <CardDescription>Daftar semua sesi kasir yang sudah ditutup</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Memuat...</p>
          ) : sessions.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Belum ada riwayat sesi</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Saldo Awal</TableHead>
                  <TableHead className="text-right">Saldo Akhir</TableHead>
                  <TableHead className="text-right">Ekspektasi</TableHead>
                  <TableHead className="text-right">Selisih</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(session => (
                  <TableRow key={session.id}>
                    <TableCell>
                      {format(new Date(session.opened_at), 'dd MMM yyyy', { locale: id })}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(session.opening_balance)}</TableCell>
                    <TableCell className="text-right">
                      {session.closing_balance !== null ? formatCurrency(session.closing_balance) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.expected_balance !== null ? formatCurrency(session.expected_balance) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.difference !== null ? (
                        <span className={session.difference === 0 ? 'text-green-600' : session.difference > 0 ? 'text-blue-600' : 'text-red-600'}>
                          {session.difference > 0 ? '+' : ''}{formatCurrency(session.difference)}
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={session.status === 'open' ? 'default' : 'secondary'}>
                        {session.status === 'open' ? 'Aktif' : 'Ditutup'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => viewDetails(session)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Close Session Dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tutup Sesi Kasir</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {sessionStats && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Total Penjualan</p>
                      <p className="text-xl font-bold">{formatCurrency(sessionStats.totalSales)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-sm text-muted-foreground">Jumlah Transaksi</p>
                      <p className="text-xl font-bold">{sessionStats.totalTransactions}</p>
                    </CardContent>
                  </Card>
                </div>

                <div>
                  <Label className="text-sm font-medium">Rincian Pembayaran</Label>
                  <div className="mt-2 space-y-1">
                    {sessionStats.paymentSummary.map((p, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{p.method_name}</span>
                        <span className="font-medium">{formatCurrency(p.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Saldo Awal</span>
                    <span>{formatCurrency(currentSession?.opening_balance || 0)}</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">+ Penerimaan Tunai</span>
                    <span>
                      {formatCurrency(
                        sessionStats.paymentSummary.find(p => 
                          p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
                        )?.total || 0
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>= Ekspektasi Kas</span>
                    <span>
                      {formatCurrency(
                        (currentSession?.opening_balance || 0) + 
                        (sessionStats.paymentSummary.find(p => 
                          p.method_name.toLowerCase().includes('tunai') || p.method_name.toLowerCase().includes('cash')
                        )?.total || 0)
                      )}
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Saldo Akhir Aktual (Hitung Fisik)</Label>
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  value={closingBalance}
                  onChange={(e) => setClosingBalance(e.target.value)}
                  placeholder="Masukkan hasil hitung fisik"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Catatan (Opsional)</Label>
              <Textarea
                value={closingNotes}
                onChange={(e) => setClosingNotes(e.target.value)}
                placeholder="Catatan penutupan kas..."
              />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Batal</Button>
            <Button variant="secondary" onClick={() => closeSession(true)}>
              <Printer className="h-4 w-4 mr-2" />
              Tutup & Cetak
            </Button>
            <Button onClick={() => closeSession(false)}>
              <Lock className="h-4 w-4 mr-2" />
              Tutup Sesi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Sesi</DialogTitle>
          </DialogHeader>
          {selectedSession && sessionStats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Dibuka</p>
                  <p className="font-medium">{format(new Date(selectedSession.opened_at), 'dd MMM yyyy HH:mm', { locale: id })}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ditutup</p>
                  <p className="font-medium">
                    {selectedSession.closed_at 
                      ? format(new Date(selectedSession.closed_at), 'dd MMM yyyy HH:mm', { locale: id })
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Total Penjualan</p>
                    <p className="text-xl font-bold">{formatCurrency(sessionStats.totalSales)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-sm text-muted-foreground">Jumlah Transaksi</p>
                    <p className="text-xl font-bold">{sessionStats.totalTransactions}</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Label className="text-sm font-medium">Rincian Pembayaran</Label>
                <div className="mt-2 space-y-1">
                  {sessionStats.paymentSummary.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{p.method_name}</span>
                      <span className="font-medium">{formatCurrency(p.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Saldo Awal</span>
                  <span>{formatCurrency(selectedSession.opening_balance)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ekspektasi</span>
                  <span>{formatCurrency(selectedSession.expected_balance || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Saldo Akhir</span>
                  <span>{formatCurrency(selectedSession.closing_balance || 0)}</span>
                </div>
                <div className="flex justify-between font-bold">
                  <span>Selisih</span>
                  <span className={
                    selectedSession.difference === 0 ? 'text-green-600' : 
                    (selectedSession.difference || 0) > 0 ? 'text-blue-600' : 'text-red-600'
                  }>
                    {(selectedSession.difference || 0) > 0 ? '+' : ''}
                    {formatCurrency(selectedSession.difference || 0)}
                  </span>
                </div>
              </div>

              {selectedSession.notes && (
                <div>
                  <Label className="text-sm text-muted-foreground">Catatan</Label>
                  <p className="text-sm">{selectedSession.notes}</p>
                </div>
              )}

              {selectedSession.status === 'closed' && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => printSessionReport(selectedSession)}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Cetak Laporan
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default POSCashClosing;
