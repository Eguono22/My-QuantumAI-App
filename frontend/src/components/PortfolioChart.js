import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend);

export default function PortfolioChart({ holdings }) {
  if (!holdings || holdings.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-500">No holdings to display</div>;
  }
  const data = {
    labels: holdings.map(h => h.asset),
    datasets: [{
      data: holdings.map(h => h.current_value),
      backgroundColor: ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#06B6D4','#84CC16','#F97316'],
      borderColor: '#1F2937',
      borderWidth: 2,
    }],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'right', labels: { color: '#9CA3AF', font: { size: 12 } } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: $${ctx.raw.toFixed(2)}`
        }
      }
    }
  };
  return <Doughnut data={data} options={options} />;
}
