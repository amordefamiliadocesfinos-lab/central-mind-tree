import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { OPERATIONAL_MODULES, saveLastOperationalContext } from '@/lib/operationalContext';
export function OperationalContextTracker() {
  const location = useLocation();
  useEffect(() => {
    const item = OPERATIONAL_MODULES.find(({ path }) => location.pathname.startsWith(path));
    if (item) saveLastOperationalContext({ module: item.module, path: `${location.pathname}${location.search}`, title: `Continuar em ${item.module}`, status: 'Agora', updatedAt: new Date().toISOString() });
  }, [location.pathname, location.search]);
  return null;
}
