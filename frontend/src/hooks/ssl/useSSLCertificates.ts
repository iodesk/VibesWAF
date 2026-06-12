import { useState, useEffect } from 'react';
import { wafApi } from '@/lib/api-client';
import type { Certificate } from '@/lib/api-client';

export const useSSLCertificates = (appId?: string) => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await wafApi.certificates.list(appId);
      setCertificates(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const removeCertificates = (domains: string[]) => {
    setCertificates(prev => prev.filter(cert => !domains.includes(cert.domain)));
  };

  const updateCertificate = (domain: string, updates: Partial<Certificate>) => {
    setCertificates(prev => prev.map(cert => 
      cert.domain === domain ? { ...cert, ...updates } : cert
    ));
  };

  useEffect(() => {
    fetchCertificates();
  }, [appId]);

  return {
    certificates,
    loading,
    error,
    refetch: fetchCertificates,
    removeCertificates,
    updateCertificate,
  };
};
