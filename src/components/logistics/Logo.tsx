import { cn } from "@/lib/utils";
import Image from 'next/image';

export const Logo = ({ className }: { className?: string }) => (
    <Image 
        src="/logo-crf.png" 
        alt="Logo de l'application" 
        width={140} 
        height={40} 
        className={cn(className, "object-contain")}
        priority
    />
  );
