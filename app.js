let appData = null;
let charts = { massiveTrends: {} };
Chart.register(ChartDataLabels);

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
        appData.schoolMetadataMap = {}; // High-performance lookup
        
        // Global Indicator Filtering & Map building
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
    } catch(e) {
        console.error(e);
        document.querySelector('.powerbi-wrapper').innerHTML = `<h1 style="padding:2rem;">Data Load Failed!</h1><pre style="padding:2rem;color:red;white-space:pre-wrap;">${e.stack || e}</pre>`;
    }
});

function formatKpiValue(val, indName) {
    if (val == null || isNaN(val)) return '-';
    let dec = 2; // Default
    const meta = appData.indicator_metadata.find(m => m['지표명'] === indName);
    const formatType = meta ? meta['평가표기'] : '2자리';
    
    if (formatType === '정수') dec = 0;
    else if (formatType === '1자리') dec = 1;
    else if (formatType === '2자리') dec = 2;
    else if (formatType === '3자리') dec = 3;
    
    return Number(val).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

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

    // Initial filtering
    updateSchoolListsByFilter('all', 'all');

    // Consolidated filter event handling
    [yearSel, schSel, cmpSel, indSel, scxSel, scySel, regSel, typSel].forEach(el => {
        el.addEventListener('change', (e) => {
            const rVal = document.getElementById('region-select').value;
            const tVal = document.getElementById('type-select').value;
            
            if (e.target.id === 'region-select' || e.target.id === 'type-select') {
                updateSchoolListsByFilter(rVal, tVal);
            }
            updateDashboard();
        });
    });

    const rivalryCompareSelect = document.getElementById('rivalry-compare-select');
    if(rivalryCompareSelect) {
        rivalryCompareSelect.addEventListener('change', () => {
            const sch = schSel.value;
            renderRivalry(sch, []);
        });
    }

    cmpSel.addEventListener('mousedown', function(e) {
        e.preventDefault();
        const option = e.target;
        if (option.tagName === 'OPTION') {
            option.selected = !option.selected;
            if (option.selected) {
                if (!option.innerText.startsWith('✓ ')) option.innerText = '✓ ' + option.innerText;
            } else {
                option.innerText = option.innerText.replace('✓ ', '');
            }
            const event = new Event('change', { bubbles: true });
            cmpSel.dispatchEvent(event);
            updateDashboard();
        }
    });

    const clearCompareBtn = document.getElementById('clear-compare');
    if (clearCompareBtn) {
        clearCompareBtn.addEventListener('click', () => {
            const options = cmpSel.querySelectorAll('option');
            options.forEach(o => {
                o.selected = false;
                o.innerText = o.innerText.replace('✓ ', '');
            });
            const event = new Event('change', { bubbles: true });
            cmpSel.dispatchEvent(event);
            updateDashboard();
        });
    }
}

function updateSchoolListsByFilter(reg, typ) {
    const schSel = document.getElementById('school-select');
    const cmpSel = document.getElementById('compare-select');
    const rivalrySch1 = document.getElementById('rivalry-school-1');

    if (!schSel || !cmpSel) return;

    // Save current selections
    const currentSch = schSel.value;
    const currentCmps = Array.from(cmpSel.selectedOptions).map(o => o.value);

    // Filter schools using high-performance cached map
    const filteredSchools = appData.filters.schools.filter(name => {
        const meta = appData.schoolMetadataMap[name];
        if (!meta) return true; 
        const regMatch = (reg === 'all' || meta.reg === reg);
        const typMatch = (typ === 'all' || meta.typ === typ);
        return regMatch && typMatch;
    });

    // Efficiently update Target School
    const frag1 = document.createDocumentFragment();
    const optAll = document.createElement('option');
    optAll.value = 'all'; optAll.innerText = '전체 대학 (평균)';
    frag1.appendChild(optAll);

    filteredSchools.forEach(s => {
        const o = document.createElement('option'); o.value = s; o.innerText = s; frag1.appendChild(o);
    });
    schSel.innerHTML = '';
    schSel.appendChild(frag1);
    
    if (filteredSchools.includes(currentSch)) schSel.value = currentSch;
    else schSel.value = 'all';

    // Efficiently update Compare School
    const frag2 = document.createDocumentFragment();
    filteredSchools.forEach(s => {
        const o = document.createElement('option'); o.value = s; o.innerText = s; frag2.appendChild(o);
    });
    cmpSel.innerHTML = '';
    cmpSel.appendChild(frag2);
    
    currentCmps.forEach(v => {
        const opt = cmpSel.querySelector(`option[value="${v}"]`);
        if (opt) opt.selected = true;
    });

    // Page 6 Rivalry dropdown
    if (rivalrySch1) {
        rivalrySch1.innerHTML = '<option value="all">대학 선택</option>';
        filteredSchools.forEach(s => {
            const o = document.createElement('option'); o.value = s; o.innerText = s; rivalrySch1.appendChild(o);
        });
    }
}



function getAvgValue(rs) {
    if(!rs || !rs.length) return null;
    const valid = rs.filter(r => r['값'] != null);
    if(valid.length === 0) return null;
    let sum = valid.reduce((acc, r) => acc + r['값'], 0);
    return sum / valid.length;
}

function getIndicatorDirection(indName) {
    // 1: Higher is better ('정'), -1: Lower is better ('부')
    if (!appData || !appData.indicator_metadata) return (TARGETS[indName] || {dir: 1}).dir;
    const meta = appData.indicator_metadata.find(m => m['지표명'] === indName);
    if (meta && meta['평가성향'] === '부') return -1;
    if (meta && meta['평가성향'] === '정') return 1;
    // Fallback to TARGETS hardcoded dir if metadata is missing
    return (TARGETS[indName] || {dir: 1}).dir;
}

function getPercentile(rs, school, kpiName, year) {
    if(!school || school === 'all') return { value: null, topPct: 50, score: 50 };
    
    // Safety check for metadata extraction
    let kpi = kpiName;
    let yr = year;
    if ((!kpi || !yr) && rs && rs.length > 0) {
        kpi = rs[0]['지표명'];
        yr = rs[0]['연도'];
    }
    
    if (!kpi || !yr) return { value: null, topPct: 50, score: 50 };

    // Find the target school globally to prevent empty spaces when filter excludes it
    const r = appData.records.find(x => x['지표명'] === kpi && x['연도'] === yr && x['학교명'] === school);
    if(!r || r['값'] == null) return { value: null, topPct: 50, score: 50 };
    
    const schoolValue = r['값'];
    
    let valid = (rs || []).filter(x => x['값'] != null).map(x => x['값']);
    // Include school value if it's not present because of filters
    if (!valid.includes(schoolValue)) {
        valid.push(schoolValue);
    }
    
    const direction = getIndicatorDirection(kpi);
    
    valid.sort((a,b) => b - a); // desc
    if(direction === -1) valid.sort((a,b) => a - b); // asc if lower is better

    let rank = valid.indexOf(schoolValue) + 1;
    let rankPct = (rank / valid.length) * 100;
    
    return {
        value: schoolValue,
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
    
    // Update selection count
    const countEl = document.getElementById('compare-count');
    if (countEl) {
        countEl.innerText = `${cmp.length}개 선택`;
    }

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
    
    try {
        CORE_8_KPIS.forEach(kpi => {
            const { group, target } = getLocalFilteredRs(kpi);
            const dir = getIndicatorDirection(kpi);
            
            // Percentile is calculated against the locally filtered dataset reflecting active Region and Type
            const stat = getPercentile(group, sch, kpi, latestYear);
            
            const groupAvg = getAvgValue(group);
            let badgeClass = stat.topPct <= 10 ? 'badge-green' : stat.topPct <= 30 ? 'badge-blue' : stat.topPct <= 60 ? 'badge-amber' : 'badge-red';
            let cardClass = stat.topPct <= 10 ? 'good' : stat.topPct <= 30 ? 'mid' : stat.topPct <= 60 ? 'warn' : 'poor';
            let kpiName = kpi.replace(/^\[\d+\.\d+\]\s*/, '');
            let valStr = (target && target['값'] != null) ? formatKpiValue(target['값'], kpi) : '-';

            kpiContainer.innerHTML += `
                <div class="kpi-card ${cardClass}">
                    <div class="kpi-label" title="${kpiName}">${kpiName}</div>
                    <div class="kpi-value">${valStr}</div>
                    <div class="kpi-meta">
                        <span class="badge ${badgeClass}">${groupLabel.replace(' 평균', '')} 상위 ${stat.topPct.toFixed(1)}%</span>
                        <span class="kpi-nat">${groupLabel} ${groupAvg ? groupAvg.toFixed(1) : '-'}</span>
                    </div>
                </div>`;
        });
    } catch (e) { console.error("KPI Cards Loop Error:", e); }

    // 1-2. Rank Bars (All 22 Indicators)
    const rankBars = document.getElementById('rankBars');
    rankBars.innerHTML = '';
    const allIndicators = appData.filters.indicators.filter(i => /^\[\d+\.\d+\]/.test(i));
    
    let radarLabels = [], radarSchData = [], radarCmpDatasets = cmp.map(c => ({ label: c, data: [], borderColor: '', borderDash: [4,2], fill: false }));

    try {
        allIndicators.forEach((kpi, idx) => {
            const dir = getIndicatorDirection(kpi);
            const { group } = getFilteredRs(kpi, latestYear, sch, cmp, reg, typ);
            const stat = getPercentile(group, sch, kpi, latestYear);
            if(stat.value === null) return;

            let kpiName = kpi.replace(/^\[\d+\.\d+\]\s*/, '');
            let dirIcon = dir === 1 ? '↑' : '↓';
            let color = stat.score >= 80 ? '#059669' : stat.score >= 60 ? '#1d4ed8' : stat.score >= 40 ? '#d97706' : '#dc2626';
            const meta = appData.indicator_metadata.find(m => m['지표명'] === kpi);
            const unit = meta && meta['단위'] !== 'NaN' ? meta['단위'] : '';

            rankBars.innerHTML += `
                <div class="rank-row">
                  <div class="rank-label" style="width:220px;" title="${kpiName}">${kpiName.substring(0,25)} ${dirIcon}</div>
                  <div class="rank-bar-bg" style="position:relative;">
                    <div class="rank-bar-fill" style="width:${stat.score}%; background:${color}; padding-right:8px; display:flex; align-items:center; justify-content:flex-end; color:#fff; font-weight:700; font-size:11px;">
                      ${stat.score >= 15 ? formatKpiValue(stat.value, kpi) + unit : ''}
                    </div>
                    ${stat.score < 15 ? `<span style="position:absolute; left:8px; top:0; bottom:0; display:flex; align-items:center; font-size:11px; font-weight:700; color:#333;">${formatKpiValue(stat.value, kpi)}${unit}</span>` : ''}
                  </div>
                  <div class="rank-val" style="color:${color}; width:120px; text-align:right;">${groupLabel.replace(' 평균', '')} 상위 ${stat.topPct.toFixed(1)}%</div>
                </div>`;
                
            // Prepare Radar Data - Use Full Name as requested
            radarLabels.push(kpiName);
            radarSchData.push(stat.score);
            cmp.forEach((cName, cIdx) => {
                const cStat = getPercentile(group, cName, kpi, latestYear);
                radarCmpDatasets[cIdx].data.push(cStat.value !== null ? cStat.score : 0);
                radarCmpDatasets[cIdx].borderColor = cmpColors[cIdx % cmpColors.length];
            });
        });
    } catch (e) { console.error("Rank Bars Loop Error:", e); }

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
                layout: { padding: 10 },
                plugins: { 
                    legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } },
                    datalabels: { display: false }
                }, 
                scales: { 
                    r: { 
                        min: 0, max: 100, 
                        ticks: { display: false }, 
                        grid: { color: 'rgba(0,0,0,0.15)' },
                        angleLines: { color: 'rgba(0,0,0,0.15)' },
                        pointLabels: { 
                            font: { size: 9, weight: '600' },
                            padding: 10,
                            callback: function(label) {
                                if (label.length > 10) {
                                    // Smart wrap: split into 2-3 lines
                                    const lines = [];
                                    for (let i = 0; i < label.length; i += 10) {
                                        lines.push(label.substring(i, i + 10));
                                    }
                                    return lines;
                                }
                                return label;
                            }
                        } 
                    } 
                } 
            }
        });
    }

    // 1-3. Financial Structure (With Comparison)
    try {
        const finKpis = [getInd('등록금 비율'), getInd('기부금 비율'), getInd('법인전입금')].filter(Boolean);
        if(document.getElementById('finChart') && finKpis.length > 0) {
            const datasets = [];
            // Target
            datasets.push({ 
                label: sch, 
                data: finKpis.map(k => {
                    const val = getPercentile(getLocalFilteredRs(k).group, sch, k, latestYear).value;
                    return (val != null && !isNaN(val)) ? val : 0;
                }), 
                backgroundColor: '#1d4ed8' 
            });

            // Comps
            cmp.forEach((cName, cIdx) => {
                datasets.push({ 
                    label: cName, 
                    data: finKpis.map(k => {
                        const val = getPercentile(getLocalFilteredRs(k).group, cName, k, latestYear).value;
                        return (val != null && !isNaN(val)) ? val : 0;
                    }), 
                    backgroundColor: cmpColors[cIdx % cmpColors.length] 
                });
            });

            datasets.push({ 
                label: groupLabel, 
                data: finKpis.map(k => {
                    const val = getAvgValue(getLocalFilteredRs(k).group);
                    return (val != null && !isNaN(val)) ? val : 0;
                }), 
                backgroundColor: '#9ca3af' 
            });

            charts.fin = new Chart(document.getElementById('finChart').getContext('2d'), {
                type: 'bar',
                data: { labels: ['등록금 비율', '기부금 비율', '법인전입금 비율'], datasets },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: (v) => v !== null ? v.toFixed(1) + '%' : '-' }
                    },
                    scales: { y: { beginAtZero: true, max: 100 } }
                }
            });
        }
    } catch (e) { console.error("finChart Error:", e); }

    // 1-3-A. Dormitory by Region (Comparative)
    try {
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
                    (target && target['값'] != null) ? target['값'] : 0
                ].map(v => (v != null && !isNaN(v)) ? v : 0),
                backgroundColor: ['#94a3b8', '#cbd5e1', 'rgba(29,78,216,0.2)', '#1d4ed8'],
                borderRadius: 6
            }];
            charts.dormReg = new Chart(document.getElementById('dormRegChart').getContext('2d'), {
                type: 'bar',
                data: { labels: ['수도권 전체', '비수도권 전체', groupLabel, sch], datasets },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { display: false },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: (v) => v !== null ? v.toFixed(1) + '%' : '-' }
                    },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    } catch (e) { console.error("dormRegChart Error:", e); }

    // 1-3-B. Size by Enrollment (Comparative)
    try {
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
                    (target && target['값'] != null) ? target['값'] : 0
                ].map(v => (v != null && !isNaN(v)) ? v : 0),
                backgroundColor: ['#94a3b8', '#cbd5e1', 'rgba(5,150,105,0.2)', '#059669'],
                borderRadius: 6
            }];
            charts.sizeEnroll = new Chart(document.getElementById('sizeEnrollChart').getContext('2d'), {
                type: 'bar',
                data: { labels: ['사립 전체', '국공립 전체', groupLabel, sch], datasets },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { display: false },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: (v) => v !== null ? v.toFixed(1) : '-' }
                    },
                    scales: { y: { beginAtZero: true } }
                }
            });
        }
    } catch (e) { console.error("sizeEnrollChart Error:", e); }

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
                try {
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
                            plugins: { 
                                legend: { display: false },
                                datalabels: {
                                    display: (context) => context.datasetIndex === 0, // Only for Target
                                    align: 'top', anchor: 'end', font: { size: 9, weight: 'bold' },
                                    formatter: (v) => v !== null ? v.toLocaleString() : ''
                                }
                            },
                            scales: { x: { ticks: { font: { size: 10 } } }, y: { beginAtZero: false, ticks: { font: { size: 10 } } } }
                        }
                    });
                } catch (e) { console.error(`Trend Chart ${idx} Error:`, e); }
            });
        }, 300);
    }

    // 1-7. Research (Optional additional chart)
    try {
        const r1 = getInd('SCI'), r2 = getInd('교외연구비');
        if (document.getElementById('researchChart') && (r1 || r2)) {
            const datasets = [];
            
            // Target
            datasets.push({ 
                label: sch, 
                data: [r1, r2].map(k => {
                    const p = getPercentile(getLocalFilteredRs(k).group, sch, k, latestYear);
                    return (p.value != null && !isNaN(p.value)) ? p.value : 0;
                }),
                backgroundColor: '#1d4ed8' 
            });

            // Comps
            cmp.forEach((cName, cIdx) => {
                datasets.push({ 
                    label: cName, 
                    data: [r1, r2].map(k => {
                        const p = getPercentile(getLocalFilteredRs(k).group, cName, k, latestYear);
                        return (p.value != null && !isNaN(p.value)) ? p.value : 0;
                    }),
                    backgroundColor: cmpColors[cIdx % cmpColors.length] 
                });
            });

            // Group Average
            datasets.push({ 
                label: groupLabel, 
                data: [r1, r2].map(k => {
                    const v = getAvgValue(getLocalFilteredRs(k).group);
                    return (v != null && !isNaN(v)) ? v : 0;
                }), 
                backgroundColor: '#9ca3af' 
            });

            charts.research = new Chart(document.getElementById('researchChart').getContext('2d'), {
                type: 'bar',
                data: { labels: ['논문 성과', '외부 연구비'], datasets },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    plugins: { 
                        legend: { display: true, position: 'bottom' },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: (v) => v !== null ? v.toLocaleString() : '-' }
                    } 
                }
            });
        }
    } catch (e) { console.error("researchChart Error:", e); }
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

    const labels = [];
    const data = [];
    const bgColors = [];

    if (sch !== 'all' && target) {
        labels.push(sch);
        data.push(target['값'] || 0);
        bgColors.push('#1d4ed8');
    }

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
            layout: { padding: { right: 60 } }, // Increase right padding to avoid datalabel clipping
            plugins: { 
                legend: { display: false },
                datalabels: {
                    anchor: 'end', align: 'right', font: { size: 10, weight: 'bold' },
                    formatter: (v) => formatKpiValue(v, ind)
                }
            },
            scales: { x: { beginAtZero: true, ticks: { display: false }, grid: { display: false } } }
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
                datalabels: { display: false },
                tooltip: { 
                    callbacks: { 
                        label: (c) => {
                            const d = c.raw;
                            return [
                                `${d.school}`,
                                `X ${indX.replace(/\[\d+\.\d+\]\s*/, '')} : ${formatKpiValue(d.x, indX)}`,
                                `Y ${indY.replace(/\[\d+\.\d+\]\s*/, '')} : ${formatKpiValue(d.y, indY)}`
                            ];
                        }
                    } 
                }
            },
            scales: {
                x: { title: { display: true, text: indX } },
                y: { title: { display: true, text: indY } }
            }
        }
    });
}

// Global Sort State for Rankings
let currentSort = { col: '값', dir: 'desc' };

function renderRanking(sch, cmp, ind, regFilter, typFilter) {
    const latestYear = getActiveYear();
    let rs = appData.records.filter(r => r['연도'] === latestYear && r['지표명'] === ind && r['값'] != null);
    
    if (regFilter !== 'all') rs = rs.filter(r => r['지역'] === regFilter);
    if (typFilter !== 'all') rs = rs.filter(r => r['설립구분'] === typFilter);

    // Initial idx assignment before sorting to maintain absolute rank? 
    // Usually rank is based on the value in the filtered list
    const dir = getIndicatorDirection(ind);
    if (dir === 1) rs.sort((a,b) => b['값'] - a['값']); // Higher is better -> rank 1 is highest
    else rs.sort((a,b) => a['값'] - b['값']); // Lower is better -> rank 1 is lowest

    rs.forEach((r, i) => r._rank = i + 1);

    // Apply selected sort
    rs.sort((a, b) => {
        let vA = a[currentSort.col];
        let vB = b[currentSort.col];
        if (currentSort.col === 'rank') { vA = a._rank; vB = b._rank; }
        
        if (vA < vB) return currentSort.dir === 'asc' ? -1 : 1;
        if (vA > vB) return currentSort.dir === 'asc' ? 1 : -1;
        return 0;
    });

    const thead = document.querySelector('#ranking-table thead');
    if (thead && !thead.dataset.bound) {
        thead.dataset.bound = "true";
        thead.querySelectorAll('th').forEach(th => {
            th.addEventListener('click', () => {
                const colMap = { '순위': 'rank', '학교명': '학교명', '지역': '지역', '설립구분': '설립구분', '지푯값': '값' };
                const col = colMap[th.innerText.trim()] || '값';
                if (currentSort.col === col) {
                    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSort.col = col;
                    currentSort.dir = 'desc';
                }
                // Update icons
                thead.querySelectorAll('th').forEach(t => t.classList.remove('sort-asc', 'sort-desc'));
                th.classList.add(currentSort.dir === 'asc' ? 'sort-asc' : 'sort-desc');
                renderRanking(sch, cmp, ind, regFilter, typFilter);
            });
        });
    }

    const tbody = document.querySelector('#ranking-table tbody');
    tbody.innerHTML = '';

    rs.forEach((r) => {
        const tr = document.createElement('tr');
        if(r['학교명'] === sch) tr.style.backgroundColor = 'rgba(242, 204, 96, 0.15)';
        else if(cmp.includes(r['학교명'])) tr.style.backgroundColor = 'rgba(255, 123, 114, 0.15)';

        tr.innerHTML = `
            <td>${r._rank}</td>
            <td style="font-weight:600">${r['학교명']}</td>
            <td>${r['지역']}</td>
            <td>${r['설립구분']}</td>
            <td class="val-highlight">${formatKpiValue(r['값'], ind)}</td>
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
        const dir = getIndicatorDirection(ind);

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
            <td class="val-highlight">${formatKpiValue(avgVal, ind)}</td>
            <td>${goal}</td>
            <td><span class="badge ${isPass ? 'pass' : 'fail'}">${isPass ? 'PASS' : 'FAIL'}</span></td>
            <td class="stars">${stars}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 6. Rivalry
function renderRivalry(sch, cmp) {
    const targetNameEl = document.getElementById('rival-a-name');
    const container = document.getElementById('rival-rows-container');
    const rivalryCompareSelect = document.getElementById('rivalry-compare-select');

    if(!targetNameEl || !container || !rivalryCompareSelect) return;

    targetNameEl.innerText = sch === 'all' ? '전체 평균' : sch;

    // Repopulate rivalry select
    const currentVal = rivalryCompareSelect.value;
    rivalryCompareSelect.innerHTML = '<option value="">비교 대학을 선택하세요</option>';
    appData.filters.schools.forEach(s => {
        if (s !== sch && s !== 'all') {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            if (s === currentVal) opt.selected = true;
            rivalryCompareSelect.appendChild(opt);
        }
    });

    const firstComp = rivalryCompareSelect.value || (cmp.length > 0 ? cmp[0] : null);
    if (firstComp && firstComp !== rivalryCompareSelect.value) {
        // If empty but global cmp has one, sync it
        rivalryCompareSelect.value = firstComp;
    }

    container.innerHTML = '';

    if(sch === 'all' || !firstComp) {
        container.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 2rem;">기준 대학과 비교 대학(우측 드롭다운)을 선택해 주세요.</div>';
        return;
    }

    const latestYear = getActiveYear();
    const allKpis = appData.filters.indicators.filter(i => /^\[\d+\.\d+\]/.test(i) && !i.includes('연구성과 기준값 대비 실적'));

    let superior = 0, competitive = 0, inferior = 0;
    const rowElements = [];

    allKpis.forEach(kpi => {
        const vA = appData.records.find(r => r['연도']===latestYear && r['지표명']===kpi && r['학교명']===sch)?.값 || 0;
        const vB = appData.records.find(r => r['연도']===latestYear && r['지표명']===kpi && r['학교명']===firstComp)?.값 || 0;

        const kpiName = kpi.replace(/\[\d+\.\d+\]\s*/, '');
        const meta = appData.indicator_metadata.find(m => m['지표명'] === kpi);
        const unit = meta && meta['단위'] !== 'NaN' ? meta['단위'] : '';
        const dir = getIndicatorDirection(kpi);

        const aWins = dir === 1 ? vA > vB : vA < vB;
        const bWins = dir === 1 ? vB > vA : vB < vA;

        if (aWins) superior++;
        else if (bWins) inferior++;
        else competitive++;

        const row = document.createElement('div');
        row.className = 'rivalry-row';

        // Target Side
        const targetSide = `
            <div class="rivalrow-side left ${aWins ? 'is-winner' : ''}">
                ${aWins ? '<span class="win-badge blue">Win 👍</span>' : ''}
                <div>
                    <span class="rival-val">${formatKpiValue(vA, kpi)}</span>
                    <span class="rival-unit">${unit}</span>
                </div>
            </div>
        `;

        // Center Indicator
        const centerInd = `<div class="ind-label">${kpiName}</div>`;

        // Compare Side
        const compareSide = `
            <div class="rivalrow-side right ${bWins ? 'is-winner' : ''}">
                <div>
                    <span class="rival-val">${formatKpiValue(vB, kpi)}</span>
                    <span class="rival-unit">${unit}</span>
                </div>
                ${bWins ? '<span class="win-badge red">Win 👍</span>' : ''}
            </div>
        `;

        row.innerHTML = targetSide + centerInd + compareSide;
        rowElements.push(row);
    });

    // Scoreboard Summary
    const winRate = (superior + inferior) > 0 ? (superior / (superior + inferior) * 100) : 0;
    
    const summaryBar = document.createElement('div');
    summaryBar.className = 'rivalry-summary-bar';
    summaryBar.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card win">
                <span class="label">우세 (Superior)</span>
                <span class="count">${superior}</span>
            </div>
            <div class="summary-card draw">
                <span class="label">경합 (Competitive)</span>
                <span class="count">${competitive}</span>
            </div>
            <div class="summary-card loss">
                <span class="label">열세 (Inferior)</span>
                <span class="count">${inferior}</span>
            </div>
        </div>
        <div class="win-rate-container">
            <div class="win-rate-label">상대적 승률 (Win Rate)</div>
            <div class="win-rate-value">${winRate.toFixed(1)}%</div>
            <div class="win-rate-gauge">
                <div class="win-rate-fill" style="width: ${winRate}%"></div>
            </div>
        </div>
    `;

    container.appendChild(summaryBar);
    rowElements.forEach(row => container.appendChild(row));
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

    const allIndicators = appData.filters.indicators.filter(i => /^\[\d+\.\d+\]/.test(i) && !i.includes('연구성과 기준값 대비 실적'));
    
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
        const dirLookup = (k) => getIndicatorDirection(k);

        const data = [];
        const rawValues = [];

        selectedRadarIndicators.map(k => {
            const rReg = document.getElementById('region-select').value;
            const rTyp = document.getElementById('type-select').value;
            const groupRs = getFilteredRs(k, latestYear, sName, [], rReg, rTyp).group;
            
            const p = getPercentile(groupRs, sName, k, latestYear);
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
                },
                datalabels: {
                    display: true,
                    anchor: 'end', align: 'top', font: { size: 10, weight: 'bold' },
                    formatter: (v) => v !== null && v !== undefined ? Number(v).toFixed(2) : ''
                }
            },
            scales: {
                r: {
                    min: 0, max: 100, beginAtZero: true,
                    ticks: { stepSize: 25, display: true, font: { size: 9 }, backdropColor: 'transparent' },
                    grid: { color: '#d1d5db' },
                    angleLines: { color: '#d1d5db' },
                    pointLabels: { font: { size: 10, weight: '700' }, color: '#374151' }
                }
            }
        }
    });
}

