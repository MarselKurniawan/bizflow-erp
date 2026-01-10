import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { useAccounts } from '@/hooks/useAccounts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  account_id: string | null;
  is_default: boolean;
  is_active: boolean;
}

const TaxSettings = () => {
  const { selectedCompany } = useCompany();
  const { accounts, getAccountsByType } = useAccounts();
  const liabilityAccounts = accounts.filter(a => 
    a.account_type === 'liability' || 
    a.name.toLowerCase().includes('pajak') ||
    a.name.toLowerCase().includes('tax')
  );

  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxRate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    rate: 11,
    account_id: '',
    is_default: false,
    is_active: true
  });

  const fetchTaxRates = async () => {
    if (!selectedCompany) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from('pos_tax_rates')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('name');
    
    if (!error) {
      setTaxRates(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTaxRates();
  }, [selectedCompany]);

  const createDefaultTaxRates = async () => {
    if (!selectedCompany) return;
    
    const defaults = [
      { name: 'PPN 11%', rate: 11, is_default: true },
      { name: 'PPN 12%', rate: 12, is_default: false },
      { name: 'PPh 23 (2%)', rate: 2, is_default: false },
    ];

    const { error } = await supabase
      .from('pos_tax_rates')
      .insert(defaults.map(d => ({
        ...d,
        company_id: selectedCompany.id,
        is_active: true
      })));

    if (error) {
      toast.error('Gagal membuat tarif pajak default');
      return;
    }

    toast.success('Tarif pajak default berhasil dibuat');
    fetchTaxRates();
  };

  const handleOpenDialog = (tax?: TaxRate) => {
    if (tax) {
      setEditingTax(tax);
      setFormData({
        name: tax.name,
        rate: tax.rate,
        account_id: tax.account_id || '',
        is_default: tax.is_default,
        is_active: tax.is_active
      });
    } else {
      setEditingTax(null);
      setFormData({
        name: '',
        rate: 11,
        account_id: '',
        is_default: false,
        is_active: true
      });
    }
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!selectedCompany || !formData.name) {
      toast.error('Nama pajak harus diisi');
      return;
    }

    // If setting as default, unset other defaults first
    if (formData.is_default) {
      await supabase
        .from('pos_tax_rates')
        .update({ is_default: false })
        .eq('company_id', selectedCompany.id);
    }

    if (editingTax) {
      const { error } = await supabase
        .from('pos_tax_rates')
        .update({
          name: formData.name,
          rate: formData.rate,
          account_id: formData.account_id || null,
          is_default: formData.is_default,
          is_active: formData.is_active
        })
        .eq('id', editingTax.id);

      if (error) {
        toast.error('Gagal mengupdate tarif pajak');
        return;
      }
      toast.success('Tarif pajak berhasil diupdate');
    } else {
      const { error } = await supabase
        .from('pos_tax_rates')
        .insert({
          company_id: selectedCompany.id,
          name: formData.name,
          rate: formData.rate,
          account_id: formData.account_id || null,
          is_default: formData.is_default,
          is_active: formData.is_active
        });

      if (error) {
        toast.error('Gagal menambah tarif pajak');
        return;
      }
      toast.success('Tarif pajak berhasil ditambah');
    }

    setShowDialog(false);
    fetchTaxRates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus tarif pajak ini?')) return;

    const { error } = await supabase
      .from('pos_tax_rates')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Gagal menghapus tarif pajak');
      return;
    }

    toast.success('Tarif pajak berhasil dihapus');
    fetchTaxRates();
  };

  const handleToggleActive = async (tax: TaxRate) => {
    const { error } = await supabase
      .from('pos_tax_rates')
      .update({ is_active: !tax.is_active })
      .eq('id', tax.id);

    if (!error) {
      fetchTaxRates();
    }
  };

  const handleSetDefault = async (tax: TaxRate) => {
    if (!selectedCompany) return;
    
    // Unset all defaults first
    await supabase
      .from('pos_tax_rates')
      .update({ is_default: false })
      .eq('company_id', selectedCompany.id);
    
    // Set new default
    const { error } = await supabase
      .from('pos_tax_rates')
      .update({ is_default: true })
      .eq('id', tax.id);

    if (!error) {
      toast.success(`${tax.name} dijadikan default`);
      fetchTaxRates();
    }
  };

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return '-';
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : '-';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Pengaturan Pajak</h1>
        <p className="text-muted-foreground">Konfigurasi tarif pajak untuk transaksi POS</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tarif Pajak</CardTitle>
              <CardDescription>
                Atur berbagai tarif pajak (PPN, PPh, dll) dan akun pencatatan masing-masing. 
                Pajak bersifat opsional dan dapat dipilih per transaksi.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {taxRates.length === 0 && (
                <Button variant="outline" onClick={createDefaultTaxRates}>
                  Buat Default
                </Button>
              )}
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">Memuat...</p>
          ) : taxRates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">Belum ada tarif pajak</p>
              <Button onClick={createDefaultTaxRates}>
                Buat Tarif Pajak Default
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="text-center">Tarif (%)</TableHead>
                  <TableHead>Akun Pajak</TableHead>
                  <TableHead className="text-center">Default</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taxRates.map(tax => (
                  <TableRow key={tax.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        {tax.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{tax.rate}%</TableCell>
                    <TableCell>{getAccountName(tax.account_id)}</TableCell>
                    <TableCell className="text-center">
                      {tax.is_default ? (
                        <Badge>Default</Badge>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSetDefault(tax)}
                          className="text-xs"
                        >
                          Set Default
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={tax.is_active}
                        onCheckedChange={() => handleToggleActive(tax)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(tax)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tax.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTax ? 'Edit' : 'Tambah'} Tarif Pajak</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nama Pajak</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: PPN 11%, PPh 23"
              />
            </div>
            <div className="space-y-2">
              <Label>Tarif (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                placeholder="11"
              />
            </div>
            <div className="space-y-2">
              <Label>Akun Pajak (Opsional)</Label>
              <Select 
                value={formData.account_id} 
                onValueChange={(v) => setFormData({ ...formData, account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tidak ada</SelectItem>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pajak akan dicatat ke akun ini jika dipilih
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(v) => setFormData({ ...formData, is_default: v })}
                />
                <Label>Jadikan Default</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
                <Label>Aktif</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Batal</Button>
            <Button onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaxSettings;
