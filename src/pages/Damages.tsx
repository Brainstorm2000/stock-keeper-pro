import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ModuleAccessGuard } from "@/components/access/ModuleAccessGuard";
import { DamagesTab } from "@/components/production/DamagesTab";

export default function Damages() {
  return (
    <DashboardLayout>
      <ModuleAccessGuard module="products">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Damages</h1>
            <p className="text-muted-foreground">
              Record damaged products. Stock levels and history update automatically.
            </p>
          </div>
          <DamagesTab productsOnly />
        </div>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
