import React, { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from "@/lib/trpc";

interface BrandingContextType {
  appName: string;
  appLogo: string | null;
  setAppName: (name: string) => void;
  setAppLogo: (logo: string | null) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: brandingData } = trpc.branding.get.useQuery(undefined, {
    staleTime: Infinity, // Mantém os dados por muito tempo
  });

  const [appName, setAppNameState] = useState('Maju Tasks');
  const [appLogo, setAppLogoState] = useState<string | null>(null);

  useEffect(() => {
    if (brandingData) {
      setAppNameState(brandingData.appName);
      setAppLogoState(brandingData.appLogoUrl);
    }
  }, [brandingData]);

  const setAppName = (name: string) => {
    setAppNameState(name);
  };

  const setAppLogo = (logo: string | null) => {
    setAppLogoState(logo);
  };

  useEffect(() => {
    document.title = appName;
  }, [appName]);

  return (
    <BrandingContext.Provider value={{ appName, appLogo, setAppName, setAppLogo }}>
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
