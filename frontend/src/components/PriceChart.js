import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function PriceChart({ history, symbol }) {
  if (!history || history.length === 0) {
    return <div className="flex items-center justify-center h-48 text-zinc-500">No price data</div>;
  }
  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const step = Math.max(1, Math.floor(history.length / 50));
  const sampled = history.filter((_, i) => i % step === 0);
  const tickColor = isDark ? '#8ea3c2' : '#5e718f';
  const gridColor = isDark ? 'rgba(142, 163, 194, 0.12)' : 'rgba(94, 113, 143, 0.12)';
  const tooltipBg = isDark ? '#08111f' : '#ffffff';
  const tooltipText = isDark ? '#edf4ff' : '#10233c';
  const data = {
    labels: sampled.map(h => new Date(h.timestamp).toLocaleDateString()),
    datasets: [{
      label: symbol,
      data: sampled.map(h => h.close),
      borderColor: '#22d3ee',
      backgroundColor: isDark ? 'rgba(34, 211, 238, 0.16)' : 'rgba(34, 211, 238, 0.12)',
      fill: true,
      tension: 0.28,
      pointRadius: 0,
      pointHoverRadius: 3,
      borderWidth: 2.4,
    }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipText,
        borderColor: 'rgba(34, 211, 238, 0.45)',
        borderWidth: 1,
        padding: 12
      }
    },
    scales: {
      x: {
        ticks: { color: tickColor, maxTicksLimit: 8 },
        grid: { color: gridColor, drawBorder: false }
      },
      y: {
        ticks: { color: tickColor, callback: (v) => `$${v.toFixed(0)}` },
        grid: { color: gridColor, drawBorder: false }
      }
    }
  };
  return <Line data={data} options={options} />;
}
