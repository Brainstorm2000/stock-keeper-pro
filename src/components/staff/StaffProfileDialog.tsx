import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StaffQRCode } from './StaffQRCode';
import { StaffIDCardFront, StaffIDCardBack } from './StaffIDCard';
import { StaffIDCardExport } from './StaffIDCardExport';
import { useStaffAttendanceSummary } from '@/hooks/useAttendance';
import { useOrganization } from '@/hooks/useOrganization';
import { useState } from 'react';
import { FileDown, Clock, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import type { Staff } from '@/hooks/useStaff';

interface StaffProfileDialogProps {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffProfileDialog({ staff, open, onOpenChange }: StaffProfileDialogProps) {
  const { data: organization } = useOrganization();
  const { data: summary } = useStaffAttendanceSummary(staff?.id);
  const [exportOpen, setExportOpen] = useState(false);

  if (!staff) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{staff.full_name} — Profile</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="qr">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="qr">QR Code</TabsTrigger>
              <TabsTrigger value="idcard">ID Card</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="flex justify-center py-4">
              <StaffQRCode
                staffId={staff.id}
                organizationId={staff.organization_id}
                staffName={staff.full_name}
                staffCode={staff.staff_id}
              />
            </TabsContent>

            <TabsContent value="idcard" className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-4">
                <div>
                  <p className="text-xs text-muted-foreground text-center mb-2">Front</p>
                  <StaffIDCardFront staff={staff} organization={organization ?? null} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground text-center mb-2">Back</p>
                  <StaffIDCardBack staff={staff} organization={organization ?? null} />
                </div>
                <Button onClick={() => setExportOpen(true)}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download ID Card PDF
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="attendance" className="py-4">
              {summary ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg border text-center">
                    <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{summary.totalHours.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground">Total Hours</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{summary.totalOvertime.toFixed(1)}h</p>
                    <p className="text-xs text-muted-foreground">Overtime</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <UserCheck className="h-4 w-4 mx-auto mb-1 text-green-500" />
                    <p className="text-lg font-bold">{summary.onTimeCount}</p>
                    <p className="text-xs text-muted-foreground">On Time</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <UserCheck className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                    <p className="text-lg font-bold">{summary.earlyCount}</p>
                    <p className="text-xs text-muted-foreground">Early</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-yellow-500" />
                    <p className="text-lg font-bold">{summary.lateCount}</p>
                    <p className="text-xs text-muted-foreground">Late</p>
                  </div>
                  <div className="p-3 rounded-lg border text-center">
                    <UserX className="h-4 w-4 mx-auto mb-1 text-destructive" />
                    <p className="text-lg font-bold">{summary.absentCount}</p>
                    <p className="text-xs text-muted-foreground">Absent</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">No attendance data</p>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <StaffIDCardExport open={exportOpen} onOpenChange={setExportOpen} singleStaff={staff} />
    </>
  );
}
