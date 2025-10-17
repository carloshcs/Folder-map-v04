import * as React from "react";

export interface ResponsiveContainerProps {
  width?: number | string;
  height?: number | string;
  children?: React.ReactNode;
}

export const ResponsiveContainer: React.FC<ResponsiveContainerProps> = ({
  width = "100%",
  height = "100%",
  children,
}) => (
  <div style={{ width, height }}>{children}</div>
);

export interface TooltipPayloadItem {
  color?: string;
  dataKey?: string;
  name?: string;
  value?: number;
  payload: Record<string, unknown>;
}

export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  labelClassName?: string;
  formatter?: (
    value: number,
    name: string,
    item: TooltipPayloadItem,
    index: number,
    payload: Record<string, unknown>,
  ) => React.ReactNode;
  labelFormatter?: (value: React.ReactNode, payload?: TooltipPayloadItem[]) => React.ReactNode;
  content?: React.ReactNode;
  wrapperStyle?: React.CSSProperties;
}

export const Tooltip: React.FC<TooltipProps> = ({ content }) => (
  <>{content ?? null}</>
);

export interface LegendPayloadItem {
  color?: string;
  dataKey?: string;
  value?: string;
  payload?: Record<string, unknown>;
}

export interface LegendProps {
  payload?: LegendPayloadItem[];
  verticalAlign?: "top" | "bottom" | "middle" | "left" | "right";
  content?: React.ReactNode;
}

export const Legend: React.FC<LegendProps> = ({ content }) => (
  <>{content ?? null}</>
);
