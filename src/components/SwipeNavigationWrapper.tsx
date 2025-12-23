import { ReactNode, useRef } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { useSwipeNavigation } from "@/hooks/useSwipeNavigation";

interface SwipeNavigationWrapperProps {
  children: ReactNode;
}

const SWIPE_THRESHOLD = 50; // Minimum distance to trigger navigation
const SWIPE_VELOCITY_THRESHOLD = 300; // Minimum velocity to trigger navigation

export function SwipeNavigationWrapper({ children }: SwipeNavigationWrapperProps) {
  const { handleSwipe, canSwipeLeft, canSwipeRight, isMobile } = useSwipeNavigation();
  const x = useMotionValue(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Visual feedback - subtle opacity change during swipe
  const leftIndicatorOpacity = useTransform(x, [-100, -20, 0], [0.8, 0.3, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, 20, 100], [0, 0.3, 0.8]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const { offset, velocity } = info;
    
    // Check if swipe was strong enough (by distance or velocity)
    const swipedLeft = offset.x < -SWIPE_THRESHOLD || velocity.x < -SWIPE_VELOCITY_THRESHOLD;
    const swipedRight = offset.x > SWIPE_THRESHOLD || velocity.x > SWIPE_VELOCITY_THRESHOLD;

    if (swipedLeft && canSwipeLeft) {
      handleSwipe("left");
    } else if (swipedRight && canSwipeRight) {
      handleSwipe("right");
    }
  };

  // Only enable swipe on mobile
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden">
      {/* Left swipe indicator (next page) */}
      {canSwipeLeft && (
        <motion.div
          className="fixed right-0 top-1/2 -translate-y-1/2 w-8 h-24 bg-gradient-to-l from-primary/20 to-transparent rounded-l-full pointer-events-none z-50"
          style={{ opacity: leftIndicatorOpacity }}
        />
      )}
      
      {/* Right swipe indicator (previous page) */}
      {canSwipeRight && (
        <motion.div
          className="fixed left-0 top-1/2 -translate-y-1/2 w-8 h-24 bg-gradient-to-r from-primary/20 to-transparent rounded-r-full pointer-events-none z-50"
          style={{ opacity: rightIndicatorOpacity }}
        />
      )}

      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className="w-full h-full touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
