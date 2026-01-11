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
        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm",
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
