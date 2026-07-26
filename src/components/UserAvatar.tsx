import React, { useState, useEffect } from 'react';
import { DefaultAvatarSVG } from './DefaultAvatarSVG';

interface UserAvatarProps {
  photoURL?: string | null;
  altText?: string;
  size?: number;
  className?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  photoURL,
  altText = "User Avatar",
  size,
  className = "w-10 h-10 rounded-3xl object-cover border-2 border-slate-200 bg-white shadow-sm"
}) => {
  const [hasError, setHasError] = useState(false);

  // Reset error state when photoURL changes
  useEffect(() => {
    setHasError(false);
  }, [photoURL]);

  const isValidUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    const trimmed = url.trim();
    if (trimmed.length === 0) return false;
    return trimmed.startsWith("data:image/") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/");
  };

  const inlineStyle: React.CSSProperties = size ? { width: size, height: size } : {};

  if (!hasError && isValidUrl(photoURL)) {
    return (
      <img
        src={photoURL!.trim()}
        alt={altText}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        className={className}
        style={inlineStyle}
      />
    );
  }

  return (
    <DefaultAvatarSVG size={size} className={className} />
  );
};
