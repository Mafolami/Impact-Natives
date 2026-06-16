import * as React from "react";
import { Check } from "lucide-react";

interface VerificationBadgeProps {
  className?: string;
}

const VerificationBadge: React.FC<VerificationBadgeProps> = ({ className }) => {
  return (
    <span className={`inline-flex items-center rounded-full bg-trust/10 text-trust px-2.5 py-0.5 text-xs font-medium ${className || ""}`}>
      <Check className="mr-1 h-3 w-3" />
      Verified
    </span>
  );
};

export { VerificationBadge };