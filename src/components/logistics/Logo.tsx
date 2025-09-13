import { cn } from "@/lib/utils";
import Image from 'next/image';

export const Logo = ({ className }: { className?: string }) => (
    <Image 
        src="/logo.png" 
        alt="ID Logistics Logo" 
        width={140} 
        height={40} 
        className={cn(className, "object-contain")}
        priority
    />
  );