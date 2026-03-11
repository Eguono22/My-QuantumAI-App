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
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 2,
    }],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: { mode: 'index', intersect: false }
    },
    scales: {
      x: { ticks: { color: '#6B7280', maxTicksLimit: 8 }, grid: { color: '#374151' } },
      y: { ticks: { color: '#6B7280', callback: (v) => `$${v.toFixed(0)}` }, grid: { color: '#374151' } }
    }
  };
  return <Line data={data} options={options} />;
}
