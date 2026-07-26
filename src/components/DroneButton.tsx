import React from 'react';
import { SAMARITAN_LOGO_URL } from '../constants';

interface DroneButtonProps {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  isLoading?: boolean;
  isSuccess?: boolean;
  text: string;
  loadingText?: string;
  successText?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  logoUrl?: string;
}

const DroneButton: React.FC<DroneButtonProps> = ({
  onClick,
  isLoading = false,
  isSuccess = false,
  text,
  loadingText = 'Establishing Link',
  successText = "It's on the way",
  type = 'button',
  disabled = false,
  logoUrl = SAMARITAN_LOGO_URL,
}) => {
  return (
    <div className={`drone-wrap ${isLoading ? 'is-loading' : ''} ${isSuccess ? 'is-success' : ''}`}>
      {/* The Drone SVG */}
      <div className="drone-container">
        <svg viewBox="0 0 80 55" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="rotor" style={{ transformOrigin: '18px 8px' }}>
            <ellipse cx="18" cy="8" rx="16" ry="2" fill="rgba(255,255,255,0.8)" />
          </g>
          <g className="rotor" style={{ transformOrigin: '62px 8px', animationDelay: '0.02s' }}>
            <ellipse cx="62" cy="8" rx="16" ry="2" fill="rgba(255,255,255,0.8)" />
          </g>
          <rect x="16" y="8" width="4" height="6" fill="#6b7280" />
          <rect x="60" y="8" width="4" height="6" fill="#6b7280" />
          <path d="M18 12 L35 25 M62 12 L45 25" stroke="#4b5563" strokeWidth="4" strokeLinecap="round" />
          <rect x="25" y="20" width="30" height="18" rx="6" fill="#3dc1da" />
          <rect x="28" y="23" width="24" height="12" rx="4" fill="#050505" />
          <circle cx="34" cy="29" r="3" fill="#fff" filter="drop-shadow(0 0 4px #fff)" />
          <circle cx="46" cy="29" r="3" fill="#fff" filter="drop-shadow(0 0 4px #fff)" />
          <path d="M32 38 v8 l-4 4 M48 38 v8 l4 4" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
      </div>

      {/* The Coffee Cup SVG */}
      <div className="coffee-cup">
        <svg viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <clipPath id="logoClip">
              <circle cx="14" cy="24" r="3.5" />
            </clipPath>
          </defs>
          <path className="steam" d="M10 4 Q12 0, 14 4 T18 0" style={{ animationDelay: '0s' }} />
          <path className="steam" d="M14 6 Q16 2, 18 6 T22 2" style={{ animationDelay: '0.6s' }} />
          <path d="M4 10 L24 10 C25.1 10 26 10.9 26 12 L2 12 C2 10.9 2.9 10 4 10 Z" fill="#374151" />
          <path d="M4 12 L8 34 C8.2 35.1 9.1 36 10.2 36 L17.8 36 C18.9 36 19.8 35.1 20 34 L24 12 Z" fill="#f3f4f6" />
          <path d="M5.5 20 L22.5 20 L21.5 28 L6.5 28 Z" fill="#1f2937" />
          <circle cx="14" cy="24" r="3.5" fill="#fff" />
          <image href={logoUrl} x="10.5" y="20.5" width="7" height="7" clipPath="url(#logoClip)" preserveAspectRatio="xMidYMid slice" />
        </svg>
      </div>

      {/* Actual Button */}
      <button 
        className="drone-btn" 
        onClick={onClick} 
        type={type}
        disabled={disabled || isLoading || isSuccess}
      >
        <span>
          {isLoading ? (
            <>{loadingText}<span className="drone-dots"></span></>
          ) : isSuccess ? (
            successText
          ) : (
            text
          )}
        </span>
      </button>
    </div>
  );
};

export default DroneButton;
