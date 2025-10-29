"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface HalfCircleProps {
  className?: string
  size?: number
  strokeWidth?: number
  fill?: string
  stroke?: string
  centerX?: number
}

// Pure function to generate vertical half circle SVG path (standing position, rotated 270°)
export function generateHalfCirclePath(
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number = 270,
  endAngle: number = 90
): string {
  const start = polarToCartesian(centerX, centerY, radius, endAngle)
  const end = polarToCartesian(centerX, centerY, radius, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"
  
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
  ].join(" ")
}

// Function to generate multiple overlapping semicircles with same starting point
export function generateOverlappingSemicircles(
  startX: number,
  startY: number,
  startYear: string,
  endYear: string,
  title: string,
  semicircles: Array<{
    radius: number
    color: string
    className?: string
  }>
): React.ReactElement {
  return (
    <svg width="300" height="150" viewBox="0 0 300 150" className="overflow-visible">
      {/* Gradient definitions */}
      <defs>
        <radialGradient id="radialGradient" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stopColor="#3183FF" />
          <stop offset="100%" stopColor="#E0F2FE" />
        </radialGradient>
      </defs>
      
      {semicircles.map((semicircle, index) => {
        const endX = startX + (semicircle.radius * 2)
        const centerX = startX + semicircle.radius
        const topY = startY - semicircle.radius
        
        return (
          <g key={index}>
            {/* Semicircle path */}
            <path
              d={`M ${startX} ${startY} A ${semicircle.radius} ${semicircle.radius} 0 0 1 ${endX} ${startY}`}
              fill={semicircle.color}
              className={semicircle.className || "transition-all duration-300"}
            />
            
            {/* Three grey dots */}
            <circle cx={startX} cy={startY} r="3" fill="#6B7280" /> {/* Left dot */}
            <circle cx={endX} cy={startY} r="3" fill="#6B7280" /> {/* Right dot */}
            <circle cx={centerX} cy={topY} r="3" fill="#6B7280" /> {/* Center top dot */}
          </g>
        )
      })}
      
      {/* Year labels */}
      <text x={startX} y={startY + 20} textAnchor="start" fontSize="12" fill="#6B7280">
        {startYear}
      </text>
      <text x={startX + 200} y={startY + 20} textAnchor="end" fontSize="12" fill="#6B7280">
        {endYear}
      </text>
      
      {/* Title */}
      <text x={startX + 100} y={startY + 40} textAnchor="middle" fontSize="14" fill="#374151" fontWeight="500">
        {title}
      </text>
    </svg>
  )
}

// Helper function to convert polar coordinates to cartesian
function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  }
}

export default function HalfCircle({ 
  className, 
  size = 200, 
  strokeWidth = 0,
  fill = "hsl(var(--primary))",
  stroke = "none",
  centerX: customCenterX
}: HalfCircleProps) {
  const radius = size / 2 - 20 // Leave some padding
  const centerX = customCenterX ?? size / 2 // Use custom centerX or default to center
  const centerY = size / 2 - 10 // Adjust for horizontal position
  
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg 
        width={size} 
        height={size / 2} 
        viewBox={`0 0 ${size} ${size / 2}`} 
        className="overflow-visible"
      >
        <path
          d={generateHalfCirclePath(centerX, centerY, radius)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
          className="transition-all duration-300"
        />
      </svg>
    </div>
  )
}

