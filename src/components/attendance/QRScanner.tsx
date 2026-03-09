import { useEffect, useRef, useState } from 'react';
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

const SUCCESS_SOUND_URL = 'data:audio/wav;base64,UklGRl9vT19teleXBldABmb3JtYXQAABAAAAABAAEARKwAAIhYAQACABAAZGF0YQ';

export function QRScanner() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const { organizationId } = useAuth();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const { data: shifts = [] } = useShifts();
  const activeShifts = shifts.filter(s => s.is_active);
  const containerRef = useRef<HTMLDivElement>(null);

  const playSuccessSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1200;
        gain2.gain.value = 0.3;
        osc2.start();
        osc2.stop(ctx.currentTime + 0.15);
      }, 150);
    } catch {}
  };

  const playErrorSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 300;
      gain.gain.value = 0.3;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const handleScan = async (decodedText: string) => {
    if (processing) return;
    setProcessing(true);

    try {
      const parsed = JSON.parse(decodedText);
      if (!parsed.staff_id || !parsed.organization_id) {
        throw new Error('Invalid QR code');
      }
      if (parsed.organization_id !== organizationId) {
        throw new Error('Staff not found in your organization');
      }

      // Verify staff exists
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
        await clockIn.mutateAsync({
          staffId: staffMember.id,
          shiftId: selectedShiftId,
          branchId: staffMember.branch_id,
          departmentId: staffMember.department_id,
        });
        playSuccessSound();
        setResult({ type: 'success', message: `Clock-in successful for ${staffMember.full_name}` });
      } else if (!existing.clock_out_time) {
        await clockOut.mutateAsync({
          staffId: staffMember.id,
          shiftId: selectedShiftId,
        });
        playSuccessSound();
        setResult({ type: 'success', message: `Clock-out successful for ${staffMember.full_name}` });
      } else {
        setResult({ type: 'error', message: `${staffMember.full_name} already completed attendance for today` });
      }
    } catch (err: any) {
      playErrorSound();
      setResult({ type: 'error', message: err.message || 'Invalid QR code' });
    } finally {
      setProcessing(false);
      setTimeout(() => setResult(null), 4000);
    }
  };

  const startScanning = async () => {
    if (!containerRef.current) return;
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
    } catch (err: any) {
      // Try front camera
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

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch {}
      }
    };
  }, []);

  return (
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
          disabled={!selectedShiftId && !scanning}
        >
          {scanning ? <><CameraOff className="mr-2 h-4 w-4" />Stop Scanner</> : <><Camera className="mr-2 h-4 w-4" />Start Scanner</>}
        </Button>

        {processing && (
          <Badge variant="secondary" className="w-full justify-center">Processing...</Badge>
        )}
      </CardContent>
    </Card>
  );
}
