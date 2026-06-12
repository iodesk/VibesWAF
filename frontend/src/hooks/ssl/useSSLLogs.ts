import { useState, useEffect } from 'react';
import { wafApi } from '@/lib/api-client';
import type { CertificateLog } from '@/lib/api-client';

export const useSSLLogs = (domain: string, limit: number = 50) => {
  const [logs, setLogs] = useState<CertificateLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!domain) {
      setLogs([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const data = await wafApi.certificates.getLogs(domain, limit);
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [domain, limit]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
  };
};
