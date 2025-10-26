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
        'pointer-events-none fixed left-[64px] right-[64px] top-4 z-[70] flex justify-center px-4 sm:justify-start md:top-5',
        className,
      )}
    >
      <div className="pointer-events-auto inline-flex items-center gap-3 rounded-2xl border border-border/60 bg-white/90 px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md transition-colors dark:border-white/10 dark:bg-neutral-900/85">
        <div className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground sm:flex">
          <span>Integrations</span>
          <span className="h-4 w-px bg-border/60" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {allowClear && (
            <button
              type="button"
              onClick={() => onServiceSelect(null)}
              aria-label="Show all integrations"
              className={cn(
                'flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-all duration-150 hover:-translate-y-px hover:border-border/70 hover:bg-white',
                activeServiceId === null &&
                  'border-slate-900/60 bg-slate-900 text-white shadow-sm hover:-translate-y-0 dark:border-white/30 dark:bg-white/15 dark:text-white',
              )}
            >
              <span>All</span>
            </button>
          )}
          {services.map(service => {
            const isActive = activeServiceId === service.id;

            return (
              <button
                key={service.id}
                type="button"
                onClick={() => handleServiceClick(service.id)}
                aria-pressed={isActive}
                className={cn(
                  'group flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-medium transition-all duration-150 hover:-translate-y-px',
                  isActive
                    ? 'border-slate-900/60 bg-slate-900 text-white shadow-md dark:border-white/30 dark:bg-white/10 dark:text-white'
                    : cn(
                        'text-muted-foreground hover:border-border/70 hover:bg-white dark:text-neutral-300 dark:hover:border-white/20 dark:hover:bg-neutral-800/80',
                        service.border,
                        service.hover,
                      ),
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/95 shadow-sm ring-1 ring-black/5 transition-all duration-150 dark:border-white/10 dark:bg-white/10 dark:ring-black/40',
                    service.accent,
                    isActive && 'scale-105 border-white/80 ring-black/10 dark:border-white/30',
                  )}
                >
                  <Image
                    src={service.logo}
                    alt={`${service.name} logo`}
                    fill
                    sizes="24px"
                    style={{ objectFit: 'contain' }}
                  />
                </span>
                <span className="whitespace-nowrap">{service.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(content, portalContainer);
};

export default IntegrationFilter;
