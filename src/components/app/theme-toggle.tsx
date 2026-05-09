'use client';

import { useEffect, useState } from 'react';
import { MonitorCog, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const active = theme ?? 'system';
  const current = resolvedTheme === 'light' ? 'clair' : 'sombre';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-full"
          aria-label={`Changer de thème (actuel: ${mounted ? current : 'chargement'})`}
        >
          {mounted ? (
            resolvedTheme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />
          ) : (
            <MonitorCog className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Thème</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme('dark')} className="justify-between">
          Sombre
          {active === 'dark' ? <Moon className="h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('light')} className="justify-between">
          Clair
          {active === 'light' ? <Sun className="h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="justify-between">
          Système
          {active === 'system' ? <MonitorCog className="h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
