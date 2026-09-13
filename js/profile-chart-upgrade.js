/* Robust Racing Kings rating graph: normalises Lichess history and avoids the time-scale adapter. */
(function () {
  'use strict';

  const HISTORY_SUFFIX = '/rating-history';
  const ORIGINAL_FETCH = window.fetch.bind(window);
  let lastSignature = '';
  let suppressObserver = false;
  let periodHookInstalled = false;

  function isRatingHistory(url) {
    try { return new URL(url, location.href).pathname.endsWith(HISTORY_SUFFIX); }
    catch { return String(url || '').includes(HISTORY_SUFFIX); }
  }

  // Normalise the Racing Kings history label so the profile page is not dependent
  // on Lichess display-name casing or wording.
  window.fetch = async function (input, init) {
    const response = await ORIGINAL_FETCH(input, init);
    if (!isRatingHistory(typeof input === 'string' ? input : input?.url)) return response;
    try {
      const data = await response.clone().json();
      if (!Array.isArray(data)) return response;
      const normalised = data.map(entry => {
        const rawName = String(entry?.name || '').trim();
        const isRacingKings = /racing\s*kings/i.test(rawName) || rawName.replace(/[_\s-]/g, '').toLowerCase() === 'racingkings';
        return { ...entry, name: isRacingKings ? 'Racing Kings' : rawName };
      });
      return new Response(JSON.stringify(normalised), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });
    } catch {
      return response;
    }
  };

  function theme() {
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      line: '#8b5cf6',
      fillTop: 'rgba(139,92,246,.16)',
      fillBottom: 'rgba(139,92,246,0)',
      grid: light ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)',
      text: light ? '#71717a' : '#a1a1aa',
      panel: light ? '#ffffff' : '#1c1c23',
      border: light ? '#e4e4e7' : '#3f3f46'
    };
  }

  function normalisePoints() {
    if (!Array.isArray(window.rkPoints) && typeof rkPoints === 'undefined') return [];
    const source = typeof rkPoints !== 'undefined' ? rkPoints : window.rkPoints;
    return (source || [])
      .map(p => ({ x: p?.x instanceof Date ? p.x.getTime() : Number(p?.x), y: Number(p?.y) }))
      .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y > 0)
      .sort((a, b) => a.x - b.x);
  }

  function selectedPoints(points, months) {
    if (!months) return points;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const time = cutoff.getTime();
    const visible = points.filter(p => p.x >= time);
    const before = points.filter(p => p.x < time).at(-1);
    return before ? [before, ...visible] : visible;
  }

  function ensureCanvas() {
    const wrap = document.getElementById('chartWrap');
    if (!wrap) return null;
    wrap.innerHTML = '<canvas id="ratingChart" aria-label="Racing Kings rating history" role="img"></canvas>';
    return document.getElementById('ratingChart');
  }

  function updateMeta(points) {
    const summary = document.getElementById('chartSummary');
    const delta = document.getElementById('chartDelta');
    if (!summary || !delta || !points.length) return;
    const first = points[0].y;
    const last = points.at(-1).y;
    const peak = Math.max(...points.map(p => p.y));
    const low = Math.min(...points.map(p => p.y));
    const diff = last - first;
    summary.textContent = `${points.length} data points · ${last} current · ${peak} peak · ${low} low · `;
    delta.textContent = `${diff > 0 ? '+' : ''}${diff}`;
    delta.className = `chart-delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'}`;
  }

  function draw(months) {
    const points = selectedPoints(normalisePoints(), months);
    const wrap = document.getElementById('chartWrap');
    if (!wrap) return;

    if (typeof Chart === 'undefined') {
      wrap.innerHTML = '<div class="no-history">Rating graph could not be loaded.</div>';
      return;
    }
    if (!points.length) {
      wrap.innerHTML = '<div class="no-history">No Racing Kings rating history available.</div>';
      document.getElementById('chartSummary').textContent = '';
      document.getElementById('chartDelta').textContent = '';
      return;
    }

    if (typeof rkChart !== 'undefined' && rkChart) {
      try { rkChart.destroy(); } catch {}
      rkChart = null;
    }

    const canvas = ensureCanvas();
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = theme();
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, t.fillTop);
    gradient.addColorStop(1, t.fillBottom);
    const ratings = points.map(p => p.y);
    const min = Math.min(...ratings);
    const max = Math.max(...ratings);
    const pad = Math.max(25, Math.round((max - min) * 0.12));

    suppressObserver = true;
    rkChart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [{
          label: 'Racing Kings Rating',
          data: points,
          parsing: false,
          borderColor: t.line,
          backgroundColor: gradient,
          borderWidth: 2.5,
          pointRadius: points.length > 120 ? 0 : 3,
          pointHoverRadius: 5,
          pointHitRadius: 12,
          tension: 0.24,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        normalized: true,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            type: 'linear',
            grid: { color: t.grid },
            ticks: {
              color: t.text,
              maxTicksLimit: 7,
              callback: value => new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
            }
          },
          y: {
            min: Math.max(0, min - pad),
            max: max + pad,
            grid: { color: t.grid },
            ticks: { color: t.text, maxTicksLimit: 6, precision: 0 }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: t.panel,
            borderColor: t.border,
            borderWidth: 1,
            titleColor: t.text,
            bodyColor: '#c4b5fd',
            displayColors: false,
            callbacks: {
              title: items => items.length ? new Date(items[0].parsed.x).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '',
              label: item => `Rating: ${Math.round(item.parsed.y)}`
            }
          }
        }
      }
    });
    suppressObserver = false;
    updateMeta(points);
  }

  function installPeriodHook() {
    if (periodHookInstalled || typeof window.setPeriod !== 'function') return;
    const original = window.setPeriod;
    window.setPeriod = function (months) {
      try { rkPeriod = months; } catch {}
      document.querySelectorAll('.period-btn').forEach(button => {
        button.classList.toggle('active', (months === 0 && button.textContent === 'All') || (`${months}M` === button.textContent) || (months === 12 && button.textContent === '1Y'));
      });
      draw(months);
      return original;
    };
    periodHookInstalled = true;
  }

  const wrapObserver = new MutationObserver(() => {
    if (suppressObserver) return;
    clearTimeout(wrapObserver._timer);
    wrapObserver._timer = setTimeout(() => {
      installPeriodHook();
      const points = normalisePoints();
      const signature = `${points.length}:${points.at(-1)?.x || 0}:${points.at(-1)?.y || 0}`;
      if (points.length && signature !== lastSignature) {
        lastSignature = signature;
        draw(typeof rkPeriod === 'number' ? rkPeriod : 12);
      }
    }, 30);
  });

  function boot() {
    const wrap = document.getElementById('chartWrap');
    if (!wrap) return;
    wrapObserver.observe(wrap, { childList: true, subtree: true });
    const hookTimer = setInterval(() => {
      installPeriodHook();
      const points = normalisePoints();
      if (points.length) {
        clearInterval(hookTimer);
        draw(typeof rkPeriod === 'number' ? rkPeriod : 12);
      }
    }, 100);
    setTimeout(() => clearInterval(hookTimer), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();