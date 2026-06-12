import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useSSLActions } from '@/hooks/ssl/useSSLActions';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Eye, Trash2, AlertCircle } from 'lucide-react';
import { CertificateDetailsDialog } from '@/components/ssl/CertificateDetailsDialog';
import type { Certificate } from '@/lib/api-client';

interface CertificateTableProps {
  certificates: Certificate[];
  onRefresh: () => void;
  onDelete?: (domains: string[]) => void;
  onUpdate?: (domain: string, updates: Partial<Certificate>) => void;
}

export const CertificateTable = ({ certificates, onRefresh, onDelete, onUpdate }: CertificateTableProps) => {
  const { renewCertificate, toggleAutoRenew, deleteCertificate, bulkDeleteCertificates, loading } = useSSLActions();
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const handleRenew = async (domain: string) => {
    try {
      await renewCertificate(domain);
      if (onUpdate) {
        onUpdate(domain, { last_renew_status: 'pending' });
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error('Renew failed:', err);
    }
  };

  const handleToggleAutoRenew = async (domain: string, enabled: boolean) => {
    try {
      await toggleAutoRenew(domain, enabled);
      if (onUpdate) {
        onUpdate(domain, { auto_renew: enabled });
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error('Toggle auto-renew failed:', err);
    }
  };

  const handleViewDetails = (cert: Certificate) => {
    setSelectedCert(cert);
    setDetailsOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCertificate(deleteTarget);
      if (onDelete) {
        onDelete([deleteTarget]);
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      const domainsToDelete = Array.from(selectedDomains);
      await bulkDeleteCertificates(domainsToDelete);
      setSelectedDomains(new Set());
      if (onDelete) {
        onDelete(domainsToDelete);
      } else {
        onRefresh();
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkDeleteOpen(false);
    }
  };

  const toggleSelectDomain = (domain: string) => {
    const newSelected = new Set(selectedDomains);
    if (newSelected.has(domain)) {
      newSelected.delete(domain);
    } else {
      newSelected.add(domain);
    }
    setSelectedDomains(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedDomains.size === certificates.length) {
      setSelectedDomains(new Set());
    } else {
      setSelectedDomains(new Set(certificates.map(c => c.domain)));
    }
  };

  const getStatusBadge = (status: string, isExpiringSoon: boolean) => {
    if (status === 'expired') {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (isExpiringSoon) {
      return <Badge variant="warning">Expiring Soon</Badge>;
    }
    if (status === 'valid') {
      return <Badge className="bg-green-600/10 text-green-600">Valid</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  const getStatusIcon = (status: string, isExpiringSoon: boolean) => {
    if (status === 'expired') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (isExpiringSoon) {
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    }
    if (status === 'valid') {
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
    return null;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <>
      {selectedDomains.size > 0 && (
        <div className="mb-4 flex items-center justify-between p-3 bg-muted rounded-lg">
          <span className="text-sm font-medium">
            {selectedDomains.size} certificate(s) selected
          </span>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkDeleteOpen(true)}
            disabled={loading}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[800px]">
          <thead className="sticky top-0 bg-background/95 backdrop-blur-sm border-b z-10">
            <tr className="text-left text-sm text-muted-foreground">
              <th className="pb-3 pr-4 font-medium w-12">
                <input
                  type="checkbox"
                  checked={selectedDomains.size === certificates.length && certificates.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="pb-3 pr-6 font-medium">Domain</th>
              <th className="pb-3 pr-6 font-medium">Status</th>
              <th className="pb-3 pr-6 font-medium w-[160px]">Issuer</th>
              <th className="pb-3 pr-6 font-medium">Expires</th>
              <th className="pb-3 pr-6 font-medium">Days Left</th>
              <th className="pb-3 pr-6 font-medium min-w-[120px]">Auto Renew</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {certificates.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No certificates found
                </td>
              </tr>
            ) : (
              certificates.map((cert) => (
                <tr key={cert.domain} className="border-b hover:bg-muted/50">
                  <td className="py-4 pr-4">
                    <input
                      type="checkbox"
                      checked={selectedDomains.has(cert.domain)}
                      onChange={() => toggleSelectDomain(cert.domain)}
                      className="rounded"
                    />
                  </td>
                  <td className="py-4 pr-6">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(cert.status, cert.is_expiring_soon)}
                      <span className="font-medium whitespace-nowrap">{cert.domain}</span>
                    </div>
                  </td>
                  <td className="py-4 pr-6">
                    {getStatusBadge(cert.status, cert.is_expiring_soon)}
                  </td>
                  <td className="py-4 pr-6 text-sm w-[160px]">
                    <div className="truncate w-[140px]" title={cert.issuer}>{cert.issuer}</div>
                  </td>
                  <td className="py-4 pr-6 text-sm whitespace-nowrap">{formatDate(cert.expires_at)}</td>
                  <td className="py-4 pr-6">
                    <span
                      className={`text-sm font-medium whitespace-nowrap ${
                        cert.days_until_expiry < 0
                          ? 'text-red-600'
                          : cert.days_until_expiry < 30
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      {cert.days_until_expiry < 0
                        ? 'Expired'
                        : `${cert.days_until_expiry} days`}
                    </span>
                  </td>
                  <td className="py-4 pr-6">
                    <Switch
                      checked={cert.auto_renew}
                      onCheckedChange={(checked) => handleToggleAutoRenew(cert.domain, checked)}
                      disabled={loading}
                    />
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRenew(cert.domain)}
                        disabled={loading}
                      >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Renew
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewDetails(cert)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteTarget(cert.domain)}
                        disabled={loading}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedCert && (
        <CertificateDetailsDialog
          certificate={selectedCert}
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          onRefresh={onRefresh}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-5 bg-muted border-b border-border">
            <div className="flex items-center gap-3 text-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <DialogTitle className="text-lg font-bold">Delete Certificate</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-8 py-6">
            <p className="text-sm text-foreground leading-relaxed">
              Are you sure you want to delete the certificate for <span className="font-medium">{deleteTarget}</span>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button
              variant="ghost"
              className="text-muted-foreground font-bold"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-none px-6 font-bold"
              onClick={handleDeleteConfirm}
              disabled={loading}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-5 bg-muted border-b border-border">
            <div className="flex items-center gap-3 text-foreground">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <DialogTitle className="text-lg font-bold">Delete Certificates</DialogTitle>
            </div>
          </DialogHeader>
          <div className="px-8 py-6">
            <p className="text-sm text-foreground leading-relaxed">
              Are you sure you want to delete <span className="font-medium">{selectedDomains.size} certificate(s)</span>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button
              variant="ghost"
              className="text-muted-foreground font-bold"
              onClick={() => setBulkDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-none px-6 font-bold"
              onClick={handleBulkDeleteConfirm}
              disabled={loading}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
