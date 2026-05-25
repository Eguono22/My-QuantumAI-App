import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { tradingService } from '../services/tradingService';

const PILOT_LENGTH_DAYS = 14;
const PILOT_START_KEY = 'quantumai_pilot_started_at';
const PILOT_FEEDBACK_KEY = 'quantumai_pilot_feedback';

const initialFeedbackForm = {
  candidateId: '',
  participant: '',
  segment: 'MT5 trader',
  trustScore: '3',
  valueScore: '3',
  wouldPay: 'Maybe',
  friction: '',
  notes: '',
};

const initialCandidateForm = {
  name: '',
  segment: 'MT5 trader',
  source: '',
  notes: '',
};

const candidateStatuses = ['INVITED', 'SCHEDULED', 'COMPLETED', 'DECLINED'];

const betaQuestions = [
  'Can a trader connect their paper setup without help?',
  'Can they understand why a signal exists before placing a trade?',
  'Do the risk controls prevent unsafe or unclear trades?',
  'Does the order and portfolio record make the AI decision auditable?',
  'Would this save enough time or discipline to justify a paid plan?',
];

const weeklyPlan = [
  {
    label: 'Days 1-2',
    title: 'Connect and observe',
    detail: 'Confirm backend health, broker mode, data provider, MQL5 bridge status, and first signal review.',
  },
  {
    label: 'Days 3-5',
    title: 'Paper-trade tiny size',
    detail: 'Place low-notional paper trades only after reviewing entry, stop, target, confidence, and risk budget.',
  },
  {
    label: 'Days 6-10',
    title: 'Track behavior',
    detail: 'Review orders, blocked decisions, fills, and portfolio movement daily. Look for confusion and repeat value.',
  },
  {
    label: 'Days 11-14',
    title: 'Decide what to double down on',
    detail: 'Interview pilot users and convert the clearest trust gaps into the next product milestone.',
  },
];

const sessionChecklist = [
  'Confirm the trader can explain their current signal review workflow.',
  'Ask them to connect or inspect the paper setup without taking over.',
  'Have them review one AI signal and say what they trust or distrust.',
  'Have them inspect risk limits before considering any paper order.',
  'End by asking what would make this worth paying for.',
];

const exitCriteria = [
  '5+ feedback entries logged',
  'Average trust score is 4.0 or higher',
  'Average value score is 4.0 or higher',
  '40%+ of users answer Yes on willingness to pay',
  'No unresolved blocker in setup, signal clarity, or risk explanation',
];

function daysBetween(startDate, nowDate) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((nowDate.getTime() - startDate.getTime()) / msPerDay));
}

function formatDate(value) {
  if (!value) return 'Not started';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function getOrderStats(orders) {
  const filled = orders.filter((order) => order.status === 'FILLED' || order.status === 'PARTIAL_FILL');
  const rejected = orders.filter((order) => order.status === 'REJECTED');
  const pending = orders.filter((order) => order.status === 'PENDING');
  const totalFilledNotional = filled.reduce((sum, order) => {
    const quantity = Number(order.filled_quantity || 0);
    const price = Number(order.fill_price || order.market_price || 0);
    return sum + quantity * price;
  }, 0);

  return {
    filled: filled.length,
    rejected: rejected.length,
    pending: pending.length,
    totalFilledNotional,
  };
}

function summarizeLatestOrderOutcome(orders) {
  if (!orders.length) {
    return null;
  }

  const latestOrder = orders[0];
  const status = String(latestOrder.status || 'UNKNOWN').toUpperCase();
  const filledQuantity = Number(latestOrder.filled_quantity || 0);
  const requestedQuantity = Number(latestOrder.requested_quantity || filledQuantity || 0);
  const fillPrice = Number(latestOrder.fill_price || latestOrder.market_price || 0);
  const notional = filledQuantity > 0 ? filledQuantity * fillPrice : requestedQuantity * fillPrice;

  let outcome = status;
  if (status === 'FILLED' || status === 'PARTIAL_FILL') {
    outcome = `${status} at ${fillPrice > 0 ? `$${fillPrice.toFixed(2)}` : 'market price'}`;
  } else if (status === 'PENDING') {
    outcome = 'PENDING trigger';
  } else if (status === 'REJECTED') {
    outcome = latestOrder.reason || 'REJECTED by broker';
  } else if (status === 'CANCELED') {
    outcome = latestOrder.reason || 'CANCELED before execution';
  }

  return {
    status,
    asset: latestOrder.asset,
    action: latestOrder.action,
    requestedQuantity,
    filledQuantity,
    fillPrice,
    notional,
    outcome,
    updatedAt: latestOrder.updated_at || latestOrder.created_at || null,
  };
}

function summarizeRecentOrderOutcomes(orders, limit = 3) {
  return orders.slice(0, limit).map((order) => {
    const status = String(order.status || 'UNKNOWN').toUpperCase();
    const filledQuantity = Number(order.filled_quantity || 0);
    const requestedQuantity = Number(order.requested_quantity || filledQuantity || 0);
    const fillPrice = Number(order.fill_price || order.market_price || 0);
    const notional = filledQuantity > 0 ? filledQuantity * fillPrice : requestedQuantity * fillPrice;

    let outcome = status;
    if (status === 'FILLED' || status === 'PARTIAL_FILL') {
      outcome = `${status} at ${fillPrice > 0 ? `$${fillPrice.toFixed(2)}` : 'market price'}`;
    } else if (status === 'PENDING') {
      outcome = 'PENDING trigger';
    } else if (status === 'REJECTED') {
      outcome = order.reason || 'REJECTED by broker';
    } else if (status === 'CANCELED') {
      outcome = order.reason || 'CANCELED before execution';
    }

    return {
      status,
      asset: order.asset,
      action: order.action,
      requestedQuantity,
      filledQuantity,
      fillPrice,
      notional,
      outcome,
      updatedAt: order.updated_at || order.created_at || null,
    };
  });
}

function getOutcomeConsistency(orders, limit = 7) {
  const recent = orders.slice(0, limit);
  const total = recent.length;

  if (!total) {
    return {
      sampleSize: 0,
      filled: 0,
      pending: 0,
      rejected: 0,
      fillRate: 0,
      rejectRate: 0,
    };
  }

  const filled = recent.filter((order) => ['FILLED', 'PARTIAL_FILL'].includes(String(order.status || '').toUpperCase())).length;
  const pending = recent.filter((order) => String(order.status || '').toUpperCase() === 'PENDING').length;
  const rejected = recent.filter((order) => String(order.status || '').toUpperCase() === 'REJECTED').length;

  return {
    sampleSize: total,
    filled,
    pending,
    rejected,
    fillRate: (filled / total) * 100,
    rejectRate: (rejected / total) * 100,
  };
}

function getOutcomeTrendSignal(orders, limit = 7) {
  const recent = orders.slice(0, limit);
  const sampleSize = recent.length;
  const statuses = recent.map((order) => String(order.status || 'UNKNOWN').toUpperCase());

  if (!sampleSize) {
    return {
      sampleSize: 0,
      label: 'No Trend Yet',
      tone: 'zinc',
      message: 'Need more paper orders to judge execution reliability.',
      sequence: [],
    };
  }

  const filled = statuses.filter((status) => status === 'FILLED' || status === 'PARTIAL_FILL').length;
  const rejected = statuses.filter((status) => status === 'REJECTED').length;
  const fillRate = (filled / sampleSize) * 100;
  const rejectRate = (rejected / sampleSize) * 100;

  if (fillRate >= 70 && rejectRate <= 15) {
    return {
      sampleSize,
      label: 'Stable Execution',
      tone: 'emerald',
      message: 'Recent paper orders are filling consistently with minimal rejection noise.',
      sequence: statuses,
    };
  }

  if (rejectRate >= 30) {
    return {
      sampleSize,
      label: 'Risky Execution',
      tone: 'red',
      message: 'Recent rejection levels are elevated; investigate route, timing, or risk constraints.',
      sequence: statuses,
    };
  }

  return {
    sampleSize,
    label: 'Mixed Execution',
    tone: 'amber',
    message: 'Recent outcomes are uneven; continue proof collection before widening pilot scope.',
    sequence: statuses,
  };
}

function getExecutionConfidenceScore(orders, limit = 7) {
  const consistency = getOutcomeConsistency(orders, limit);
  const sampleSize = consistency.sampleSize;

  if (!sampleSize) {
    return {
      sampleSize: 0,
      score: 0,
      label: 'No Confidence Signal Yet',
      tone: 'zinc',
    };
  }

  const rawScore = Math.round((consistency.fillRate * 0.7) + ((100 - consistency.rejectRate) * 0.3));
  const samplePenalty = sampleSize < limit ? (limit - sampleSize) * 5 : 0;
  const score = Math.max(0, Math.min(100, rawScore - samplePenalty));

  if (score >= 75) {
    return {
      sampleSize,
      score,
      label: 'High Confidence',
      tone: 'emerald',
    };
  }

  if (score >= 50) {
    return {
      sampleSize,
      score,
      label: 'Moderate Confidence',
      tone: 'amber',
    };
  }

  return {
    sampleSize,
    score,
    label: 'Low Confidence',
    tone: 'red',
  };
}

function getReleaseGateDecision(executionReliabilityBlocked, recommendation) {
  if (executionReliabilityBlocked) {
    return {
      status: 'HOLD',
      tone: 'red',
      reason: 'Execution reliability is below threshold.',
    };
  }

  if (recommendation?.tone === 'emerald') {
    return {
      status: 'READY',
      tone: 'emerald',
      reason: 'Trust, value, and execution checks support broader pilot rollout.',
    };
  }

  return {
    status: 'HOLD',
    tone: 'amber',
    reason: 'More pilot proof is needed before expanding to a larger cohort.',
  };
}

function loadStoredFeedback() {
  try {
    const raw = localStorage.getItem(PILOT_FEEDBACK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function getFeedbackStats(entries) {
  if (!entries.length) {
    return {
      avgTrust: 0,
      avgValue: 0,
      payYes: 0,
      payMaybe: 0,
      payNo: 0,
    };
  }

  const totals = entries.reduce((acc, entry) => {
    const wouldPay = entry.wouldPay || 'Maybe';
    return {
      trust: acc.trust + Number(entry.trustScore || 0),
      value: acc.value + Number(entry.valueScore || 0),
      payYes: acc.payYes + (wouldPay === 'Yes' ? 1 : 0),
      payMaybe: acc.payMaybe + (wouldPay === 'Maybe' ? 1 : 0),
      payNo: acc.payNo + (wouldPay === 'No' ? 1 : 0),
    };
  }, { trust: 0, value: 0, payYes: 0, payMaybe: 0, payNo: 0 });

  return {
    avgTrust: totals.trust / entries.length,
    avgValue: totals.value / entries.length,
    payYes: totals.payYes,
    payMaybe: totals.payMaybe,
    payNo: totals.payNo,
  };
}

function normalizeFeedbackEntry(entry) {
  return {
    id: entry.id,
    candidateId: entry.candidate_id ?? entry.candidateId ?? null,
    participant: entry.participant,
    segment: entry.segment,
    trustScore: Number(entry.trust_score ?? entry.trustScore ?? 0),
    valueScore: Number(entry.value_score ?? entry.valueScore ?? 0),
    wouldPay: entry.would_pay ?? entry.wouldPay ?? 'Maybe',
    friction: entry.friction || '',
    notes: entry.notes || '',
    createdAt: entry.created_at ?? entry.createdAt ?? new Date().toISOString(),
    persisted: Boolean(entry.id && typeof entry.id === 'number'),
  };
}

function normalizeCandidate(candidate) {
  return {
    id: candidate.id,
    name: candidate.name,
    segment: candidate.segment,
    source: candidate.source || '',
    status: candidate.status || 'INVITED',
    notes: candidate.notes || '',
    createdAt: candidate.created_at || candidate.createdAt || new Date().toISOString(),
    updatedAt: candidate.updated_at || candidate.updatedAt || new Date().toISOString(),
  };
}

function getCandidateStats(candidates) {
  return candidateStatuses.reduce((acc, status) => ({
    ...acc,
    [status]: candidates.filter((candidate) => candidate.status === status).length,
  }), {});
}

function buildLocalSummary(entries) {
  const stats = getFeedbackStats(entries);
  const total = entries.length;
  const yesRate = total > 0 ? (stats.payYes / total) * 100 : 0;
  const segmentCounts = entries.reduce((acc, entry) => {
    const segment = entry.segment || 'Unknown';
    return { ...acc, [segment]: (acc[segment] || 0) + 1 };
  }, {});
  const topSegments = Object.entries(segmentCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([segment, count]) => ({ segment, count }));
  let recommendation = {
    label: 'Collect Feedback',
    tone: 'amber',
    title: 'Run at least 5 pilot conversations',
    message: 'The product needs real trader reactions before the next roadmap decision.',
    next_action: 'Schedule private beta sessions and log one feedback entry after each session.',
  };

  if (total >= 5 && stats.avgTrust >= 4 && stats.avgValue >= 4 && yesRate >= 40) {
    recommendation = {
      label: 'Expand Pilot',
      tone: 'emerald',
      title: 'Trust and value are strong enough to widen the beta',
      message: 'Users are signaling confidence and willingness to pay.',
      next_action: 'Invite the next 10 beta users and keep execution paper-only.',
    };
  } else if (total >= 5 && stats.avgTrust < 4) {
    recommendation = {
      label: 'Fix Trust',
      tone: 'red',
      title: 'Trust is the main blocker',
      message: 'Users are not yet confident enough in the signal, risk, or execution story.',
      next_action: 'Run 2 validation sessions on the updated trust flow. If trust stays below 4.0, keep improving signal rationale, audit trail clarity, and risk explanations.',
    };
  } else if (total >= 5 && stats.avgValue < 4) {
    recommendation = {
      label: 'Sharpen Value',
      tone: 'amber',
      title: 'Value is not obvious enough',
      message: 'The workflow may be trustworthy, but users are not yet feeling a strong day-to-day benefit.',
      next_action: 'Tighten the core loop around faster review and daily return habits.',
    };
  }

  return {
    total_feedback: total,
    avg_trust_score: Number(stats.avgTrust.toFixed(2)),
    avg_value_score: Number(stats.avgValue.toFixed(2)),
    would_pay_yes: stats.payYes,
    would_pay_maybe: stats.payMaybe,
    would_pay_no: stats.payNo,
    yes_rate_pct: Number(yesRate.toFixed(2)),
    top_segments: topSegments,
    recent_frictions: entries.filter((entry) => entry.friction).map((entry) => entry.friction).slice(0, 5),
    recommendation,
  };
}

function buildPilotReport({
  currentDay,
  gateProgress,
  orderStats,
  orders,
  candidateStats,
  candidates,
  feedbackSummary,
  recommendation,
  releaseGateDecision,
}) {
  const segments = feedbackSummary?.top_segments?.length
    ? feedbackSummary.top_segments.map((item) => `${item.segment} (${item.count})`).join(', ')
    : 'None yet';
  const frictions = feedbackSummary?.recent_frictions?.length
    ? feedbackSummary.recent_frictions.map((item) => `- ${item}`).join('\n')
    : '- None logged yet';
  const recentOutcomes = summarizeRecentOrderOutcomes(orders);
  const outcomeConsistency = getOutcomeConsistency(orders);
  const outcomeTrend = getOutcomeTrendSignal(orders);
  const executionConfidence = getExecutionConfidenceScore(orders);
  const outcomesText = recentOutcomes.length
    ? recentOutcomes.map((item) => `- ${item.asset} ${item.action} ${item.status}: ${item.outcome}`).join('\n')
    : '- None yet';

  return [
    '# QuantumAI 14-Day Trust Pilot Report',
    '',
    `Generated: ${new Date().toLocaleString()}`,
    `Pilot day: ${currentDay || 'Not started'} / ${PILOT_LENGTH_DAYS}`,
    `Trust gate readiness: ${gateProgress}%`,
    '',
    '## Candidate Pipeline',
    `Candidates: ${candidates.length}`,
    `Invited: ${candidateStats.INVITED || 0}`,
    `Scheduled: ${candidateStats.SCHEDULED || 0}`,
    `Completed: ${candidateStats.COMPLETED || 0}`,
    `Declined: ${candidateStats.DECLINED || 0}`,
    '',
    '## Feedback',
    `Entries: ${feedbackSummary?.total_feedback || 0}`,
    `Average trust: ${Number(feedbackSummary?.avg_trust_score || 0).toFixed(1)} / 5`,
    `Average value: ${Number(feedbackSummary?.avg_value_score || 0).toFixed(1)} / 5`,
    `Willingness to pay: ${feedbackSummary?.would_pay_yes || 0} yes, ${feedbackSummary?.would_pay_maybe || 0} maybe, ${feedbackSummary?.would_pay_no || 0} no`,
    `Yes rate: ${Number(feedbackSummary?.yes_rate_pct || 0).toFixed(0)}%`,
    `Strongest segments: ${segments}`,
    '',
    '## Execution Evidence',
    `Orders recorded: ${orders.length}`,
    `Filled: ${orderStats.filled}`,
    `Pending: ${orderStats.pending}`,
    `Rejected: ${orderStats.rejected}`,
    `Recent fill rate (${outcomeConsistency.sampleSize} orders): ${outcomeConsistency.fillRate.toFixed(0)}%`,
    `Recent reject rate (${outcomeConsistency.sampleSize} orders): ${outcomeConsistency.rejectRate.toFixed(0)}%`,
    `Execution trend (${outcomeTrend.sampleSize} orders): ${outcomeTrend.label}`,
    `Execution confidence (${executionConfidence.sampleSize} orders): ${executionConfidence.score}/100 (${executionConfidence.label})`,
    `Filled notional: ${orderStats.totalFilledNotional.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    'Recent outcomes:',
    outcomesText,
    '',
    '## Recommendation',
    `${recommendation.label}: ${recommendation.title}`,
    recommendation.message,
    `Next action: ${recommendation.next_action}`,
    `Release gate: ${releaseGateDecision.status} - ${releaseGateDecision.reason}`,
    '',
    '## Recent Frictions',
    frictions,
  ].join('\n');
}

function Pill({ tone = 'zinc', children }) {
  const tones = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    sky: 'bg-sky-100 text-sky-800',
    zinc: 'bg-zinc-100 text-zinc-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, hint, tone = 'zinc' }) {
  const valueTone = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    sky: 'text-sky-700',
    zinc: 'text-zinc-900',
    red: 'text-red-700',
  };
  return (
    <div className="market-panel rounded-md p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 text-2xl font-display font-bold ${valueTone[tone]}`}>{value}</p>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}

function PilotGate({ label, complete, detail, action, to }) {
  return (
    <div className={`rounded-md border px-4 py-3 ${complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`font-semibold ${complete ? 'text-emerald-900' : 'text-amber-900'}`}>{label}</p>
          <p className={`mt-1 text-sm ${complete ? 'text-emerald-800' : 'text-amber-800'}`}>{detail}</p>
        </div>
        <Pill tone={complete ? 'emerald' : 'amber'}>{complete ? 'Ready' : 'Needs work'}</Pill>
      </div>
      {to && (
        <Link to={to} className="mt-3 inline-flex text-sm font-semibold text-zinc-900 hover:text-sky-700">
          {action}
        </Link>
      )}
    </div>
  );
}

export default function Pilot() {
  const [startupHealth, setStartupHealth] = useState(null);
  const [mql5Status, setMql5Status] = useState(null);
  const [signals, setSignals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [pilotStart, setPilotStart] = useState(localStorage.getItem(PILOT_START_KEY));
  const [feedbackEntries, setFeedbackEntries] = useState(loadStoredFeedback);
  const [feedbackSummary, setFeedbackSummary] = useState(() => buildLocalSummary(loadStoredFeedback()));
  const [feedbackForm, setFeedbackForm] = useState(initialFeedbackForm);
  const [candidateForm, setCandidateForm] = useState(initialCandidateForm);
  const [feedbackSyncState, setFeedbackSyncState] = useState('local');
  const [reportCopied, setReportCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [health, bridge, signalData, orderData, portfolioData, feedbackData, feedbackSummaryData, candidateData] = await Promise.all([
          tradingService.getStartupHealth().catch(() => null),
          tradingService.getMql5Status().catch(() => null),
          tradingService.getSignals().catch(() => []),
          tradingService.getOrders().catch(() => []),
          tradingService.getPortfolio().catch(() => []),
          tradingService.getPilotFeedback().catch(() => null),
          tradingService.getPilotFeedbackSummary().catch(() => null),
          tradingService.getPilotCandidates().catch(() => []),
        ]);

        if (!isMounted) return;
        setStartupHealth(health);
        setMql5Status(bridge);
        setSignals(Array.isArray(signalData) ? signalData : []);
        setOrders(Array.isArray(orderData) ? orderData : []);
        setPortfolio(Array.isArray(portfolioData) ? portfolioData : []);
        setCandidates(Array.isArray(candidateData) ? candidateData.map(normalizeCandidate) : []);
        if (Array.isArray(feedbackData)) {
          const normalizedFeedback = feedbackData.map(normalizeFeedbackEntry);
          setFeedbackEntries(normalizedFeedback);
          localStorage.setItem(PILOT_FEEDBACK_KEY, JSON.stringify(normalizedFeedback));
          setFeedbackSummary(feedbackSummaryData || buildLocalSummary(normalizedFeedback));
          setFeedbackSyncState('synced');
        } else {
          setFeedbackSummary(buildLocalSummary(loadStoredFeedback()));
          setFeedbackSyncState('local');
        }
        setError('');
      } catch (err) {
        if (!isMounted) return;
        setError(err.response?.data?.detail || 'Failed to load pilot status');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const startPilot = () => {
    const now = new Date().toISOString();
    localStorage.setItem(PILOT_START_KEY, now);
    setPilotStart(now);
  };

  const resetPilot = () => {
    localStorage.removeItem(PILOT_START_KEY);
    setPilotStart(null);
  };

  const updateFeedbackForm = (key, value) => {
    setFeedbackForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectFeedbackCandidate = (candidateId) => {
    const candidate = candidates.find((item) => String(item.id) === String(candidateId));
    setFeedbackForm((prev) => ({
      ...prev,
      candidateId,
      participant: candidate ? candidate.name : prev.participant,
      segment: candidate ? candidate.segment : prev.segment,
    }));
  };

  const updateCandidateForm = (key, value) => {
    setCandidateForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveCandidate = async (event) => {
    event.preventDefault();
    const payload = {
      name: candidateForm.name.trim(),
      segment: candidateForm.segment,
      source: candidateForm.source.trim(),
      notes: candidateForm.notes.trim(),
      status: 'INVITED',
    };
    if (!payload.name) return;
    try {
      const created = await tradingService.createPilotCandidate(payload);
      setCandidates((prev) => [normalizeCandidate(created), ...prev]);
      setCandidateForm(initialCandidateForm);
    } catch (_err) {
      // Keep the form intact so the operator can retry.
    }
  };

  const updateCandidateStatus = async (candidate, status) => {
    try {
      const updated = await tradingService.updatePilotCandidateStatus(candidate.id, {
        status,
        notes: candidate.notes,
      });
      setCandidates((prev) => prev.map((item) => (item.id === candidate.id ? normalizeCandidate(updated) : item)));
    } catch (_err) {
      // Status updates are intentionally no-op on transient API errors.
    }
  };

  const deleteCandidate = async (id) => {
    try {
      await tradingService.deletePilotCandidate(id);
      setCandidates((prev) => prev.filter((candidate) => candidate.id !== id));
    } catch (_err) {
      // Leave the row visible if delete fails.
    }
  };

  const saveFeedback = async (event) => {
    event.preventDefault();
    const participant = feedbackForm.participant.trim() || `Pilot user ${feedbackEntries.length + 1}`;
    const payload = {
      candidate_id: feedbackForm.candidateId ? Number(feedbackForm.candidateId) : undefined,
      participant,
      segment: feedbackForm.segment,
      trust_score: Number(feedbackForm.trustScore),
      value_score: Number(feedbackForm.valueScore),
      would_pay: feedbackForm.wouldPay,
      friction: feedbackForm.friction.trim(),
      notes: feedbackForm.notes.trim(),
    };
    let entry;
    try {
      const saved = await tradingService.createPilotFeedback(payload);
      entry = normalizeFeedbackEntry(saved);
      setFeedbackSyncState('synced');
      if (payload.candidate_id) {
        setCandidates((prev) => prev.map((candidate) => (
          candidate.id === payload.candidate_id
            ? { ...candidate, status: 'COMPLETED', updatedAt: new Date().toISOString() }
            : candidate
        )));
      }
    } catch (_err) {
      entry = {
        id: `feedback-${Date.now()}`,
        participant,
        segment: payload.segment,
        trustScore: payload.trust_score,
        valueScore: payload.value_score,
        wouldPay: payload.would_pay,
        friction: payload.friction,
        notes: payload.notes,
        createdAt: new Date().toISOString(),
        persisted: false,
      };
      setFeedbackSyncState('local');
    }
    const next = [entry, ...feedbackEntries].slice(0, 25);
    localStorage.setItem(PILOT_FEEDBACK_KEY, JSON.stringify(next));
    setFeedbackEntries(next);
    setFeedbackSummary(buildLocalSummary(next));
    setFeedbackForm(initialFeedbackForm);
  };

  const deleteFeedback = async (id) => {
    if (typeof id === 'number') {
      try {
        await tradingService.deletePilotFeedback(id);
        setFeedbackSyncState('synced');
      } catch (_err) {
        setFeedbackSyncState('local');
      }
    }
    const next = feedbackEntries.filter((entry) => entry.id !== id);
    localStorage.setItem(PILOT_FEEDBACK_KEY, JSON.stringify(next));
    setFeedbackEntries(next);
    setFeedbackSummary(buildLocalSummary(next));
  };

  const orderStats = useMemo(() => getOrderStats(orders), [orders]);
  const latestOrderOutcome = useMemo(() => summarizeLatestOrderOutcome(orders), [orders]);
  const recentOrderOutcomes = useMemo(() => summarizeRecentOrderOutcomes(orders), [orders]);
  const outcomeConsistency = useMemo(() => getOutcomeConsistency(orders), [orders]);
  const outcomeTrend = useMemo(() => getOutcomeTrendSignal(orders), [orders]);
  const executionConfidence = useMemo(() => getExecutionConfidenceScore(orders), [orders]);
  const feedbackStats = useMemo(() => getFeedbackStats(feedbackEntries), [feedbackEntries]);
  const candidateStats = useMemo(() => getCandidateStats(candidates), [candidates]);
  const feedbackCandidateOptions = candidates.filter((candidate) => candidate.status !== 'DECLINED');
  const actionableSignals = signals.filter((signal) => signal.signal_type && signal.signal_type !== 'HOLD');
  const bridgeAlerts = mql5Status?.alerts || [];
  const bridgeErrors = bridgeAlerts.filter((alert) => alert.severity === 'ERROR').length;
  const analytics = mql5Status?.analytics?.overview || {};
  const databaseReady = startupHealth?.database?.ready !== false;
  const startedAt = pilotStart ? new Date(pilotStart) : null;
  const elapsedDays = startedAt ? daysBetween(startedAt, new Date()) : 0;
  const currentDay = startedAt ? Math.min(PILOT_LENGTH_DAYS, elapsedDays + 1) : 0;
  const timeProgress = startedAt ? Math.min(100, (currentDay / PILOT_LENGTH_DAYS) * 100) : 0;

  const gates = [
    {
      key: 'backend',
      label: 'Backend and broker readiness',
      complete: startupHealth?.status === 'ok' && startupHealth?.trading?.broker_ready === true && databaseReady,
      detail: !databaseReady
        ? startupHealth?.database?.reason
        : startupHealth?.trading?.reason || 'Startup diagnostics confirm the paper-trading backend is reachable.',
      action: 'Open Connection Center',
      to: '/app/connect',
    },
    {
      key: 'signals',
      label: 'Actionable signal review',
      complete: actionableSignals.length > 0,
      detail: `${actionableSignals.length} non-HOLD signal${actionableSignals.length === 1 ? '' : 's'} available for review.`,
      action: 'Review AI Signals',
      to: '/app/signals',
    },
    {
      key: 'risk',
      label: 'Risk limits visible before execution',
      complete: Boolean(startupHealth?.risk_limits?.max_notional_per_trade && startupHealth?.risk_limits?.max_risk_percent_per_trade),
      detail: 'Pilot users should see max notional, daily trade count, and risk-per-trade before any order.',
      action: 'Review limits',
      to: '/app/connect',
    },
    {
      key: 'paperOrders',
      label: 'Paper order evidence',
      complete: orders.length > 0,
      detail: `${orders.length} order${orders.length === 1 ? '' : 's'} recorded. Filled, pending, and rejected states all help prove trust.`,
      action: 'Open Orders',
      to: '/app/orders',
    },
    {
      key: 'audit',
      label: 'Decision audit trail',
      complete: Boolean((analytics.decisions || 0) > 0 || orders.length > 0),
      detail: `${analytics.decisions || 0} bridge decision${analytics.decisions === 1 ? '' : 's'} and ${orders.length} order record${orders.length === 1 ? '' : 's'} available.`,
      action: 'Inspect activity',
      to: '/app/connect',
    },
  ];
  const gateProgress = Math.round((gates.filter((gate) => gate.complete).length / gates.length) * 100);
  const baseRecommendation = feedbackSummary?.recommendation || buildLocalSummary(feedbackEntries).recommendation;
  const executionReliabilityBlocked = executionConfidence.sampleSize > 0
    && (executionConfidence.score < 50 || outcomeConsistency.rejectRate >= 30);
  const recommendation = executionReliabilityBlocked
    ? {
      label: 'Fix Execution Reliability',
      tone: 'red',
      title: 'Execution reliability is the blocker',
      message: 'Recent paper outcomes are not stable enough to expand the pilot safely.',
      next_action: 'Reduce rejects first: inspect routing, risk caps, and order timing before inviting more users.',
    }
    : baseRecommendation;
  const releaseGateDecision = getReleaseGateDecision(executionReliabilityBlocked, recommendation);
  const recommendationTone = recommendation.tone === 'red'
    ? 'border-red-200 bg-red-50 text-red-900'
    : recommendation.tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : recommendation.tone === 'sky'
        ? 'border-sky-200 bg-sky-50 text-sky-900'
        : 'border-amber-200 bg-amber-50 text-amber-900';
  const pilotReport = buildPilotReport({
    currentDay,
    gateProgress,
    orderStats,
    orders,
    candidateStats,
    candidates,
    feedbackSummary,
    recommendation,
    releaseGateDecision,
  });

  const copyPilotReport = async () => {
    try {
      await navigator.clipboard.writeText(pilotReport);
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1800);
    } catch (_err) {
      setReportCopied(false);
    }
  };

  if (loading) return <LoadingSpinner size="lg" />;

  return (
    <div className="space-y-8 animate-fadeRise">
      <div className="rounded-2xl overflow-hidden border border-zinc-700 relative" style={{ background: 'linear-gradient(135deg, #102016 0%, #17412f 48%, #24436f 100%)' }}>
        <div className="relative px-6 py-8 md:px-10 md:py-10">
          <p className="text-emerald-100 text-xs tracking-[0.18em] uppercase">Private Beta Milestone</p>
          <h1 className="mt-2 text-3xl md:text-4xl font-display font-bold text-white uppercase">
            14-Day Trust Pilot
          </h1>
          <p className="mt-3 max-w-3xl text-sm md:text-base text-emerald-50">
            Prove one complete paper-trading loop: connect, review AI rationale, enforce risk, execute tiny paper trades, and learn whether traders come back.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={pilotStart ? resetPilot : startPilot}
              className="px-4 py-2 rounded-md bg-emerald-300 text-zinc-950 text-sm font-semibold hover:bg-emerald-200 transition"
            >
              {pilotStart ? 'Reset Pilot Clock' : 'Start Pilot Clock'}
            </button>
            <Link to="/app/connect" className="px-4 py-2 rounded-md border border-emerald-100 text-emerald-50 text-sm font-semibold hover:bg-white/10 transition">
              Check Setup
            </Link>
            <Link to="/app/signals" className="px-4 py-2 rounded-md border border-sky-100 text-sky-50 text-sm font-semibold hover:bg-white/10 transition">
              Review Signals
            </Link>
          </div>
        </div>
      </div>

      {!!error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {executionReliabilityBlocked && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-wide">Execution Gate</p>
            <Pill tone={releaseGateDecision.tone}>{releaseGateDecision.status}</Pill>
          </div>
          <p className="mt-1">
            Reliability is below threshold ({executionConfidence.score}/100 confidence, {outcomeConsistency.rejectRate.toFixed(0)}% reject rate).
            Keep pilot scope tight until this stabilizes.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <MetricCard label="Pilot Day" value={currentDay ? `${currentDay}/${PILOT_LENGTH_DAYS}` : 'Not started'} hint={`Started ${formatDate(pilotStart)}`} tone={currentDay ? 'emerald' : 'amber'} />
        <MetricCard label="Trust Gates" value={formatPercent(gateProgress)} hint={`${gates.filter((gate) => gate.complete).length}/${gates.length} proof points ready`} tone={gateProgress >= 80 ? 'emerald' : 'amber'} />
        <MetricCard label="Paper Orders" value={orders.length} hint={`${orderStats.filled} filled, ${orderStats.pending} pending, ${orderStats.rejected} rejected`} tone={orders.length > 0 ? 'sky' : 'zinc'} />
        <MetricCard label="Execution Confidence" value={`${executionConfidence.score}/100`} hint={executionConfidence.label} tone={executionConfidence.tone} />
        <MetricCard label="Beta Pipeline" value={candidates.length} hint={`${candidateStats.SCHEDULED} scheduled, ${candidateStats.COMPLETED} completed`} tone={candidates.length >= 10 ? 'emerald' : 'amber'} />
      </div>

      <div className="market-panel rounded-md p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Latest Paper Order Outcome</h2>
            <p className="text-sm text-zinc-600">A compact summary of the most recent order so the pilot can explain what happened after submit.</p>
          </div>
          <Pill tone={latestOrderOutcome?.status === 'REJECTED' ? 'red' : latestOrderOutcome?.status === 'PENDING' ? 'amber' : 'sky'}>
            {latestOrderOutcome ? latestOrderOutcome.status : 'No orders'}
          </Pill>
        </div>

        {latestOrderOutcome ? (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Signal</p>
              <p className="font-semibold text-zinc-900">{latestOrderOutcome.asset} {latestOrderOutcome.action}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Status</p>
              <p className="font-semibold text-zinc-900">{latestOrderOutcome.status}</p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Fill / Qty</p>
              <p className="font-semibold text-zinc-900">
                {latestOrderOutcome.filledQuantity > 0 ? `${latestOrderOutcome.filledQuantity}` : `${latestOrderOutcome.requestedQuantity}`}
                {latestOrderOutcome.fillPrice > 0 ? ` @ $${latestOrderOutcome.fillPrice.toFixed(2)}` : ''}
              </p>
            </div>
            <div className="market-panel-soft rounded-md p-3">
              <p className="text-zinc-500">Notional</p>
              <p className="font-semibold text-zinc-900">${latestOrderOutcome.notional.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
            No paper orders have been placed yet.
          </div>
        )}

        {latestOrderOutcome && (
          <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Outcome note</p>
            <p className="mt-1">{latestOrderOutcome.outcome}{latestOrderOutcome.updatedAt ? ` | Updated ${formatDate(latestOrderOutcome.updatedAt)}` : ''}</p>
          </div>
        )}

        {!!outcomeConsistency.sampleSize && (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Outcome consistency (recent {outcomeConsistency.sampleSize})</p>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="rounded-md border border-emerald-100 bg-white px-3 py-2">
                <p className="text-xs text-zinc-500">Fill rate</p>
                <p className="font-semibold text-zinc-900">{outcomeConsistency.fillRate.toFixed(0)}%</p>
              </div>
              <div className="rounded-md border border-emerald-100 bg-white px-3 py-2">
                <p className="text-xs text-zinc-500">Reject rate</p>
                <p className="font-semibold text-zinc-900">{outcomeConsistency.rejectRate.toFixed(0)}%</p>
              </div>
              <div className="rounded-md border border-emerald-100 bg-white px-3 py-2">
                <p className="text-xs text-zinc-500">Pending</p>
                <p className="font-semibold text-zinc-900">{outcomeConsistency.pending}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-600">Execution confidence: <span className="font-semibold">{executionConfidence.score}/100</span> ({executionConfidence.label})</p>
          </div>
        )}

        {!!outcomeTrend.sampleSize && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">Execution trend signal</p>
              <Pill tone={outcomeTrend.tone}>{outcomeTrend.label}</Pill>
            </div>
            <p className="mt-2 text-zinc-700">{outcomeTrend.message}</p>
            <p className="mt-2 text-xs text-zinc-500">Recent sequence: {outcomeTrend.sequence.join(' -> ')}</p>
          </div>
        )}

        {!!recentOrderOutcomes.length && (
          <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent Outcomes</p>
            <div className="mt-2 space-y-2">
              {recentOrderOutcomes.map((item, index) => (
                <div key={`${item.asset}-${item.status}-${index}`} className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-900">{item.asset} {item.action}</p>
                    <Pill tone={item.status === 'REJECTED' ? 'red' : item.status === 'PENDING' ? 'amber' : 'sky'}>{item.status}</Pill>
                  </div>
                  <p className="mt-1 text-zinc-700">{item.outcome}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Qty {item.filledQuantity > 0 ? item.filledQuantity : item.requestedQuantity}
                    {item.fillPrice > 0 ? ` | Fill ${formatCurrency(item.fillPrice)}` : ''}
                    {item.notional > 0 ? ` | Notional ${formatCurrency(item.notional)}` : ''}
                    {item.updatedAt ? ` | ${formatDate(item.updatedAt)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="market-panel rounded-md p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Pilot Progress</h2>
            <p className="text-sm text-zinc-600">Keep the pilot narrow until these proof points are working in front of real users.</p>
          </div>
          <Pill tone={gateProgress >= 80 ? 'emerald' : 'amber'}>{formatPercent(gateProgress)} ready</Pill>
        </div>
        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${gateProgress}%` }} />
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${timeProgress}%` }} />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Green is readiness. Blue is elapsed pilot time.</p>
      </div>

      <div className={`rounded-md border px-5 py-4 ${recommendationTone}`}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-3xl">
            <Pill tone={recommendation.tone || 'amber'}>{recommendation.label}</Pill>
            <div className="mt-2">
              <Pill tone={releaseGateDecision.tone}>Release Gate: {releaseGateDecision.status}</Pill>
            </div>
            <h2 className="mt-3 text-xl font-display font-bold uppercase">{recommendation.title}</h2>
            <p className="mt-2 text-sm opacity-90">{recommendation.message}</p>
            <p className="mt-3 text-sm font-semibold">{recommendation.next_action}</p>
            <p className="mt-2 text-xs opacity-80">{releaseGateDecision.reason}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md bg-white/75 px-3 py-2">
              <p className="text-xs uppercase tracking-wide opacity-70">Trust</p>
              <p className="mt-1 font-display font-bold">{Number(feedbackSummary?.avg_trust_score || 0).toFixed(1)}</p>
            </div>
            <div className="rounded-md bg-white/75 px-3 py-2">
              <p className="text-xs uppercase tracking-wide opacity-70">Value</p>
              <p className="mt-1 font-display font-bold">{Number(feedbackSummary?.avg_value_score || 0).toFixed(1)}</p>
            </div>
            <div className="rounded-md bg-white/75 px-3 py-2">
              <p className="text-xs uppercase tracking-wide opacity-70">Yes Rate</p>
              <p className="mt-1 font-display font-bold">{Number(feedbackSummary?.yes_rate_pct || 0).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="market-panel rounded-md p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Beta Session Kit</h2>
              <p className="text-sm text-zinc-600">Run every interview the same way so the feedback is comparable.</p>
            </div>
            <Pill tone="sky">30 min</Pill>
          </div>

          <div className="mt-4 space-y-3">
            {sessionChecklist.map((item, index) => (
              <div key={item} className="flex gap-3 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
                <span className="font-display font-bold text-zinc-900">{index + 1}</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Expansion Criteria</p>
            <div className="mt-2 space-y-2">
              {exitCriteria.map((item) => (
                <p key={item} className="text-sm text-zinc-700">{item}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="market-panel rounded-md p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Pilot Report</h2>
              <p className="text-sm text-zinc-600">A compact batch summary for roadmap and beta decisions.</p>
            </div>
            <button
              type="button"
              onClick={copyPilotReport}
              className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800"
            >
              {reportCopied ? 'Copied' : 'Copy Report'}
            </button>
          </div>
          <textarea
            readOnly
            value={pilotReport}
            className="mt-4 h-80 w-full rounded-md border border-zinc-300 bg-zinc-950 px-3 py-3 font-mono text-xs text-zinc-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
        <div className="market-panel rounded-md p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Beta Candidate Pipeline</h2>
              <p className="text-sm text-zinc-600">Track who should be invited before the feedback exists.</p>
            </div>
            <Pill tone={candidateStats.SCHEDULED + candidateStats.COMPLETED >= 5 ? 'emerald' : 'amber'}>
              {candidateStats.SCHEDULED + candidateStats.COMPLETED}/5 active
            </Pill>
          </div>

          <form onSubmit={saveCandidate} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-zinc-700">
                Candidate
                <input
                  value={candidateForm.name}
                  onChange={(event) => updateCandidateForm('name', event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                  placeholder="Name, handle, or account"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Segment
                <select
                  value={candidateForm.segment}
                  onChange={(event) => updateCandidateForm('segment', event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option>MT5 trader</option>
                  <option>Alpaca paper trader</option>
                  <option>Crypto trader</option>
                  <option>Signal reviewer</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium text-zinc-700">
              Source
              <input
                value={candidateForm.source}
                onChange={(event) => updateCandidateForm('source', event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                placeholder="Discord, Telegram, X, referral..."
              />
            </label>
            <label className="block text-sm font-medium text-zinc-700">
              Notes
              <textarea
                value={candidateForm.notes}
                onChange={(event) => updateCandidateForm('notes', event.target.value)}
                className="mt-1 min-h-20 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                placeholder="Why are they a useful pilot user?"
              />
            </label>
            <button type="submit" className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              Add Candidate
            </button>
          </form>
        </div>

        <div className="market-panel rounded-md p-4">
          <div className="grid grid-cols-4 gap-2 text-center text-sm">
            {candidateStatuses.map((status) => (
              <div key={status} className="rounded-md border border-zinc-200 bg-white p-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">{status.toLowerCase()}</p>
                <p className="mt-1 font-display text-xl font-bold text-zinc-900">{candidateStats[status]}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {!candidates.length && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                No beta candidates yet. Add 10 likely users before widening the pilot.
              </div>
            )}
            {candidates.map((candidate) => (
              <div key={candidate.id} className="rounded-md border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-zinc-900">{candidate.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {candidate.segment}{candidate.source ? ` | ${candidate.source}` : ''} | updated {new Date(candidate.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Pill tone={candidate.status === 'COMPLETED' ? 'emerald' : candidate.status === 'DECLINED' ? 'red' : candidate.status === 'SCHEDULED' ? 'sky' : 'amber'}>
                    {candidate.status}
                  </Pill>
                </div>
                {candidate.notes && <p className="mt-3 text-sm text-zinc-600">{candidate.notes}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {candidateStatuses.filter((status) => status !== candidate.status).map((status) => (
                    <button
                      key={`${candidate.id}-${status}`}
                      type="button"
                      onClick={() => updateCandidateStatus(candidate, status)}
                      className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => deleteCandidate(candidate.id)}
                    className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-200"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
        <div className="market-panel rounded-md p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Beta Feedback</h2>
              <p className="text-sm text-zinc-600">Log each pilot conversation while the product is still fresh in the user's mind.</p>
            </div>
            <div className="flex gap-2">
              <Pill tone={feedbackSyncState === 'synced' ? 'emerald' : 'amber'}>{feedbackSyncState === 'synced' ? 'Synced' : 'Local'}</Pill>
              <Pill tone={feedbackEntries.length >= 5 ? 'emerald' : 'amber'}>{feedbackEntries.length}/5 minimum</Pill>
            </div>
          </div>

          <form onSubmit={saveFeedback} className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-zinc-700">
              Linked Candidate
              <select
                value={feedbackForm.candidateId}
                onChange={(event) => selectFeedbackCandidate(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
              >
                <option value="">No linked candidate</option>
                {feedbackCandidateOptions.map((candidate) => (
                  <option key={`feedback-candidate-${candidate.id}`} value={candidate.id}>
                    {candidate.name} - {candidate.status.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-zinc-700">
                Participant
                <input
                  value={feedbackForm.participant}
                  onChange={(event) => updateFeedbackForm('participant', event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                  placeholder="Name or short label"
                />
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Segment
                <select
                  value={feedbackForm.segment}
                  onChange={(event) => updateFeedbackForm('segment', event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option>MT5 trader</option>
                  <option>Alpaca paper trader</option>
                  <option>Crypto trader</option>
                  <option>Signal reviewer</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <label className="text-sm font-medium text-zinc-700">
                Trust
                <select
                  value={feedbackForm.trustScore}
                  onChange={(event) => updateFeedbackForm('trustScore', event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  {[1, 2, 3, 4, 5].map((score) => <option key={`trust-${score}`} value={score}>{score}/5</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Value
                <select
                  value={feedbackForm.valueScore}
                  onChange={(event) => updateFeedbackForm('valueScore', event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  {[1, 2, 3, 4, 5].map((score) => <option key={`value-${score}`} value={score}>{score}/5</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-zinc-700">
                Would Pay
                <select
                  value={feedbackForm.wouldPay}
                  onChange={(event) => updateFeedbackForm('wouldPay', event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                >
                  <option>Maybe</option>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </label>
            </div>

            <label className="block text-sm font-medium text-zinc-700">
              Main Friction
              <input
                value={feedbackForm.friction}
                onChange={(event) => updateFeedbackForm('friction', event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                placeholder="What made them hesitate?"
              />
            </label>

            <label className="block text-sm font-medium text-zinc-700">
              Notes
              <textarea
                value={feedbackForm.notes}
                onChange={(event) => updateFeedbackForm('notes', event.target.value)}
                className="mt-1 min-h-24 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900"
                placeholder="What did they trust, misunderstand, or ask to see next?"
              />
            </label>

            <button type="submit" className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800">
              Save Feedback
            </button>
          </form>
        </div>

        <div className="market-panel rounded-md p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Feedback Evidence</h2>
              <p className="text-sm text-zinc-600">Use this to decide whether to improve onboarding, signal trust, or execution clarity next.</p>
            </div>
            <Pill tone={feedbackStats.avgTrust >= 4 && feedbackStats.avgValue >= 4 ? 'emerald' : 'sky'}>
              Trust {feedbackStats.avgTrust.toFixed(1)} / Value {feedbackStats.avgValue.toFixed(1)}
            </Pill>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Yes</p>
              <p className="mt-1 text-xl font-display font-bold text-emerald-700">{feedbackStats.payYes}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Maybe</p>
              <p className="mt-1 text-xl font-display font-bold text-amber-700">{feedbackStats.payMaybe}</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">No</p>
              <p className="mt-1 text-xl font-display font-bold text-red-700">{feedbackStats.payNo}</p>
            </div>
          </div>

          {!!feedbackSummary?.top_segments?.length && (
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Strongest Segments</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {feedbackSummary.top_segments.map((item) => (
                  <Pill key={item.segment} tone="zinc">{item.segment}: {item.count}</Pill>
                ))}
              </div>
            </div>
          )}

          {!!feedbackSummary?.recent_frictions?.length && (
            <div className="mt-4 rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Recent Frictions</p>
              <div className="mt-2 space-y-2">
                {feedbackSummary.recent_frictions.map((friction, index) => (
                  <p key={`${friction}-${index}`} className="text-sm text-zinc-700">{friction}</p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {!feedbackEntries.length && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                No beta feedback logged yet.
              </div>
            )}
            {feedbackEntries.map((entry) => (
              <div key={entry.id} className="rounded-md border border-zinc-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">{entry.participant}</p>
                    <p className="mt-1 text-xs text-zinc-500">{entry.segment} | {new Date(entry.createdAt).toLocaleString()} | {entry.persisted ? 'synced' : 'local'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteFeedback(entry.id)}
                    className="rounded bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
                  >
                    Remove
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone={entry.trustScore >= 4 ? 'emerald' : 'amber'}>Trust {entry.trustScore}/5</Pill>
                  <Pill tone={entry.valueScore >= 4 ? 'emerald' : 'amber'}>Value {entry.valueScore}/5</Pill>
                  <Pill tone={entry.wouldPay === 'Yes' ? 'emerald' : entry.wouldPay === 'No' ? 'red' : 'amber'}>Pay {entry.wouldPay}</Pill>
                  {entry.candidateId && <Pill tone="sky">Candidate linked</Pill>}
                </div>
                {entry.friction && <p className="mt-3 text-sm text-zinc-700"><span className="font-semibold">Friction:</span> {entry.friction}</p>}
                {entry.notes && <p className="mt-2 text-sm text-zinc-600">{entry.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="market-panel rounded-md p-4 space-y-3">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Trust Gates</h2>
            <p className="text-sm text-zinc-600">These gates define whether the product is ready for the next batch of beta users.</p>
          </div>
          {gates.map(({ key, ...gateProps }) => (
            <PilotGate key={key} {...gateProps} />
          ))}
        </div>

        <div className="space-y-6">
          <div className="market-panel rounded-md p-4">
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Success Questions</h2>
            <div className="mt-4 space-y-3">
              {betaQuestions.map((question, index) => (
                <div key={question} className="flex gap-3 rounded-md border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-700">
                  <span className="font-display font-bold text-zinc-900">{index + 1}</span>
                  <span>{question}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="market-panel rounded-md p-4">
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">Current Evidence</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Trading mode</span>
                <span className="font-semibold text-zinc-900">{startupHealth?.trading?.trading_mode || 'unknown'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Broker provider</span>
                <span className="font-semibold text-zinc-900">{startupHealth?.trading?.broker_provider || 'unknown'}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Database</span>
                <span className={`font-semibold ${databaseReady ? 'text-zinc-900' : 'text-red-700'}`}>
                  {startupHealth?.database?.durable ? 'durable' : startupHealth?.database?.provider || 'unknown'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Actionable signals</span>
                <span className="font-semibold text-zinc-900">{actionableSignals.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Portfolio holdings</span>
                <span className="font-semibold text-zinc-900">{portfolio.length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Filled notional</span>
                <span className="font-semibold text-zinc-900">{orderStats.totalFilledNotional.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-zinc-500">Bridge alerts</span>
                <span className={`font-semibold ${bridgeErrors > 0 ? 'text-red-700' : 'text-zinc-900'}`}>{bridgeAlerts.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="market-panel rounded-md p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-display font-bold text-zinc-900 uppercase">14-Day Operating Plan</h2>
            <p className="text-sm text-zinc-600">Do these in order. Resist broad feature work until the pilot answers the trust questions.</p>
          </div>
          <Pill tone="sky">Pilot script</Pill>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {weeklyPlan.map((item) => (
            <div key={item.label} className="rounded-md border border-zinc-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</p>
              <h3 className="mt-2 font-display font-bold text-zinc-900 uppercase">{item.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
