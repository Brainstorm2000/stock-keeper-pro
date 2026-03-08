import { ReactNode, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { ProfileSettingsDialog } from '@/components/profile/ProfileSettingsDialog';
import { ModulePermissionsDialog } from '@/components/permissions/ModulePermissionsDialog';
import { OrganizationSettingsDialog } from '@/components/organization/OrganizationSettingsDialog';
import { SubscriptionBanner } from '@/components/subscription/SubscriptionBanner';
import { SubscriptionGuard } from '@/components/subscription/SubscriptionGuard';

interface DashboardLayoutProps {
  children: ReactNode;
}

// Pages that should remain accessible even when subscription is expired
const UNGUARDED_PATHS = ['/subscription'];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [orgSettingsDialogOpen, setOrgSettingsDialogOpen] = useState(false);
  const location = useLocation();

  const isUnguarded = UNGUARDED_PATHS.includes(location.pathname);

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
            {isUnguarded ? children : (
              <SubscriptionGuard>{children}</SubscriptionGuard>
            )}
          </main>
        </div>
      </div>

      <ProfileSettingsDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
      <ModulePermissionsDialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen} />
      <OrganizationSettingsDialog open={orgSettingsDialogOpen} onOpenChange={setOrgSettingsDialogOpen} />
    </SidebarProvider>
  );
}
