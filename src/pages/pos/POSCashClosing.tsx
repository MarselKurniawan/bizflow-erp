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
    // Get transactions for this session
    const { data: transactions } = await supabase
      .from('pos_transactions')
      .select('id, total_amount, status')
      .eq('cash_session_id', sessionId)
      .eq('status', 'completed');
    
    const totalSales = transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0;
    const totalTransactions = transactions?.length || 0;

    // Get payment breakdown
    const { data: payments } = await supabase
      .from('pos_transaction_payments')
      .select(`
        amount,
        pos_payment_methods(name)
      `)
      .in('pos_transaction_id', transactions?.map(t => t.id) || []);

    const paymentMap = new Map<string, number>();
    payments?.forEach(p => {
      const name = (p.pos_payment_methods as any)?.name || 'Unknown';
      paymentMap.set(name, (paymentMap.get(name) || 0) + p.amount);
    });

    const paymentSummary: PaymentSummary[] = Array.from(paymentMap.entries()).map(([name, total]) => ({
      method_name: name,
      total
    }));

    setSessionStats({ totalSales, totalTransactions, paymentSummary });
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
        paymentSummary: sessionStats?.paymentSummary || []
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
  }) => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Laporan Penutupan Kas</title>
        <style>
          body { font-family: monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 10px; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .header h2 { margin: 0 0 5px 0; font-size: 14px; }
          .row { display: flex; justify-content: space-between; margin: 3px 0; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
          .total { font-weight: bold; font-size: 14px; }
          .diff-pos { color: blue; }
          .diff-neg { color: red; }
          .diff-zero { color: green; }
          @media print { body { width: 80mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>LAPORAN PENUTUPAN KAS</h2>
          <p>${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}</p>
        </div>
        
        <div class="row"><span>Dibuka:</span><span>${format(new Date(data.openedAt), 'dd/MM/yy HH:mm', { locale: id })}</span></div>
        <div class="row"><span>Ditutup:</span><span>${format(new Date(data.closedAt), 'dd/MM/yy HH:mm', { locale: id })}</span></div>
        
        <div class="divider"></div>
        
        <div class="row"><span>Total Transaksi:</span><span>${data.totalTransactions}</span></div>
        <div class="row total"><span>Total Penjualan:</span><span>${formatCurrency(data.totalSales)}</span></div>
        
        <div class="divider"></div>
        <p><strong>Rincian Pembayaran:</strong></p>
        ${data.paymentSummary.map(p => `<div class="row"><span>${p.method_name}</span><span>${formatCurrency(p.total)}</span></div>`).join('')}
        
        <div class="divider"></div>
        
        <div class="row"><span>Saldo Awal:</span><span>${formatCurrency(data.openingBalance)}</span></div>
        <div class="row"><span>Ekspektasi Kas:</span><span>${formatCurrency(data.expectedBalance)}</span></div>
        <div class="row"><span>Saldo Akhir (Fisik):</span><span>${formatCurrency(data.closingBalance)}</span></div>
        
        <div class="divider"></div>
        
        <div class="row total">
          <span>SELISIH:</span>
          <span class="${data.difference === 0 ? 'diff-zero' : data.difference > 0 ? 'diff-pos' : 'diff-neg'}">
            ${data.difference > 0 ? '+' : ''}${formatCurrency(data.difference)}
          </span>
        </div>
        
        <div class="divider"></div>
        <p style="text-align: center; margin-top: 20px;">--- Terima Kasih ---</p>
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
      paymentSummary: sessionStats.paymentSummary
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
