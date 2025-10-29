"use client"

import * as React from 'react'
import Box from '@mui/material/Box'
import { LineChart } from '@mui/x-charts/LineChart'
import { AverageContractPriceData } from "@/lib/mock-data"

interface LineAreaChartProps {
  data: AverageContractPriceData[]
  className?: string
}

export default function LineAreaChart({ data, className }: LineAreaChartProps) {
  // Extract months and prices for cleaner data handling
  const months = data.map(item => item.month)
  const prices = data.map(item => item.price)
  
  return (
    <div className={className}>
      <Box sx={{ width: '100%', height: 200, backgroundColor: 'transparent' }}>
        <LineChart
          series={[
            {
              data: prices,
              label: 'Contract Price',
              color: '#3183FF',
              area: false,
              curve: 'monotoneX',
              showMark: true,
            }
          ]}
          xAxis={[
            {
              scaleType: 'point',
              data: months,
              tickSize: 0,
              tickLabelStyle: { 
                fill: '#9CA3AF', 
                fontSize: 10,
                fontWeight: 500,
              },
            },
          ]}
          yAxis={[
            {
              width: 50,
              tickSize: 0,
              tickLabelStyle: { 
                fill: '#9CA3AF', 
                fontSize: 10,
                fontWeight: 500,
              },
              valueFormatter: (value: number) => `$${value}K`,
            },
          ]}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          grid={{ 
            horizontal: true, 
            vertical: false,
          }}
          slotProps={{
            legend: {
              position: { vertical: 'top', horizontal: 'end' },
            },
          }}
          sx={{
            backgroundColor: 'transparent',
            '& .MuiChartsAxis-root': {
              backgroundColor: 'transparent',
            },
            '& .MuiChartsAxis-line': {
              stroke: '#E5E7EB',
            },
            '& .MuiChartsAxis-tick': {
              stroke: '#E5E7EB',
            },
            '& .MuiChartsAxis-tickLabel': {
              fill: '#9CA3AF',
            },
            '& .MuiChartsGrid-root': {
              stroke: '#E5E7EB',
            },
            '& .MuiChartsLegend-root': {
              fontSize: '12px',
              fontWeight: 500,
              backgroundColor: 'transparent',
            },
            '& .MuiChartsLegend-mark': {
              borderRadius: '2px',
            },
          }}
        />
      </Box>
    </div>
  )
}

