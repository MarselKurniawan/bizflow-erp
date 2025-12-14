import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Download, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToExcel, exportToPDF, generatePDFTable } from '@/lib/exportUtils';

interface AccountBalance {
  account_type: string;
  name: string;
  code: string;
  total_debit: number;
  total_credit: number;
  balance: number;
}

export const ProfitLoss: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(0, 1);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [revenueAccounts, setRevenueAccounts] = useState<AccountBalance[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);

    // Get all journal entry lines within date range
    const { data: entries, error } = await supabase
      .from('journal_entry_lines')
      .select(`
        debit_amount,
        credit_amount,
        account:chart_of_accounts!journal_entry_lines_account_id_fkey(
          id, code, name, account_type
        ),
        journal_entry:journal_entries!journal_entry_lines_journal_entry_id_fkey(
          entry_date, is_posted, company_id
        )
      `)
      .gte('journal_entry.entry_date', startDate)
      .lte('journal_entry.entry_date', endDate)
      .eq('journal_entry.company_id', selectedCompany.id)
      .eq('journal_entry.is_posted', true);

    if (error) {
      console.error('Error fetching P&L data:', error);
      toast.error('Failed to load report data');
      setIsLoading(false);
      return;
    }

    // Group by account - filter entries that match the company (Supabase filter on joined tables can return null)
    const accountMap = new Map<string, AccountBalance>();
    
    (entries || []).forEach((entry: any) => {
      // Skip if no account or journal_entry is null (filtered out by company_id)
      if (!entry.account || !entry.journal_entry) return;
      
      const key = entry.account.id;
      
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          account_type: entry.account.account_type,
          name: entry.account.name,
          code: entry.account.code,
          total_debit: 0,
          total_credit: 0,
          balance: 0,
        });
      }
      
      const acc = accountMap.get(key)!;
      acc.total_debit += entry.debit_amount || 0;
      acc.total_credit += entry.credit_amount || 0;
    });

    // Calculate balances
    accountMap.forEach((acc) => {
      if (acc.account_type === 'revenue') {
        acc.balance = acc.total_credit - acc.total_debit;
      } else if (acc.account_type === 'expense') {
        acc.balance = acc.total_debit - acc.total_credit;
      }
    });

    const accounts = Array.from(accountMap.values());
    setRevenueAccounts(accounts.filter(a => a.account_type === 'revenue').sort((a, b) => a.code.localeCompare(b.code)));
    setExpenseAccounts(accounts.filter(a => a.account_type === 'expense').sort((a, b) => a.code.localeCompare(b.code)));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany, startDate, endDate]);

  const totalRevenue = revenueAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalExpenses = expenseAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const netIncome = totalRevenue - totalExpenses;

  const handleExportCSV = () => {
    const data = [
      ...revenueAccounts.map(a => ({ Type: 'Revenue', Code: a.code, Account: a.name, Amount: a.balance })),
      ...expenseAccounts.map(a => ({ Type: 'Expense', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Net Income', Amount: netIncome }
    ];
    exportToCSV(data, `profit-loss-${startDate}-to-${endDate}`);
    toast.success('Exported to CSV');
  };

  const handleExportExcel = () => {
    const data = [
      ...revenueAccounts.map(a => ({ Type: 'Revenue', Code: a.code, Account: a.name, Amount: a.balance })),
      ...expenseAccounts.map(a => ({ Type: 'Expense', Code: a.code, Account: a.name, Amount: a.balance })),
      { Type: 'Total', Code: '', Account: 'Net Income', Amount: netIncome }
    ];
    exportToExcel(data, `profit-loss-${startDate}-to-${endDate}`, 'Profit & Loss');
    toast.success('Exported to Excel');
  };

  const handleExportPDF = () => {
    const revenueRows = revenueAccounts.map(a => [a.code, a.name, formatCurrency(a.balance)]);
    const expenseRows = expenseAccounts.map(a => [a.code, a.name, formatCurrency(a.balance)]);
    
    const html = `
      <h2>Period: ${startDate} to ${endDate}</h2>
      <h3>Revenue</h3>
      ${generatePDFTable(['Code', 'Account', 'Amount'], revenueRows, { totalRow: ['', 'Total Revenue', formatCurrency(totalRevenue)] })}
      <h3>Expenses</h3>
      ${generatePDFTable(['Code', 'Account', 'Amount'], expenseRows, { totalRow: ['', 'Total Expenses', formatCurrency(totalExpenses)] })}
      <h3>Net ${netIncome >= 0 ? 'Profit' : 'Loss'}: ${formatCurrency(netIncome)}</h3>
    `;
    exportToPDF(`Profit & Loss Statement - ${selectedCompany?.name}`, html);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Profit & Loss Statement</h1>
          <p className="text-muted-foreground mt-1">Income and expenses summary</p>
        </div>
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
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">From Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="flex-1">
              <label className="form-label">To Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field"
              />
            </div>
            <Button onClick={fetchData} variant="outline">
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalRevenue)}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-success/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
              </div>
              <TrendingDown className="w-10 h-10 text-destructive/20" />
            </div>
          </CardContent>
        </Card>
        <Card className={cn(netIncome >= 0 ? 'border-success/30' : 'border-destructive/30')}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Net {netIncome >= 0 ? 'Profit' : 'Loss'}</p>
                <p className={cn(
                  'text-2xl font-bold',
                  netIncome >= 0 ? 'text-success' : 'text-destructive'
                )}>
                  {formatCurrency(Math.abs(netIncome))}
                </p>
              </div>
              {netIncome >= 0 ? (
                <TrendingUp className="w-10 h-10 text-success/20" />
              ) : (
                <TrendingDown className="w-10 h-10 text-destructive/20" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading report...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-success">Revenue</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-muted-foreground py-8">
                        No revenue recorded for this period
                      </td>
                    </tr>
                  ) : (
                    <>
                      {revenueAccounts.map((acc) => (
                        <tr key={acc.code}>
                          <td className="font-mono">{acc.code}</td>
                          <td>{acc.name}</td>
                          <td className="text-right font-medium text-success">
                            {formatCurrency(acc.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-semibold">
                        <td colSpan={2}>Total Revenue</td>
                        <td className="text-right text-success">{formatCurrency(totalRevenue)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-destructive">Expenses</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-muted-foreground py-8">
                        No expenses recorded for this period
                      </td>
                    </tr>
                  ) : (
                    <>
                      {expenseAccounts.map((acc) => (
                        <tr key={acc.code}>
                          <td className="font-mono">{acc.code}</td>
                          <td>{acc.name}</td>
                          <td className="text-right font-medium text-destructive">
                            {formatCurrency(acc.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-semibold">
                        <td colSpan={2}>Total Expenses</td>
                        <td className="text-right text-destructive">{formatCurrency(totalExpenses)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className={cn(netIncome >= 0 ? 'bg-success/5' : 'bg-destructive/5')}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Net {netIncome >= 0 ? 'Profit' : 'Loss'}</h3>
              <p className="text-sm text-muted-foreground">
                Revenue ({formatCurrency(totalRevenue)}) - Expenses ({formatCurrency(totalExpenses)})
              </p>
            </div>
            <p className={cn(
              'text-3xl font-bold',
              netIncome >= 0 ? 'text-success' : 'text-destructive'
            )}>
              {formatCurrency(netIncome)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfitLoss;
