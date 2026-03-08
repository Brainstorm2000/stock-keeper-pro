import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useCreateOrganization, useJoinOrganization } from '@/hooks/useOrganization';
import { Package, Building2, Users, Loader2, Shield, User } from 'lucide-react';
import { LogoUpload } from '@/components/onboarding/LogoUpload';

type OnboardingStep = 'choice' | 'create' | 'join';

export default function Onboarding() {
  const [step, setStep] = useState<OnboardingStep>('choice');
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgLogoUrl, setOrgLogoUrl] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgAddress, setOrgAddress] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [joinRole, setJoinRole] = useState<'admin' | 'user'>('user');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, refreshProfile, hasCompletedOnboarding, isSuperSuperAdmin } = useAuth();
  const createOrg = useCreateOrganization();
  const joinOrg = useJoinOrganization();

  // Redirect if already onboarded
  if (hasCompletedOnboarding) {
    navigate('/dashboard');
    return null;
  }

  // Redirect if not logged in
  if (!user) {
    navigate('/auth');
    return null;
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    setOrgSlug(generateSlug(value));
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !orgSlug.trim() || !fullName.trim()) {
      toast({ title: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await createOrg.mutateAsync({ 
        name: orgName, 
        slug: orgSlug, 
        fullName,
        logo_url: orgLogoUrl || undefined,
        email: orgEmail || undefined,
        address: orgAddress || undefined,
      });
      await refreshProfile();
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !fullName.trim()) {
      toast({ title: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      await joinOrg.mutateAsync({ slug: inviteCode, fullName, role: joinRole });
      await refreshProfile();
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg animate-fade-in">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <Package className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">StockFlow</h1>
                <p className="text-sm text-muted-foreground">Inventory Management</p>
              </div>
            </div>
          </div>

          <Card className="glass-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold text-center">
                Welcome to StockFlow
              </CardTitle>
              <CardDescription className="text-center">
                Get started by creating or joining an organization
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setStep('create')}
              >
                <Building2 className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium">Create Organization</p>
                  <p className="text-xs text-muted-foreground">Start a new organization as Super Admin</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="w-full h-24 flex flex-col items-center justify-center gap-2"
                onClick={() => setStep('join')}
              >
                <Users className="h-8 w-8 text-primary" />
                <div className="text-center">
                  <p className="font-medium">Join Organization</p>
                  <p className="text-xs text-muted-foreground">Join an existing organization with an invite code</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === 'create') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
                <Package className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">StockFlow</h1>
                <p className="text-sm text-muted-foreground">Inventory Management</p>
              </div>
            </div>
          </div>

          <Card className="glass-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-semibold text-center">
                Create Organization
              </CardTitle>
              <CardDescription className="text-center">
                You'll be the Super Admin of this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Your Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgName">Organization Name *</Label>
                  <Input
                    id="orgName"
                    placeholder="Acme Inc."
                    value={orgName}
                    onChange={(e) => handleOrgNameChange(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgSlug">Organization ID (Invite Code) *</Label>
                  <Input
                    id="orgSlug"
                    placeholder="acme-inc"
                    value={orgSlug}
                    onChange={(e) => setOrgSlug(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Share this code with team members to let them join
                  </p>
                </div>

                <LogoUpload
                  value={orgLogoUrl}
                  onChange={setOrgLogoUrl}
                  disabled={isLoading}
                />

                <div className="space-y-2">
                  <Label htmlFor="orgEmail">Organization Email (Optional)</Label>
                  <Input
                    id="orgEmail"
                    type="email"
                    placeholder="contact@acme.com"
                    value={orgEmail}
                    onChange={(e) => setOrgEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgAddress">Organization Address (Optional)</Label>
                  <Textarea
                    id="orgAddress"
                    placeholder="123 Main St, City, Country"
                    value={orgAddress}
                    onChange={(e) => setOrgAddress(e.target.value)}
                    disabled={isLoading}
                    rows={2}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('choice')}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Organization'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Package className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">StockFlow</h1>
              <p className="text-sm text-muted-foreground">Inventory Management</p>
            </div>
          </div>
        </div>

        <Card className="glass-card">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-semibold text-center">
              Join Organization
            </CardTitle>
            <CardDescription className="text-center">
              Enter the invite code provided by your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoinOrg} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Your Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteCode">Invite Code</Label>
                <Input
                  id="inviteCode"
                  placeholder="acme-inc"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-3">
                <Label>Your Role</Label>
                <RadioGroup
                  value={joinRole}
                  onValueChange={(value) => setJoinRole(value as 'admin' | 'user')}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="role-admin"
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      joinRole === 'admin'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="admin" id="role-admin" className="sr-only" />
                    <Shield className={`h-6 w-6 ${joinRole === 'admin' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-medium text-sm ${joinRole === 'admin' ? 'text-primary' : 'text-foreground'}`}>Admin</span>
                    <span className="text-xs text-muted-foreground text-center">Manage inventory</span>
                  </Label>
                  <Label
                    htmlFor="role-user"
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      joinRole === 'user'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="user" id="role-user" className="sr-only" />
                    <User className={`h-6 w-6 ${joinRole === 'user' ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className={`font-medium text-sm ${joinRole === 'user' ? 'text-primary' : 'text-foreground'}`}>Viewer</span>
                    <span className="text-xs text-muted-foreground text-center">View-only access</span>
                  </Label>
                </RadioGroup>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('choice')}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    'Join Organization'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
