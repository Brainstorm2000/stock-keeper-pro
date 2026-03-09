import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Camera, CameraOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useClockIn, useClockOut } from '@/hooks/useAttendance';
import { useShifts } from '@/hooks/useShifts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function playSuccessBell() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Bell 1 — bright ding
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 1200;
    gain1.gain.setValueAtTime(0.6, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Bell 2 — higher octave follow-up
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1600;
    gain2.gain.setValueAtTime(0.5, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.55);

    // Bell 3 — final chime
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.value = 2000;
    gain3.gain.setValueAtTime(0.45, now + 0.3);
    gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.3);
    osc3.stop(now + 0.8);

    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

function playErrorBell() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 250;
    gain1.gain.setValueAtTime(0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 180;
    gain2.gain.setValueAtTime(0.5, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.7);

    setTimeout(() => ctx.close(), 1000);
  } catch {}
}

interface PendingClockOut {
  staffName: string;
  staffId: string;
  shiftId: string;
}

export function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [pendingClockOut, setPendingClockOut] = useState<PendingClockOut | null>(null);
  const hasScannedRef = useRef(false);
  const { organizationId } = useAuth();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { data: shifts = [] } = useShifts();
  const activeShifts = shifts.filter(s => s.is_active);
  const containerRef = useRef<HTMLDivElement>(null);

  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const handleConfirmClockOut = async () => {
    if (!pendingClockOut) return;
    setProcessing(true);
    try {
      await clockOut.mutateAsync({
        staffId: pendingClockOut.staffId,
        shiftId: pendingClockOut.shiftId,
      });
      playSuccessBell();
      setResult({ type: 'success', message: `Clock-out successful for ${pendingClockOut.staffName}` });
    } catch (err: any) {
      playErrorBell();
      setResult({ type: 'error', message: err.message || 'Clock-out failed' });
    } finally {
      setPendingClockOut(null);
      setProcessing(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  const handleCancelClockOut = () => {
    setPendingClockOut(null);
    hasScannedRef.current = false;
    setResult(null);
  };

  const handleScan = useCallback(async (decodedText: string) => {
    if (processing || hasScannedRef.current) return;
    hasScannedRef.current = true;
    setProcessing(true);

    // Stop scanner immediately after first successful decode
    await stopScanning();

    try {
      const parsed = JSON.parse(decodedText);
      if (!parsed.staff_id || !parsed.organization_id) {
        throw new Error('Invalid QR code');
      }
      if (parsed.organization_id !== organizationId) {
        throw new Error('Staff not found in your organization');
      }

      const { data: staffMember, error: staffErr } = await supabase
        .from('staff')
        .select('id, full_name, branch_id, department_id')
        .eq('id', parsed.staff_id)
        .eq('organization_id', organizationId)
        .single();

      if (staffErr || !staffMember) throw new Error('Staff not found');
      if (!selectedShiftId) throw new Error('Please select a shift first');

      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('attendance')
        .select('id, clock_out_time')
        .eq('staff_id', staffMember.id)
        .eq('attendance_date', today)
        .eq('shift_id', selectedShiftId)
        .maybeSingle();

      if (!existing) {
        // Clock in directly
        await clockIn.mutateAsync({
          staffId: staffMember.id,
          shiftId: selectedShiftId,
          branchId: staffMember.branch_id,
          departmentId: staffMember.department_id,
        });
        playSuccessBell();
        setResult({ type: 'success', message: `Clock-in successful for ${staffMember.full_name}` });
        setProcessing(false);
        setTimeout(() => setResult(null), 5000);
      } else if (!existing.clock_out_time) {
        // Ask for confirmation before clock-out
        setPendingClockOut({
          staffName: staffMember.full_name,
          staffId: staffMember.id,
          shiftId: selectedShiftId,
        });
        setProcessing(false);
      } else {
        setResult({ type: 'error', message: `${staffMember.full_name} already completed attendance for today` });
        setProcessing(false);
        setTimeout(() => setResult(null), 5000);
      }
    } catch (err: any) {
      playErrorBell();
      setResult({ type: 'error', message: err.message || 'Invalid QR code' });
      setProcessing(false);
      setTimeout(() => setResult(null), 5000);
    }
  }, [processing, organizationId, selectedShiftId, clockIn, clockOut, stopScanning]);

  const startScanning = async () => {
    if (!containerRef.current) return;
    hasScannedRef.current = false;
    setResult(null);

    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleScan,
        () => {}
      );
      setScanning(true);
    } catch {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'user' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          handleScan,
          () => {}
        );
        setScanning(true);
      } catch {
        setResult({ type: 'error', message: 'Could not access camera' });
      }
    }
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch {}
      }
    };
  }, []);

  return (
    <>
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            QR Attendance Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select Shift</Label>
            <Select value={selectedShiftId} onValueChange={setSelectedShiftId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a shift" />
              </SelectTrigger>
              <SelectContent>
                {activeShifts.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.shift_name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div ref={containerRef} id="qr-reader" className="w-full rounded-lg overflow-hidden bg-muted min-h-[280px]" />

          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${result.type === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-destructive/10 text-destructive'}`}>
              {result.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
              <span className="text-sm font-medium">{result.message}</span>
            </div>
          )}

          <Button
            className="w-full"
            onClick={scanning ? stopScanning : startScanning}
            disabled={(!selectedShiftId && !scanning) || processing}
          >
            {scanning ? <><CameraOff className="mr-2 h-4 w-4" />Stop Scanner</> : <><Camera className="mr-2 h-4 w-4" />Start Scanner</>}
          </Button>

          {processing && (
            <Badge variant="secondary" className="w-full justify-center">Processing...</Badge>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!pendingClockOut} onOpenChange={(open) => { if (!open) handleCancelClockOut(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Clock-Out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to clock out <span className="font-semibold text-foreground">{pendingClockOut?.staffName}</span>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelClockOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClockOut}>
              Confirm Clock-Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
