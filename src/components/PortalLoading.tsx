import React from 'react';
import { PortalLoadingScreen, PortalLoadingScreenProps } from './auth/PortalLoadingScreen';

interface PortalLoadingProps extends PortalLoadingScreenProps {
  submessage?: string;
}

export function PortalLoading({
  message = "Waiting to Log In",
  subMessage,
  submessage,
  status = "Preparing your portal…",
  ...props
}: PortalLoadingProps) {
  return (
    <PortalLoadingScreen
      message={message}
      subMessage={subMessage || submessage || "Please wait, Future RCrim."}
      status={status}
      {...props}
    />
  );
}

export { PortalLoadingScreen };
