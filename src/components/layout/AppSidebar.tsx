import { useLocation } from 'react-router-dom';
import { LogOut, User, Shield, Crown, Building2, Settings, LayoutDashboard, ShoppingCart, Receipt, Wallet, PackagePlus, Lock, Loader2, Factory, CreditCard, BarChart3, Users2, ClipboardList, ScanLine, BadgeDollarSign, RotateCcw } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { useOrganization } from '@/hooks/useOrganization';
import { useMyModuleAccess, hasAccess, AppModule } from '@/hooks/useModulePermissions';
import faviconIcon from '/favicon.png';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: AppModule;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'POS', icon: ShoppingCart, module: 'pos' },
  { href: '/sales', label: 'Sales', icon: Receipt, module: 'sales' },
  { href: '/purchases', label: 'Purchases', icon: PackagePlus, module: 'purchases' },
  { href: '/debts', label: 'Debts', icon: BadgeDollarSign, module: 'sales' },
  { href: '/returns', label: 'Returns', icon: RotateCcw, module: 'sales' },
  { href: '/expenses', label: 'Expenses', icon: Wallet, module: 'expenses' },
  { href: '/production', label: 'Production', icon: Factory, module: 'production' },
  { href: '/staff', label: 'Staff', icon: Users2, module: 'staff' as AppModule },
  { href: '/attendance', label: 'Attendance', icon: ScanLine, module: 'staff' as AppModule },
  { href: '/action-tracker', label: 'Action Tracker', icon: ClipboardList, module: 'tasks' as AppModule },
  { href: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
];

interface AppSidebarProps {
  onOpenProfile: () => void;
  onOpenOrgSettings: () => void;
  onOpenPermissions: () => void;
}

export function AppSidebar({ onOpenProfile, onOpenOrgSettings, onOpenPermissions }: AppSidebarProps) {
  const { user, isSuperAdmin, isAdmin, signOut } = useAuth();
  const { data: organization } = useOrganization();
  const { data: moduleAccess, isLoading: accessLoading } = useMyModuleAccess();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const visibleLinks = navItems.filter((link) => {
    if (!link.module) return true;
    if (accessLoading) return true;
    return hasAccess(moduleAccess, link.module, 'view');
  });

  const initials = user?.user_metadata?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || user?.email?.slice(0, 2).toUpperCase() || 'U';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          {organization?.logo_url ? (
            <img src={organization.logo_url} alt={organization.name} className="h-8 w-8 rounded-lg object-cover shrink-0" />
          ) : (
            <img src={faviconIcon} alt="StockFlow" className="h-8 w-8 rounded-lg object-cover shrink-0" />
          )}
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-sidebar-foreground truncate">StockFlow</h1>
              {organization && (
                <p className="text-xs text-sidebar-foreground/60 truncate flex items-center gap-1">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {organization.name}
                </p>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {accessLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-sidebar-foreground/60" />
                </div>
              ) : (
                visibleLinks.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                      <NavLink to={item.href} end>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={onOpenOrgSettings}>
                    <Building2 className="h-4 w-4" />
                    <span>Organization</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={onOpenPermissions}>
                    <Lock className="h-4 w-4" />
                    <span>Permissions</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/subscription'}>
                    <NavLink to="/subscription" end>
                      <CreditCard className="h-4 w-4" />
                      <span>Subscription</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed && (
          <>
            <div className="flex items-center justify-between mb-2">
              <Badge variant={isSuperAdmin ? 'default' : isAdmin ? 'default' : 'secondary'} className="text-xs">
                {isSuperAdmin ? <Crown className="h-3 w-3 mr-1" /> : isAdmin ? <Shield className="h-3 w-3 mr-1" /> : <User className="h-3 w-3 mr-1" />}
                {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Viewer'}
              </Badge>
              <ThemeToggle />
            </div>
            <Separator className="mb-2 bg-sidebar-border" />
            <div className="flex items-center gap-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-medium text-sidebar-foreground shrink-0">
                {initials}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.user_metadata?.full_name || 'User'}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{user?.email}</p>
              </div>
            </div>
          </>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onOpenProfile}>
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
