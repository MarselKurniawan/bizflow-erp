import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Auth from "./pages/Auth";
import SelectCompany from "./pages/SelectCompany";
import Dashboard from "./pages/Dashboard";
import ChartOfAccounts from "./pages/ChartOfAccounts";
import Products from "./pages/Products";
import Customers from "./pages/sales/Customers";
import SalesOrders from "./pages/sales/SalesOrders";
import Invoices from "./pages/sales/Invoices";
import SalesPayments from "./pages/sales/Payments";
import Suppliers from "./pages/purchases/Suppliers";
import PurchaseOrders from "./pages/purchases/PurchaseOrders";
import Bills from "./pages/purchases/Bills";
import PurchasePayments from "./pages/purchases/Payments";
import JournalEntries from "./pages/JournalEntries";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CompanyProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/auth" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/select-company" element={<SelectCompany />} />
              <Route element={<MainLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/accounts" element={<ChartOfAccounts />} />
                <Route path="/products" element={<Products />} />
                <Route path="/sales/customers" element={<Customers />} />
                <Route path="/sales/orders" element={<SalesOrders />} />
                <Route path="/sales/invoices" element={<Invoices />} />
                <Route path="/sales/payments" element={<SalesPayments />} />
                <Route path="/purchases/suppliers" element={<Suppliers />} />
                <Route path="/purchases/orders" element={<PurchaseOrders />} />
                <Route path="/purchases/bills" element={<Bills />} />
                <Route path="/purchases/payments" element={<PurchasePayments />} />
                <Route path="/journal" element={<JournalEntries />} />
                <Route path="/reports/profit-loss" element={<Dashboard />} />
                <Route path="/reports/balance-sheet" element={<Dashboard />} />
                <Route path="/reports/general-ledger" element={<Dashboard />} />
                <Route path="/reports/aged-receivables" element={<Dashboard />} />
                <Route path="/reports/aged-payables" element={<Dashboard />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CompanyProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
