import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CertificateTable } from '@/components/ssl/CertificateTable';
import { useSSLCertificates } from '@/hooks/ssl/useSSLCertificates';
import { useSSLActions } from '@/hooks/ssl/useSSLActions';
import { RefreshCw, Search, AlertTriangle, CheckCircle, Download, Plus } from 'lucide-react';
import { SkeletonPage } from '@/components/shared/SkeletonLoading';

const SSLManager = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const { certificates, loading, error, refetch, removeCertificates, updateCertificate } = useSSLCertificates();
  const { syncFromFilesystem, issueCertificate, loading: actionsLoading } = useSSLActions();

  const filteredCertificates = certificates.filter((cert) =>
    cert.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const expiringSoonCount = certificates.filter((c) => c.is_expiring_soon).length;
  const expiredCount = certificates.filter((c) => c.status === 'expired').length;
  const validCount = certificates.filter((c) => c.status === 'valid' && !c.is_expiring_soon).length;

  const handleSync = async () => {
    try {
      await syncFromFilesystem();
      refetch();
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  const handleAddDomain = async () => {
    const domain = newDomain.trim();
    if (!domain) {
      setAddError('Domain is required');
      return;
    }
    setAddError(null);
    try {
      await issueCertificate(domain);
      setAddOpen(false);
      setNewDomain('');
      refetch();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to issue certificate');
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <SkeletonPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center text-red-600">
            <p className="font-medium">Failed to load certificates</p>
            <p className="text-sm mt-1">{error}</p>
            <Button onClick={refetch} className="mt-4" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="space-y-3 md:space-y-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">SSL Certificate Manager</h1>
            <p className="text-muted-foreground mt-1">
              Manage SSL certificates and auto-renewal settings
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setAddOpen(true)} className="flex-1 md:flex-none">
              <Plus className="w-4 h-4 mr-2" />
              Add Domain
            </Button>
            <Button onClick={handleSync} variant="outline" disabled={actionsLoading} className="flex-1 md:flex-none">
              <Download className="w-4 h-4 mr-2" />
              {actionsLoading ? 'Syncing...' : 'Sync'}
            </Button>
            <Button onClick={refetch} variant="outline" className="flex-1 md:flex-none">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Valid Certificates</p>
              <p className="text-2xl font-bold mt-1">{validCount}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expiring Soon</p>
              <p className="text-2xl font-bold mt-1">{expiringSoonCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-500" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Expired</p>
              <p className="text-2xl font-bold mt-1">{expiredCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </Card>
      </div>

      {expiringSoonCount > 0 && (
        <Card className="p-4 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-yellow-900 dark:text-yellow-100">
                {expiringSoonCount} certificate{expiringSoonCount > 1 ? 's' : ''} expiring soon
              </p>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                Certificates expiring within 30 days. Enable auto-renew or renew manually.
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 md:p-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <CertificateTable 
          certificates={filteredCertificates} 
          onRefresh={refetch}
          onDelete={removeCertificates}
          onUpdate={updateCertificate}
        />
      </Card>

      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setNewDomain(''); setAddError(null); } }}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-5 bg-muted border-b border-border">
            <DialogTitle className="text-lg font-bold">Add SSL Domain</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Domain</label>
              <Input
                placeholder="example.com"
                value={newDomain}
                onChange={(e) => { setNewDomain(e.target.value); setAddError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); }}
                disabled={actionsLoading}
              />
              {addError && <p className="text-xs text-destructive">{addError}</p>}
            </div>
            <p className="text-xs text-muted-foreground">
              acme.sh will issue a Let's Encrypt certificate via standalone HTTP challenge on port 8080. Make sure the domain points to this server and port 8080 is accessible.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border">
            <Button variant="ghost" className="font-bold text-muted-foreground" onClick={() => setAddOpen(false)} disabled={actionsLoading}>
              Cancel
            </Button>
            <Button onClick={handleAddDomain} disabled={actionsLoading || !newDomain.trim()} className="px-6 font-bold">
              {actionsLoading ? 'Issuing...' : 'Issue Certificate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SSLManager;
