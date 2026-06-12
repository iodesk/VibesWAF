import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSSLActions } from '@/hooks/ssl/useSSLActions';
import { useSSLLogs } from '@/hooks/ssl/useSSLLogs';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import type { Certificate } from '@/lib/api-client';

interface CertificateDetailsDialogProps {
  certificate: Certificate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export const CertificateDetailsDialog = ({
  certificate,
  open,
  onOpenChange,
  onRefresh,
}: CertificateDetailsDialogProps) => {
  const { validateCertificate, renewCertificate, loading } = useSSLActions();
  const { logs, loading: logsLoading } = useSSLLogs(certificate.domain, 20);
  const [validating, setValidating] = useState(false);

  const handleValidate = async () => {
    try {
      setValidating(true);
      await validateCertificate(certificate.domain);
      onRefresh();
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setValidating(false);
    }
  };

  const handleRenew = async () => {
    try {
      await renewCertificate(certificate.domain);
      onRefresh();
    } catch (err) {
      console.error('Renewal failed:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLogStatusBadge = (status: string) => {
    if (status === 'success') {
      return <Badge variant="success">Success</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    if (status === 'pending') {
      return <Badge variant="secondary">Pending</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Certificate Details</h2>
            <p className="text-sm text-muted-foreground mt-1">{certificate.domain}</p>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge
                      variant={
                        certificate.status === 'valid'
                          ? 'success'
                          : certificate.is_expiring_soon
                          ? 'warning'
                          : 'destructive'
                      }
                    >
                      {certificate.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Issuer</label>
                  <p className="mt-1 text-sm">{certificate.issuer}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expires At</label>
                  <p className="mt-1 text-sm">{formatDate(certificate.expires_at)}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Days Until Expiry</label>
                  <p
                    className={`mt-1 text-sm font-medium ${
                      certificate.days_until_expiry < 0
                        ? 'text-red-600'
                        : certificate.days_until_expiry < 30
                        ? 'text-yellow-600'
                        : 'text-green-600'
                    }`}
                  >
                    {certificate.days_until_expiry < 0
                      ? 'Expired'
                      : `${certificate.days_until_expiry} days`}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Auto Renew</label>
                  <p className="mt-1 text-sm">
                    {certificate.auto_renew ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" />
                        Enabled
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        Disabled
                      </span>
                    )}
                  </p>
                </div>

                {certificate.last_renew_at && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Renewed</label>
                    <p className="mt-1 text-sm">{formatDate(certificate.last_renew_at)}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleValidate}
                  disabled={validating || loading}
                  variant="outline"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {validating ? 'Validating...' : 'Validate'}
                </Button>
                <Button onClick={handleRenew} disabled={loading}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Renew Now
                </Button>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Activity Log</h3>
                {logsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading logs...</p>
                ) : logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity logs</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 border rounded-lg text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">{log.action}</span>
                            {getLogStatusBadge(log.status)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{log.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-6 border-t flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
