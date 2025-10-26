'use client';

import Image from 'next/image';
import React from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';
import { ServiceId } from './right-sidebar/data';

export type IntegrationService = {
  id: ServiceId;
  name: string;
  logo: string;
  accent: string;
  hover: string;
  border: string;
};

type IntegrationFilterProps = {
  services: IntegrationService[];
  activeServiceId: ServiceId | null;
  onServiceSelect: (serviceId: ServiceId | null) => void;
  allowClear?: boolean;
  className?: string;
};

export const IntegrationFilter: React.FC<IntegrationFilterProps> = ({
  services,
  activeServiceId,
  onServiceSelect,
  allowClear = false,
  className,
}) => {
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setPortalContainer(document.body);
  }, []);

  if (services.length === 0) {
    return null;
  }

  if (!portalContainer) {
    return null;
  }

  const handleServiceClick = (serviceId: ServiceId) => {
    if (allowClear && activeServiceId === serviceId) {
      onServiceSelect(null);
      return;
    }

    onServiceSelect(serviceId);
  };

  const content = (
    <div
      className={cn(
        'pointer-events-none fixed left-[calc(64px+32px)] top-5 z-[45] flex justify-start',
        className,
      )}
    >
      <div className="pointer-events-auto inline-flex flex-wrap items-center gap-1.5 rounded-full border border-border/70 bg-white/85 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-neutral-900/80">
        {services.map(service => {
          const isActive = activeServiceId === service.id;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => handleServiceClick(service.id)}
              aria-pressed={isActive}
              className={cn(
                'flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-medium transition-colors',
                isActive
                  ? 'border-slate-900/60 bg-slate-900 text-white shadow-sm dark:border-white/40'
                  : cn(
                      'text-muted-foreground hover:text-foreground hover:border-border/70 hover:bg-white/70 dark:hover:border-white/20 dark:hover:bg-neutral-800/70',
                      service.border,
                      service.hover,
                    ),
              )}
            >
              <span
                className={cn(
                  'relative h-5 w-5 overflow-hidden rounded-full border border-white/60 bg-white/80 dark:border-white/10 dark:bg-white/10',
                  service.accent,
                )}
              >
                <Image src={service.logo} alt={`${service.name} logo`} fill sizes="20px" />
              </span>
              <span>{service.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return createPortal(content, portalContainer);
};

export default IntegrationFilter;
