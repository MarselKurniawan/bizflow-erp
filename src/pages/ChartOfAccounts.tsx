import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit2, Trash2, ChevronRight, FolderOpen, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const recommendedAccounts = [
  {
    category: 'Cash & Bank',
    type: 'cash_bank',
    accounts: [
      { code: '1101', name: 'Kas', description: 'Untuk mencatat uang tunai' },
      { code: '1102', name: 'Bank BCA', description: 'Rekening bank utama' },
      { code: '1103', name: 'Bank Mandiri', description: 'Rekening bank tambahan' },
    ],
  },
  {
    category: 'Asset (Aset)',
    type: 'asset',
    accounts: [
      { code: '1201', name: 'Piutang Usaha', description: 'Tagihan dari pelanggan' },
      { code: '1301', name: 'Persediaan Barang', description: 'Stok barang dagangan' },
      { code: '1401', name: 'Peralatan', description: 'Aset tetap perusahaan' },
    ],
  },
  {
    category: 'Liability (Kewajiban)',
    type: 'liability',
    accounts: [
      { code: '2101', name: 'Hutang Usaha', description: 'Hutang ke supplier' },
      { code: '2102', name: 'Hutang Pajak', description: 'Kewajiban pajak' },
      { code: '2201', name: 'Hutang Bank', description: 'Pinjaman dari bank' },
    ],
  },
  {
    category: 'Equity (Modal)',
    type: 'equity',
    accounts: [
      { code: '3101', name: 'Modal Disetor', description: 'Modal awal pemilik' },
      { code: '3201', name: 'Laba Ditahan', description: 'Akumulasi laba' },
    ],
  },
  {
    category: 'Revenue (Pendapatan)',
    type: 'revenue',
    accounts: [
      { code: '4101', name: 'Penjualan', description: 'Pendapatan dari penjualan' },
      { code: '4102', name: 'Diskon Penjualan', description: 'Potongan penjualan' },
      { code: '4201', name: 'Pendapatan Lain-lain', description: 'Pendapatan non-operasional' },
    ],
  },
  {
    category: 'Expense (Beban)',
    type: 'expense',
    accounts: [
      { code: '5101', name: 'Harga Pokok Penjualan', description: 'HPP/COGS' },
      { code: '5201', name: 'Beban Gaji', description: 'Gaji karyawan' },
      { code: '5202', name: 'Beban Sewa', description: 'Sewa kantor/gudang' },
      { code: '5203', name: 'Beban Listrik & Air', description: 'Utilitas bulanan' },
      { code: '5204', name: 'Beban Transportasi', description: 'Biaya pengiriman' },
    ],
  },
];

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
  parent_id: string | null;
}

const accountTypes = [
  { value: 'asset', label: 'Asset', color: 'bg-primary/10 text-primary' },
  { value: 'liability', label: 'Liability', color: 'bg-destructive/10 text-destructive' },
  { value: 'equity', label: 'Equity', color: 'bg-accent/10 text-accent' },
  { value: 'revenue', label: 'Revenue', color: 'bg-success/10 text-success' },
  { value: 'expense', label: 'Expense', color: 'bg-warning/10 text-warning' },
  { value: 'cash_bank', label: 'Cash & Bank', color: 'bg-primary/10 text-primary' },
];

const getAccountTypeStyle = (type: string) => {
  return accountTypes.find(t => t.value === type)?.color || 'bg-muted text-muted-foreground';
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
};

export const ChartOfAccounts: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    account_type: 'asset',
  });

  const fetchAccounts = async () => {
    if (!selectedCompany) return;
    
    setIsLoading(true);
    const { data, error } = await supabase
      .from('chart_of_accounts')
      .select('*')
      .eq('company_id', selectedCompany.id)
      .order('code');

    if (error) {
      console.error('Error fetching accounts:', error);
      toast.error('Failed to load accounts');
    } else {
      setAccounts(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedCompany]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) return;

    const accountType = formData.account_type as "asset" | "liability" | "equity" | "revenue" | "expense" | "cash_bank";
    
    if (editingAccount) {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update({
          code: formData.code,
          name: formData.name,
          account_type: accountType,
        })
        .eq('id', editingAccount.id);

      if (error) {
        toast.error('Failed to update account');
      } else {
        toast.success('Account updated successfully');
        fetchAccounts();
      }
    } else {
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert([{
          company_id: selectedCompany.id,
          code: formData.code,
          name: formData.name,
          account_type: accountType,
        }]);

      if (error) {
        if (error.code === '23505') {
          toast.error('Account code already exists');
        } else {
          toast.error('Failed to create account');
        }
      } else {
        toast.success('Account created successfully');
        fetchAccounts();
      }
    }

    setIsDialogOpen(false);
    setEditingAccount(null);
    setFormData({ code: '', name: '', account_type: 'asset' });
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      code: account.code,
      name: account.name,
      account_type: account.account_type,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    const { error } = await supabase
      .from('chart_of_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Failed to delete account');
    } else {
      toast.success('Account deleted successfully');
      fetchAccounts();
    }
  };

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = 
      account.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || account.account_type === filterType;
    return matchesSearch && matchesType;
  });

  // Group accounts by type
  const groupedAccounts = accountTypes.reduce((acc, type) => {
    acc[type.value] = filteredAccounts.filter(a => a.account_type === type.value);
    return acc;
  }, {} as Record<string, Account[]>);

  return (
    <div className="space-y-6">
      {/* Account Guide Alert */}
      <Collapsible open={showGuide} onOpenChange={setShowGuide}>
        <Card className="border-primary/20 bg-primary/5">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-primary/10 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base font-medium text-primary">
                    Panduan Akun yang Diperlukan
                  </CardTitle>
                </div>
                {showGuide ? (
                  <ChevronUp className="w-4 h-4 text-primary" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-primary" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <p className="text-sm text-muted-foreground mb-4">
                Berikut adalah daftar akun yang direkomendasikan untuk sistem akuntansi lengkap:
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendedAccounts.map((category) => (
                  <div key={category.category} className="space-y-2">
                    <h4 className="font-semibold text-sm text-foreground flex items-center gap-2">
                      <span className={cn('w-2 h-2 rounded-full', 
                        category.type === 'cash_bank' ? 'bg-primary' :
                        category.type === 'asset' ? 'bg-blue-500' :
                        category.type === 'liability' ? 'bg-destructive' :
                        category.type === 'equity' ? 'bg-purple-500' :
                        category.type === 'revenue' ? 'bg-green-500' :
                        'bg-orange-500'
                      )} />
                      {category.category}
                    </h4>
                    <ul className="space-y-1">
                      {category.accounts.map((acc) => (
                        <li key={acc.code} className="text-xs text-muted-foreground pl-4">
                          <span className="font-mono text-foreground/70">{acc.code}</span> - {acc.name}
                          <span className="block text-muted-foreground/70 text-[10px]">{acc.description}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Manage your accounting structure
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="gradient-primary text-primary-foreground shadow-glow"
              onClick={() => {
                setEditingAccount(null);
                setFormData({ code: '', name: '', account_type: 'asset' });
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Edit Account' : 'Create New Account'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="form-label">Account Code</label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="e.g., 1-1001"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="form-label">Account Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Cash on Hand"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="form-label">Account Type</label>
                <SearchableSelect
                  options={accountTypes.map(type => ({ value: type.value, label: type.label }))}
                  value={formData.account_type}
                  onChange={(value) => setFormData({ ...formData, account_type: value })}
                  placeholder="Select account type"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
                  {editingAccount ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts..."
            className="pl-10 input-field"
          />
        </div>
        <div className="w-full sm:w-48">
          <SearchableSelect
            options={[
              { value: 'all', label: 'All Types' },
              ...accountTypes.map(type => ({ value: type.value, label: type.label })),
            ]}
            value={filterType}
            onChange={setFilterType}
            placeholder="Filter by type"
          />
        </div>
      </div>

      {/* Accounts List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading accounts...</div>
      ) : filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No accounts found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filterType !== 'all' 
                  ? 'Try adjusting your search or filter'
                  : 'Get started by adding your first account'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {accountTypes.map((type) => {
            const typeAccounts = groupedAccounts[type.value];
            if (!typeAccounts || typeAccounts.length === 0) return null;

            return (
              <Card key={type.value} className="animate-fade-in">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className={cn('badge-status', type.color)}>{type.label}</span>
                    <span className="text-muted-foreground font-normal text-sm">
                      ({typeAccounts.length} accounts)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Account Name</th>
                          <th className="text-right">Balance</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {typeAccounts.map((account) => (
                          <tr key={account.id}>
                            <td className="font-mono text-sm">{account.code}</td>
                            <td className="font-medium">{account.name}</td>
                            <td className="text-right font-medium">
                              {formatCurrency(account.balance || 0)}
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(account)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(account.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
