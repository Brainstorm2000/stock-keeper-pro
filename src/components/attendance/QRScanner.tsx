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

// Helper to create a loud tone with compressor for maximum volume
function makeLoudTone(ctx: AudioContext, dest: AudioNode, freq: number, type: OscillatorType, startTime: number, duration: number, volume = 1) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Clock-IN sound: bright ascending welcome chime (intro feel)
function playClockInSound() {
  try {
    const ctx = new AudioContext();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0;
    compressor.release.value = 0.05;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);
    const now = ctx.currentTime;

    // Ascending 5-note welcome chime: C5 → E5 → G5 → C6 → E6
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((freq, i) => {
      makeLoudTone(ctx, compressor, freq, 'sine', now + i * 0.12, 0.35, 1);
      // Add harmonic overtone for brightness
      makeLoudTone(ctx, compressor, freq * 2, 'sine', now + i * 0.12, 0.2, 0.3);
    });
    // Final sustained chord
    makeLoudTone(ctx, compressor, 1047, 'sine', now + 0.5, 0.8, 0.8);
    makeLoudTone(ctx, compressor, 1319, 'sine', now + 0.5, 0.8, 0.6);
    makeLoudTone(ctx, compressor, 1568, 'sine', now + 0.5, 0.8, 0.4);

    setTimeout(() => ctx.close(), 2000);
  } catch {}
}

// Clock-OUT sound: warm descending farewell chime (outro feel)
function playClockOutSound() {
  try {
    const ctx = new AudioContext();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0;
    compressor.release.value = 0.05;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);
    const now = ctx.currentTime;

    // Descending farewell: G5 → E5 → C5 → G4 with warmth
    const notes = [784, 659, 523, 392];
    notes.forEach((freq, i) => {
      makeLoudTone(ctx, compressor, freq, 'triangle', now + i * 0.18, 0.5, 1);
      makeLoudTone(ctx, compressor, freq * 1.5, 'sine', now + i * 0.18, 0.3, 0.2);
    });
    // Final low chord
    makeLoudTone(ctx, compressor, 261, 'triangle', now + 0.72, 1.0, 0.7);
    makeLoudTone(ctx, compressor, 392, 'triangle', now + 0.72, 1.0, 0.5);

    setTimeout(() => ctx.close(), 2500);
  } catch {}
}

// Error sound: harsh dissonant buzz
function playErrorBell() {
  try {
    const ctx = new AudioContext();
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0;
    compressor.release.value = 0.05;
    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);
    const now = ctx.currentTime;

    makeLoudTone(ctx, compressor, 200, 'sawtooth', now, 0.5, 1);
    makeLoudTone(ctx, compressor, 150, 'sawtooth', now + 0.2, 0.5, 1);
    makeLoudTone(ctx, compressor, 100, 'square', now + 0.4, 0.4, 0.8);

    setTimeout(() => ctx.close(), 1500);
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
        playClockOutSound();
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
