import React, { createContext, useContext, useState, useEffect } from 'react';
import { wafApi } from '../lib/api/client';

interface DemoContextType {
  isDemoMode: boolean;
}

const DemoContext = createContext<DemoContextType>({ isDemoMode: false });

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    wafApi.health.check().then((res) => {
      setIsDemoMode(res.demo === true);
    }).catch(() => {});
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => useContext(DemoContext);
