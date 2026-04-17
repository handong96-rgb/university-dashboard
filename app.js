let appData = null;
let charts = {};

const CORE_9_KPIS = [
    '[1.5] 학생 충원 성과', '[1.5] 졸업생 진로 성과', '[1.3] 교육비 환원율', 
    '[4.1] 장학금 비율', '[3.1] 전임교원 및 겸임교원 확보율', '[4.5] 기숙사 수용률 I', 
    '[1.3] 세입 중 등록금 비율', '[4.6] 재학생 1인당 연간 자료구입비(결산)', '[3.4] 전임교원 1인당 교외연구비'
];

const cmpColors = ['#ff7b72', '#a371f7', '#3fb950', '#58a6ff', '#f2cc60', '#db2777', '#0891b2', '#79c0ff'];

const TARGETS = {
    '[1.3] 교육비 환원율': { target: 110, dir: 1 },
    '[1.3] 법인 재정규모 대비 법인전입금 비율(사립대)': { target: 10, dir: 1 },
    '[1.3] 법정부담금 부담률(사립대)': { target: 10, dir: 1 },
    '[1.3] 세입 중 기부금 비율': { target: 0.4, dir: 1 },
    '[1.3] 세입 중 등록금 비율': { target: 72, dir: -1 }, // lower is better
    '[1.3] 세입 중 법인전입금 비율(사립대)': { target: 0.4, dir: 1 },
    '[1.5] 졸업생 진로 성과': { target: 55, dir: 1 },
    '[1.5] 학생 충원 성과': { target: 85, dir: 1 },
    '[3.1] 전임교원 및 겸임교원 확보율': { target: 64, dir: 1 },
    '[3.3] 강사 강의료': { target: 53100, dir: 1 },
    '[3.4] 전임교원 1인당 SCI급 논문 실적': { target: 0.05, dir: 1 },
    '[3.4] 전임교원 1인당 교내연구비': { target: 1000, dir: 1 },
    '[3.4] 전임교원 1인당 교외연구비': { target: 10000, dir: 1 },
    '[3.4] 전임교원 1인당 등재(후보)지 논문 실적': { target: 0.35, dir: 1 },
    '[3.4] 전임교원 1인당 저역서 실적': { target: 0.06, dir: 1 },
    '[3.5] 직원 1인당 학생수': { target: 70, dir: -1 }, // lower is better
    '[4.1] 장학금 비율': { target: 12, dir: 1 },
    '[4.5] 기숙사 수용률 I': { target: 11, dir: 1 },
    '[4.5] 기숙사 수용률 II': { target: 11, dir: 1 },
    '[4.6] 재학생 1,000명당 도서관 직원수': { target: 1, dir: 1 },
    '[4.6] 재학생 1인당 연간 자료구입비(결산)': { target: 54000, dir: 1 }
};

window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('dashboard_data.json');
        appData = await res.json();
        
        Chart.defaults.color = '#6b7280';
        Chart.defaults.borderColor = 'rgba(0,0,0,0.06)';
        
        setupNavigation();
        setupFilters();
        updateDashboard();
    } catch(e) {
        console.error(e);
        document.querySelector('.powerbi-wrapper').innerHTML = `<h1 style="padding:2rem;">Data Load Failed!</h1><pre style="padding:2rem;color:red;white-space:pre-wrap;">${e.stack || e}</pre>`;
    }
});

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page-container');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(ni => ni.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(item.dataset.target).classList.add('active');
            
            updateDashboard(); // re-render on tab switch
        });
    });
}

function setupFilters() {
    const schSel = document.getElementById('school-select');
    const cmpSel = document.getElementById('compare-select');
    const indSel = document.getElementById('indicator-select');
    const scxSel = document.getElementById('scatter-x');
    const scySel = document.getElementById('scatter-y');

    const yearSel = document.getElementById('year-select');
    const regSel = document.getElementById('region-select');
    const typSel = document.getElementById('type-select');

    
    appData.filters.years.forEach(y => {
        const o = document.createElement('option'); o.value = y; o.innerText = y + '년'; yearSel.appendChild(o);
    });
    yearSel.value = appData.filters.years[appData.filters.years.length - 1];
    
    appData.filters.regions.forEach(reg => {
        const o = document.createElement('option'); o.value = reg; o.innerText = reg; regSel.appendChild(o);
    });

    appData.filters.types.forEach(typ => {
        const o = document.createElement('option'); o.value = typ; o.innerText = typ; typSel.appendChild(o);
    });

    const optAll = document.createElement('option');
    optAll.value = 'all'; optAll.innerText = '전체 대학 (평균)';
    schSel.appendChild(optAll);

    appData.filters.schools.forEach(sch => {
        const option = () => { const o = document.createElement('option'); o.value = sch; o.innerText = sch; return o; };
        schSel.appendChild(option());
        cmpSel.appendChild(option());
    });

    appData.filters.indicators.forEach(ind => {
        const option = () => { const o = document.createElement('option'); o.value = ind; o.innerText = ind; return o; };
        indSel.appendChild(option());
        scxSel.appendChild(option());
        scySel.appendChild(option());
    });

    // Defaults
    if(appData.filters.schools.includes('한동대학교')) schSel.value = '한동대학교';
    if(appData.filters.indicators.includes('[1.5] 학생 충원 성과')) {
        indSel.value = '[1.5] 학생 충원 성과';
        scySel.value = '[1.5] 학생 충원 성과';
    }
    if(appData.filters.indicators.includes('[4.1] 장학금 비율')) scxSel.value = '[4.1] 장학금 비율';

    [yearSel, schSel, cmpSel, indSel, scxSel, scySel, regSel, typSel].forEach(el => el.addEventListener('change', updateDashboard));

    // Improved Multi-select behavior: Toggle on click without Ctrl
    cmpSel.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const option = e.target;
        if (option.tagName === 'OPTION') {
            option.selected = !option.selected;
            
            // Visual Feedback: Add checkmarks
            if (option.selected) {
                if (!option.innerText.startsWith('✓ ')) {
                    option.innerText = '✓ ' + option.innerText;
                }
            } else {
                option.innerText = option.innerText.replace('✓ ', '');
            }
            
            const event = new Event('change', { bubbles: true });
            cmpSel.dispatchEvent(event);
            updateDashboard();
        }
    });
}

function getAvgValue(rs) {
    if(!rs || !rs.length) return null;
    const valid = rs.filter(r => r['값'] != null);
    if(valid.length === 0) return null;
    let sum = valid.reduce((acc, r) => acc + r['값'], 0);
    return sum / valid.length;
}

function getPercentile(rs, school, dir) {
    if(!school || school === 'all') return { value: null, topPct: 50, score: 50 };
    const r = rs.find(x => x['학교명'] === school);
    if(!r || r['값'] == null) return { value: null, topPct: 50, score: 50 };
    
    let valid = rs.filter(x => x['값'] != null).map(x => x['값']);
    if(valid.length === 0) return { value: r['값'], topPct: 50, score: 50 };
    
    valid.sort((a,b) => b - a); // desc
    if(dir === -1) valid.sort((a,b) => a - b); // asc if lower is better

    let rank = valid.indexOf(r['값']) + 1;
    let rankPct = (rank / valid.length) * 100;
    
    return {
        value: r['값'],
        topPct: rankPct,
        score: Math.max(0, 100 - rankPct) // bar width (100 is best)
    };
}


function getActiveYear() {
    const ySel = document.getElementById('year-select');
    return ySel && ySel.value ? ySel.value : appData.filters.years[appData.filters.years.length - 1];
}

function updateDashboard() {
    const activePageId = document.querySelector('.nav-item.active').dataset.target;
    const sch = document.getElementById('school-select').value;
    const cmp = Array.from(document.getElementById('compare-select').selectedOptions).map(o => o.value);
    const ind = document.getElementById('indicator-select').value;
    const reg = document.getElementById('region-select').value;
    const typ = document.getElementById('type-select').value;

    document.querySelectorAll('.dynamic-indicator-name').forEach(el => el.innerText = ind);

    if(activePageId === 'page-performance') renderPerformance(sch, cmp, reg, typ);
    if(activePageId === 'page-benchmarking') { 
        renderBenchmarking(sch, cmp, ind); 
        updateRadarIndicatorFiltersUI(); // New: Indicator axes
        updateRadarSchoolLegendUI(sch, cmp); // New: School colors
        renderRadar(sch, cmp); 
    }
    if(activePageId === 'page-scatter') renderScatter(sch, cmp, reg, typ);
    if(activePageId === 'page-ranking') renderRanking(sch, cmp, ind, reg, typ);
    if(activePageId === 'page-evaluation') renderEvaluation(sch);
    if(activePageId === 'page-rivalry') renderRivalry(sch, cmp);
}

function getGroupLabel(reg, typ) {
    if (reg === 'all' && typ === 'all') return "전국 평균";
    const parts = [];
    if (reg !== 'all') parts.push(reg);
    if (typ !== 'all') parts.push(typ);
    return parts.join('·') + " 평균";
}

function getFilteredRs(ind, year, sch, cmp, reg, typ) {
    let allYearRecs = appData.records.filter(r => r['연도'] === year && r['지표명'] === ind);
    let groupRs = allYearRecs;
    if(reg !== 'all') groupRs = groupRs.filter(r => r['지역'] === reg);
    if(typ !== 'all') groupRs = groupRs.filter(r => r['설립구분'] === typ);
    
    return {
        group: groupRs,
        target: allYearRecs.find(r => r['학교명'] === sch),
        compares: cmp.map(cName => allYearRecs.find(r => r['학교명'] === cName)).filter(Boolean)
    };
}

// 1. Executive Report
function renderPerformance(sch, cmp, reg, typ) {
    if(sch === 'all') sch = appData.filters.schools[0];
    const latestYear = getActiveYear();
    const groupLabel = getGroupLabel(reg, typ);
    
    document.getElementById('exec-school-name').textContent = sch;
    document.querySelectorAll('.l-sch').forEach(el => el.textContent = sch);

    // Destroy existing charts
    ['execRadar', 'fin', 'dormReg', 'sizeEnroll', 'research', 'enrollTrend', 'eduTrend'].forEach(key => {
        if(charts[key]) charts[key].destroy();
    });
    if(!charts.massiveTrends) charts.massiveTrends = {};
    for (let key in charts.massiveTrends) {
        charts.massiveTrends[key].destroy();
    }
    charts.massiveTrends = {};

    const getInd = (pattern) => appData.filters.indicators.find(i => i.includes(pattern)) || '';
    const getLocalFilteredRs = (ind, year = latestYear) => getFilteredRs(ind, year, sch, cmp, reg, typ);


    // 1-1. Top Core KPI Cards (8 Selected)
    const CORE_8_KPIS = [
        getInd('학생 충원 성과'), 
        getInd('졸업생 진로 성과'), 
        getInd('교육비 환원율'),
        getInd('전임교원 및 겸임교원 확보율'), 
        getInd('기숙사 수용률 I'), 
        getInd('세입 중 등록금 비율'),
        getInd('세입 중 기부금 비율'),
        getInd('직원 1인당 학생수')
    ].filter(Boolean);

    const kpiContainer = document.getElementById('kpi-container');
    kpiContainer.innerHTML = '';
    
    CORE_8_KPIS.forEach(kpi => {
        const { group, target } = getLocalFilteredRs(kpi);
        const dir = (TARGETS[kpi] || {dir: 1}).dir;
        
        // Percentile is calculated against the FULL dataset (not just the filtered group) for absolute ranking
        const allYearRecs = appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === kpi);
        const stat = getPercentile(allYearRecs, sch, dir);
        
        const groupAvg = getAvgValue(group);
        let badgeClass = stat.topPct <= 10 ? 'badge-green' : stat.topPct <= 30 ? 'badge-blue' : stat.topPct <= 60 ? 'badge-amber' : 'badge-red';
        let cardClass = stat.topPct <= 10 ? 'good' : stat.topPct <= 30 ? '' : stat.topPct <= 60 ? 'warn' : 'poor';
        let kpiName = kpi.replace(/^\[\d+\.\d+\]\s*/, '');
        let valStr = (target && target['값'] != null) ? target['값'].toFixed(1) : '-';

        kpiContainer.innerHTML += `
            <div class="kpi-card ${cardClass}">
                <div class="kpi-label" title="${kpiName}">${kpiName}</div>
                <div class="kpi-value">${valStr}</div>
                <div class="kpi-meta">
                    <span class="badge ${badgeClass}">전국 상위 ${stat.topPct.toFixed(1)}%</span>
                    <span class="kpi-nat">${groupLabel} ${groupAvg ? groupAvg.toFixed(1) : '-'}</span>
                </div>
            </div>`;
    });

    // 1-2. Rank Bars (All 22 Indicators)
    const rankBars = document.getElementById('rankBars');
    rankBars.innerHTML = '';
    const allIndicators = appData.filters.indicators.filter(i => /^\[\d+\.\d+\]/.test(i));
    
    let radarLabels = [], radarSchData = [], radarCmpDatasets = cmp.map(c => ({ label: c, data: [], borderColor: '', borderDash: [4,2], fill: false }));

    allIndicators.forEach((kpi, idx) => {
        const dir = (TARGETS[kpi] || {dir: 1}).dir;
        const allYearRecs = appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === kpi);
        const stat = getPercentile(allYearRecs, sch, dir);
        if(stat.value === null) return;

        let kpiName = kpi.replace(/^\[\d+\.\d+\]\s*/, '');
        let dirIcon = dir === 1 ? '↑' : '↓';
        let color = stat.score >= 80 ? '#059669' : stat.score >= 60 ? '#1d4ed8' : stat.score >= 40 ? '#d97706' : '#dc2626';

        rankBars.innerHTML += `
            <div class="rank-row">
              <div class="rank-label" style="width:220px;" title="${kpiName}">${kpiName.substring(0,25)} ${dirIcon}</div>
              <div class="rank-bar-bg" style="position:relative;">
                <div class="rank-bar-fill" style="width:${stat.score}%; background:${color}; padding-right:8px; display:flex; align-items:center; justify-content:flex-end; color:#fff; font-weight:700; font-size:12px;">
                  ${stat.score >= 10 ? stat.value.toFixed(1) : ''}
                </div>
                ${stat.score < 10 ? `<span style="position:absolute; left:8px; top:0; bottom:0; display:flex; align-items:center; font-size:12px; font-weight:700; color:#333;">${stat.value.toFixed(1)}</span>` : ''}
              </div>
              <div class="rank-val" style="color:${color}; width:80px; text-align:right;">상위 ${stat.topPct.toFixed(1)}%</div>
            </div>`;
            
        // Prepare Radar Data
        radarLabels.push(kpiName.substring(0, 8));
        radarSchData.push(stat.score);
        cmp.forEach((cName, cIdx) => {
            const cStat = getPercentile(allYearRecs, cName, dir);
            radarCmpDatasets[cIdx].data.push(cStat.value !== null ? cStat.score : 0);
            radarCmpDatasets[cIdx].borderColor = cmpColors[cIdx % cmpColors.length];
        });
    });

    if(document.getElementById('execRadarChart')) {
        charts.execRadar = new Chart(document.getElementById('execRadarChart').getContext('2d'), {
            type: 'radar',
            data: {
                labels: radarLabels,
                datasets: [
                    { label: sch, data: radarSchData, borderColor: '#1d4ed8', backgroundColor: 'rgba(29,78,216,0.12)', borderWidth: 2, pointRadius: 2, fill: true },
                    ...radarCmpDatasets,
                    { label: groupLabel + '(50)', data: Array(radarLabels.length).fill(50), borderColor: '#9ca3af', backgroundColor: 'transparent', borderDash: [2, 2], pointRadius: 0 }
                ]
            },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, 
                scales: { r: { min: 0, max: 100, ticks: { display: false }, pointLabels: { font: { size: 10, weight: '600' } } } } 
            }
        });
    }

    // 1-3. Financial Structure (With Comparison)
    const finKpis = [getInd('등록금 비율'), getInd('기부금 비율'), getInd('법인전입금')].filter(Boolean);
    if(document.getElementById('finChart')) {
        const datasets = [{ label: sch, data: finKpis.map(k => getPercentile(appData.records.filter(r=>r['연도']===latestYear&&r['지표명']===k), sch, (TARGETS[k]||{dir:1}).dir).value), backgroundColor: '#1d4ed8' }];
        cmp.forEach((cName, cIdx) => {
            datasets.push({ label: cName, data: finKpis.map(k => getPercentile(appData.records.filter(r=>r['연도']===latestYear&&r['지표명']===k), cName, (TARGETS[k]||{dir:1}).dir).value), backgroundColor: cmpColors[cIdx % cmpColors.length] });
        });
        datasets.push({ label: groupLabel, data: finKpis.map(k => getAvgValue(getLocalFilteredRs(k).group)), backgroundColor: '#9ca3af' });

        charts.fin = new Chart(document.getElementById('finChart').getContext('2d'), {
            type: 'bar',
            data: { labels: ['등록금 비율', '기부금 비율', '법인전입금 비율'], datasets },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } }
        });
    }

    // 1-3-A. Dormitory by Region (Comparative)
    const dormKpi = getInd('기숙사 수용률 I');
    if (document.getElementById('dormRegChart') && dormKpi) {
        const { group, target } = getLocalFilteredRs(dormKpi);
        const sudokwon = ['서울', '경기', '인천'];
        
        const sudokwonRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===dormKpi && sudokwon.includes(r['지역']));
        const nonSudokwonRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===dormKpi && !sudokwon.includes(r['지역']));

        const datasets = [{
            label: '기숙사 수용률 (%)',
            data: [
                getAvgValue(sudokwonRecs),
                getAvgValue(nonSudokwonRecs),
                getAvgValue(group),
                target ? target['값'] || 0 : 0
            ],
            backgroundColor: ['#94a3b8', '#cbd5e1', 'rgba(29,78,216,0.2)', '#1d4ed8'],
            borderRadius: 6
        }];
        charts.dormReg = new Chart(document.getElementById('dormRegChart').getContext('2d'), {
            type: 'bar',
            data: { labels: ['수도권 전체', '비수도권 전체', groupLabel, sch], datasets },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // 1-3-B. Size by Enrollment (Comparative)
    const enrollKpi = getInd('학생 충원 성과');
    if (document.getElementById('sizeEnrollChart') && enrollKpi) {
        const { group, target } = getLocalFilteredRs(enrollKpi);
        const publicTypes = ['국립', '국립대법인', '공립'];
        
        const privateRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===enrollKpi && r['설립구분'] === '사립');
        const publicRecs = appData.records.filter(r => r['연도']===latestYear && r['지표명']===enrollKpi && publicTypes.includes(r['설립구분']));

        const datasets = [{
            label: '학생 충원 성과 (점)',
            data: [
                getAvgValue(privateRecs),
                getAvgValue(publicRecs),
                getAvgValue(group),
                target ? target['값'] || 0 : 0
            ],
            backgroundColor: ['#94a3b8', '#cbd5e1', 'rgba(5,150,105,0.2)', '#059669'],
            borderRadius: 6
        }];
        charts.sizeEnroll = new Chart(document.getElementById('sizeEnrollChart').getContext('2d'), {
            type: 'bar',
            data: { labels: ['사립 전체', '국공립 전체', groupLabel, sch], datasets },
            options: { 
                responsive: true, maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // 1-4. Massive Trends (22 Indicators) with dynamic layout
    const trendsContainer = document.getElementById('massive-trends-container');
    const dynamicPalette = ['#1d4ed8', '#059669', '#d97706', '#9333ea', '#db2777', '#0891b2', '#ea580c', '#4f46e5', '#ca8a04', '#16a34a'];
    
    if(trendsContainer) {
        trendsContainer.innerHTML = '';
        allIndicators.forEach((kpi, idx) => {
            let kpiName = kpi.replace(/^\[\d+\.\d+\]\s*/, '');
            const themeColor = dynamicPalette[idx % dynamicPalette.length];
            trendsContainer.innerHTML += `
                <div class="chart-card" style="border-left: 5px solid ${themeColor}">
                    <div class="chart-title" style="font-size: 13px; color: #fff; background: ${themeColor}; padding: 8px 12px; margin: -16px -16px 16px -16px; border-radius: 6px 6px 0 0;">${kpiName} (최근 3년)</div>
                    <div class="chart-wrap" style="min-height: 160px;">
                        <canvas id="trend-${idx}"></canvas>
                    </div>
                </div>`;
        });
        
        setTimeout(() => {
            const displayYears = appData.filters.years.slice(-3);
            allIndicators.forEach((kpi, idx) => {
                const ctxNode = document.getElementById(`trend-${idx}`);
                if(!ctxNode) return;
                const themeColor = dynamicPalette[idx % dynamicPalette.length];
                
                const lineDatasets = [{ 
                    label: sch, 
                    data: displayYears.map(y => appData.records.find(r => r['연도']===y && r['지표명']===kpi && r['학교명']===sch)?.값 || null),
                    borderColor: themeColor, backgroundColor: themeColor + '20', borderWidth: 2.5, fill: true, tension: 0.3, pointRadius: 4 
                }];

                cmp.forEach((cName, cIdx) => {
                    lineDatasets.push({
                        label: cName,
                        data: displayYears.map(y => appData.records.find(r => r['연도']===y && r['지표명']===kpi && r['학교명']===cName)?.값 || null),
                        borderColor: cmpColors[cIdx % cmpColors.length], borderDash: [3,3], borderWidth: 1.5, tension: 0.3, pointRadius: 3
                    });
                });

                lineDatasets.push({ 
                    label: groupLabel, 
                    data: displayYears.map(y => getAvgValue(getLocalFilteredRs(kpi, y).group)), 
                    borderColor: '#9ca3af', borderDash: [5,4], borderWidth: 1.2, tension: 0.3, pointRadius: 0 
                });

                charts.massiveTrends[`trend-${idx}`] = new Chart(ctxNode.getContext('2d'), {
                    type: 'line',
                    data: { labels: displayYears, datasets: lineDatasets },
                    options: { 
                        responsive: true, maintainAspectRatio: false, 
                        plugins: { legend: { display: false } },
                        scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: false, ticks: { font: { size: 10 } } } }
                    }
                });
            });
        }, 150);
    }

    // 1-7. Research (Optional additional chart)
    const r1 = getInd('SCI'), r2 = getInd('교외연구비');
    if (document.getElementById('researchChart') && (r1 || r2)) {
        const datasets = [];
        
        // Target
        datasets.push({ 
            label: sch, 
            data: [r1, r2].map(k => getPercentile(appData.records.filter(r=>r['연도']===latestYear&&r['지표명']===k), sch, 1).value || 0),
            backgroundColor: '#1d4ed8' 
        });

        // Comps
        cmp.forEach((cName, cIdx) => {
            datasets.push({ 
                label: cName, 
                data: [r1, r2].map(k => getPercentile(appData.records.filter(r=>r['연도']===latestYear&&r['지표명']===k), cName, 1).value || 0),
                backgroundColor: cmpColors[cIdx % cmpColors.length] 
            });
        });

        // Group Average
        datasets.push({ 
            label: groupLabel, 
            data: [r1, r2].map(k => getAvgValue(getLocalFilteredRs(k).group)), 
            backgroundColor: '#9ca3af' 
        });

        charts.research = new Chart(document.getElementById('researchChart').getContext('2d'), {
            type: 'bar',
            data: { labels: ['논문 성과', '외부 연구비'], datasets },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' } } }
        });
    }
}

// 2. Benchmarking
function renderBenchmarking(sch, cmp, ind) {
    const activeReg = document.getElementById('region-select').value;
    const activeTyp = document.getElementById('type-select').value;

    const ctx = document.getElementById('benchmark-canvas').getContext('2d');
    if(charts.benchmarking) charts.benchmarking.destroy();

    const latestYear = getActiveYear();
    const groupLabel = getGroupLabel(activeReg, activeTyp);
    const { group, target, compares } = getFilteredRs(ind, latestYear, sch, cmp, activeReg, activeTyp);
    
    // Default group-based averages for context
    let schRegion = target ? target['지역'] : '-';
    let schType = target ? target['설립구분'] : '-';
    
    let allAvg = getAvgValue(appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === ind));
    let regAvg = getAvgValue(appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === ind && r['지역'] === schRegion));
    let typAvg = getAvgValue(appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === ind && r['설립구분'] === schType));
    let filterGrpAvg = getAvgValue(group);

    const labels = [sch];
    const data = [target ? target['값'] || 0 : 0];
    const bgColors = ['#1d4ed8'];

    compares.forEach((cRec, cIdx) => {
        labels.push(cRec['학교명']);
        data.push(cRec['값'] || 0);
        bgColors.push(cmpColors[cIdx % cmpColors.length]);
    });

    // Add context averages
    labels.push(groupLabel, `동일립유형(${schType}) `, `동일지역(${schRegion}) `, '전국 전체');
    data.push(filterGrpAvg, typAvg, regAvg, allAvg);
    bgColors.push('#6b7280', '#9ca3af', '#9ca3af', '#cbd5e1');

    charts.benchmarking = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data, backgroundColor: bgColors, borderRadius: 4 }] },
        options: {
            indexAxis: 'y', // horizontal bar
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// 3. Scatter
function renderScatter(sch, cmp, regFilter, typFilter) {
    const ctx = document.getElementById('scatter-canvas').getContext('2d');
    if(charts.scatter) charts.scatter.destroy();

    const indX = document.getElementById('scatter-x').value;
    const indY = document.getElementById('scatter-y').value;
    const latestYear = getActiveYear();

    let rsX = appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === indX);
    let rsY = appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === indY);

    if (regFilter !== 'all') {
        rsX = rsX.filter(r => r['지역'] === regFilter);
        rsY = rsY.filter(r => r['지역'] === regFilter);
    }
    if (typFilter !== 'all') {
        rsX = rsX.filter(r => r['설립구분'] === typFilter);
        rsY = rsY.filter(r => r['설립구분'] === typFilter);
    }

    const scatterData = [];
    appData.filters.schools.forEach(s => {
        const rx = rsX.find(r => r['학교명'] === s);
        const ry = rsY.find(r => r['학교명'] === s);
        if(rx && ry && rx['값'] != null && ry['값'] != null) {
            scatterData.push({ x: rx['값'], y: ry['값'], school: s });
        }
    });

    const bgColors = scatterData.map(d => {
        if(d.school === sch) return '#f2cc60';
        const cIdx = cmp.indexOf(d.school);
        if (cIdx > -1) return cmpColors[cIdx % cmpColors.length];
        return 'rgba(88, 166, 255, 0.4)';
    });
    
    const radii = scatterData.map(d => (d.school === sch || cmp.includes(d.school)) ? 8 : 4);

    charts.scatter = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: [{ data: scatterData, backgroundColor: bgColors, pointRadius: radii }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: (c) => `${c.raw.school}: (${c.raw.x.toFixed(1)}, ${c.raw.y.toFixed(1)})` } }
            },
            scales: {
                x: { title: { display: true, text: indX } },
                y: { title: { display: true, text: indY } }
            }
        }
    });
}

// 4. Ranking
function renderRanking(sch, cmp, ind, regFilter, typFilter) {
    const latestYear = getActiveYear();
    let rs = appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === ind && r['값'] != null);
    
    if (regFilter !== 'all') rs = rs.filter(r => r['지역'] === regFilter);
    if (typFilter !== 'all') rs = rs.filter(r => r['설립구분'] === typFilter);

    // Sort descending
    rs.sort((a,b) => b['값'] - a['값']);

    const tbody = document.querySelector('#ranking-table tbody');
    tbody.innerHTML = '';

    rs.forEach((r, idx) => {
        const tr = document.createElement('tr');
        if(r['학교명'] === sch) tr.style.backgroundColor = 'rgba(242, 204, 96, 0.15)';
        else if(cmp.includes(r['학교명'])) tr.style.backgroundColor = 'rgba(255, 123, 114, 0.15)';

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-weight:600">${r['학교명']}</td>
            <td>${r['지역']}</td>
            <td>${r['설립구분']}</td>
            <td class="val-highlight">${r['값'].toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 5. Evaluation
function renderEvaluation(sch) {
    const tbody = document.querySelector('#evaluation-table tbody');
    tbody.innerHTML = '';

    if(sch === 'all') {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">특정 기준 대학을 선택해야 정량평가표가 조회됩니다.</td></tr>';
        return;
    }

    const availableIndicators = Object.keys(TARGETS);

    availableIndicators.forEach(ind => {
        if(!appData.filters.indicators.includes(ind)) return;

        // Get recent 3 years
        const years = appData.filters.years.slice(-3);
        const rs = appData.records.filter(r => r['지표명'] === ind && r['학교명'] === sch && years.includes(r['연도']) && r['값'] != null);
        
        if(rs.length === 0) return;

        const avgVal = getAvgValue(rs);
        const goal = TARGETS[ind].target;
        const dir = TARGETS[ind].dir;

        const meta = appData.indicator_metadata.find(m => m['지표명'] === ind);
        const unit = meta && meta['단위'] !== 'NaN' ? meta['단위'] : '';

        // Pass condition
        let isPass = false;
        if(dir === 1) isPass = avgVal >= goal;
        else isPass = avgVal <= goal;

        // Stars dummy logic based on how much it surpassed
        let stars = isPass ? '★★★★★' : '★☆☆☆☆';
        if(isPass && dir === 1 && avgVal < goal * 1.05) stars = '★★★★☆';
        if(!isPass && dir === 1 && avgVal > goal * 0.9) stars = '★★☆☆☆';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:500;">${ind}</td>
            <td>${unit}</td>
            <td class="val-highlight">${avgVal.toFixed(2)}</td>
            <td>${goal}</td>
            <td><span class="badge ${isPass ? 'pass' : 'fail'}">${isPass ? 'PASS' : 'FAIL'}</span></td>
            <td class="stars">${stars}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 6. Rivalry
function renderRivalry(sch, cmp) {
    document.getElementById('rival-a-name').innerText = sch === 'all' ? 'Target Univ' : sch;

    const statsA = document.getElementById('rival-a-stats');
    const rightContainer = document.getElementById('rival-compare-container');
    statsA.innerHTML = ''; rightContainer.innerHTML = '';

    if(sch === 'all' || cmp.length === 0) {
        const msg = '<div style="color:var(--text-secondary); text-align:center;">기준 대학과 비교 대학을 모두 1개 이상 선택해주세요.</div>';
        statsA.innerHTML = msg; rightContainer.innerHTML = `<div class="rival-col right-rival">${msg}</div>`;
        return;
    }

    const latestYear = getActiveYear();

    // Build Stats A (Target)
    CORE_9_KPIS.forEach(kpi => {
        let vA = appData.records.find(r => r['연도']===latestYear && r['지표명']===kpi && r['학교명']===sch)?.값 || 0;
        
        let allCmpVals = cmp.map(cSchool => appData.records.find(r => r['연도']===latestYear && r['지표명']===kpi && r['학교명']===cSchool)?.값 || 0);
        let maxCmp = Math.max(...allCmpVals);
        let minCmp = Math.min(...allCmpVals);

        const kpiName = kpi.replace(/\[\d+\.\d+\]\s*/, '');
        const meta = appData.indicator_metadata.find(m => m['지표명'] === kpi);
        const unit = meta && meta['단위'] !== 'NaN' ? meta['단위'] : '';
        const dir = (TARGETS[kpi] || {dir: 1}).dir;

        const aWins = dir === 1 ? vA > maxCmp : vA < minCmp;

        statsA.innerHTML += `
            <div class="rival-stat ${aWins ? 'win' : ''}">
                <div class="stat-name">${kpiName}</div>
                <div><span class="stat-val">${vA.toFixed(1)}</span><span class="stat-unit">${unit}</span></div>
            </div>`;
    });

    // Build Stats B, C... (Compare Schools)
    cmp.forEach(cSchool => {
        let col = document.createElement('div');
        col.className = "rival-col right-rival";
        col.style.overflow = 'visible';
        
        let h2 = document.createElement('h2');
        h2.className = "rival-name";
        h2.innerText = cSchool;
        col.appendChild(h2);

        let statsB = document.createElement('div');
        statsB.className = "rival-stats";

        CORE_9_KPIS.forEach(kpi => {
            let vA = appData.records.find(r => r['연도']===latestYear && r['지표명']===kpi && r['학교명']===sch)?.값 || 0;
            let vB = appData.records.find(r => r['연도']===latestYear && r['지표명']===kpi && r['학교명']===cSchool)?.값 || 0;

            const kpiName = kpi.replace(/\[\d+\.\d+\]\s*/, '');
            const meta = appData.indicator_metadata.find(m => m['지표명'] === kpi);
            const unit = meta && meta['단위'] !== 'NaN' ? meta['단위'] : '';
            const dir = (TARGETS[kpi] || {dir: 1}).dir;

            const bWins = dir === 1 ? vB > vA : vB < vA;

            statsB.innerHTML += `
                <div class="rival-stat ${bWins ? 'win' : ''}">
                    <div class="stat-name" style="width: auto;"></div>
                    <div><span class="stat-val">${vB.toFixed(1)}</span><span class="stat-unit">${unit}</span></div>
                </div>`;
        });
        col.appendChild(statsB);
        rightContainer.appendChild(col);
    });
}

// 7. Radar function (Benchmarking Page)
let selectedRadarIndicators = [
    '[1.3] 교육비 환원율', 
    '[1.5] 학생 충원 성과', 
    '[1.5] 졸업생 진로 성과', 
    '[3.1] 전임교원 및 겸임교원 확보율', 
    '[4.1] 장학금 비율'
];

function updateRadarIndicatorFiltersUI() {
    const container = document.getElementById('radar-indicator-filters');
    if (!container || container.children.length > 0) return; // Only populate once

    const allIndicators = appData.filters.indicators.filter(i => /^\[\d+\.\d+\]/.test(i));
    
    allIndicators.forEach(ind => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex; align-items:center; gap:4px; cursor:pointer; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;';
        const kpiName = ind.replace(/\[\d+\.\d+\]\s*/, '');
        
        label.innerHTML = `
            <input type="checkbox" ${selectedRadarIndicators.includes(ind) ? 'checked' : ''} value="${ind}">
            <span title="${ind}">${kpiName}</span>
        `;
        
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                if (!selectedRadarIndicators.includes(ind)) selectedRadarIndicators.push(ind);
            } else {
                selectedRadarIndicators = selectedRadarIndicators.filter(x => x !== ind);
            }
            // Trigger redraw - we don't call updateDashboard to avoid full page refresh
            const sch = document.getElementById('school-select').value;
            const cmp = Array.from(document.getElementById('compare-select').selectedOptions).map(o => o.value);
            renderRadar(sch, cmp);
        });
        container.appendChild(label);
    });
}

function updateRadarSchoolLegendUI(sch, cmp) {
    const container = document.getElementById('radar-school-legend');
    if (!container) return;

    const allSchools = [sch, ...cmp].filter(s => s !== 'all');
    container.innerHTML = '';

    allSchools.forEach((sName, sIdx) => {
        const color = (sName === sch) ? '#1d4ed8' : cmpColors[(sIdx - 1) % cmpColors.length];
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; padding:2px 8px; border-radius:4px; background:#fff; border:1px solid #eee;';
        item.innerHTML = `
            <div style="width:8px; height:8px; border-radius:50%; background:${color}"></div>
            <span>${sName}</span>
        `;
        container.appendChild(item);
    });
}

function renderRadar(sch, cmp) {
    const ctx = document.getElementById('radar-canvas');
    if(!ctx) return;
    if(charts.radar) charts.radar.destroy();

    const latestYear = getActiveYear();

    if (selectedRadarIndicators.length < 3) {
        // Radar needs at least 3 points to look decent
        return; 
    }

    const labels = selectedRadarIndicators.map(k => k.replace(/\[\d+\.\d+\]\s*/, ''));
    const datasets = [];
    const allSchools = [sch, ...cmp].filter(s => s !== 'all');

    allSchools.forEach((sName, sIdx) => {
        const isTarget = (sName === sch);
        const color = isTarget ? '#1d4ed8' : cmpColors[(sIdx) % cmpColors.length];
        const dirLookup = (k) => (TARGETS[k] || {dir: 1}).dir;

        const data = [];
        const rawValues = [];

        selectedRadarIndicators.map(k => {
            const rs = appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === k);
            const p = getPercentile(rs, sName, dirLookup(k));
            data.push(p.score || 0);
            
            // Get raw value and unit
            const meta = appData.indicator_metadata.find(m => m['지표명'] === k);
            const unit = meta && meta['단위'] !== 'NaN' ? meta['단위'] : '';
            rawValues.push({ val: p.value, unit: unit, name: k.replace(/\[\d+\.\d+\]\s*/, '') });
        });

        datasets.push({
            label: sName,
            data: data,
            raw: rawValues, // Store for tooltip
            backgroundColor: isTarget ? 'rgba(29, 78, 216, 0.1)' : 'transparent',
            borderColor: color,
            pointBackgroundColor: color,
            borderWidth: isTarget ? 3 : 1.5,
            borderDash: isTarget ? [] : [3, 2],
            fill: isTarget,
            tension: 0.2
        });
    });

    charts.radar = new Chart(ctx.getContext('2d'), {
        type: 'radar',
        data: { labels, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataset = context.dataset;
                            const index = context.dataIndex;
                            const rawObj = dataset.raw[index];
                            const score = context.parsed.r;
                            const val = rawObj.val ? rawObj.val.toLocaleString() : '0';
                            return ` ${context.dataset.label}: ${score.toFixed(1)}점 (실제값: ${val}${rawObj.unit})`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    min: 0, max: 100, beginAtZero: true,
                    ticks: { stepSize: 25, display: true, font: { size: 9 }, backdropColor: 'transparent' },
                    grid: { color: '#f3f4f6' },
                    angleLines: { color: '#f3f4f6' },
                    pointLabels: { font: { size: 10, weight: '700' }, color: '#374151' }
                }
            }
        }
    });
}

