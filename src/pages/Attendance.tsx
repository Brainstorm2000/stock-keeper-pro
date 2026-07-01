import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRScanner } from '@/components/attendance/QRScanner';
import { AttendanceRecords } from '@/components/attendance/AttendanceRecords';
import { ShiftManagement } from '@/components/attendance/ShiftManagement';
import { AttendanceDashboard } from '@/components/attendance/AttendanceDashboard';
import { ScanLine, Table2, Settings2 } from 'lucide-react';

export default function Attendance() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Attendance</h1>
          <p className="text-muted-foreground">Clock in/out via QR scan and manage attendance records</p>
        </div>

        <AttendanceDashboard />

        <Tabs defaultValue="scanner">
          <TabsList>
            <TabsTrigger value="scanner" className="gap-1.5">
              <ScanLine className="h-4 w-4" />
              QR Scanner
            </TabsTrigger>
            <TabsTrigger value="records" className="gap-1.5">
              <Table2 className="h-4 w-4" />
              Records
            </TabsTrigger>
            <TabsTrigger value="shifts" className="gap-1.5">
              <Settings2 className="h-4 w-4" />
              Shifts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner" className="mt-4">
            <QRScanner />
          </TabsContent>
          <TabsContent value="records" className="mt-4">
            <AttendanceRecords />
          </TabsContent>
          <TabsContent value="shifts" className="mt-4">
            <ShiftManagement />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
