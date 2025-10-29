"use client";

import * as React from "react";
import { useTheme, styled } from "@mui/material/styles";
import {
  BarChart,
  type BarLabelProps,
  type BarProps,
} from "@mui/x-charts/BarChart";
import { useAnimate, useAnimateBar, useDrawingArea } from "@mui/x-charts/hooks";
import { PiecewiseColorLegend } from "@mui/x-charts/ChartsLegend";
import { interpolateObject } from "@mui/x-charts-vendor/d3-interpolate";
import { DepartmentData } from "@/lib/mock-data";

interface HorizontalBarChartProps {
  data: DepartmentData[];
  className?: string;
}

export default function HorizontalBarChart({
  data,
  className,
}: HorizontalBarChartProps) {
  return (
    <div className={className}>
      <div className="relative w-full overflow-hidden">
        <BarChart
          height={200}
          dataset={data as unknown as Record<string, string | number>[]}
          series={[
            {
              id: "department",
              dataKey: "value",
              stack: "department value",
              valueFormatter: (value: number | null) => `${value}K`,
            },
          ]}
          layout="horizontal"
          xAxis={[
            {
              id: "value",
              min: 0,
              max: Math.max(...data.map((d) => d.value)) * 1.2,
              colorMap: {
                type: "piecewise",
                thresholds: [100, 130],
                colors: ["#EF4444", "#F59E0B", "#3183FF"], // Professional color scheme
              },
              valueFormatter: (value: number) => `${value}K`,
            },
          ]}
          barLabel={(v) => `${v.value}K`}
          yAxis={[
            {
              scaleType: "band",
              dataKey: "name",
              width: 100,
              tickLabelStyle: { fill: "#6B7280", fontSize: 12 },
            },
          ]}
          slots={{
            legend: PiecewiseColorLegend,
            barLabel: BarLabelAtBase,
            bar: BarShadedBackground,
          }}
          margin={{ top: 20, right: 80, left: 0, bottom: 20 }}
        />
      </div>
    </div>
  );
}

// Custom bar component with shaded background
export function BarShadedBackground(props: BarProps) {
  const {
    ownerState,
    skipAnimation: _skipAnimation,
    id: _id,
    dataIndex: _dataIndex,
    xOrigin: _xOrigin,
    yOrigin: _yOrigin,
    ...other
  } = props;
  const theme = useTheme();

  const animatedProps = useAnimateBar(props);
  const { width } = useDrawingArea();

  return (
    <React.Fragment>
      {/* Shaded background bar */}
      <rect
        {...other}
        fill={(theme.vars || theme).palette.text.primary}
        opacity={theme.palette.mode === "dark" ? 0.05 : 0.08}
        x={other.x}
        width={width}
      />
      {/* Main animated bar */}
      <rect
        {...other}
        filter={ownerState.isHighlighted ? "brightness(120%)" : undefined}
        opacity={ownerState.isFaded ? 0.3 : 1}
        data-highlighted={ownerState.isHighlighted || undefined}
        data-faded={ownerState.isFaded || undefined}
        {...animatedProps}
      />
    </React.Fragment>
  );
}

// Styled text component for bar labels
const Text = styled("text")(({ theme }) => ({
  ...theme?.typography?.body2,
  stroke: "none",
  fill: (theme.vars || theme).palette.common.white,
  transition: "opacity 0.2s ease-in, fill 0.2s ease-in",
  textAnchor: "start",
  dominantBaseline: "central",
  pointerEvents: "none",
  fontWeight: 600,
  fontSize: "12px",
}));

// Custom bar label component with animation
function BarLabelAtBase(props: BarLabelProps) {
  const {
    seriesId: _seriesId,
    dataIndex: _dataIndex,
    color: _color,
    isFaded: _isFaded,
    isHighlighted: _isHighlighted,
    classes: _classes,
    xOrigin,
    yOrigin: _yOrigin,
    x: _x,
    y,
    width: _width,
    height,
    layout: _layout,
    skipAnimation,
    ...otherProps
  } = props;

  const animatedProps = useAnimate(
    { x: xOrigin + 8, y: y + height / 2 },
    {
      initialProps: { x: xOrigin, y: y + height / 2 },
      createInterpolator: interpolateObject,
      transformProps: (p) => p,
      applyProps: (element: SVGTextElement, p) => {
        element.setAttribute("x", p.x.toString());
        element.setAttribute("y", p.y.toString());
      },
      skip: skipAnimation,
    }
  );

  return <Text {...otherProps} {...animatedProps} />;
}
