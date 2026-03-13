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
      backgroundColor: ['#22d3ee','#0ea5e9','#2dd4bf','#34d399','#a3e635','#facc15','#f59e0b','#fb7185'],
      borderColor: '#0b1325',
      borderWidth: 2,
    }],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'right', labels: { color: '#cbd5e1', font: { size: 12 } } },
      tooltip: {
        backgroundColor: '#0b1325',
        borderColor: 'rgba(34, 211, 238, 0.4)',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `${ctx.label}: $${ctx.raw.toFixed(2)}`
        }
      }
    }
  };
  return <Doughnut data={data} options={options} />;
}
