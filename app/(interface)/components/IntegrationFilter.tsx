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
  /**
   * When true (default) the filter is rendered in a body-level portal so it remains fixed to the viewport.
   * Set to false to keep the filter positioned relative to its parent container.
   */
  mountToBody?: boolean;
};

export const IntegrationFilter: React.FC<IntegrationFilterProps> = ({
  services,
  activeServiceId,
  onServiceSelect,
  allowClear = false,
  className,
  mountToBody = true,
}) => {
  const [portalContainer, setPortalContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!mountToBody) {
      return;
    }

    setPortalContainer(document.body);
  }, [mountToBody]);

  if (services.length === 0) {
    return null;
  }

  const handleServiceClick = (serviceId: ServiceId) => {
    if (allowClear && activeServiceId === serviceId) {
      onServiceSelect(null);
      return;
    }
    onServiceSelect(serviceId);
  };

  const positioningClassName = mountToBody
    ? 'fixed left-[64px] right-[64px] top-4 md:top-5'
    : 'absolute left-[64px] right-[64px] top-4 md:top-5';

  const content = (
    <div
      className={cn(
        'pointer-events-none z-[70] flex justify-center px-4 sm:justify-start',
        positioningClassName,
        className,
      )}
    >
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-black/15 bg-white/95 px-3 py-1.5 text-xs font-medium shadow-lg backdrop-blur-md transition-colors dark:border-white/10 dark:bg-neutral-900/95">
        <div className="flex flex-wrap items-center gap-1.5">
          {services.map(service => {
            const isActive = activeServiceId === service.id;
            return (
              <button
                key={service.id}
                type="button"
                onClick={() => handleServiceClick(service.id)}
                aria-pressed={isActive}
                className={cn(
                  'group flex h-8 items-center gap-2 rounded-full border px-3 text-[11px] font-medium transition-all duration-150 hover:-translate-y-px',
                  isActive
                    ? 'border-black bg-slate-900 text-white shadow-md dark:border-white/20 dark:bg-neutral-800 dark:text-white'
                    : cn(
                        'border-black/20 text-muted-foreground hover:bg-white dark:border-white/10 dark:text-neutral-300 dark:hover:bg-neutral-800/80',
                        service.hover,
                      ),
                )}
              >
                <span
                  className={cn(
                    'relative flex h-6 w-6 flex-shrink-0 items-center justify-center transition-all duration-150',
                    isActive && 'scale-105',
                  )}
                >
                  <Image
                    src={service.logo}
                    alt={`${service.name} logo`}
                    width={24}
                    height={24}
                    className="h-full w-full object-contain"
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

  if (!mountToBody) {
    return content;
  }

  if (!portalContainer) {
    return null;
  }

  return createPortal(content, portalContainer);
};

export default IntegrationFilter;