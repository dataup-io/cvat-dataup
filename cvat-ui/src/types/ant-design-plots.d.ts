// Copyright (C) CVAT.ai Corporation
//
// SPDX-License-Identifier: MIT

// Type declarations for @ant-design/plots
declare module '@ant-design/plots' {
  import { ComponentType } from 'react';

  export interface BaseConfig {
    data: any[];
    height?: number;
    width?: number;
    autoFit?: boolean;
    padding?: number | number[];
    appendPadding?: number | number[];
    renderer?: 'canvas' | 'svg';
    pixelRatio?: number;
    limitInPlot?: boolean;
    locale?: string;
    defaultInteractions?: string[];
    interactions?: any[];
    statistic?: any;
    onReady?: (plot: any) => void;
    onEvent?: (chart: any, event: any) => void;
  }

  export interface LineConfig extends BaseConfig {
    xField: string;
    yField: string;
    seriesField?: string;
    smooth?: boolean;
    stepType?: 'vh' | 'hvh' | 'hv';
    connectNulls?: boolean;
    lineStyle?: any;
    point?: any;
    area?: any;
    color?: string | string[] | ((datum: any) => string);
    tooltip?: any;
    legend?: any;
    xAxis?: any;
    yAxis?: any;
    slider?: any;
    scrollbar?: any;
    meta?: any;
    geometryOptions?: any[];
    theme?: string | any;
    pattern?: any;
    state?: any;
    animation?: any;
  }

  export interface PieConfig extends BaseConfig {
    angleField: string;
    colorField?: string;
    radius?: number;
    innerRadius?: number;
    startAngle?: number;
    endAngle?: number;
    color?: string | string[] | ((datum: any) => string);
    pieStyle?: any;
    tooltip?: any;
    label?: any;
    legend?: any;
    statistic?: any;
    theme?: string | any;
    pattern?: any;
    state?: any;
    animation?: any;
  }

  export interface ColumnConfig extends BaseConfig {
    xField: string;
    yField: string;
    seriesField?: string;
    groupField?: string;
    isGroup?: boolean;
    isStack?: boolean;
    isRange?: boolean;
    isPercent?: boolean;
    color?: string | string[] | ((datum: any) => string);
    columnStyle?: any;
    columnWidthRatio?: number;
    marginRatio?: number;
    tooltip?: any;
    label?: any;
    legend?: any;
    xAxis?: any;
    yAxis?: any;
    meta?: any;
    theme?: string | any;
    pattern?: any;
    state?: any;
    animation?: any;
    scrollbar?: any;
    slider?: any;
  }

  export const Line: ComponentType<LineConfig>;
  export const Pie: ComponentType<PieConfig>;
  export const Column: ComponentType<ColumnConfig>;
  export const Bar: ComponentType<any>;
  export const Area: ComponentType<any>;
  export const Scatter: ComponentType<any>;
  export const Rose: ComponentType<any>;
  export const Histogram: ComponentType<any>;
  export const Heatmap: ComponentType<any>;
  export const Box: ComponentType<any>;
  export const Violin: ComponentType<any>;
  export const Treemap: ComponentType<any>;
  export const Sunburst: ComponentType<any>;
  export const Liquid: ComponentType<any>;
  export const Bullet: ComponentType<any>;
  export const Funnel: ComponentType<any>;
  export const Waterfall: ComponentType<any>;
  export const WordCloud: ComponentType<any>;
  export const DualAxes: ComponentType<any>;
  export const Mix: ComponentType<any>;
  export const Gauge: ComponentType<any>;
  export const Progress: ComponentType<any>;
  export const RingProgress: ComponentType<any>;
  export const TinyLine: ComponentType<any>;
  export const TinyArea: ComponentType<any>;
  export const TinyColumn: ComponentType<any>;
}