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

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4 pt-6',
        className,
      )}
    >
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-3 shadow-[0_20px_45px_rgba(15,23,42,0.12)] backdrop-blur">
        {services.map(service => {
          const isActive = activeServiceId === service.id;

          return (
            <button
              key={service.id}
              type="button"
              onClick={() => handleServiceClick(service.id)}
              aria-pressed={isActive}
              className={cn(
                'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-slate-700 transition-colors',
                isActive
                  ? 'border-indigo-300 bg-white text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.16)]'
                  : cn(service.accent, service.hover, service.border),
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
    </div>
  );
};

export default IntegrationFilter;
