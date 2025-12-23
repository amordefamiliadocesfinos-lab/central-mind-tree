import { ReactNode } from "react";

interface SwipeNavigationWrapperProps {
  children: ReactNode;
}

// Swipe navigation disabled to prevent unintended screen changes on mobile
export function SwipeNavigationWrapper({ children }: SwipeNavigationWrapperProps) {
  return <>{children}</>;
}
