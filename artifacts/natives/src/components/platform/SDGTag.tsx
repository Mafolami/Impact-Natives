import * as React from "react";

interface SDGTagProps {
  label: string;
}

const SDGTag: React.FC<SDGTagProps> = ({ label }) => {
  return (
    <span className="inline-flex items-center rounded-full bg-trust/10 text-trust px-2.5 py-0.5 text-xs font-medium">
      {label}
    </span>
  );
};

export { SDGTag };