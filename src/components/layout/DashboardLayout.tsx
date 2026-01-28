import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, LogOut, User, Shield, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, role, isAdmin, isSuperAdmin, signOut } = useAuth();
  const navigate = useNavigate();

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
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Package className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">StockFlow</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Inventory Management</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant={isSuperAdmin ? 'default' : isAdmin ? 'default' : 'secondary'} className="hidden sm:flex items-center gap-1">
              {isSuperAdmin ? <Crown className="h-3 w-3" /> : isAdmin ? <Shield className="h-3 w-3" /> : <User className="h-3 w-3" />}
              {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Viewer'}
            </Badge>

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
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
