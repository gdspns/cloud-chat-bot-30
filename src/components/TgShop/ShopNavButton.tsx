import React from "react";
import { cn } from "@/lib/utils";

interface ShopNavButtonProps {
  icon: React.ReactNode;
  label: string;
  shortLabel?: string;
  active: boolean;
  onClick: () => void;
}

export function ShopNavButton({ icon, label, shortLabel, active, onClick }: ShopNavButtonProps) {
  return (
    <button 
      onClick={onClick}
      title={label}
      className={cn(
        "flex items-center gap-1 px-2 py-1.5 sm:gap-1.5 sm:px-3 sm:py-2 rounded-lg transition-all text-xs sm:text-sm whitespace-nowrap",
        active 
          ? "bg-primary text-primary-foreground shadow-lg font-medium" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <span className="sm:hidden">{shortLabel || label}</span>
      <span className="hidden sm:inline-flex items-center gap-1.5">{icon}{label}</span>
    </button>
  );
}
