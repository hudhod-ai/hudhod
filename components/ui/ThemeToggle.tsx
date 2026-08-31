"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useColorMode } from "@/hooks/useColorMode";

export function ThemeToggle() {
  const { mode, toggle } = useColorMode();

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
      {mode === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
