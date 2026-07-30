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
      className={`inline-block select-none object-contain p-0.5 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0 ${className}`}
      style={size ? { width: size, height: size } : {}}
    />
  );
};


