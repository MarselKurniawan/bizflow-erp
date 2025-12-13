import React, { useState, useEffect } from 'react';
import { Building2, Wallet, Scale } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompany } from '@/contexts/CompanyContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface AccountBalance {
  account_type: string;
  name: string;
  code: string;
  balance: number;
}

export const BalanceSheet: React.FC = () => {
  const { selectedCompany } = useCompany();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [assets, setAssets] = useState<AccountBalance[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<AccountBalance[]>([]);
  const [liabilities, setLiabilities] = useState<AccountBalance[]>([]);
  const [equityAccounts, setEquityAccounts] = useState<AccountBalance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    if (!selectedCompany) return;

    setIsLoading(true);

    // Get all journal entry lines up to the as-of date
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
      .lte('journal_entry.entry_date', asOfDate)
      .eq('journal_entry.company_id', selectedCompany.id)
      .eq('journal_entry.is_posted', true);

    if (error) {
      console.error('Error fetching balance sheet data:', error);
      toast.error('Failed to load report data');
      setIsLoading(false);
      return;
    }

    // Group by account
    const accountMap = new Map<string, AccountBalance>();
    
    (entries || []).forEach((entry: any) => {
      if (!entry.account) return;
      const key = entry.account.id;
      
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          account_type: entry.account.account_type,
          name: entry.account.name,
          code: entry.account.code,
          balance: 0,
        });
      }
      
      const acc = accountMap.get(key)!;
      const debit = entry.debit_amount || 0;
      const credit = entry.credit_amount || 0;
      
      // Assets and Cash/Bank: debit increases, credit decreases
      // Liabilities and Equity: credit increases, debit decreases
      if (acc.account_type === 'asset' || acc.account_type === 'cash_bank') {
        acc.balance += debit - credit;
      } else {
        acc.balance += credit - debit;
      }
    });

    const accounts = Array.from(accountMap.values());
    setAssets(accounts.filter(a => a.account_type === 'asset').sort((a, b) => a.code.localeCompare(b.code)));
    setCashBankAccounts(accounts.filter(a => a.account_type === 'cash_bank').sort((a, b) => a.code.localeCompare(b.code)));
    setLiabilities(accounts.filter(a => a.account_type === 'liability').sort((a, b) => a.code.localeCompare(b.code)));
    setEquityAccounts(accounts.filter(a => a.account_type === 'equity').sort((a, b) => a.code.localeCompare(b.code)));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedCompany, asOfDate]);

  const totalAssets = assets.reduce((sum, acc) => sum + acc.balance, 0) + cashBankAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, acc) => sum + acc.balance, 0);
  const totalEquity = equityAccounts.reduce((sum, acc) => sum + acc.balance, 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Balance Sheet</h1>
          <p className="text-muted-foreground mt-1">Statement of financial position</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="form-label">As of Date</label>
              <Input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
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
                <p className="text-sm text-muted-foreground">Total Assets</p>
                <p className="text-2xl font-bold text-primary">{formatCurrency(totalAssets)}</p>
              </div>
              <Building2 className="w-10 h-10 text-primary/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Liabilities</p>
                <p className="text-2xl font-bold text-warning">{formatCurrency(totalLiabilities)}</p>
              </div>
              <Wallet className="w-10 h-10 text-warning/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Equity</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(totalEquity)}</p>
              </div>
              <Scale className="w-10 h-10 text-success/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading report...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg text-primary">Assets</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {cashBankAccounts.length > 0 && (
                    <>
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="font-semibold">Cash & Bank</td>
                      </tr>
                      {cashBankAccounts.map((acc) => (
                        <tr key={acc.code}>
                          <td className="font-mono pl-6">{acc.code}</td>
                          <td>{acc.name}</td>
                          <td className="text-right font-medium">
                            {formatCurrency(acc.balance)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  {assets.length > 0 && (
                    <>
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="font-semibold">Other Assets</td>
                      </tr>
                      {assets.map((acc) => (
                        <tr key={acc.code}>
                          <td className="font-mono pl-6">{acc.code}</td>
                          <td>{acc.name}</td>
                          <td className="text-right font-medium">
                            {formatCurrency(acc.balance)}
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  <tr className="bg-primary/10 font-bold">
                    <td colSpan={2}>Total Assets</td>
                    <td className="text-right text-primary">{formatCurrency(totalAssets)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Liabilities & Equity Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Liabilities & Equity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {liabilities.length > 0 && (
                    <>
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="font-semibold text-warning">Liabilities</td>
                      </tr>
                      {liabilities.map((acc) => (
                        <tr key={acc.code}>
                          <td className="font-mono pl-6">{acc.code}</td>
                          <td>{acc.name}</td>
                          <td className="text-right font-medium">
                            {formatCurrency(acc.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td colSpan={2} className="pl-6">Total Liabilities</td>
                        <td className="text-right text-warning">{formatCurrency(totalLiabilities)}</td>
                      </tr>
                    </>
                  )}
                  {equityAccounts.length > 0 && (
                    <>
                      <tr className="bg-muted/30">
                        <td colSpan={3} className="font-semibold text-success">Equity</td>
                      </tr>
                      {equityAccounts.map((acc) => (
                        <tr key={acc.code}>
                          <td className="font-mono pl-6">{acc.code}</td>
                          <td>{acc.name}</td>
                          <td className="text-right font-medium">
                            {formatCurrency(acc.balance)}
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold">
                        <td colSpan={2} className="pl-6">Total Equity</td>
                        <td className="text-right text-success">{formatCurrency(totalEquity)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-muted/50 font-bold">
                    <td colSpan={2}>Total Liabilities & Equity</td>
                    <td className="text-right">{formatCurrency(totalLiabilitiesAndEquity)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Balance Check */}
      <Card className={cn(
        Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01 
          ? 'bg-success/5 border-success/30' 
          : 'bg-destructive/5 border-destructive/30'
      )}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Balance Check</h3>
              <p className="text-sm text-muted-foreground">
                Assets should equal Liabilities + Equity
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Difference</p>
              <p className={cn(
                'text-2xl font-bold',
                Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01 
                  ? 'text-success' 
                  : 'text-destructive'
              )}>
                {formatCurrency(totalAssets - totalLiabilitiesAndEquity)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BalanceSheet;
