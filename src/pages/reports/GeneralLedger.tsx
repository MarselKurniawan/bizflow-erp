import React, { useState, useEffect } from 'react';
import { Search, BookOpen, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface Account {
  id: string;
  code: string;
  name: string;
  account_type: string;
}

interface LedgerEntry {
  entry_date: string;
  entry_number: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
}

export const GeneralLedger: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAccounts = async () => {
    if (!selectedCompany) return;

    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, code, name, account_type')
      .eq('company_id', selectedCompany.id)
      .eq('is_active', true)
      .order('code');

    setAccounts(data || []);
  };

  useEffect(() => {
    fetchAccounts();
  }, [selectedCompany]);

  const fetchLedger = async () => {
    if (!selectedCompany || !selectedAccount) return;

    setIsLoading(true);

    const account = accounts.find(a => a.id === selectedAccount);
    const isDebitNormal = account?.account_type === 'asset' || 
                          account?.account_type === 'cash_bank' || 
                          account?.account_type === 'expense';

    // Get opening balance (entries before start date)
    const { data: openingData } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit_amount,
        credit_amount,
        journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
          entry_date, is_posted, company_id
        )
      `)
      .eq('account_id', selectedAccount)
      .lt('journal_entry.entry_date', startDate)
      .eq('journal_entry.company_id', selectedCompany.id)
      .eq('journal_entry.is_posted', true);

    let opening = 0;
    (openingData || []).forEach((entry: any) => {
      const debit = entry.debit_amount || 0;
      const credit = entry.credit_amount || 0;
      opening += isDebitNormal ? (debit - credit) : (credit - debit);
    });
    setOpeningBalance(opening);

    // Get entries within date range
    const { data: entries, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit_amount,
        credit_amount,
        description,
        journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
          entry_date, entry_number, description, is_posted, company_id
        )
      `)
      .eq('account_id', selectedAccount)
      .gte('journal_entry.entry_date', startDate)
      .lte('journal_entry.entry_date', endDate)
      .eq('journal_entry.company_id', selectedCompany.id)
      .eq('journal_entry.is_posted', true)
      .order('journal_entry(entry_date)', { ascending: true });

    if (error) {
      console.error('Error fetching ledger:', error);
      toast.error('Failed to load ledger data');
      setIsLoading(false);
      return;
    }

    let runningBalance = opening;
    const ledger: LedgerEntry[] = (entries || []).map((entry: any) => {
      const debit = entry.debit_amount || 0;
      const credit = entry.credit_amount || 0;
      runningBalance += isDebitNormal ? (debit - credit) : (credit - debit);
      
      return {
        entry_date: entry.journal_entry?.entry_date,
        entry_number: entry.journal_entry?.entry_number,
        description: entry.description || entry.journal_entry?.description || '',
        debit_amount: debit,
        credit_amount: credit,
        running_balance: runningBalance,
      };
    });

    setLedgerEntries(ledger);
    setIsLoading(false);
  };

  const selectedAccountData = accounts.find(a => a.id === selectedAccount);
  const totalDebits = ledgerEntries.reduce((sum, e) => sum + e.debit_amount, 0);
  const totalCredits = ledgerEntries.reduce((sum, e) => sum + e.credit_amount, 0);
  const closingBalance = ledgerEntries.length > 0 
    ? ledgerEntries[ledgerEntries.length - 1].running_balance 
    : openingBalance;

  const handleExportCSV = () => {
    if (!selectedAccountData) return;
    const data = ledgerEntries.map(e => ({
      Date: e.entry_date,
      'Entry #': e.entry_number,
      Description: e.description,
      Debit: e.debit_amount,
      Credit: e.credit_amount,
      Balance: e.running_balance,
    }));
    exportToCSV(data, `ledger-${selectedAccountData.code}-${startDate}-to-${endDate}`);
    toast.success('Exported to CSV');
  };

  const handleExportExcel = () => {
    if (!selectedAccountData) return;
    const data = ledgerEntries.map(e => ({
      Date: e.entry_date,
      'Entry #': e.entry_number,
      Description: e.description,
      Debit: e.debit_amount,
      Credit: e.credit_amount,
      Balance: e.running_balance,
    }));
    exportToExcel(data, `ledger-${selectedAccountData.code}-${startDate}-to-${endDate}`, 'General Ledger');
    toast.success('Exported to Excel');
  };

  const handleExportPDF = () => {
    if (!selectedAccountData) return;
    const rows = ledgerEntries.map(e => [
      formatDate(e.entry_date),
      e.entry_number,
      e.description,
      e.debit_amount > 0 ? formatCurrency(e.debit_amount) : '-',
      e.credit_amount > 0 ? formatCurrency(e.credit_amount) : '-',
      formatCurrency(e.running_balance),
    ]);
    
    const html = `
      <h2>Account: ${selectedAccountData.code} - ${selectedAccountData.name}</h2>
      <h3>Period: ${startDate} to ${endDate}</h3>
      <p>Opening Balance: ${formatCurrency(openingBalance)}</p>
      ${generatePDFTable(['Date', 'Entry #', 'Description', 'Debit', 'Credit', 'Balance'], rows, { 
        totalRow: ['', '', 'Totals', formatCurrency(totalDebits), formatCurrency(totalCredits), ''] 
      })}
      <p><strong>Closing Balance: ${formatCurrency(closingBalance)}</strong></p>
    `;
    exportToPDF(`General Ledger - ${selectedAccountData.name}`, html);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">General Ledger</h1>
          <p className="text-muted-foreground mt-1">Detailed account transactions</p>
        </div>
        {selectedAccountData && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportPDF}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="form-label">Account</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="input-field">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="form-label">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchLedger} className="w-full gradient-primary text-primary-foreground">
                View Ledger
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAccountData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-3">
              <span className="font-mono text-primary">{selectedAccountData.code}</span>
              <span>{selectedAccountData.name}</span>
              <span className="text-sm font-normal text-muted-foreground capitalize">
                ({selectedAccountData.account_type.replace('_', ' ')})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Loading ledger...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Entry #</th>
                      <th>Description</th>
                      <th className="text-right">Debit</th>
                      <th className="text-right">Credit</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-muted/50 font-medium">
                      <td colSpan={5}>Opening Balance</td>
                      <td className="text-right">{formatCurrency(openingBalance)}</td>
                    </tr>
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center text-muted-foreground py-8">
                          No transactions found for this period
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((entry, index) => (
                        <tr key={index}>
                          <td>{formatDate(entry.entry_date)}</td>
                          <td className="font-mono text-sm">{entry.entry_number}</td>
                          <td className="max-w-xs truncate">{entry.description}</td>
                          <td className="text-right">
                            {entry.debit_amount > 0 ? formatCurrency(entry.debit_amount) : '-'}
                          </td>
                          <td className="text-right">
                            {entry.credit_amount > 0 ? formatCurrency(entry.credit_amount) : '-'}
                          </td>
                          <td className="text-right font-medium">{formatCurrency(entry.running_balance)}</td>
                        </tr>
                      ))
                    )}
                    <tr className="bg-muted/50 font-semibold">
                      <td colSpan={3}>Totals</td>
                      <td className="text-right">{formatCurrency(totalDebits)}</td>
                      <td className="text-right">{formatCurrency(totalCredits)}</td>
                      <td></td>
                    </tr>
                    <tr className="bg-primary/10 font-bold">
                      <td colSpan={5}>Closing Balance</td>
                      <td className="text-right text-primary">{formatCurrency(closingBalance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!selectedAccount && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Select an Account</h3>
              <p className="text-muted-foreground">Choose an account to view its ledger transactions</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GeneralLedger;
