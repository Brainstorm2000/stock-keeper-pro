import { ReactNode, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { ProfileSettingsDialog } from '@/components/profile/ProfileSettingsDialog';
import { ModulePermissionsDialog } from '@/components/permissions/ModulePermissionsDialog';
import { OrganizationSettingsDialog } from '@/components/organization/OrganizationSettingsDialog';
import { SubscriptionBanner } from '@/components/subscription/SubscriptionBanner';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [orgSettingsDialogOpen, setOrgSettingsDialogOpen] = useState(false);
  const { user, loading, hasCompletedOnboarding, isOrgDisabled } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user || isOrgDisabled) {
      navigate('/auth', { replace: true });
    } else if (hasCompletedOnboarding === false) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, loading, hasCompletedOnboarding, isOrgDisabled, navigate]);

  if (loading || !user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar
          onOpenProfile={() => setProfileDialogOpen(true)}
          onOpenOrgSettings={() => setOrgSettingsDialogOpen(true)}
          onOpenPermissions={() => setPermissionsDialogOpen(true)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-50 h-12 flex items-center border-b bg-background/80 backdrop-blur-sm px-4">
            <SidebarTrigger />
          </header>

          <main className="flex-1 p-4 md:p-6 space-y-4">
            <SubscriptionBanner />
            {children}
          </main>
        </div>
      </div>

      <ProfileSettingsDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
      <ModulePermissionsDialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen} />
      <OrganizationSettingsDialog open={orgSettingsDialogOpen} onOpenChange={setOrgSettingsDialogOpen} />
    </SidebarProvider>
  );
}
