import React from "react";
import { cn } from "@/lib/utils";

interface ShopNavButtonProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

export function ShopNavButton({ icon, label, active, onClick }: ShopNavButtonProps) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg transition-all text-xs md:text-sm whitespace-nowrap shrink-0",
        active 
          ? "bg-primary text-primary-foreground shadow-lg font-medium" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
