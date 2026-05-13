import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldAlert, ArrowRight } from "lucide-react";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Invalid email address" }).max(255),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(100),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const currentYear = new Date().getFullYear();

  const {
    signIn,
    signUp,
    user,
    hasCompletedOnboarding,
    isSuperSuperAdmin,
    isOrgDisabled,
    signOut,
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      if (isSuperSuperAdmin) navigate("/admin");
      else if (!isOrgDisabled && hasCompletedOnboarding) navigate("/dashboard");
    }
  }, [
    user,
    hasCompletedOnboarding,
    isSuperSuperAdmin,
    isOrgDisabled,
    navigate,
  ]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) newErrors[error.path[0] as string] = error.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Access Denied",
            description:
              error.message === "Invalid login credentials"
                ? "Invalid email or password."
                : error.message,
            variant: "destructive",
          });
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          toast({
            title: "Sign Up Failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Check Your Email",
            description: "Verification link sent.",
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white dark:bg-[#020817] font-sans antialiased text-[#000B26] dark:text-slate-100 transition-colors duration-300">
      {/* Left Side: Brand Visual (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-10 left-10">
          <img
            src="/stoqkip-logo.png"
            alt="stoqkip logo"
            className="h-20 w-auto object-contain"
          />
        </div>

        <div className="max-w-md space-y-6 z-10">
          <h2 className="text-4xl font-bold tracking-tight leading-[1.1]">
            Precision tools for <span className="text-[#FF9E3D]">modern</span>{" "}
            inventory.
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
            Manage your entire ERP lifecycle from stock tracking to productions
            and sales terminals in one cohesive interface.
          </p>
        </div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#FF9E3D]/10 dark:bg-[#FF9E3D]/5 rounded-full blur-3xl" />
      </div>

      {/* Right Side: Auth Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-[400px] flex flex-col space-y-8">
          {/* --- Mobile Logo Display --- */}
          <div className="lg:hidden flex justify-center mb-2">
            <img
              src="/stoqkip-logo.png"
              alt="stoqkip logo"
              className="h-16 w-auto object-contain"
            />
          </div>

          <div className="flex flex-col space-y-2 text-center lg:text-left">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[#000B26] dark:text-white">
              {isLogin ? "Welcome back" : "Get started"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {isLogin
                ? "Access your dashboard and manage your inventory."
                : "Start your free trial today."}
            </p>
          </div>

          {user && isOrgDisabled ? (
            <Card className="border-destructive/20 bg-destructive/5 dark:bg-destructive/10">
              <CardContent className="pt-6 text-center space-y-4">
                <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
                <div className="space-y-1">
                  <p className="font-semibold text-destructive">
                    Account Disabled
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Your organization access has been revoked. Contact support.
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={signOut}>
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-[10px] uppercase tracking-widest text-slate-500 font-bold"
                  >
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    className={`h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${errors.email ? "border-destructive" : ""}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p className="text-[11px] text-destructive font-semibold uppercase">
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-[10px] uppercase tracking-widest text-slate-500 font-bold"
                  >
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className={`h-11 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 ${errors.password ? "border-destructive" : ""}`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="text-[11px] text-destructive font-semibold uppercase">
                      {errors.password}
                    </p>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-[#FF9E3D] hover:bg-[#e88d30] h-12 text-[#000B26] font-bold shadow-lg shadow-amber-500/10 transition-transform active:scale-[0.98]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#000B26]" />
                ) : (
                  <span className="flex items-center gap-2">
                    {isLogin ? "Sign In" : "Create Account"}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setErrors({});
                  }}
                  className="text-sm font-medium text-slate-500 hover:text-[#FF9E3D] transition-colors"
                  disabled={isLoading}
                ></button>
              </div>
            </form>
          )}

          <footer className="pt-8 text-center border-t border-slate-100 dark:border-slate-900/50">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
              © {currentYear} StoqKip. All rights reserved.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
