import { useState, useEffect, useRef } from 'react';
import { wafApi } from '@/lib/api-client';
import type { Certificate } from '@/lib/api-client';

const POLL_INTERVAL = 5000; // 5 seconds

export const useSSLCertificates = (appId?: string) => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hasPending = (certs: Certificate[]) =>
    certs.some(c => c.status === 'pending' || c.last_renew_status === 'pending');

  const fetchCertificates = async () => {
    try {
      setError(null);

      const data = await wafApi.certificates.list(appId);
      setCertificates(data || []);

      // Auto-poll while any cert is pending
      if (hasPending(data || [])) {
        if (!pollRef.current) {
          pollRef.current = setInterval(fetchCertificates, POLL_INTERVAL);
        }
      } else {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
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

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
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
