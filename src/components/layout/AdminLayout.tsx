import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, LogOut, Building2, Users, LayoutDashboard, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/organizations', label: 'Organizations', icon: Building2 },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/onboarding', label: 'Onboarding', icon: BookOpen },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isSuperSuperAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && (!user || !isSuperSuperAdmin)) {
      navigate('/admin-login');
    }
  }, [user, isSuperSuperAdmin, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isSuperSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar-background text-sidebar-foreground flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-4 flex items-center gap-3 border-b border-sidebar-border">
          <div className="h-8 w-8 rounded-lg bg-destructive flex items-center justify-center">
            <ShieldAlert className="h-5 w-5 text-destructive-foreground" />
          </div>
          <span className="font-bold text-sm">Super Admin</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => navigate(item.href)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                location.pathname === item.href
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="flex items-center justify-between px-3">
            <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>
            <ThemeToggle />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="w-full justify-start text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
