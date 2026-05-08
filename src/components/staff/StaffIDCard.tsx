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
      className="w-[340px] h-[214px] rounded-xl overflow-hidden flex flex-col relative bg-card border border-border"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Teal geometric accent - top right */}
      <div className="absolute top-0 right-0 w-[120px] h-[120px]">
        <div className="absolute top-0 right-0 w-0 h-0" style={{
          borderLeft: '120px solid transparent',
          borderTop: '120px solid hsl(var(--primary))',
        }} />
      </div>
      {/* Teal geometric accent - bottom left */}
      <div className="absolute bottom-0 left-0 w-[100px] h-[80px]">
        <div className="absolute bottom-0 left-0 w-0 h-0" style={{
          borderRight: '100px solid transparent',
          borderBottom: '80px solid hsl(var(--primary))',
        }} />
      </div>

      {/* Header with org info */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2 relative z-10">
        {organization?.logo_url && (
          <img src={organization.logo_url} alt="" className="h-7 w-7 rounded object-cover" />
        )}
        <div>
          <p className="text-xs font-bold text-foreground leading-tight">{organization?.name || 'Organization'}</p>
          <p className="text-[8px] text-muted-foreground">Staff Identification Card</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 px-4 pb-2 flex gap-3 items-center relative z-10">
        {/* Circular photo or initials */}
        <div className="w-[72px] h-[72px] rounded-full bg-muted border-2 border-primary flex items-center justify-center text-xl font-bold text-primary shrink-0 overflow-hidden">
          {staff.photo_url ? (
            <img src={staff.photo_url} alt={staff.full_name} className="w-full h-full object-cover" />
          ) : (
            staff.full_name
              .split(' ')
              .map((n) => n.charAt(0).toUpperCase())
              .slice(0, 2)
              .join('')
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="font-bold text-sm text-foreground truncate leading-tight">{staff.full_name}</p>
          {staff.role && <p className="text-[11px] text-primary font-semibold truncate">{staff.role}</p>}
          <div className="space-y-0.5 mt-1">
            {staff.staff_id && (
              <p className="text-[9px] text-muted-foreground">
                <span className="font-semibold text-foreground">ID:</span> {staff.staff_id}
              </p>
            )}
            {staff.department && (
              <p className="text-[9px] text-muted-foreground">
                <span className="font-semibold text-foreground">DEPT:</span> {staff.department}
              </p>
            )}
            {staff.phone && (
              <p className="text-[9px] text-muted-foreground">
                <span className="font-semibold text-foreground">PHONE:</span> {staff.phone}
              </p>
            )}
            {staff.email && (
              <p className="text-[9px] text-muted-foreground truncate">
                <span className="font-semibold text-foreground">EMAIL:</span> {staff.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-primary/10 px-4 py-1 relative z-10">
        <div className="flex items-center justify-between">
          {staff.branches?.name && (
            <p className="text-[8px] text-primary font-medium">📍 {staff.branches.name}</p>
          )}
          {staff.employment_date && (
            <p className="text-[8px] text-muted-foreground">Since {staff.employment_date}</p>
          )}
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
      className="w-[340px] h-[214px] rounded-xl overflow-hidden flex flex-col relative bg-card border border-border"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Geometric accent - bottom right */}
      <div className="absolute bottom-0 right-0 w-[100px] h-[80px]">
        <div className="absolute bottom-0 right-0 w-0 h-0" style={{
          borderLeft: '100px solid transparent',
          borderBottom: '80px solid hsl(var(--primary))',
        }} />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex gap-4 relative z-10">
        {/* Left side - org info */}
        <div className="flex-1 space-y-2">
          <p className="text-[10px] font-bold text-foreground">Terms & Information</p>
          <ul className="text-[8px] text-muted-foreground space-y-1 list-disc list-inside">
            <li>This card is property of {organization?.name || 'the organization'}.</li>
            <li>Must be worn visibly during work hours.</li>
            <li>Report loss immediately to HR department.</li>
          </ul>
          <div className="pt-2 space-y-0.5">
            {organization?.email && (
              <p className="text-[8px] text-muted-foreground">✉ {organization.email}</p>
            )}
            {organization?.address && (
              <p className="text-[8px] text-muted-foreground truncate">📍 {organization.address}</p>
            )}
          </div>
        </div>

        {/* Right side - QR + logo */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="p-1.5 bg-white rounded border">
            <QRCodeSVG
              value={JSON.stringify({ staff_id: staff.id, organization_id: staff.organization_id })}
              size={160}
              level="M"
              includeMargin
            />
          </div>
          <p className="text-[7px] text-muted-foreground">Scan for attendance</p>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-primary px-4 py-1.5 flex items-center gap-2 relative z-10">
        {organization?.logo_url && (
          <img src={organization.logo_url} alt="" className="h-5 w-5 rounded object-cover" />
        )}
        <p className="text-[9px] text-primary-foreground font-semibold">{organization?.name || 'Organization'}</p>
      </div>
    </div>
  )
);
StaffIDCardBack.displayName = 'StaffIDCardBack';
