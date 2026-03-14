import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function PriceChart({ history, symbol }) {
  if (!history || history.length === 0) {
    return <div className="flex items-center justify-center h-48 text-zinc-500">No price data</div>;
  }
  const step = Math.max(1, Math.floor(history.length / 50));
  const sampled = history.filter((_, i) => i % step === 0);
  const data = {
    labels: sampled.map(h => new Date(h.timestamp).toLocaleDateString()),
    datasets: [{
      label: symbol,
      data: sampled.map(h => h.close),
      borderColor: '#151515',
      backgroundColor: 'rgba(255, 191, 0, 0.2)',
      fill: true,
      tension: 0.28,
      pointRadius: 0,
      borderWidth: 2.2,
    }],
  };
  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: '#151515',
        borderColor: 'rgba(255, 191, 0, 0.6)',
        borderWidth: 1
      }
    },
    scales: {
      x: { ticks: { color: '#6a6a6a', maxTicksLimit: 8 }, grid: { color: 'rgba(0, 0, 0, 0.08)' } },
      y: { ticks: { color: '#6a6a6a', callback: (v) => `$${v.toFixed(0)}` }, grid: { color: 'rgba(0, 0, 0, 0.08)' } }
    }
  };
  return <Line data={data} options={options} />;
}
