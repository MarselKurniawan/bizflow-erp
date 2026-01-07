import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Minus, Plus, ShoppingCart, Trash2, Receipt, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';

interface CartItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  total: number;
}

const POSDashboard = () => {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { products } = useProducts();
  const { getCashBankAccounts, getRevenueAccounts, getCogsAccounts } = useAccounts();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cashAccountId, setCashAccountId] = useState('');
  const [revenueAccountId, setRevenueAccountId] = useState('');
  const [cogsAccountId, setCogsAccountId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const cashAccounts = getCashBankAccounts();
  const revenueAccounts = getRevenueAccounts();
  const cogsAccounts = getCogsAccounts();

  // Set default accounts
  useEffect(() => {
    if (cashAccounts.length > 0 && !cashAccountId) {
      setCashAccountId(cashAccounts[0].id);
    }
    if (revenueAccounts.length > 0 && !revenueAccountId) {
      setRevenueAccountId(revenueAccounts[0].id);
    }
    if (cogsAccounts.length > 0 && !cogsAccountId) {
      setCogsAccountId(cogsAccounts[0].id);
    }
  }, [cashAccounts, revenueAccounts, cogsAccounts]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: any) => {
    const existingItem = cart.find(item => item.product_id === product.id);
    if (existingItem) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        name: product.name,
        quantity: 1,
        unit_price: product.unit_price,
        cost_price: product.cost_price,
        total: product.unit_price
      }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.product_id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty, total: newQty * item.unit_price };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const totalCogs = cart.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);

  const generateTransactionNumber = async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('pos_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', selectedCompany?.id);
    return `POS-${today}-${String((count || 0) + 1).padStart(4, '0')}`;
  };

  const processTransaction = async () => {
    if (!selectedCompany || cart.length === 0) return;
    if (!cashAccountId || !revenueAccountId) {
      toast.error('Pilih akun kas dan pendapatan');
      return;
    }

    setIsProcessing(true);
    try {
      const transactionNumber = await generateTransactionNumber();

      // Create POS transaction
      const { data: transaction, error: txError } = await supabase
        .from('pos_transactions')
        .insert({
          company_id: selectedCompany.id,
          transaction_number: transactionNumber,
          subtotal,
          total_amount: subtotal,
          total_cogs: totalCogs,
          cash_account_id: cashAccountId,
          revenue_account_id: revenueAccountId,
          cogs_account_id: cogsAccountId || null,
          created_by: user?.id
        })
        .select()
        .single();

      if (txError) throw txError;

      // Create transaction items
      const items = cart.map(item => ({
        pos_transaction_id: transaction.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        total: item.total
      }));

      const { error: itemsError } = await supabase
        .from('pos_transaction_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Create journal entry for the sale
      const journalNumber = `JV-POS-${transactionNumber}`;
      const { data: journalEntry, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          company_id: selectedCompany.id,
          entry_number: journalNumber,
          description: `Penjualan POS ${transactionNumber}`,
          reference_type: 'pos_transaction',
          reference_id: transaction.id,
          is_posted: true,
          created_by: user?.id
        })
        .select()
        .single();

      if (jeError) throw jeError;

      // Create journal lines: Debit Cash, Credit Revenue
      const journalLines = [
        { journal_entry_id: journalEntry.id, account_id: cashAccountId, debit_amount: subtotal, credit_amount: 0, description: 'Penerimaan kas POS' },
        { journal_entry_id: journalEntry.id, account_id: revenueAccountId, debit_amount: 0, credit_amount: subtotal, description: 'Pendapatan penjualan' }
      ];

      // Add COGS entries if account is set
      if (cogsAccountId && totalCogs > 0) {
        // Find inventory account
        const { data: inventoryAccount } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('company_id', selectedCompany.id)
          .eq('account_type', 'asset')
          .ilike('name', '%persediaan%')
          .single();

        journalLines.push(
          { journal_entry_id: journalEntry.id, account_id: cogsAccountId, debit_amount: totalCogs, credit_amount: 0, description: 'HPP penjualan' }
        );
        
        if (inventoryAccount) {
          journalLines.push(
            { journal_entry_id: journalEntry.id, account_id: inventoryAccount.id, debit_amount: 0, credit_amount: totalCogs, description: 'Pengurangan persediaan' }
          );
        }
      }

      const { error: linesError } = await supabase
        .from('journal_entry_lines')
        .insert(journalLines);

      if (linesError) throw linesError;

      toast.success(`Transaksi ${transactionNumber} berhasil diproses`);
      setCart([]);
    } catch (error: any) {
      toast.error('Gagal memproses transaksi: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Point of Sale</h1>
        <p className="text-muted-foreground">Transaksi penjualan cepat</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari produk..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
                {filteredProducts.map(product => (
                  <Button
                    key={product.id}
                    variant="outline"
                    className="h-auto py-3 px-4 flex flex-col items-start text-left"
                    onClick={() => addToCart(product)}
                  >
                    <span className="font-medium truncate w-full">{product.name}</span>
                    <span className="text-sm text-muted-foreground">{product.sku}</span>
                    <span className="text-primary font-semibold">{formatCurrency(product.unit_price)}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Account Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pengaturan Akun</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Akun Kas/Bank</label>
                  <Select value={cashAccountId} onValueChange={setCashAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun kas" />
                    </SelectTrigger>
                    <SelectContent>
                      {cashAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Akun Pendapatan</label>
                  <Select value={revenueAccountId} onValueChange={setRevenueAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun pendapatan" />
                    </SelectTrigger>
                    <SelectContent>
                      {revenueAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Akun HPP</label>
                  <Select value={cogsAccountId} onValueChange={setCogsAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih akun HPP" />
                    </SelectTrigger>
                    <SelectContent>
                      {cogsAccounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.code} - {acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div>
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Keranjang ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Keranjang kosong</p>
              ) : (
                <>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {cart.map(item => (
                      <div key={item.product_id} className="flex items-center justify-between gap-2 p-2 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-sm text-muted-foreground">{formatCurrency(item.unit_price)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product_id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatCurrency(subtotal)}</span>
                    </div>
                    {totalCogs > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>HPP</span>
                        <span>{formatCurrency(totalCogs)}</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={processTransaction}
                    disabled={isProcessing}
                  >
                    <Receipt className="mr-2 h-5 w-5" />
                    {isProcessing ? 'Memproses...' : 'Proses Transaksi'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default POSDashboard;
