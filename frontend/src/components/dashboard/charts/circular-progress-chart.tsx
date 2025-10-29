"use client"

import * as React from 'react'
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge'

interface CircularProgressChartProps {
  percentage: number
  className?: string
}

export default function CircularProgressChart({ percentage, className }: CircularProgressChartProps) {
  const settings = {
    width: 200,
    height: 200,
    value: percentage,
  }

  return (
    <div className={`circular-progress-text ${className || ''}`}>
      <Gauge
        {...settings}
        cornerRadius="50%"
        sx={{
          [`& .${gaugeClasses.valueText}`]: {
            fontSize: 40,
            fontWeight: 'bold',
            fill: 'rgb(var(--foreground)) !important', // Force with !important
          },
          [`& .${gaugeClasses.valueArc}`]: {
            fill: '#3183FF', // Professional blue color
          },
          [`& .${gaugeClasses.referenceArc}`]: {
            fill: 'rgb(var(--muted))', // Use CSS custom property for theme-aware color
          },
        }}
        className="circular-progress-text"
      />
    </div>
  )
}

