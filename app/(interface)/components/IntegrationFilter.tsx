'use client';

import Image from 'next/image';
import React from 'react';

import { cn } from '@/lib/utils';
import { ServiceId } from '@/app/(interface)/components/right-sidebar/data';

export type IntegrationService = {
  id: ServiceId;
  name: string;
  logo: string;
  accent: string;
  hover: string;
  border: string;
};

interface IntegrationFilterProps {
  services: IntegrationService[];
  activeServiceId: ServiceId | null;
  onServiceSelect: (serviceId: ServiceId | null) => void;
  allowClear?: boolean;
  offsetLeft?: number;
  className?: string;
}

export const IntegrationFilter: React.FC<IntegrationFilterProps> = ({
  services,
  activeServiceId,
  onServiceSelect,
  allowClear = false,
  offsetLeft = 80,
  className,
}) => {
  if (!services.length) {
    return null;
  }

  return (
    <div
      className={cn(
        'pointer-events-auto fixed top-4 flex flex-wrap gap-2 px-4 py-3 z-[60]',
        className,
      )}
      style={{ left: `${offsetLeft}px` }}
    >
      {services.map(service => {
        const isActive = activeServiceId === service.id;
        const handleClick = () => {
          if (isActive && allowClear) {
            onServiceSelect(null);
            return;
          }

          onServiceSelect(service.id);
        };

        return (
          <button
            key={service.id}
            type="button"
            onClick={handleClick}
            aria-pressed={isActive}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-slate-700 transition',
              isActive
                ? 'bg-white/90 shadow-[0_12px_24px_rgba(15,23,42,0.12)] border-indigo-300'
                : `${service.accent} ${service.hover} ${service.border}`,
            )}
          >
            <span className="relative h-6 w-6 overflow-hidden rounded-full bg-white/80">
              <Image src={service.logo} alt={`${service.name} logo`} fill sizes="24px" />
            </span>
            <span>{service.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export default IntegrationFilter;
