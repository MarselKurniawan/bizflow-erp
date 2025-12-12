import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { Loader2 } from 'lucide-react';

export const MainLayout: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { selectedCompany, isLoading: companyLoading, companies } = useCompany();

  if (authLoading || companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If no company selected and there are companies available, go to select company
  if (!selectedCompany && companies.length > 0) {
    return <Navigate to="/select-company" replace />;
  }

  // If no companies available at all
  if (!selectedCompany && companies.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <h2 className="text-2xl font-heading font-semibold mb-4">No Company Access</h2>
          <p className="text-muted-foreground mb-6">
            You don't have access to any company. Please contact your administrator to get access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 min-h-screen">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
