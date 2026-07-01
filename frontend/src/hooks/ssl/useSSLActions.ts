import { useState } from 'react';
import { wafApi } from '@/lib/api-client';

export const useSSLActions = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const renewCertificate = async (domain: string) => {
    try {
      setLoading(true);
      setError(null);

      return await wafApi.certificates.renew(domain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const issueCertificate = async (domain: string, appId?: string) => {
    try {
      setLoading(true);
      setError(null);

      return await wafApi.certificates.issue(domain, appId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const validateCertificate = async (domain: string) => {
    try {
      setLoading(true);
      setError(null);

      return await wafApi.certificates.validate(domain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const toggleAutoRenew = async (domain: string, enabled: boolean) => {
    try {
      setLoading(true);
      setError(null);

      return await wafApi.certificates.toggleAutoRenew(domain, enabled);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const syncFromFilesystem = async () => {
    try {
      setLoading(true);
      setError(null);

      return await wafApi.certificates.syncFromFilesystem();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteCertificate = async (domain: string) => {
    try {
      setLoading(true);
      setError(null);

      return await wafApi.certificates.delete(domain);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const bulkDeleteCertificates = async (domains: string[]) => {
    try {
      setLoading(true);
      setError(null);

      return await wafApi.certificates.bulkDelete(domains);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    issueCertificate,
    renewCertificate,
    validateCertificate,
    toggleAutoRenew,
    syncFromFilesystem,
    deleteCertificate,
    bulkDeleteCertificates,
    loading,
    error,
  };
};
