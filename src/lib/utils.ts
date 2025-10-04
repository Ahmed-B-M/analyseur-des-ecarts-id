import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCarrierFromDriverName(driverName: string): string | null {
  if (!driverName) {
    return null;
  }

  // Transporteur "ID LOG"
  if (driverName.includes("ID LOG")) {
    return "ID LOG";
  }

  // Transporteur STT
  if (driverName.startsWith("STT")) {
    // Assuming the carrier name is what follows "STT "
    const potentialCarrier = driverName.substring(4).split(' ')[0];
    return potentialCarrier || "STT";
  }

  const suffix = driverName.slice(-1);

  switch (suffix) {
    case '3':
      return 'BC one';
    case '0':
      return 'DUB';
    case '8':
      return 'GPC';
    case '7':
      return 'GPL';
    case '6':
      return 'RK';
    case '2':
      return 'Express';
    case '5':
      return 'MLG';
    default:
      return null;
  }
}
