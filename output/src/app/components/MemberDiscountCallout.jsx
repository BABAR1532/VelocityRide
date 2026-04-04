import { Sparkles } from 'lucide-react';
import { formatInr } from '../utils/currency';

/**
 * Shown when API marks velocityMember + discounted fare (rides, parcels, carpool preview).
 */
export function MemberDiscountCallout({
  velocityMember,
  memberDiscountPercent,
  memberPlanName,
  originalFare,
  fare,
}) {
  if (!velocityMember || !memberDiscountPercent || originalFare == null || fare == null) {
    return null;
  }
  if (Number(originalFare) <= Number(fare)) return null;

  const planBit = memberPlanName ? ` (${memberPlanName} plan)` : '';

  return (
    <div className="flex gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-900 dark:text-emerald-100">
      <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
      <div>
        <p className="font-semibold text-emerald-800 dark:text-emerald-200">
          Velocity member{planBit}: {memberDiscountPercent}% extra discount
        </p>
        <p className="text-emerald-900/85 dark:text-emerald-100/90 mt-0.5">
          Regular {formatInr(originalFare)} → you pay {formatInr(fare)} (save{' '}
          {formatInr(Number(originalFare) - Number(fare))})
        </p>
      </div>
    </div>
  );
}
