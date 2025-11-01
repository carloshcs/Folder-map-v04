import { useCallback, useEffect, useMemo, useState } from 'react';
import { type IntegrationService } from '@/app/(interface)/components/IntegrationFilter';
import { type FolderItem, type ServiceId } from '../../../right-sidebar/data';
import { buildFoxTree, SERVICE_DETAILS } from '../model';
import { type FoxTreeNode } from '../config';

export const useServiceFilter = (folders: FolderItem[]) => {
  const [activeServiceId, setActiveServiceId] = useState<ServiceId | null>(null);

  const tree = useMemo<FoxTreeNode>(() => buildFoxTree(folders), [folders]);

  const availableServices = useMemo<IntegrationService[]>(() => {
    const services: IntegrationService[] = [];
    tree.children?.forEach(child => {
      if (!child.serviceId) return;
      if ((child.children?.length ?? 0) === 0) return;
      const details = SERVICE_DETAILS[child.serviceId];
      services.push({ id: child.serviceId, ...details });
    });
    return services;
  }, [tree]);

  const handleServiceSelect = useCallback((serviceId: ServiceId | null) => {
    setActiveServiceId(current => {
      if (serviceId === null) return null;
      if (current === serviceId) return null;
      return serviceId;
    });
  }, []);

  useEffect(() => {
    if (activeServiceId && !availableServices.some(service => service.id === activeServiceId)) {
      setActiveServiceId(null);
    }
  }, [activeServiceId, availableServices]);

  const filteredTree = useMemo<FoxTreeNode>(() => {
    if (!activeServiceId) return tree;
    return {
      ...tree,
      children: tree.children?.filter(child => child.serviceId === activeServiceId) ?? [],
    };
  }, [tree, activeServiceId]);

  return { tree, filteredTree, availableServices, activeServiceId, handleServiceSelect } as const;
};

