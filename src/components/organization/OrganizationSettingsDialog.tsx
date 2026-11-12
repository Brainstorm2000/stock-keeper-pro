import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useOrganization, useUpdateOrganization } from '@/hooks/useOrganization';
import type { ReceiptPaperSize } from '@/hooks/useOrganization';
import { LogoUpload } from '@/components/onboarding/LogoUpload';
import { Loader2, Building2, CreditCard } from 'lucide-react';
import { PaymentMethodsDialog } from '@/components/organization/PaymentMethodsDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface OrganizationSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrganizationSettingsDialog({ open, onOpenChange }: OrganizationSettingsDialogProps) {
  const { data: organization, isLoading } = useOrganization();
  const updateOrganization = useUpdateOrganization();
  const { toast } = useToast();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [receiptPaperSize, setReceiptPaperSize] = useState<ReceiptPaperSize>('80mm');
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);

  // Sync state with organization data when dialog opens
  useEffect(() => {
    if (organization && open) {
      setName(organization.name || '');
      setEmail(organization.email || '');
      setAddress(organization.address || '');
      setLogoUrl(organization.logo_url || '');
      setReceiptPaperSize(organization.receipt_paper_size || '80mm');
    }
  }, [organization, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organization) return;
    
    if (!name.trim()) {
      toast({ title: 'Organization name is required', variant: 'destructive' });
      return;
    }

    updateOrganization.mutate(
      {
        id: organization.id,
        name: name.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        logo_url: logoUrl || null,
        receipt_paper_size: receiptPaperSize,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  const isUpdating = updateOrganization.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organization Settings
          </DialogTitle>
          <DialogDescription>
            Update your organization's profile and contact information
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <LogoUpload
              value={logoUrl}
              onChange={setLogoUrl}
              disabled={isUpdating}
            />

            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name *</Label>
              <Input
                id="orgName"
                placeholder="My Company"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgEmail">Contact Email</Label>
              <Input
                id="orgEmail"
                type="email"
                placeholder="contact@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isUpdating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgAddress">Address</Label>
              <Textarea
                id="orgAddress"
                placeholder="123 Business Street, City, Country"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={isUpdating}
                rows={3}
              />
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div>
                <h3 className="font-semibold">Receipt Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Receipts use the organization name, logo, address, and email above.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="receiptPaperSize">Paper size</Label>
                <Select
                  value={receiptPaperSize}
                  onValueChange={(value: ReceiptPaperSize) => setReceiptPaperSize(value)}
                  disabled={isUpdating}
                >
                  <SelectTrigger id="receiptPaperSize">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="80mm">80 mm (default)</SelectItem>
                    <SelectItem value="57mm">57 mm</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* <div className="space-y-2">
              <Label htmlFor="orgSlug">Organization Code</Label>
              <Input
                id="orgSlug"
                value={organization?.slug || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                This code is used by team members to join your organization
              </p>
            </div> */}

            <Button type="submit" disabled={isUpdating} className="w-full">
              {isUpdating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setPaymentMethodsOpen(true)}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Payment Methods
            </Button>

          </form>
        )}
      </DialogContent>
      <PaymentMethodsDialog
        open={paymentMethodsOpen}
        onOpenChange={setPaymentMethodsOpen}
      />
    </Dialog>
  );
}
