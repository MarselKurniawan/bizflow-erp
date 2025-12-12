import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  CreditCard
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Sample data
const revenueData = [
  { month: 'Jan', revenue: 45000000, expense: 32000000 },
  { month: 'Feb', revenue: 52000000, expense: 35000000 },
  { month: 'Mar', revenue: 48000000, expense: 33000000 },
  { month: 'Apr', revenue: 61000000, expense: 40000000 },
  { month: 'May', revenue: 55000000, expense: 38000000 },
  { month: 'Jun', revenue: 67000000, expense: 45000000 },
];

const expenseByCategory = [
  { name: 'COGS', value: 45, color: 'hsl(199, 89%, 48%)' },
  { name: 'Salary', value: 25, color: 'hsl(172, 66%, 50%)' },
  { name: 'Operations', value: 15, color: 'hsl(142, 71%, 45%)' },
  { name: 'Marketing', value: 10, color: 'hsl(38, 92%, 50%)' },
  { name: 'Others', value: 5, color: 'hsl(215, 16%, 47%)' },
];

const recentTransactions = [
  { id: 1, type: 'income', description: 'Invoice #INV-2024-001', amount: 15000000, date: '2024-01-15' },
  { id: 2, type: 'expense', description: 'Purchase Order #PO-2024-012', amount: 8500000, date: '2024-01-14' },
  { id: 3, type: 'income', description: 'Invoice #INV-2024-002', amount: 22000000, date: '2024-01-13' },
  { id: 4, type: 'expense', description: 'Utility Payment', amount: 3200000, date: '2024-01-12' },
  { id: 5, type: 'income', description: 'Invoice #INV-2024-003', amount: 9800000, date: '2024-01-11' },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatCompactCurrency = (value: number) => {
  if (value >= 1000000000) {
    return `Rp ${(value / 1000000000).toFixed(1)}B`;
  }
  if (value >= 1000000) {
    return `Rp ${(value / 1000000).toFixed(1)}M`;
  }
  return formatCurrency(value);
};

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  iconBg: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, changeLabel, icon: Icon, iconBg }) => {
  const isPositive = change >= 0;
  
  return (
    <div className="stat-card animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-primary-foreground" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className={`flex items-center text-sm font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {Math.abs(change)}%
        </span>
        <span className="text-sm text-muted-foreground">{changeLabel}</span>
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const { selectedCompany } = useCompany();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's what's happening with {selectedCompany?.name}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={formatCompactCurrency(328000000)}
          change={12.5}
          changeLabel="vs last month"
          icon={DollarSign}
          iconBg="gradient-primary"
        />
        <StatCard
          title="Total Expenses"
          value={formatCompactCurrency(223000000)}
          change={-3.2}
          changeLabel="vs last month"
          icon={CreditCard}
          iconBg="bg-warning"
        />
        <StatCard
          title="Outstanding Invoices"
          value="24"
          change={8}
          changeLabel="new this week"
          icon={FileText}
          iconBg="bg-accent"
        />
        <StatCard
          title="Total Customers"
          value="156"
          change={5.2}
          changeLabel="vs last month"
          icon={Users}
          iconBg="bg-success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    fontSize={12}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(199, 89%, 48%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorRevenue)"
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="hsl(38, 92%, 50%)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorExpense)"
                    name="Expense"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardHeader>
            <CardTitle className="text-lg font-heading">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`${value}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {expenseByCategory.map((item) => (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="font-medium">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
        <CardHeader>
          <CardTitle className="text-lg font-heading">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="font-medium">{transaction.description}</td>
                    <td className="text-muted-foreground">{transaction.date}</td>
                    <td>
                      <span className={`badge-status ${
                        transaction.type === 'income' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {transaction.type === 'income' ? 'Income' : 'Expense'}
                      </span>
                    </td>
                    <td className={`text-right font-medium ${
                      transaction.type === 'income' ? 'text-success' : 'text-destructive'
                    }`}>
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
