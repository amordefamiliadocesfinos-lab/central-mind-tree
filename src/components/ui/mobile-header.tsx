import * as React from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
  backTo?: string;
  onBack?: () => void;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function MobileHeader({
  title,
  showBack = true,
  backTo = "/",
  onBack,
  showSearch = false,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Buscar...",
  actions,
  className,
}: MobileHeaderProps) {
  const navigate = useNavigate();
  const [isSearching, setIsSearching] = React.useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(backTo);
    }
  };

  return (
    <header 
      className={cn(
        "sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        "border-b border-border safe-area-pt",
        className
      )}
    >
      <div className="flex items-center h-14 px-4 gap-2">
        {/* Search mode */}
        {isSearching && showSearch ? (
          <>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="pl-9 pr-9 h-10"
              />
              {searchValue && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => onSearchChange?.("")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setIsSearching(false);
                onSearchChange?.("");
              }}
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            {showBack && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleBack}
                className="h-10 w-10 shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            
            <h1 className="flex-1 text-lg font-semibold truncate">
              {title}
            </h1>
            
            {showSearch && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearching(true)}
                className="h-10 w-10 shrink-0"
              >
                <Search className="h-5 w-5" />
              </Button>
            )}
            
            {actions}
          </>
        )}
      </div>
    </header>
  );
}
