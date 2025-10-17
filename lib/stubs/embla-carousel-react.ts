import * as React from "react";

type EmblaApiStub = {
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: () => boolean;
  canScrollNext: () => boolean;
  on: (_event: string, _handler: (api: EmblaApiStub) => void) => void;
  off: (_event: string, _handler: (api: EmblaApiStub) => void) => void;
};
export type EmblaOptionsType = Record<string, unknown>;
export type EmblaPluginType = unknown;

export type UseEmblaCarouselType = [React.RefCallback<HTMLDivElement>, EmblaApiStub];

const noop = () => {};

export default function useEmblaCarousel(
  options?: EmblaOptionsType,
  plugins?: EmblaPluginType,
): UseEmblaCarouselType {
  void options;
  void plugins;
  const ref = React.useCallback((node: HTMLDivElement | null) => {
    // store node if needed for future enhancements
    void node;
  }, []);

  const api = React.useMemo<EmblaApiStub>(() => {
    const handlerRegistry = new Map<string, Set<(api: EmblaApiStub) => void>>();

    let stub: EmblaApiStub;

    const register = (event: string, handler: (api: EmblaApiStub) => void) => {
      if (!handlerRegistry.has(event)) {
        handlerRegistry.set(event, new Set());
      }
      handlerRegistry.get(event)?.add(handler);
    };

    const unregister = (event: string, handler: (api: EmblaApiStub) => void) => {
      handlerRegistry.get(event)?.delete(handler);
    };

    const emit = (event: string) => {
      const listeners = handlerRegistry.get(event);
      if (!listeners) {
        return;
      }
      listeners.forEach(listener => listener(stub));
    };

    stub = {
      scrollPrev: () => emit("select"),
      scrollNext: () => emit("select"),
      canScrollPrev: () => false,
      canScrollNext: () => false,
      on: register,
      off: unregister,
    };

    return stub;
  }, []);

  return [ref, api];
}
