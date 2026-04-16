import React, { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from "@/lib/trpc";

interface BrandingContextType {
  appName: string;
  appLogo: string | null;
  primaryColor: string;
  setAppName: (name: string) => void;
  setAppLogo: (logo: string | null) => void;
  setPrimaryColor: (color: string) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: brandingData } = trpc.branding.get.useQuery(undefined, {
    staleTime: Infinity,
  });

  const [appName, setAppNameState] = useState('Sistema');
  const [appLogo, setAppLogoState] = useState<string | null>(null);
  const [primaryColor, setPrimaryColorState] = useState('#4b4897');

  useEffect(() => {
    if (brandingData) {
      setAppNameState(brandingData.appName);
      setAppLogoState(brandingData.appLogoUrl);
      setPrimaryColorState(brandingData.primaryColor);
      
      // Aplicar cor primária dinamicamente ao CSS
      document.documentElement.style.setProperty('--primary', brandingData.primaryColor);
      // Opcional: calcular variantes mais claras/escuras se necessário
    }
  }, [brandingData]);

  const setAppName = (name: string) => setAppNameState(name);
  const setAppLogo = (logo: string | null) => setAppLogoState(logo);
  const setPrimaryColor = (color: string) => {
    setPrimaryColorState(color);
    document.documentElement.style.setProperty('--primary', color);
  };

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  return (
    <BrandingContext.Provider value={{ 
      appName, 
      appLogo, 
      primaryColor,
      setAppName, 
      setAppLogo,
      setPrimaryColor
    }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
