import React, { createContext, useContext, useState, useEffect } from 'react';

interface BrandingContextType {
  appName: string;
  appLogo: string | null;
  setAppName: (name: string) => void;
  setAppLogo: (logo: string | null) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [appName, setAppNameState] = useState(() => {
    return localStorage.getItem('maju_app_name') || 'Maju Tasks';
  });
  
  const [appLogo, setAppLogoState] = useState(() => {
    return localStorage.getItem('maju_app_logo') || null;
  });

  const setAppName = (name: string) => {
    setAppNameState(name);
    localStorage.setItem('maju_app_name', name);
  };

  const setAppLogo = (logo: string | null) => {
    setAppLogoState(logo);
    if (logo) {
      localStorage.setItem('maju_app_logo', logo);
    } else {
      localStorage.removeItem('maju_app_logo');
    }
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
