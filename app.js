let appData = null;
let charts = { massiveTrends: {} };
let renderTimeout = null;
window.DASHBOARD_VERSION = "2.29";
console.error("DASHBOARD VERSION 2.29 LOADED");

// Global Error Reporter for Debugging
window.onerror = function(msg, url, lineNo, columnNo, error) {
    const container = document.querySelector('.powerbi-wrapper');
    if (container) {
        container.innerHTML = `<div style="padding:2rem; background:#fff; border:4px solid red; color:red; font-family:monospace; white-space:pre-wrap;"><h1>Critical JS Error!</h1>Error: ${msg}\nUrl: ${url}\nLine: ${lineNo}:${columnNo}\nStack: ${error ? error.stack : 'N/A'}</div>`;
    }
};
window.onunhandledrejection = function(event) {
    const container = document.querySelector('.powerbi-wrapper');
    if (container) {
        container.innerHTML = `<div style="padding:2rem; background:#fff; border:4px solid red; color:red; font-family:monospace; white-space:pre-wrap;"><h1>Unhandled Promise Rejection!</h1>${event.reason}</div>`;
    }
};

Chart.register(ChartDataLabels);

const CORE_9_KPIS = [
    '[1.5] 학생 충원 성과', '[1.5] 졸업생 진로 성과', '[1.3] 교육비 환원율', 
    '[4.1] 장학금 비율', '[3.1] 전임교원 및 겸임교원 확보율', '[4.5] 기숙사 수용율 I', 
    '[1.3] 세입 중 등록금 비율', '[4.6] 대학생 1인당 연간 자료구입비(결산)', '[3.4] 전임교원 1인당 교외연구비'
];

const cmpColors = ['#ff7b72', '#a371f7', '#3fb950', '#58a6ff', '#f2cc60', '#db2777', '#0891b2', '#79c0ff'];

const TARGETS = {
    '[1.3] 교육비 환원율': { target: 110, dir: 1 },
    '[1.3] 법인 법정부담금 부담률(사립대)': { target: 10, dir: 1 },
    '[1.3] 법인 전입금 비율(사립대)': { target: 10, dir: 1 },
    '[1.3] 세입 중 기부금 비율': { target: 0.4, dir: 1 },
    '[1.3] 세입 중 등록금 비율': { target: 72, dir: -1 }, 
    '[1.3] 세입 중 법인전입금 비율(사립대)': { target: 0.4, dir: 1 },
    '[1.5] 졸업생 진로 성과': { target: 55, dir: 1 },
    '[1.5] 학생 충원 성과': { target: 85, dir: 1 },
    '[3.1] 전임교원 및 겸임교원 확보율': { target: 64, dir: 1 },
    '[3.3] 강사 강의료': { target: 53100, dir: 1 },
    '[3.4] 전임교원 1인당 SCI급 논문 실적': { target: 0.05, dir: 1 },
    '[3.4] 전임교원 1인당 교내연구비': { target: 1000, dir: 1 },
    '[3.4] 전임교원 1인당 교외연구비': { target: 10000, dir: 1 },
    '[3.4] 전임교원 1인당 국제(학술)지 논문 실적': { target: 0.35, dir: 1 },
    '[3.4] 전임교원 1인당 등재지 논문 실적': { target: 0.06, dir: 1 },
    '[3.5] 직원 1인당 학생수': { target: 70, dir: -1 }, 
    '[4.1] 장학금 비율': { target: 12, dir: 1 },
    '[4.5] 기숙사 수용율 I': { target: 11, dir: 1 },
    '[4.5] 기숙사 수용율 II': { target: 11, dir: 1 },
    '[4.6] 대학생 1,000명당 도서관 직원수': { target: 1, dir: 1 },
    '[4.6] 대학생 1인당 연간 자료구입비(결산)': { target: 54000, dir: 1 }
};

const customRegions = ['수도권', '대경강원권', '충청권', '동남권', '호남권제주권'];
const getCustomRegion = (prov) => {
    if (!prov) return '';
    if (prov.includes('서울') || prov.includes('경기') || prov.includes('인천')) return '수도권';
    if (prov.includes('대구') || prov.includes('경북') || prov.includes('강원')) return '대경강원권';
    if (prov.includes('대전') || prov.includes('충남') || prov.includes('세종') || prov.includes('충북')) return '충청권';
    if (prov.includes('부산') || prov.includes('경남') || prov.includes('울산')) return '동남권';
    if (prov.includes('광주') || prov.includes('전남') || prov.includes('전북') || prov.includes('제주')) return '호남권제주권';
    return '';
};

const scaleGroups = ['A. 5,000명 미만', 'B. 만명 미만', 'C. 만명 이상'];
const getScaleGroup = (val) => {
    if (val < 5000) return 'A. 5,000명 미만';
    if (val < 10000) return 'B. 만명 미만';
    return 'C. 만명 이상';
};

const regionGroupToRegions = {
    '수도권': ['서울', '경기', '인천'],
    '대경강원권': ['대구', '경북', '강원'],
    '충청권': ['대전', '충남', '세종', '충북'],
    '동남권': ['부산', '경남', '울산'],
    '호남권제주권': ['광주', '전남', '전북', '제주']
};

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('dashboard_data.json');
        appData = await res.json();
        appData.schoolMetadataMap = {}; 
        appData.filters.indicators = appData.filters.indicators.filter(i => !i.includes('연구성과 기준값 대비 실적'));
        appData.records = appData.records.filter(r => !r['지표명'].includes('연구성과 기준값 대비 실적'));
        appData.records.forEach(r => {
            if (!appData.schoolMetadataMap[r['학교명']]) {
                appData.schoolMetadataMap[r['학교명']] = { reg: r['지역'], typ: r['설립구분'] };
            }
        });
        Chart.defaults.color = '#6b7280';
        Chart.defaults.borderColor = 'rgba(0,0,0,0.06)';
        setupNavigation();
        setupFilters();
        updateDashboard();
    } catch(e) { console.error(e); }
});

function getPrecision(indName) {
    if (!indName) return 2;
    const cleanInd = indName.trim();
    if (cleanInd === '순위') return 0;
    if (cleanInd === 'T-점수' || cleanInd === '백분위') return 2;
    const meta = appData.indicator_metadata.find(m => m['지표명'] && m['지표명'].trim() === cleanInd);
    const formatType = meta ? meta['평가표기'] : '2자리';
    if (formatType === '정수') return 0;
    if (formatType === '1자리') return 1;
    if (formatType === '2자리') return 2;
    if (formatType === '3자리') return 3;
    return 2;
}

function truncateValue(val, dec) {
    if (val == null || isNaN(val)) return 0;
    const factor = Math.pow(10, dec);
    return Math.floor(val * factor + 1e-9) / factor;
}

function formatKpiValue(val, indName) {
    if (val == null || isNaN(val)) return '-';
    if (indName === '순위') return Math.round(val).toString();
    if (indName === 'T-점수' || indName === '백분위') {
        const rounded = Math.round(Number(val) * 100) / 100;
        return rounded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const dec = getPrecision(indName);
    const truncated = truncateValue(val, dec);
    return truncated.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function getAvgValue(rs, indName) {
    if(!rs || !rs.length) return null;
    const valid = rs.filter(r => r['값'] != null);
    if(valid.length === 0) return null;
    const dec = getPrecision(indName);
    const factor = Math.pow(10, dec);
    const scaledInputs = valid.map(r => Math.floor(r['값'] * factor + 1e-9));
    let sum = scaledInputs.reduce((acc, v) => acc + v, 0);
    let avgScaled = sum / valid.length;
    let resultScaled = Math.floor(avgScaled + 1e-9);
    return resultScaled / factor;
}

function median(values) {
    if (values.length === 0) return 0;
    values.sort((a,b) => a - b);
    const half = Math.floor(values.length / 2);
    if (values.length % 2) return values[half];
    return (values[half - 1] + values[half]) / 2.0;
}

function percentileExc(vals, k) {
    if (!vals || vals.length === 0) return 0;
    const sorted = [...vals].sort((a,b) => a - b);
    const index = k * (sorted.length + 1) - 1;
    if (index <= 0) return sorted[0];
    if (index >= sorted.length - 1) return sorted[sorted.length - 1];
    const low = Math.floor(index);
    const high = Math.ceil(index);
    return sorted[low] + (sorted[high] - sorted[low]) * (index - low);
}

function getStats(rs, indName) {
    if(!rs || !rs.length) return { mean: 0, stdDev: 0, max: 0, q1: 0, q2: 0, q3: 0 };
    const vals = rs.filter(r => r['값'] != null).map(r => r['값']).sort((a,b) => a - b);
    if(vals.length === 0) return { mean: 0, stdDev: 0, max: 0, q1: 0, q2: 0, q3: 0 };
    const mean = getAvgValue(rs, indName);
    const rawMean = vals.reduce((a,b) => a+b, 0) / vals.length;
    const variance = vals.reduce((a,b) => a + Math.pow(b - rawMean, 2), 0) / vals.length;
    const stdDev = Math.sqrt(variance);
    const max = vals[vals.length - 1];
    const q1 = percentileExc(vals, 0.25);
    const q2 = median(vals);
    const q3 = percentileExc(vals, 0.75);
    return { mean, stdDev, max, q1, q2, q3 };
}

function getTScore(val, stats, direction) {
    if(val == null || !stats || stats.stdDev === 0) return 50;
    let z = (val - stats.mean) / stats.stdDev;
    if(direction === -1) z = (stats.mean - val) / stats.stdDev;
    return 10 * z + 50;
}

function getIndicatorDirection(ind) {
    if (!ind) return 1;
    if (TARGETS[ind]) return TARGETS[ind].dir;
    if (ind.includes('비율') && (ind.includes('등록금') || ind.includes('학생수'))) return -1;
    return 1;
}

function getPercentile(rs, school, kpiName, year) {
    if(!school || school === 'all') return { value: null, topPct: 50, score: 50, percentile: 50 };
    const r = appData.records.find(x => x['지표명'] === kpiName && x['연도'] === year && x['학교명'] === school);
    if(!r || r['값'] == null) return { value: null, topPct: 50, score: 50, percentile: 50 };
    const schoolValue = r['값'];
    const pop = (rs || []).filter(x => x['값'] != null).map(x => x['값']);
    const totalUnivs = pop.length;
    if (totalUnivs <= 1) return { value: schoolValue, topPct: 0, score: 100, percentile: 100 };
    const countSmaller = pop.filter(v => v < schoolValue).length;
    const countSame = pop.filter(v => v === schoolValue).length;
    const direction = getIndicatorDirection(kpiName);
    let pct = (direction === 1) ? (countSmaller + (countSame / 2)) / totalUnivs * 100 : (pop.filter(v => v > schoolValue).length + (countSame / 2)) / totalUnivs * 100;
    return { value: schoolValue, topPct: 100 - pct, score: pct, percentile: pct };
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(ni => ni.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
            document.getElementById(item.dataset.target).classList.add('active');
            Object.keys(charts).forEach(key => { 
                if (key === 'massiveTrends') {
                    Object.keys(charts.massiveTrends).forEach(tk => charts.massiveTrends[tk]?.destroy());
                    charts.massiveTrends = {};
                } else if (charts[key] && typeof charts[key].destroy === 'function') {
                    charts[key].destroy();
                    charts[key] = null;
                }
            });
            updateDashboard();
        });
    });
}

function getActiveYear() { return document.getElementById('year-select')?.value || appData.filters.years[appData.filters.years.length - 1]; }

function setupFilters() {
    const schSel = document.getElementById('school-select');
    const cmpSel = document.getElementById('compare-select');
    const indSel = document.getElementById('indicator-select');
    const yearSel = document.getElementById('year-select');
    const scxSel = document.getElementById('scatter-x');
    const scySel = document.getElementById('scatter-y');

    appData.filters.years.forEach(y => { const o = document.createElement('option'); o.value = y; o.innerText = y + '년'; yearSel.appendChild(o); });
    yearSel.value = appData.filters.years[appData.filters.years.length - 1];
    document.getElementById('type-select').innerHTML = `<option value="all">전체 설립구분</option><option value="사립">사립</option><option value="국공립">국공립</option>`;
    const optAll = document.createElement('option'); optAll.value = 'all'; optAll.innerText = '전체 대학 (평균)'; schSel.appendChild(optAll);
    appData.filters.schools.forEach(s => { const o = document.createElement('option'); o.value = s; o.innerText = s; schSel.appendChild(o); });
    schSel.value = '한동대학교';
    appData.filters.schools.forEach(s => { const o = document.createElement('option'); o.value = s; o.innerText = s; cmpSel.appendChild(o); });
    appData.filters.indicators.forEach(i => { 
        const o = document.createElement('option'); o.value = i; o.innerText = i; indSel.appendChild(o); 
        const ox = o.cloneNode(true); scxSel.appendChild(ox);
        const oy = o.cloneNode(true); scySel.appendChild(oy);
    });
    indSel.value = '[1.5] 학생 충원 성과';
    scxSel.value = '[1.3] 교육비 환원율';
    scySel.value = '[1.5] 학생 충원 성과';

    appData.filters.regions.forEach(r => {
        const div = document.createElement('div'); div.className = 'region-checkbox-item';
        div.innerHTML = `<label><input type="checkbox" value="${r}" checked> ${r}</label>`;
        document.getElementById('region-checkbox-list').appendChild(div);
    });

    [schSel, cmpSel, indSel, yearSel, scxSel, scySel, document.getElementById('region-group-select'), document.getElementById('type-select'), document.getElementById('scale-select')].forEach(el => {
        el.addEventListener('change', () => { if (renderTimeout) clearTimeout(renderTimeout); renderTimeout = setTimeout(updateDashboard, 300); });
    });
    document.querySelectorAll('#region-checkbox-list input').forEach(cb => cb.addEventListener('change', () => updateDashboard()));
    document.getElementById('clear-compare').onclick = () => { cmpSel.selectedIndex = -1; updateDashboard(); };

    const rivalSel = document.getElementById('rivalry-compare-select');
    if(rivalSel) rivalSel.addEventListener('change', () => {
        const sch = document.getElementById('school-select').value;
        const cmp = Array.from(document.getElementById('compare-select').selectedOptions).map(o => o.value);
        renderRivalry(sch, cmp);
    });
}

function getFilteredRs(ind, year, sch, cmp, reg, typ, scale) {
    let base = appData.records.filter(r => r['지표명'] === ind && r['연도'] === year);
    const scaleInd = appData.filters.indicators.find(i => i.includes('학부') && i.includes('정원') && i.includes('재학생'));
    const sizeRecs = appData.records.filter(r => r['연도'] === year && r['지표명'] === scaleInd);
    let group = base.filter(r => {
        let mReg = (reg === 'all' || reg.includes(r['지역']));
        let mTyp = (typ === 'all' || ((r['설립구분'] === '사립' ? '사립' : '국공립') === typ));
        let mScale = (scale === 'all' || scale === undefined) || (getScaleGroup(sizeRecs.find(sr => sr['학교명'] === r['학교명'])?.['값']) === scale);
        return mReg && mTyp && mScale;
    });
    return { group, target: base.find(r => r['학교명'] === sch), compares: base.filter(r => cmp.includes(r['학교명'])) };
}

function updateDashboard() {
    const activePageId = document.querySelector('.nav-item.active').dataset.target;
    const sch = document.getElementById('school-select').value;
    const cmp = Array.from(document.getElementById('compare-select').selectedOptions).map(o => o.value);
    const ind = document.getElementById('indicator-select').value;
    const regChecked = Array.from(document.querySelectorAll('#region-checkbox-list input:checked')).map(i => i.value);
    const reg = regChecked.length > 0 ? regChecked : 'all';
    const typ = document.getElementById('type-select').value;
    const scale = document.getElementById('scale-select').value;

    document.querySelectorAll('.dynamic-indicator-name').forEach(el => el.innerText = ind);

    if(activePageId === 'page-performance') renderPerformance(sch, cmp, reg, typ);
    if(activePageId === 'page-benchmarking') renderBenchmarking(sch, cmp, ind, reg, typ, scale);
    if(activePageId === 'page-scatter') renderScatter(sch, cmp, reg, typ, scale);
    if(activePageId === 'page-ranking') renderRanking(sch, cmp, ind, reg, typ, scale);
    if(activePageId === 'page-evaluation') renderEvaluation(sch);
    if(activePageId === 'page-rivalry') renderRivalry(sch, cmp);
    if(activePageId === 'page-our-university') renderOurUniversity(sch, ind);
}

function renderPerformance(sch, cmp, reg, typ) {
    const latestYear = getActiveYear();
    document.getElementById('kpi-container').innerHTML = '';
    CORE_9_KPIS.slice(0, 8).forEach(kpi => {
        const { group } = getFilteredRs(kpi, latestYear, sch, cmp, reg, typ, 'all');
        const stat = getPercentile(group, sch, kpi, latestYear);
        const groupAvg = getAvgValue(group, kpi);
        let badge = stat.topPct <= 10 ? 'badge-green' : stat.topPct <= 30 ? 'badge-blue' : stat.topPct <= 60 ? 'badge-amber' : 'badge-red';
        const div = document.createElement('div');
        div.className = `kpi-card ${stat.topPct <= 10 ? 'good' : stat.topPct <= 30 ? 'mid' : stat.topPct <= 60 ? 'warn' : 'poor'}`;
        div.innerHTML = `<div class="kpi-header"><span class="kpi-label">${kpi.replace(/^\[\d+\.\d+\]\s*/, '')}</span><span class="kpi-badge ${badge}">상위 ${stat.topPct.toFixed(1)}%</span></div><div class="kpi-value">${formatKpiValue(stat.value, kpi)}</div><div class="kpi-footer"><span class="kpi-trend">평균: ${formatKpiValue(groupAvg, kpi)}</span></div>`;
        document.getElementById('kpi-container').appendChild(div);
    });

    // Dormitory
    const dormKpi = '[4.5] 기숙사 수용율 I';
    const { group: dGrp, target: dTar } = getFilteredRs(dormKpi, latestYear, sch, cmp, reg, typ, 'all');
    const sudokwon = ['서울', '경기', '인천'];
    const sRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===dormKpi && sudokwon.includes(r['지역']));
    const nRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===dormKpi && !sudokwon.includes(r['지역']));
    if(charts.dormReg) charts.dormReg.destroy();
    charts.dormReg = new Chart(document.getElementById('dormRegChart').getContext('2d'), {
        type: 'bar', data: { labels: ['수도권', '비수도권', '그룹평균', sch], datasets: [{ data: [getAvgValue(sRecs, dormKpi), getAvgValue(nRecs, dormKpi), getAvgValue(dGrp, dormKpi), dTar?dTar['값']:0], backgroundColor: ['#94a3b8', '#cbd5e1', 'rgba(29,78,216,0.2)', '#1d4ed8'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (v) => formatKpiValue(v, dormKpi) } } }
    });

    // Enrollment
    const enrollKpi = '[1.5] 학생 충원 성과';
    const { group: eGrp, target: eTar } = getFilteredRs(enrollKpi, latestYear, sch, cmp, reg, typ, 'all');
    const pRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===enrollKpi && r['설립구분']==='사립');
    const gRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===enrollKpi && r['설립구분']!=='사립');
    if(charts.sizeEnroll) charts.sizeEnroll.destroy();
    charts.sizeEnroll = new Chart(document.getElementById('sizeEnrollChart').getContext('2d'), {
        type: 'bar', data: { labels: ['사립', '국공립', '그룹평균', sch], datasets: [{ data: [getAvgValue(pRecs, enrollKpi), getAvgValue(gRecs, enrollKpi), getAvgValue(eGrp, enrollKpi), eTar?eTar['값']:0], backgroundColor: ['#94a3b8', '#cbd5e1', 'rgba(5,150,105,0.2)', '#059669'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (v) => formatKpiValue(v, enrollKpi) } } }
    });
}

function renderBenchmarking(sch, cmp, ind, reg, typ, scale) {
    const latestYear = getActiveYear();
    const { group, target, compares } = getFilteredRs(ind, latestYear, sch, cmp, reg, typ, scale);
    const stats = getStats(group, ind);
    const stat = getPercentile(group, sch, ind, latestYear);
    
    document.getElementById('bench-target-value').innerText = formatKpiValue(stat.value, ind);
    document.getElementById('bench-target-rank').innerText = `상위 ${stat.topPct.toFixed(1)}%`;
    document.getElementById('bench-group-avg').innerText = formatKpiValue(stats.mean, ind);

    const ctx = document.getElementById('bench-chart').getContext('2d');
    if(charts.benchmarking) charts.benchmarking.destroy();

    const labels = []; const data = []; const bgs = [];
    if(sch !== 'all' && target) { labels.push(sch); data.push(target['값']); bgs.push('#1d4ed8'); }
    compares.forEach((c, i) => { labels.push(c['학교명']); data.push(c['값']); bgs.push(cmpColors[i % cmpColors.length]); });
    labels.push('그룹 평균'); data.push(stats.mean); bgs.push('#6b7280');

    charts.benchmarking = new Chart(ctx, {
        type: 'bar', data: { labels, datasets: [{ data, backgroundColor: bgs, borderRadius: 4 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (v) => formatKpiValue(v, ind) } } }
    });

    updateRadarIndicatorFiltersUI();
    updateRadarSchoolLegendUI(sch, cmp);
    renderRadar(sch, cmp);

    // Benchmarking rank bars (Bottom section)
    const rankBars = document.getElementById('bench-rank-bars');
    rankBars.innerHTML = '';
    CORE_9_KPIS.slice(0, 5).forEach(kpi => {
        const { group: g } = getFilteredRs(kpi, latestYear, sch, cmp, 'all', 'all', 'all');
        const s = getPercentile(g, sch, kpi, latestYear);
        let color = s.score >= 80 ? '#059669' : s.score >= 60 ? '#1d4ed8' : s.score >= 40 ? '#d97706' : '#dc2626';
        rankBars.innerHTML += `<div class="rank-row"><div class="rank-label" style="width:220px;">${kpi.replace(/\[\d+\.\d+\]\s*/, '')}</div><div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${s.score}%; background:${color};">${s.score >= 15 ? formatKpiValue(s.value, kpi) : ''}</div></div><div class="rank-val" style="color:${color}; width:100px; text-align:right;">상위 ${s.topPct.toFixed(1)}%</div></div>`;
    });
}

function renderScatter(sch, cmp, reg, typ, scale) {
    const ctx = document.getElementById('scatter-canvas').getContext('2d');
    if(charts.scatter) charts.scatter.destroy();
    const indX = document.getElementById('scatter-x').value;
    const indY = document.getElementById('scatter-y').value;
    const year = getActiveYear();
    const { group: gX } = getFilteredRs(indX, year, sch, cmp, reg, typ, scale);
    const { group: gY } = getFilteredRs(indY, year, sch, cmp, reg, typ, scale);
    const scatterData = [];
    appData.filters.schools.forEach(s => {
        const rx = gX.find(r => r['학교명'] === s);
        const ry = gY.find(r => r['학교명'] === s);
        if(rx && ry && rx['값'] != null && ry['값'] != null) scatterData.push({ x: rx['값'], y: ry['값'], school: s });
    });
    const bgs = scatterData.map(d => d.school === sch ? '#f2cc60' : cmp.includes(d.school) ? cmpColors[cmp.indexOf(d.school) % cmpColors.length] : 'rgba(88, 166, 255, 0.4)');
    const rads = scatterData.map(d => (d.school === sch || cmp.includes(d.school)) ? 8 : 4);
    charts.scatter = new Chart(ctx, {
        type: 'scatter', data: { datasets: [{ data: scatterData, backgroundColor: bgs, pointRadius: rads }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false }, tooltip: { callbacks: { label: (c) => `${c.raw.school}: (${formatKpiValue(c.raw.x, indX)}, ${formatKpiValue(c.raw.y, indY)})` } } }, scales: { x: { title: { display: true, text: indX } }, y: { title: { display: true, text: indY } } } }
    });
}

function renderRanking(sch, cmp, ind, reg, typ, scale) {
    const year = getActiveYear();
    const { group } = getFilteredRs(ind, year, sch, cmp, reg, typ, scale);
    const dir = getIndicatorDirection(ind);
    group.sort((a,b) => dir === 1 ? b['값'] - a['값'] : a['값'] - b['값']);
    const tbody = document.querySelector('#ranking-table tbody');
    tbody.innerHTML = '';
    group.forEach((r, i) => {
        const tr = document.createElement('tr');
        if(r['학교명'] === sch) tr.className = 'highlight';
        tr.innerHTML = `<td>${i+1}</td><td>${r['학교명']}</td><td>${r['지역']}</td><td>${r['설립구분']}</td><td>${formatKpiValue(r['값'], ind)}</td>`;
        tbody.appendChild(tr);
    });
}

function renderEvaluation(sch) {
    const tbody = document.querySelector('#evaluation-table tbody');
    tbody.innerHTML = '';
    if(sch === 'all') return;
    Object.keys(TARGETS).forEach(ind => {
        const rs = appData.records.filter(r => r['지표명'] === ind && r['학교명'] === sch).sort((a,b) => b['연도'] - a['연도']).slice(0, 3);
        if(rs.length === 0) return;
        const avg = getAvgValue(rs, ind);
        const isPass = TARGETS[ind].dir === 1 ? avg >= TARGETS[ind].target : avg <= TARGETS[ind].target;
        tbody.innerHTML += `<tr><td>${ind}</td><td>${appData.indicator_metadata.find(m=>m['지표명']===ind)?.단위 || ''}</td><td>${formatKpiValue(avg, ind)}</td><td>${TARGETS[ind].target}</td><td><span class="badge ${isPass?'pass':'fail'}">${isPass?'PASS':'FAIL'}</span></td><td>${isPass?'★★★':'☆☆☆'}</td></tr>`;
    });
}

function renderRivalry(sch, cmp) {
    const rivalSel = document.getElementById('rivalry-compare-select');
    if(!rivalSel) return;
    if(rivalSel.children.length <= 1) {
        appData.filters.schools.forEach(s => { if(s!==sch) { const o = document.createElement('option'); o.value = s; o.innerText = s; rivalSel.appendChild(o); } });
    }
    const targetB = rivalSel.value || (cmp.length > 0 ? cmp[0] : null);
    document.getElementById('rival-a-name').innerText = sch;
    const container = document.getElementById('rival-rows-container');
    container.innerHTML = '';
    if(!targetB) return;
    const year = getActiveYear();
    CORE_9_KPIS.forEach(kpi => {
        const vA = appData.records.find(r => r['연도']===year && r['지표명']===kpi && r['학교명']===sch)?.값 || 0;
        const vB = appData.records.find(r => r['연도']===year && r['지표명']===kpi && r['학교명']===targetB)?.값 || 0;
        const dir = getIndicatorDirection(kpi);
        const aWins = dir === 1 ? vA > vB : vA < vB;
        container.innerHTML += `<div class="rivalry-row"><div class="rivalrow-side left ${aWins?'is-winner':''}"><span>${formatKpiValue(vA, kpi)}</span></div><div class="ind-label">${kpi.replace(/\[\d+\.\d+\]\s*/, '')}</div><div class="rivalrow-side right ${!aWins?'is-winner':''}"><span>${formatKpiValue(vB, kpi)}</span></div></div>`;
    });
}

let selectedRadarIndicators = ['[1.3] 교육비 환원율', '[1.5] 학생 충원 성과', '[1.5] 졸업생 진로 성과', '[3.1] 전임교원 및 겸임교원 확보율', '[4.1] 장학금 비율'];
function updateRadarIndicatorFiltersUI() {
    const container = document.getElementById('radar-indicator-filters');
    if(!container || container.children.length > 0) return;
    CORE_9_KPIS.forEach(ind => {
        const lbl = document.createElement('label');
        lbl.innerHTML = `<input type="checkbox" ${selectedRadarIndicators.includes(ind)?'checked':''} value="${ind}"> <span>${ind.replace(/\[\d+\.\d+\]\s*/, '')}</span>`;
        lbl.querySelector('input').onchange = (e) => {
            if(e.target.checked) selectedRadarIndicators.push(ind);
            else selectedRadarIndicators = selectedRadarIndicators.filter(x => x!==ind);
            renderRadar(document.getElementById('school-select').value, Array.from(document.getElementById('compare-select').selectedOptions).map(o=>o.value));
        };
        container.appendChild(lbl);
    });
}
function updateRadarSchoolLegendUI(sch, cmp) {
    const container = document.getElementById('radar-school-legend');
    if(!container) return;
    container.innerHTML = '';
    [sch, ...cmp].forEach((s, i) => { container.innerHTML += `<div style="display:flex; align-items:center; gap:5px;"><div style="width:10px; height:10px; border-radius:50%; background:${s===sch?'#1d4ed8':cmpColors[i-1 % cmpColors.length]}"></div><span>${s}</span></div>`; });
}
function renderRadar(sch, cmp) {
    const ctx = document.getElementById('radar-canvas'); if(!ctx) return;
    if(charts.radar) charts.radar.destroy();
    const year = getActiveYear();
    const datasets = [sch, ...cmp].map((s, i) => ({
        label: s,
        data: selectedRadarIndicators.map(k => getPercentile(getFilteredRs(k, year, s, [], 'all', 'all', 'all').group, s, k, year).score),
        borderColor: s===sch?'#1d4ed8':cmpColors[i-1 % cmpColors.length],
        fill: s===sch
    }));
    charts.radar = new Chart(ctx.getContext('2d'), { type: 'radar', data: { labels: selectedRadarIndicators.map(k=>k.replace(/\[\d+\.\d+\]\s*/, '')), datasets }, options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } } } });
}

function renderOurUniversity(sch, ind) {
    if (sch === 'all') sch = appData.filters.schools[0];
    const year = getActiveYear();
    const direction = getIndicatorDirection(ind);
    const yearBaseRecords = appData.records.filter(r => r['연도'] === year && r['지표명'] === ind);
    const stats = getStats(yearBaseRecords, ind);
    const targetRec = yearBaseRecords.find(r => r['학교명'] === sch);
    const val = targetRec ? targetRec['값'] : null;

    document.getElementById('dash-school-name').textContent = sch;
    document.getElementById('dash-indicator-name').textContent = ind;
    document.getElementById('dash-main-value').textContent = formatKpiValue(val, ind);
    document.getElementById('dash-main-unit').textContent = appData.indicator_metadata.find(m=>m['지표명']===ind)?.단위 || '';
    document.getElementById('dash-t-score').textContent = formatKpiValue(getTScore(val, stats, direction), 'T-점수');
    document.getElementById('dash-percentile').textContent = (100 - getPercentile(yearBaseRecords, sch, ind, year).topPct).toFixed(2) + '%';
    
    ['dashChange', 'dashTrend', 'dashRegion', 'dashScale', 'dashType', 'dashBenchmarkDots', 'dashRankTrend', 'dashDist'].forEach(key => { if (charts[key]) charts[key].destroy(); });

    // Change Rate
    const years = appData.filters.years.slice(-3);
    const vPrev = appData.records.find(r => r['학교명']===sch && r['지표명']===ind && r['연도']===years[years.length-2])?.값 || 0;
    const rate = vPrev !== 0 ? ((val / vPrev) - 1) * 100 : 0;
    charts.dashChange = new Chart(document.getElementById('dash-change-chart'), { type: 'bar', data: { labels: ['변화율'], datasets: [{ data: [rate], backgroundColor: rate>=0?'#005a9c':'#ff7b72' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { datalabels: { formatter: (v) => v.toFixed(1)+'%' } } } });

    // Trend
    const trendData = years.map(y => { const rs = appData.records.filter(r => r['연도'] === y && r['지표명'] === ind); return { avg: getAvgValue(rs, ind), univ: rs.find(r => r['학교명'] === sch)?.값 }; });
    charts.dashTrend = new Chart(document.getElementById('dash-trend-chart'), { type: 'line', data: { labels: years.map(y => y+'년'), datasets: [{ label: '우리대학', data: trendData.map(d=>d.univ), borderColor: '#f97316' }, { label: '대학평균', data: trendData.map(d=>d.avg), borderColor: '#0891b2', borderDash: [5,5] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { datalabels: { formatter: (v) => formatKpiValue(v, ind) } } } });

    // Region
    const regionData = customRegions.map(cr => getAvgValue(yearBaseRecords.filter(r => getCustomRegion(r['지역']) === cr), ind));
    charts.dashRegion = new Chart(document.getElementById('dash-region-chart'), { type: 'bar', data: { labels: customRegions, datasets: [{ data: regionData, backgroundColor: '#94a3b8' }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (v) => formatKpiValue(v, ind) } } } });

    // Scale
    const scaleAvgData = scaleGroups.map(grp => { const srs = appData.records.filter(r => r['연도']===year && r['지표명'].includes('학부') && r['지표명'].includes('정원')); const grpSchools = srs.filter(r => getScaleGroup(r['값']) === grp).map(r => r['학교명']); return getAvgValue(yearBaseRecords.filter(r => grpSchools.includes(r['학교명'])), ind); });
    charts.dashScale = new Chart(document.getElementById('dash-scale-chart'), { type: 'bar', data: { labels: scaleGroups, datasets: [{ data: scaleAvgData, backgroundColor: '#94a3b8' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (v) => formatKpiValue(v, ind) } } } });

    // Type
    const typeAvgData = ['사립', '국공립 등'].map(t => getAvgValue(yearBaseRecords.filter(r => (t === '사립' ? r['설립구분'] === '사립' : r['설립구분'] !== '사립')), ind));
    charts.dashType = new Chart(document.getElementById('dash-type-chart'), { type: 'bar', data: { labels: ['', '', '사립', '국공립 등', '', ''], datasets: [{ data: [null, null, ...typeAvgData, null, null], backgroundColor: '#475569' }] }, options: { responsive: true, maintainAspectRatio: false, categoryPercentage: 1.0, barPercentage: 0.9, plugins: { legend: { display: false }, datalabels: { formatter: (v) => formatKpiValue(v, ind) } } } });

    // Benchmark Dots
    const top10 = yearBaseRecords.filter(r=>r.값!=null).sort((a,b)=>direction===1?b.값-a.값:a.값-b.값).slice(0, 10);
    if(!top10.find(r=>r['학교명']===sch) && targetRec) top10.push(targetRec);
    top10.sort((a,b)=>direction===1?b.값-a.값:a.값-b.값);
    charts.dashBenchmarkDots = new Chart(document.getElementById('dash-benchmark-dots-chart'), { type: 'line', data: { labels: top10.map(r=>r['학교명']), datasets: [{ data: top10.map(r=>r.값), borderColor: '#003366', backgroundColor: top10.map(r=>r['학교명']===sch?'#f97316':'#003366'), pointRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { formatter: (v) => formatKpiValue(v, ind) } } } });

    // Rank Trend
    const rankTrend = years.map(y => { const yrBase = appData.records.filter(r => r['연도']===y && r['지표명']===ind && r.값!=null).sort((a,b)=>direction===1?b.값-a.값:a.값-b.값); const rIdx = yrBase.findIndex(r=>r['학교명']===sch); return rIdx>=0?rIdx+1:null; });
    charts.dashRankTrend = new Chart(document.getElementById('dash-rank-trend-chart'), { type: 'line', data: { labels: years.map(y=>y+'년'), datasets: [{ data: rankTrend, borderColor: '#003366', backgroundColor: '#f97316' }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { reverse: true } }, plugins: { legend: { display: false }, datalabels: { formatter: (v) => v } } } });

    // Dist table
    document.getElementById('dash-dist-table').innerHTML = `<thead><tr><th>우리대학교값</th><th>상위 75%</th><th>중위수</th><th>상위 25%</th><th>최댓값</th><th>평균</th></tr></thead><tbody><tr><td style="font-weight:800; color:#f97316;">${formatKpiValue(val, ind)}</td><td>${formatKpiValue(stats.q1, ind)}</td><td>${formatKpiValue(stats.q2, ind)}</td><td>${formatKpiValue(stats.q3, ind)}</td><td>${formatKpiValue(stats.max, ind)}</td><td>${formatKpiValue(stats.mean, ind)}</td></tr></tbody>`;
}
