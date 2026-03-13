import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function PriceChart({ history, symbol }) {
  if (!history || history.length === 0) {
    return <div className="flex items-center justify-center h-48 text-gray-500">No price data</div>;
  }
  const step = Math.max(1, Math.floor(history.length / 50));
  const sampled = history.filter((_, i) => i % step === 0);
  const data = {
    labels: sampled.map(h => new Date(h.timestamp).toLocaleDateString()),
    datasets: [{
      label: symbol,
      data: sampled.map(h => h.close),
      borderColor: '#22d3ee',
      backgroundColor: 'rgba(34, 211, 238, 0.14)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2.5,
    }],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#0b1325',
        borderColor: 'rgba(34, 211, 238, 0.4)',
        borderWidth: 1
      }
    },
    scales: {
      x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 }, grid: { color: 'rgba(148, 163, 184, 0.15)' } },
      y: { ticks: { color: '#94a3b8', callback: (v) => `$${v.toFixed(0)}` }, grid: { color: 'rgba(148, 163, 184, 0.15)' } }
    }
  };
  return <Line data={data} options={options} />;
}
