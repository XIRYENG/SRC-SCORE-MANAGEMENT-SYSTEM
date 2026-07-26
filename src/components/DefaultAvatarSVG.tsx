import React from 'react';

interface DefaultAvatarSVGProps {
  size?: number;
  className?: string;
}

export const DefaultAvatarSVG: React.FC<DefaultAvatarSVGProps> = ({ size = 40, className = "" }) => {
  return (
    <img
      src="/logo.svg"
      alt="SRC Official Logo"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className={`inline-block select-none object-contain p-1 rounded-full border border-slate-200/80 bg-white shadow-sm ${className}`}
      style={size ? { width: size, height: size } : {}}
    />
  );
};


