import { QRCodeSVG } from 'qrcode.react';
import { forwardRef } from 'react';
import type { Staff } from '@/hooks/useStaff';
import type { Organization } from '@/hooks/useOrganization';

interface StaffIDCardProps {
  staff: Staff;
  organization: Organization | null;
}

export const StaffIDCardFront = forwardRef<HTMLDivElement, StaffIDCardProps>(
  ({ staff, organization }, ref) => (
    <div
      ref={ref}
      className="w-[340px] h-[214px] rounded-xl overflow-hidden flex relative bg-card border border-border shadow-sm"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Left accent stripe */}
      <div className="w-[8px] bg-primary shrink-0" />

      <div className="flex-1 flex flex-col p-3 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          {organization?.logo_url && (
            <img src={organization.logo_url} alt="" className="h-6 w-6 rounded object-cover" />
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground truncate leading-tight uppercase tracking-wide">
              {organization?.name || 'Organization'}
            </p>
            <p className="text-[7px] text-muted-foreground tracking-[0.15em] uppercase">Employee ID</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex gap-3 items-center pt-2.5 min-w-0">
          {/* Photo / initials */}
          <div className="w-[78px] h-[78px] rounded-md bg-muted flex items-center justify-center text-2xl font-bold text-primary shrink-0 overflow-hidden ring-1 ring-border">
            {staff.photo_url ? (
              <img src={staff.photo_url} alt={staff.full_name} className="w-full h-full object-cover" />
            ) : (
              staff.full_name.split(' ').map((n) => n.charAt(0).toUpperCase()).slice(0, 2).join('')
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <div>
              <p className="font-semibold text-[13px] text-foreground truncate leading-tight">{staff.full_name}</p>
              {staff.role && <p className="text-[10px] text-primary font-medium truncate">{staff.role}</p>}
            </div>
            <div className="space-y-[2px] pt-0.5">
              {staff.staff_id && (
                <p className="text-[9px] text-muted-foreground font-mono">{staff.staff_id}</p>
              )}
              {staff.department && (
                <p className="text-[9px] text-muted-foreground truncate">{staff.department}</p>
              )}
              {staff.phone && (
                <p className="text-[9px] text-muted-foreground truncate">{staff.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        {(staff.branches?.name || staff.employment_date) && (
          <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-border">
            {staff.branches?.name && (
              <p className="text-[8px] text-muted-foreground uppercase tracking-wide truncate">
                {staff.branches.name}
              </p>
            )}
            {staff.employment_date && (
              <p className="text-[8px] text-muted-foreground">Since {staff.employment_date}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
);
StaffIDCardFront.displayName = 'StaffIDCardFront';

export const StaffIDCardBack = forwardRef<HTMLDivElement, StaffIDCardProps>(
  ({ staff, organization }, ref) => (
    <div
      ref={ref}
      className="w-[340px] h-[214px] rounded-xl overflow-hidden flex flex-col relative bg-card border border-border shadow-sm"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      <div className="flex-1 p-3 flex gap-3">
        <div className="flex-1 min-w-0 flex flex-col">
          <p className="text-[9px] font-bold text-foreground uppercase tracking-[0.15em] mb-1.5">Terms</p>
          <ul className="text-[8px] text-muted-foreground space-y-1 leading-snug">
            <li>• Property of {organization?.name || 'the organization'}.</li>
            <li>• Must be worn visibly during work hours.</li>
            <li>• Report loss immediately to HR.</li>
            <li>• Not transferable.</li>
          </ul>
          <div className="mt-auto space-y-0.5 pt-2">
            {organization?.email && (
              <p className="text-[8px] text-muted-foreground truncate">{organization.email}</p>
            )}
            {organization?.address && (
              <p className="text-[8px] text-muted-foreground truncate">{organization.address}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="p-1 bg-white rounded ring-1 ring-border">
            <QRCodeSVG
              value={JSON.stringify({ staff_id: staff.id, organization_id: staff.organization_id })}
              size={110}
              level="M"
            />
          </div>
          <p className="text-[7px] text-muted-foreground uppercase tracking-wide">Scan for attendance</p>
        </div>
      </div>

      <div className="h-[6px] bg-primary" />
    </div>
  )
);
StaffIDCardBack.displayName = 'StaffIDCardBack';
