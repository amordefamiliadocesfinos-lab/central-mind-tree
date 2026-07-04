import { Link } from "react-router-dom";
import { Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function NucleoLauncherButton() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
        >
          <Link to="/nucleo" aria-label="Núcleo do Painel Central">
            <Brain className="h-4 w-4" />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">Núcleo do Painel Central</TooltipContent>
    </Tooltip>
  );
}
