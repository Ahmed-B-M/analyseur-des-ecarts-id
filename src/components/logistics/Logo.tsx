import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("lucide lucide-container", className)}
    >
      <path d="M22 8.32V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.32" />
      <path d="M2 7V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2" />
      <path d="M5 17v-4" />
      <path d="M8 17v-4" />
      <path d="M12 17v-4" />
      <path d="M16 17v-4" />
      <path d="M19 17v-4" />
    </svg>
  );
  