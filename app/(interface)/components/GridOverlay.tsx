"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface GridOverlayProps {
  zoom: number;
  camera: { x: number; y: number };
  thickness: number;
  visible: boolean;
  darkMode?: boolean;
}

interface SpacingInfo {
  screen: number;
  world: number;
}

const BASE_WORLD_SPACING = 50; // px at zoom = 1
const MIN_SCREEN_SPACING = 40;
const MAX_SCREEN_SPACING = 140;
const MAJOR_LINE_FREQUENCY = 5;
const ANIMATION_DURATION = 200; // ms
const SNAP_DELAY = 300; // ms

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const computeSpacing = (zoomValue: number): SpacingInfo => {
  const zoomFactor = Math.max(zoomValue / 100, 0.0001);
  let world = BASE_WORLD_SPACING;
  let screen = world * zoomFactor;

  let guard = 0;
  while (screen < MIN_SCREEN_SPACING && guard < 10) {
    world *= 2;
    screen = world * zoomFactor;
    guard += 1;
  }

  guard = 0;
  while (screen > MAX_SCREEN_SPACING && guard < 10) {
    world /= 2;
    screen = world * zoomFactor;
    guard += 1;
  }

  return { screen, world };
};

export function GridOverlay({
  zoom,
  camera,
  thickness,
  visible,
  darkMode,
}: GridOverlayProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const targetSpacingRef = useRef<SpacingInfo | null>(null);
  const spacingAnimationRef = useRef<number>();
  const snapTimeoutRef = useRef<number>();
  const [animatedSpacing, setAnimatedSpacing] = useState<SpacingInfo>(() =>
    computeSpacing(zoom),
  );
  const animatedSpacingRef = useRef(animatedSpacing);

  const updateCanvasSize = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    setDimensions({ width: rect.width, height: rect.height });
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext("2d");
    if (context) {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateCanvasSize();

    const resizeObserver = new ResizeObserver(() => updateCanvasSize());
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [updateCanvasSize]);

  useEffect(() => {
    const spacing = computeSpacing(zoom);
    targetSpacingRef.current = spacing;

    const startSpacing = animatedSpacingRef.current;

    if (spacingAnimationRef.current) {
      cancelAnimationFrame(spacingAnimationRef.current);
    }
    if (snapTimeoutRef.current) {
      window.clearTimeout(snapTimeoutRef.current);
    }

    if (
      Math.abs(startSpacing.screen - spacing.screen) < 0.1 &&
      Math.abs(startSpacing.world - spacing.world) < 0.1
    ) {
      animatedSpacingRef.current = spacing;
      setAnimatedSpacing(spacing);
      return;
    }

    let animationStart: number | null = null;

    const animate = (timestamp: number) => {
      if (animationStart == null) {
        animationStart = timestamp;
      }

      const progress = Math.min((timestamp - animationStart) / ANIMATION_DURATION, 1);
      const eased = easeOutCubic(progress);

      const nextScreen =
        startSpacing.screen + (spacing.screen - startSpacing.screen) * eased;
      const nextWorld =
        startSpacing.world + (spacing.world - startSpacing.world) * eased;

      const nextSpacing = { screen: nextScreen, world: nextWorld };
      animatedSpacingRef.current = nextSpacing;
      setAnimatedSpacing(nextSpacing);

      if (progress < 1) {
        spacingAnimationRef.current = requestAnimationFrame(animate);
      } else {
        snapTimeoutRef.current = window.setTimeout(() => {
          if (targetSpacingRef.current) {
            animatedSpacingRef.current = targetSpacingRef.current;
            setAnimatedSpacing(targetSpacingRef.current);
          }
        }, SNAP_DELAY);
      }
    };

    spacingAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (spacingAnimationRef.current) {
        cancelAnimationFrame(spacingAnimationRef.current);
      }
      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
    };
  }, [zoom]);

  useEffect(() => {
    animatedSpacingRef.current = animatedSpacing;
  }, [animatedSpacing]);

  const drawGrid = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const { width, height } = dimensions;
    if (width === 0 || height === 0) {
      return;
    }

    context.clearRect(0, 0, width, height);

    if (!visible || thickness <= 0) {
      return;
    }

    const spacing = animatedSpacingRef.current.screen;
    if (spacing <= 0.5) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const minorColor = darkMode
      ? "rgba(255,255,255,0.08)"
      : "rgba(15,23,42,0.08)";
    const majorColor = darkMode
      ? "rgba(255,255,255,0.16)"
      : "rgba(15,23,42,0.16)";

    const minorWidth = Math.max(1, thickness);
    const majorWidth = Math.max(1, thickness * 1.5);
    const minorAlignOffset = minorWidth % 2 === 0 ? 0 : 0.5;
    const majorAlignOffset = majorWidth % 2 === 0 ? 0 : 0.5;

    const offsetX = ((camera.x % spacing) + spacing) % spacing;
    const offsetY = ((camera.y % spacing) + spacing) % spacing;

    context.beginPath();
    for (let x = offsetX - spacing; x <= width + spacing; x += spacing) {
      const alignedX = Math.round(x) + minorAlignOffset;
      context.moveTo(alignedX, 0);
      context.lineTo(alignedX, height);
    }
    for (let y = offsetY - spacing; y <= height + spacing; y += spacing) {
      const alignedY = Math.round(y) + minorAlignOffset;
      context.moveTo(0, alignedY);
      context.lineTo(width, alignedY);
    }
    context.strokeStyle = minorColor;
    context.lineWidth = minorWidth;
    context.stroke();

    const majorSpacing = spacing * MAJOR_LINE_FREQUENCY;
    const majorOffsetX = ((camera.x % majorSpacing) + majorSpacing) % majorSpacing;
    const majorOffsetY = ((camera.y % majorSpacing) + majorSpacing) % majorSpacing;

    context.beginPath();
    for (let x = majorOffsetX - majorSpacing; x <= width + majorSpacing; x += majorSpacing) {
      const alignedX = Math.round(x) + majorAlignOffset;
      context.moveTo(alignedX, 0);
      context.lineTo(alignedX, height);
    }
    for (let y = majorOffsetY - majorSpacing; y <= height + majorSpacing; y += majorSpacing) {
      const alignedY = Math.round(y) + majorAlignOffset;
      context.moveTo(0, alignedY);
      context.lineTo(width, alignedY);
    }
    context.strokeStyle = majorColor;
    context.lineWidth = majorWidth;
    context.stroke();
  }, [camera.x, camera.y, darkMode, dimensions, thickness, visible]);

  useEffect(() => {
    drawGrid();
  }, [drawGrid, animatedSpacing]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 -z-10 pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 150ms ease" }}
      aria-hidden
    >
      <canvas ref={canvasRef} />
    </div>
  );
}
