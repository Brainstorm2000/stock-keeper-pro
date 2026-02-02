import { ReactNode, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { LogOut, User, Shield, Crown, Building2, Settings, LayoutDashboard, ShoppingCart, Receipt, Wallet, PackagePlus, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useOrganization } from '@/hooks/useOrganization';
import { ProfileSettingsDialog } from '@/components/profile/ProfileSettingsDialog';
import { ModulePermissionsDialog } from '@/components/permissions/ModulePermissionsDialog';
import { useMyModuleAccess, hasAccess, AppModule } from '@/hooks/useModulePermissions';
import { cn } from '@/lib/utils';
import faviconIcon from '/favicon.png';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: AppModule;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, role, isAdmin, isSuperAdmin, signOut } = useAuth();
  const { data: organization } = useOrganization();
  const { data: moduleAccess, isLoading: accessLoading } = useMyModuleAccess();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);

  const navLinks: NavLink[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/pos', label: 'POS', icon: ShoppingCart, module: 'pos' },
    { href: '/sales', label: 'Sales', icon: Receipt, module: 'sales' },
    { href: '/purchases', label: 'Purchases', icon: PackagePlus, module: 'purchases' },
    { href: '/expenses', label: 'Expenses', icon: Wallet, module: 'expenses' },
  ];

  // Filter links based on module access
  const visibleLinks = navLinks.filter((link) => {
    // Dashboard is always visible
    if (!link.module) return true;
    // If still loading or super admin, show all
    if (accessLoading || isSuperAdmin) return true;
    // Check if user has at least view access
    return hasAccess(moduleAccess, link.module, 'view');
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const initials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {organization?.logo_url ? (
              <img
                src={organization.logo_url}
                alt={organization.name}
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <img
                src={faviconIcon}
                alt="StockFlow"
                className="h-10 w-10 rounded-xl object-cover"
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">StockFlow</h1>
              {organization && (
                <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {organization.name}
                </p>
              )}
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 ml-6">
              {accessLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                visibleLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      location.pathname === link.href
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    )}
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                ))
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <Badge variant={isSuperAdmin ? 'default' : isAdmin ? 'default' : 'secondary'} className="hidden sm:flex items-center gap-1">
              {isSuperAdmin ? <Crown className="h-3 w-3" /> : isAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Viewer'}
            </Badge>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.user_metadata?.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="sm:hidden">
                  <Badge variant={isSuperAdmin ? 'default' : isAdmin ? 'default' : 'secondary'} className="flex items-center gap-1">
                    {isSuperAdmin ? <Crown className="h-3 w-3" /> : isAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
                    {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Viewer'}
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setProfileDialogOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Profile Settings
                </DropdownMenuItem>
                {isSuperAdmin && (
                  <DropdownMenuItem onClick={() => setPermissionsDialogOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    Module Permissions
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <nav className="md:hidden border-b bg-card sticky top-16 z-40">
        <div className="container mx-auto px-4 flex overflow-x-auto gap-1 py-2">
          {accessLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
          ) : (
            visibleLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors',
                  location.pathname === link.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            ))
          )}
        </div>
      </nav>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>

      <ProfileSettingsDialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen} />
      <ModulePermissionsDialog open={permissionsDialogOpen} onOpenChange={setPermissionsDialogOpen} />
    </div>
  );
}
