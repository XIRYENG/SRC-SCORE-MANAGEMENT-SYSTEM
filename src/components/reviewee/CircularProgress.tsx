import React from 'react';

export const CircularProgress = ({ value }: { value: number }) => {
  const radius = 38;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = Math.min(Math.max(value || 0, 0), 100);
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const formatPercentage = (val: number): string => {
    if (val >= 100) return "100%";
    const formatted = val.toFixed(2);
    if (formatted === "100.00") return "100%";
    return `${formatted}%`;
  };

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="-rotate-90">
        <circle
          stroke="rgba(255,255,255,0.12)"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />

        <circle
          stroke="url(#srcProgressGradient)"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />

        <defs>
          <linearGradient id="srcProgressGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0057FF" />
            <stop offset="55%" stopColor="#00B8A9" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
      </svg>

      <div className="absolute text-center">
        <p className="text-base font-black tracking-tight text-white">{formatPercentage(progress)}</p>
      </div>
    </div>
  );
};
