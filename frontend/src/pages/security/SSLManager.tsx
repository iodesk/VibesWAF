import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CertificateTable } from '@/components/ssl/CertificateTable';
import { useSSLCertificates } from '@/hooks/ssl/useSSLCertificates';
import { useSSLActions } from '@/hooks/ssl/useSSLActions';
import { RefreshCw, Search, AlertTriangle, CheckCircle, Download, Plus, Copy, Check } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { SkeletonPage } from '@/components/shared/SkeletonLoading';
import type { WildcardSetupResponse } from '@/lib/api-client';

const SSLManager = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [useWildcard, setUseWildcard] = useState(false);
  const [wildcardMethod, setWildcardMethod] = useState<'persist' | 'dns'>('persist');
  const [addError, setAddError] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardDomain, setWizardDomain] = useState('');
  const [wildcardSetup, setWildcardSetup] = useState<WildcardSetupResponse | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [copied, setCopied] = useState(false);
  const { certificates, loading, error, refetch, removeCertificates, updateCertificate } = useSSLCertificates();
  const { issueCertificate, enableWildcard, verifyWildcardDNS, issueWildcard, syncFromFilesystem, loading: actionsLoading } = useSSLActions();
  const { addToast } = useToast();

  const filteredCertificates = certificates.filter((cert) =>
    cert.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const expiringSoonCount = certificates.filter((c) => c.is_expiring_soon).length;
  const expiredCount = certificates.filter((c) => c.status === 'expired').length;
  const validCount = certificates.filter((c) => c.status === 'valid' && !c.is_expiring_soon).length;

  const handleSyncFilesystem = async () => {
    try {
      await syncFromFilesystem();
      addToast('Certificates synced from filesystem', 'success');
      refetch();
    } catch (err: any) {
      addToast(err?.message || 'Sync failed', 'error');
    }
  };

  const handleAddDomain = async () => {
    const domain = newDomain.trim();
    if (!domain) {
      setAddError('Domain is required');
      return;
    }
    setAddError(null);

    if (useWildcard) {
      const wildcardPattern = /^\*?\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?){1,2}$/;
      const checkDomain = domain.startsWith('*.') ? domain : '*.' + domain;
      if (!wildcardPattern.test(checkDomain)) {
        setAddError('Only *.domain.com or *.sub.domain.com are supported');
        return;
      }
      try {
        const resp = await enableWildcard(domain, wildcardMethod);
        if (wildcardMethod === 'dns' && !resp) {
          addToast('Wildcard certificate issuance initiated', 'success');
          handleCloseWizard();
          refetch();
          return;
        }
        setWizardDomain(domain);
        setWildcardSetup(resp);
        setWizardStep(1);
      } catch (err: any) {
        setAddError(err?.message || 'Failed to enable wildcard');
      }
      return;
    }

    try {
      await issueCertificate(domain);
      addToast('Certificate issuance initiated', 'success');
      handleCloseWizard();
      refetch();
    } catch (err: any) {
      setAddError(err?.message || 'Failed to issue certificate');
    }
  };

  const handleVerifyDNS = async () => {
    setVerifying(true);
    try {
      const resp = await verifyWildcardDNS(wizardDomain);
      if (resp.verified) {
        setWizardStep(2);
        addToast('DNS record verified', 'success');
      } else {
        addToast(resp.message || 'DNS record not found yet. Wait 1-5 minutes and try again.', 'error');
      }
    } catch (err: any) {
      addToast(err?.message || 'Verification failed', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleIssueWildcard = async () => {
    setIssuing(true);
    try {
      await issueWildcard(wizardDomain);
      addToast('Wildcard certificate issuance initiated', 'success');
      setWizardStep(3);
      refetch();
    } catch (err: any) {
      addToast(err?.message || 'Failed to issue wildcard certificate', 'error');
    } finally {
      setIssuing(false);
    }
  };

  const handleCopyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseWizard = () => {
    setAddOpen(false);
    setNewDomain('');
    setUseWildcard(false);
    setWildcardMethod('persist');
    setWizardStep(0);
    setWizardDomain('');
    setWildcardSetup(null);
    setCopied(false);
    setAddError(null);
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
            <Button onClick={handleSyncFilesystem} variant="outline" disabled={actionsLoading} className="flex-1 md:flex-none">
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

      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) handleCloseWizard(); }}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl">
          <DialogHeader className="px-6 py-5 bg-muted border-b border-border">
            <DialogTitle className="text-lg font-bold">
              {wizardStep === 0 && 'Add SSL Domain'}
              {wizardStep === 1 && 'Wildcard DNS Setup — Step 1 of 2'}
              {wizardStep === 2 && 'Wildcard DNS Setup — Step 2 of 2'}
              {wizardStep === 3 && 'Wildcard Certificate Issued'}
            </DialogTitle>
          </DialogHeader>

          {wizardStep === 0 && (
            <div className="px-6 py-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Domain</label>
                <Input
                  placeholder="example.com"
                  value={newDomain}
                  onChange={(e) => { setNewDomain(e.target.value.replace(/^\*\./, '')); setAddError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddDomain(); }}
                  disabled={actionsLoading}
                />
                {addError && <p className="text-xs text-destructive">{addError}</p>}
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Use Wildcard DNS</label>
                  <p className="text-xs text-muted-foreground">
                    Issue *.domain cert via DNS challenge
                  </p>
                </div>
                <Switch
                  checked={useWildcard}
                  onCheckedChange={setUseWildcard}
                  disabled={actionsLoading}
                />
              </div>
              {useWildcard && (
                <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                  <label className="text-xs font-medium text-muted-foreground">Method</label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="wildcard-method"
                        value="persist"
                        checked={wildcardMethod === 'persist'}
                        onChange={() => setWildcardMethod('persist')}
                        className="mt-1"
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">DNS Persist</p>
                        <p className="text-xs text-muted-foreground">
                          Manual TXT record once, auto-renew forever. Zero API dependency.
                        </p>
                        <p className="text-xs text-yellow-600">
                          Waiting for Let's Encrypt production support.
                        </p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="wildcard-method"
                        value="dns"
                        checked={wildcardMethod === 'dns'}
                        onChange={() => setWildcardMethod('dns')}
                        className="mt-1"
                      />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">DNS (Cloudflare)</p>
                        <p className="text-xs text-muted-foreground">
                          Fully automatic via Cloudflare API. Requires CF_Token and CF_Email in .env.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {!useWildcard
                  ? "acme.sh will issue a Let's Encrypt certificate via standalone HTTP challenge on port 8080."
                  : wildcardMethod === 'persist'
                  ? 'DNS persist: requires 1 manual TXT record. Renewals fully automatic.'
                  : 'Cloudflare DNS-01: fully automatic. No manual steps.'}
              </p>
            </div>
          )}

          {wizardStep === 1 && wildcardSetup && (
            <div className="px-6 py-6 space-y-4">
              <p className="text-sm text-muted-foreground">
                Add this TXT record to your DNS provider ({wildcardSetup.domain}):
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm font-mono font-medium truncate">{wildcardSetup.txt_name}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleCopyValue(wildcardSetup.txt_name)} className="ml-2 flex-shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs text-muted-foreground">Type</p>
                    <p className="text-sm font-mono font-medium">TXT</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs text-muted-foreground">Value</p>
                    <p className="text-sm font-mono font-medium break-all leading-relaxed">{wildcardSetup.txt_value}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleCopyValue(wildcardSetup.txt_value)} className="ml-2 flex-shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>DNS Provider:</strong> Add the TXT record above. Wait 1-5 minutes for propagation, then click Verify.
                </p>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="px-6 py-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">DNS record verified</p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    Ready to issue wildcard certificate for *.{wizardDomain}
                  </p>
                </div>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="px-6 py-6 space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Wildcard certificate issued!</p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    *.{wizardDomain} is now covered. Auto-renewal enabled.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="px-6 py-4 bg-muted/30 border-t border-border">
            {wizardStep === 0 && (
              <>
                <Button variant="ghost" className="font-bold text-muted-foreground" onClick={handleCloseWizard} disabled={actionsLoading}>
                  Cancel
                </Button>
                <Button onClick={handleAddDomain} disabled={actionsLoading || !newDomain.trim()} className="px-6 font-bold">
                  {actionsLoading ? 'Processing...' : 'Next'}
                </Button>
              </>
            )}
            {wizardStep === 1 && (
              <>
                <Button variant="ghost" className="font-bold text-muted-foreground" onClick={handleCloseWizard} disabled={verifying}>
                  Cancel
                </Button>
                <Button onClick={handleVerifyDNS} disabled={verifying} className="px-6 font-bold">
                  {verifying ? 'Checking...' : 'Verify DNS'}
                </Button>
              </>
            )}
            {wizardStep === 2 && (
              <>
                <Button variant="ghost" className="font-bold text-muted-foreground" onClick={handleCloseWizard} disabled={issuing}>
                  Cancel
                </Button>
                <Button onClick={handleIssueWildcard} disabled={issuing} className="px-6 font-bold">
                  {issuing ? 'Issuing...' : 'Issue Certificate'}
                </Button>
              </>
            )}
            {wizardStep === 3 && (
              <Button onClick={handleCloseWizard} className="px-6 font-bold w-full">
                Done
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SSLManager;
