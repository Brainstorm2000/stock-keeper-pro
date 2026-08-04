import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del, createStore } from "idb-keyval";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Sales from "./pages/Sales";
import Purchases from "./pages/Purchases";
import Expenses from "./pages/Expenses";
import Production from "./pages/Production";
import Reports from "./pages/Reports";
import StaffManagement from "./pages/StaffManagement";
import Attendance from "./pages/Attendance";
import ActionTracker from "./pages/ActionTracker";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminOrganizations from "./pages/AdminOrganizations";
import AdminPricing from "./pages/AdminPricing";
import AdminBilling from "./pages/AdminBilling";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";
import Debts from "./pages/Debts";
import Returns from "./pages/Returns";
import Damages from "./pages/Damages";
import { OfflineBanner } from "@/components/OfflineBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Serve cached data and still attempt requests while offline
      networkMode: "offlineFirst",
      gcTime: 1000 * 60 * 60 * 24, // keep cache for a day so screens load offline
      staleTime: 1000 * 30,
      retry: 1,
    },
    mutations: {
      // Let mutations run so the offline interceptor can queue them
      networkMode: "offlineFirst",
    },
  },
});

const idbStore = createStore("stockflow-offline", "query-cache");
const persister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => get<string>(key, idbStore).then((v) => v ?? null),
    setItem: (key, value) => set(key, value, idbStore),
    removeItem: (key) => del(key, idbStore),
  },
  key: "stockflow-query-cache",
  throttleTime: 2000,
});

const App = () => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 }}
  >
    <ThemeProvider defaultTheme="system" storageKey="stockflow-theme">
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <OfflineBanner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/pos" element={<POS />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/purchases" element={<Purchases />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/production" element={<Production />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/staff" element={<StaffManagement />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/action-tracker" element={<ActionTracker />} />
              <Route path="/subscription" element={<Subscription />} />
              <Route path="/debts" element={<Debts />} />
              <Route path="/returns" element={<Returns />} />
              <Route path="/damages" element={<Damages />} />
              <Route path="/admin-login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/organizations" element={<AdminOrganizations />} />
              <Route path="/admin/pricing" element={<AdminPricing />} />
              <Route path="/admin/billing" element={<AdminBilling />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </PersistQueryClientProvider>
);

export default App;
