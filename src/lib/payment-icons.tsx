import {
  Banknote,
  CreditCard,
  Smartphone,
  Building,
  Building2,
  Clock,
  ShoppingCart,
  Wallet,
  Coins,
  DollarSign,
  Landmark,
  QrCode,
  Receipt,
  BadgeDollarSign,
  PiggyBank,
  HandCoins,
  Send,
  ArrowRightLeft,
  Gift,
  Calculator,
  CircleDollarSign,
  Percent,
  Store,
  Bitcoin,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const PAYMENT_ICONS: Record<string, LucideIcon> = {
  Banknote,
  CreditCard,
  Smartphone,
  Building,
  Building2,
  Clock,
  ShoppingCart,
  Wallet,
  Coins,
  DollarSign,
  Landmark,
  QrCode,
  Receipt,
  BadgeDollarSign,
  PiggyBank,
  HandCoins,
  Send,
  ArrowRightLeft,
  Gift,
  Calculator,
  CircleDollarSign,
  Percent,
  Store,
  Bitcoin,
};

export const PAYMENT_ICON_NAMES = Object.keys(PAYMENT_ICONS);

export function PaymentIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = PAYMENT_ICONS[name] ?? Banknote;
  return <Icon className={className ?? "h-4 w-4"} />;
}