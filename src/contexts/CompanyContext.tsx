import React, { createContext, useContext, useState, useEffect } from 'react';
import { Company, getUserCompanies } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company) => void;
  isLoading: boolean;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setSelectedCompany(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const userCompanies = await getUserCompanies(user.id);
    setCompanies(userCompanies);

    // Auto-select company from localStorage or first available
    const savedCompanyId = localStorage.getItem('selectedCompanyId');
    const savedCompany = userCompanies.find(c => c.id === savedCompanyId);
    
    if (savedCompany) {
      setSelectedCompany(savedCompany);
    } else if (userCompanies.length === 1) {
      setSelectedCompany(userCompanies[0]);
      localStorage.setItem('selectedCompanyId', userCompanies[0].id);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    if (!authLoading) {
      refreshCompanies();
    }
  }, [user, authLoading]);

  const handleSetSelectedCompany = (company: Company) => {
    setSelectedCompany(company);
    localStorage.setItem('selectedCompanyId', company.id);
  };

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        setSelectedCompany: handleSetSelectedCompany,
        isLoading,
        refreshCompanies
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
