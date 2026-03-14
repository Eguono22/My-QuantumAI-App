import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend);

export default function PortfolioChart({ holdings }) {
  if (!holdings || holdings.length === 0) {
    return <div className="flex items-center justify-center h-48 text-zinc-500">No holdings to display</div>;
  }
  const data = {
    labels: holdings.map(h => h.asset),
    datasets: [{
      data: holdings.map(h => h.current_value),
      backgroundColor: ['#151515','#343434','#ffbf00','#e5ab00','#16a34a','#dc2626','#0ea5e9','#f97316'],
      borderColor: '#ffffff',
      borderWidth: 2,
    }],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'right', labels: { color: '#3f3f46', font: { size: 12 } } },
      tooltip: {
        backgroundColor: '#151515',
        borderColor: 'rgba(255, 191, 0, 0.6)',
        borderWidth: 1,
        callbacks: {
          label: (ctx) => `${ctx.label}: $${ctx.raw.toFixed(2)}`
        }
      }
    }
  };
  return <Doughnut data={data} options={options} />;
}
