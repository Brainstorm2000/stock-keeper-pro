import { QRCodeSVG } from 'qrcode.react';
import { forwardRef } from 'react';
import type { Staff } from '@/hooks/useStaff';
import type { Organization } from '@/hooks/useOrganization';

interface StaffIDCardProps {
  staff: Staff;
  organization: Organization | null;
  side?: 'front' | 'back';
}

export const StaffIDCardFront = forwardRef<HTMLDivElement, StaffIDCardProps>(
  ({ staff, organization }, ref) => (
    <div
      ref={ref}
      className="w-[340px] h-[214px] rounded-xl border-2 border-border bg-card overflow-hidden flex flex-col"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="bg-primary px-4 py-2 flex items-center gap-2">
        {organization?.logo_url && (
          <img src={organization.logo_url} alt="" className="h-8 w-8 rounded object-cover bg-white" />
        )}
        <div className="text-primary-foreground">
          <p className="text-sm font-bold leading-tight">{organization?.name || 'Organization'}</p>
          <p className="text-[10px] opacity-80">Staff Identification Card</p>
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 px-4 py-2 flex gap-3">
        <div className="w-16 h-20 rounded bg-muted flex items-center justify-center text-2xl font-bold text-muted-foreground shrink-0 border">
          {staff.full_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-bold text-sm text-foreground truncate">{staff.full_name}</p>
          {staff.staff_id && <p className="text-[10px] text-muted-foreground font-mono">ID: {staff.staff_id}</p>}
          {staff.role && <p className="text-[11px] text-foreground truncate">{staff.role}</p>}
          {staff.department && <p className="text-[10px] text-muted-foreground truncate">{staff.department}</p>}
          {staff.branches?.name && <p className="text-[10px] text-muted-foreground truncate">📍 {staff.branches.name}</p>}
        </div>
      </div>
    </div>
  )
);
StaffIDCardFront.displayName = 'StaffIDCardFront';

export const StaffIDCardBack = forwardRef<HTMLDivElement, StaffIDCardProps>(
  ({ staff, organization }, ref) => (
    <div
      ref={ref}
      className="w-[340px] h-[214px] rounded-xl border-2 border-border bg-card overflow-hidden flex flex-col items-center justify-center gap-2 p-4"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="p-2 bg-white rounded">
        <QRCodeSVG
          value={JSON.stringify({ staff_id: staff.id, organization_id: staff.organization_id })}
          size={100}
          level="H"
        />
      </div>
      <p className="text-[10px] text-muted-foreground text-center">Scan for attendance</p>
      {organization?.email && (
        <p className="text-[10px] text-muted-foreground">✉ {organization.email}</p>
      )}
      {organization?.address && (
        <p className="text-[10px] text-muted-foreground text-center truncate max-w-full">📍 {organization.address}</p>
      )}
    </div>
  )
);
StaffIDCardBack.displayName = 'StaffIDCardBack';
