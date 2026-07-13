import React, { createContext, useContext, useState, useEffect } from 'react';
import { wafApi } from '../lib/api/client';

interface DemoContextType {
  isDemoMode: boolean;
  demoUser: string;
  demoPass: string;
  serverIP: string;
}

const DemoContext = createContext<DemoContextType>({
  isDemoMode: false,
  demoUser: '',
  demoPass: '',
  serverIP: '',
});

export const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [demoUser, setDemoUser] = useState('');
  const [demoPass, setDemoPass] = useState('');
  const [serverIP, setServerIP] = useState('');

  useEffect(() => {
    wafApi.health.check().then((res) => {
      setIsDemoMode(res.demo === true);
      if (res.demo) {
        setDemoUser(res.demo_user ?? '');
        setDemoPass(res.demo_pass ?? '');
        setServerIP(res.server_ip ?? '');
      }
    }).catch(() => {});
  }, []);

  return (
    <DemoContext.Provider value={{ isDemoMode, demoUser, demoPass, serverIP }}>
      {children}
    </DemoContext.Provider>
  );
};

export const useDemo = () => useContext(DemoContext);
