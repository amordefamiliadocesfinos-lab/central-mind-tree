import { useNavigate, useLocation } from "react-router-dom";
import { useIsMobile } from "./use-mobile";

// Define the order of main pages for swipe navigation
const PAGES_ORDER = [
  "/",
  "/foco",
  "/calendario",
  "/rotina",
  "/operacoes",
  "/conteudo",
  "/planilhas",
  "/reunioes",
  "/minha-area"
];

export function useSwipeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  const currentIndex = PAGES_ORDER.indexOf(location.pathname);

  const canSwipeLeft = currentIndex < PAGES_ORDER.length - 1 && currentIndex >= 0;
  const canSwipeRight = currentIndex > 0;

  const navigateLeft = () => {
    if (canSwipeLeft) {
      navigate(PAGES_ORDER[currentIndex + 1]);
    }
  };

  const navigateRight = () => {
    if (canSwipeRight) {
      navigate(PAGES_ORDER[currentIndex - 1]);
    }
  };

  const handleSwipe = (direction: "left" | "right") => {
    if (!isMobile) return;
    
    if (direction === "left") {
      navigateLeft();
    } else {
      navigateRight();
    }
  };

  return {
    handleSwipe,
    canSwipeLeft,
    canSwipeRight,
    currentPageIndex: currentIndex,
    totalPages: PAGES_ORDER.length,
    isMobile
  };
}
