import { useLocation } from "react-router-dom";
import {
  LogOut,
  User,
  Shield,
  Crown,
  Building2,
  Settings,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Wallet,
  PackagePlus,
  Lock,
  Loader2,
  Factory,
  CreditCard,
  BarChart3,
  Users2,
  ClipboardList,
  ScanLine,
  BadgeDollarSign,
  RotateCcw,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useOrganization } from "@/hooks/useOrganization";
import {
  useMyModuleAccess,
  hasAccess,
  AppModule,
} from "@/hooks/useModulePermissions";
import { cn } from "@/lib/utils";
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
} from "@/components/ui/sidebar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  module?: AppModule;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS", icon: ShoppingCart, module: "pos" },
  { href: "/sales", label: "Sales", icon: Receipt, module: "sales" },
  {
    href: "/purchases",
    label: "Purchases",
    icon: PackagePlus,
    module: "purchases",
  },
  { href: "/debts", label: "Debts", icon: BadgeDollarSign, module: "debts" },
  { href: "/returns", label: "Returns", icon: RotateCcw, module: "returns" },
  { href: "/expenses", label: "Expenses", icon: Wallet, module: "expenses" },
  {
    href: "/production",
    label: "Production",
    icon: Factory,
    module: "production",
  },
  {
    href: "/staff",
    label: "Staff",
    icon: Users2,
    module: "staff" as AppModule,
  },
  {
    href: "/attendance",
    label: "Attendance",
    icon: ScanLine,
    module: "staff" as AppModule,
  },
  {
    href: "/action-tracker",
    label: "Action Tracker",
    icon: ClipboardList,
    module: "tasks" as AppModule,
  },
  { href: "/reports", label: "Reports", icon: BarChart3, module: "reports" },
];

interface AppSidebarProps {
  onOpenProfile: () => void;
  onOpenOrgSettings: () => void;
  onOpenPermissions: () => void;
}

export function AppSidebar({
  onOpenProfile,
  onOpenOrgSettings,
  onOpenPermissions,
}: AppSidebarProps) {
  const { user, isSuperAdmin, isAdmin, signOut } = useAuth();
  const { data: organization } = useOrganization();
  const { data: moduleAccess, isLoading: accessLoading } = useMyModuleAccess();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const visibleLinks = navItems.filter((link) => {
    if (!link.module) return true;
    if (accessLoading) return true;
    return hasAccess(moduleAccess, link.module, "view");
  });

  const initials =
    user?.user_metadata?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ||
    user?.email?.slice(0, 2).toUpperCase() ||
    "U";

  return (
    <Sidebar collapsible="icon" className="border-r border-white/5">
      <SidebarHeader className="h-15 flex justify-center bg-[#000B26] dark:bg-[#020817] px-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center shrink-0">
            <img
              src={organization?.logo_url || "/stoqkip-logo.png"}
              alt="StoqKip"
              className="h-10 w-10 object-contain"
            />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-inter text-white tracking-tight leading-none">
                Stoq<span className="text-[#FF9E3D]">Kip</span>
              </h1>
              {organization && (
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate mt-1">
                  {organization.name}
                </p>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-[#000B26] dark:bg-[#020817] px-3 pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {accessLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-[#FF9E3D]" />
                </div>
              ) : (
                visibleLinks.map((item) => {
                  const active = location.pathname === item.href;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "h-11 rounded-xl transition-all duration-200 group relative flex items-center gap-3",
                          active
                            ? "bg-white/10 text-[#FF9E3D] shadow-inner"
                            : "text-slate-400 hover:bg-white/5 hover:text-white",
                        )}
                      >
                        {/* preventScrollReset added to maintain scroll position */}
                        <NavLink to={item.href} end preventScrollReset={true}>
                          <item.icon
                            className={cn(
                              "h-5 w-5 shrink-0 transition-colors",
                              active
                                ? "text-[#FF9E3D]"
                                : "text-slate-400 group-hover:text-[#FF9E3D]",
                            )}
                          />
                          <span className="font-bold text-sm tracking-tight">
                            {item.label}
                          </span>
                          {active && (
                            <div className="absolute right-0 w-1 h-6 bg-[#FF9E3D] rounded-l-full shadow-[0_0_15px_#FF9E3D]" />
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isSuperAdmin && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onOpenOrgSettings}
                    className="h-11 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white flex items-center gap-3"
                  >
                    <Building2 className="h-5 w-5 shrink-0" />
                    <span className="font-bold text-sm tracking-tight">
                      Organization
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={onOpenPermissions}
                    className="h-11 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white flex items-center gap-3"
                  >
                    <Lock className="h-5 w-5 shrink-0" />
                    <span className="font-bold text-sm tracking-tight">
                      Permissions
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    className="h-11 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white"
                  >
                    <NavLink
                      to="/subscription"
                      end
                      preventScrollReset={true}
                      className="flex items-center gap-3"
                    >
                      <CreditCard className="h-5 w-5 shrink-0" />
                      <span className="font-bold text-sm tracking-tight">
                        Subscription
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="bg-[#000B26] dark:bg-[#020817] p-4 border-t border-white/5">
        {!collapsed && (
          <div className="space-y-4 mb-4">
            <div className="flex items-center justify-between">
              <Badge className="bg-[#FF9E3D] text-[#000B26] font-black hover:bg-[#FF9E3D]/90 border-none px-2 py-0.5">
                {isSuperAdmin ? (
                  <Crown className="h-3 w-3 mr-1" />
                ) : isAdmin ? (
                  <Shield className="h-3 w-3 mr-1" />
                ) : (
                  <User className="h-3 w-3 mr-1" />
                )}
                {isSuperAdmin ? "SUPER ADMIN" : isAdmin ? "ADMIN" : "VIEWER"}
              </Badge>
              <ThemeToggle />
            </div>

            <div className="bg-white/5 rounded-2xl p-3 flex items-center gap-3 border border-white/5 shadow-inner">
              <div className="h-10 w-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-black text-xs text-[#FF9E3D] shrink-0">
                {initials}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-black text-white truncate uppercase tracking-tight">
                  {user?.user_metadata?.full_name || "User"}
                </p>
                <p className="text-[10px] text-slate-500 truncate lowercase">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        )}

        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onOpenProfile}
              className="h-11 rounded-xl text-slate-400 hover:bg-white/5 hover:text-white flex items-center gap-3"
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span className="font-bold text-sm tracking-tight">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="h-11 rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-400 flex items-center gap-3"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="font-bold text-sm tracking-tight">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
