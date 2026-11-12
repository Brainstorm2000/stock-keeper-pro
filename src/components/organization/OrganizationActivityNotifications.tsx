import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

interface ActivityNotification {
  recipient_id: string;
  actor_id: string | null;
  actor_username: string;
  action: string;
}

function playNotificationTone(context: AudioContext) {
  const startTime = context.currentTime;
  const compressor = context.createDynamicsCompressor();
  const masterGain = context.createGain();
  compressor.threshold.setValueAtTime(-8, startTime);
  compressor.knee.setValueAtTime(2, startTime);
  compressor.ratio.setValueAtTime(16, startTime);
  compressor.attack.setValueAtTime(0.003, startTime);
  compressor.release.setValueAtTime(0.18, startTime);
  masterGain.gain.setValueAtTime(0.95, startTime);
  compressor.connect(masterGain);
  masterGain.connect(context.destination);

  const chimes = [
    { start: 0, frequencies: [880, 1320, 1760] },
    { start: 0.16, frequencies: [1046, 1569, 2092] },
  ];

  chimes.forEach(({ start, frequencies }) => {
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const noteStart = startTime + start;
      const peak = [0.62, 0.2, 0.1][index];

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, noteStart);
      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(peak, noteStart + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.9);
      oscillator.connect(gain);
      gain.connect(compressor);
      oscillator.start(noteStart);
      oscillator.stop(noteStart + 0.9);
    });
  });
}

export function OrganizationActivityNotifications() {
  const { user, role } = useAuth();
  const audioContextRef = useRef<AudioContext | null>(null);
  const pendingSoundRef = useRef(false);

  useEffect(() => {
    const unlockAudio = () => {
      if (!audioContextRef.current && typeof window.AudioContext !== 'undefined') {
        audioContextRef.current = new window.AudioContext();
      }

      const context = audioContextRef.current;
      if (!context || context.state === 'running') return;

      void context.resume().then(() => {
        if (pendingSoundRef.current) {
          pendingSoundRef.current = false;
          playNotificationTone(context);
        }
      });
    };

    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!user || role !== 'super_admin') return;

    const channel = supabase
      .channel(`activity-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_notifications',
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          const notification = payload.new as ActivityNotification;
          if (notification.actor_id === user.id) return;

          const context = audioContextRef.current;
          if (context?.state === 'running') {
            playNotificationTone(context);
          } else {
            pendingSoundRef.current = true;
          }

          const showNotification = async () => {
            let actorName = notification.actor_username;
            if (notification.actor_id) {
              try {
                const { data } = await supabase.rpc('get_org_user_names', {
                  _user_ids: [notification.actor_id],
                });
                actorName = data?.find((profile) => profile.user_id === notification.actor_id)?.full_name?.trim()
                  || actorName;
              } catch {
                // Keep the stored username if the profile lookup is unavailable.
              }
            }

            toast(actorName, {
              description: notification.action,
              duration: 8000,
            });
          };

          void showNotification();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [role, user]);

  return null;
}