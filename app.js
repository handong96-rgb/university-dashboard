let appData = null;
let charts = { massiveTrends: {} };
let renderTimeout = null;
window.DASHBOARD_VERSION = "2.13";
console.error("DASHBOARD VERSION 2.13 LOADED");
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

const customRegions = ['수도권', '대경강원권', '충청권', '동남권', '호남권제주권'];
const getCustomRegion = (prov) => {
    if (!prov) return '';
    if (prov.includes('서울') || prov.includes('경기') || prov.includes('인천')) return '수도권';
    if (prov.includes('대구') || prov.includes('경북') || prov.includes('강원')) return '대경강원권';
    if (prov.includes('대전') || prov.includes('충남') || prov.includes('세종') || prov.includes('충북')) return '충청권';
    if (prov.includes('울산') || prov.includes('경남') || prov.includes('부산')) return '동남권';
    if (prov.includes('전남') || prov.includes('전북') || prov.includes('제주')) return '호남권제주권';
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
    '동남권': ['울산', '경남', '부산'],
    '호남권제주권': ['전남', '전북', '제주']
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
    if (indName === '순위') return Math.round(val).toString();
    if (indName === 'T-점수' || indName === '백분위') return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let dec = 2; // Default
    const meta = appData.indicator_metadata.find(m => m['지표명'] === indName);
    const formatType = meta ? meta['평가표기'] : '2자리';
    
    if (formatType === '정수') dec = 0;
    else if (formatType === '1자리') dec = 1;
    else if (formatType === '2자리') dec = 2;
    else if (formatType === '3자리') dec = 3;
    
    // Truncation (Floor) Logic
    const factor = Math.pow(10, dec);
    const truncated = Math.floor(val * factor + 1e-9) / factor;
    
    return truncated.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });
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

            // Robust multi-tab chart cleanup
            Object.keys(charts).forEach(key => {
                if (key === 'massiveTrends') {
                    Object.keys(charts.massiveTrends).forEach(tk => charts.massiveTrends[tk]?.destroy());
                    charts.massiveTrends = {};
                } else if (charts[key] && typeof charts[key].destroy === 'function') {
                    charts[key].destroy();
                    charts[key] = null;
                }
            });
            if (renderTimeout) clearTimeout(renderTimeout);

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
    const grpSel = document.getElementById('region-group-select');
    const typSel = document.getElementById('type-select');
    const scaleSel = document.getElementById('scale-select');

    // Standard dropdown populations
    appData.filters.years.forEach(y => {
        const o = document.createElement('option'); o.value = y; o.innerText = y + '년'; yearSel.appendChild(o);
    });
    yearSel.value = appData.filters.years[appData.filters.years.length - 1];

    typSel.innerHTML = `
        <option value="all">전체 설립구분</option>
        <option value="사립">사립</option>
        <option value="국공립">국공립</option>
    `;

    const optAll = document.createElement('option');
    optAll.value = 'all'; optAll.innerText = '전체 대학 (평균)';
    schSel.appendChild(optAll);

    appData.filters.schools.forEach(sch => {
        const o = document.createElement('option'); o.value = sch; o.innerText = sch; 
        schSel.appendChild(o);
        const c = document.createElement('option'); c.value = sch; c.innerText = sch;
        cmpSel.appendChild(c);
    });

    appData.filters.indicators.forEach(ind => {
        const o = () => { const el = document.createElement('option'); el.value = ind; el.innerText = ind; return el; };
        indSel.appendChild(o());
        scxSel.appendChild(o());
        scySel.appendChild(o());
    });

    scaleGroups.forEach(s => {
        const o = document.createElement('option'); o.value = s; o.innerText = s; scaleSel.appendChild(o);
    });

    // Hierarchical Populators
    function populateRegionGroups(targetSch) {
        grpSel.innerHTML = '<option value="all">전체 권역</option>';
        let groupsToShow = customRegions;
        if (targetSch !== 'all') {
            const schRegion = appData.schoolMetadataMap[targetSch]?.reg;
            const targetGrp = getCustomRegion(schRegion);
            if (targetGrp) groupsToShow = [targetGrp];
        }
        groupsToShow.forEach(g => {
            const o = document.createElement('option'); o.value = g; o.innerText = g; grpSel.appendChild(o);
        });
    }

    function populateRegionCheckboxes(targetGrp) {
        const container = document.getElementById('region-checkbox-list');
        container.innerHTML = '';
        let regionsToShow = [];
        if (targetGrp === 'all') {
            regionsToShow = appData.filters.regions;
        } else {
            regionsToShow = regionGroupToRegions[targetGrp] || [];
        }

        regionsToShow.forEach(r => {
            const div = document.createElement('label');
            div.className = 'checkbox-item';
            div.innerHTML = `<input type="checkbox" value="${r}" checked> <span>${r}</span>`;
            div.querySelector('input').addEventListener('change', () => {
                const checked = Array.from(container.querySelectorAll('input:checked')).map(i => i.value);
                triggerFiltering();
            });
            container.appendChild(div);
        });
    }

    // Initial Population
    populateRegionGroups(schSel.value);
    populateRegionCheckboxes(grpSel.value);

    // Defaults
    if(appData.filters.schools.includes('한동대학교')) schSel.value = '한동대학교';
    if(appData.filters.indicators.includes('[1.5] 학생 충원 성과')) {
        indSel.value = '[1.5] 학생 충원 성과';
        scySel.value = '[1.5] 학생 충원 성과';
    }
    if(appData.filters.indicators.includes('[4.1] 장학금 비율')) scxSel.value = '[4.1] 장학금 비율';

    function triggerFiltering() {
        const rVals = Array.from(document.querySelectorAll('#region-checkbox-list input:checked')).map(i => i.value);
        const tVal = typSel.value;
        const gVal = grpSel.value;
        const sVal = scaleSel.value;
        updateSchoolListsByFilter(rVals, tVal, gVal, sVal);
        updateDashboard();
    }

    // Consolidated filter event handling
    [yearSel, schSel, cmpSel, indSel, scxSel, scySel, typSel, grpSel, scaleSel].forEach(el => {
        el.addEventListener('change', (e) => {
            if (e.target.id === 'school-select') {
                populateRegionGroups(e.target.value);
                populateRegionCheckboxes(grpSel.value);
            } else if (e.target.id === 'region-group-select') {
                populateRegionCheckboxes(e.target.value);
            }
            triggerFiltering();
        });
    });

    // Initial filtering
    if (schSel.value !== 'all') {
        populateRegionGroups(schSel.value);
        populateRegionCheckboxes(grpSel.value);
    }
    triggerFiltering();

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

function updateSchoolListsByFilter(regions, typ, groupReg, scale) {
    const schSel = document.getElementById('school-select');
    const cmpSel = document.getElementById('compare-select');
    const rivalrySch1 = document.getElementById('rivalry-school-1');
    const year = getActiveYear();

    if (!schSel || !cmpSel) return;

    // Save current selections
    const currentSch = schSel.value;
    const currentCmps = Array.from(cmpSel.selectedOptions).map(o => o.value);

    // Filter schools using high-performance cached map + scale lookup
    const scaleIndName = appData.filters.indicators.find(i => i.includes('학부') && i.includes('정원') && i.includes('재학생'));
    const univSizeRecs = appData.records.filter(r => r['연도'] === year && r['지표명'] === scaleIndName);

    const filteredSchools = appData.filters.schools.filter(name => {
        const meta = appData.schoolMetadataMap[name];
        if (!meta) return true; 

        // 1. Region (Multiple Checkboxes)
        const regMatch = (regions.length === 0 || regions.includes(meta.reg));
        
        // 2. Type (Simplified Mapping)
        let typMatch = true;
        if (typ !== 'all') {
            const mappedTyp = (meta.typ === '사립') ? '사립' : '국공립';
            typMatch = (mappedTyp === typ);
        }

        // 3. Region Group
        const grpMatch = (groupReg === 'all' || getCustomRegion(meta.reg) === groupReg);
        
        // 4. Scale
        let scaleMatch = true;
        if (scale !== 'all') {
            const sizeValue = univSizeRecs.find(r => r['학교명'] === name)?.['값'] || 0;
            scaleMatch = (getScaleGroup(sizeValue) === scale);
        }

        return regMatch && typMatch && grpMatch && scaleMatch;
    });

    // DO NOT rebuild schSel (Target University) - it should always show all schools
    // Only rebuild Compare list and Rivalry list
    
    // 1. Update Compare School (filtered)
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

    // 2. Update Page 6 Rivalry dropdown (filtered)
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

function percentileExc(vals, k) {
    if (!vals.length) return 0;
    const N = vals.length;
    const i = k * (N + 1);
    if (i <= 1) return vals[0];
    if (i >= N) return vals[N - 1];
    const floorIdx = Math.floor(i);
    const fraction = i - floorIdx;
    return vals[floorIdx - 1] + fraction * (vals[floorIdx] - vals[floorIdx - 1]);
}

function median(vals) {
    if (!vals.length) return 0;
    const N = vals.length;
    const mid = Math.floor(N / 2);
    return (N % 2 !== 0) ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

function getStats(rs) {
    if(!rs || !rs.length) return { mean: 0, stdDev: 0, max: 0, q1: 0, q2: 0, q3: 0 };
    const vals = rs.filter(r => r['값'] != null).map(r => r['값']).sort((a,b) => a - b);
    if(vals.length === 0) return { mean: 0, stdDev: 0, max: 0, q1: 0, q2: 0, q3: 0 };
    
    const mean = vals.reduce((a,b) => a+b, 0) / vals.length;
    const variance = vals.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / vals.length;
    const stdDev = Math.sqrt(variance);
    
    const max = vals[vals.length - 1];
    const q1 = percentileExc(vals, 0.25);
    const q2 = median(vals);
    const q3 = percentileExc(vals, 0.75);
    
    return { mean, stdDev, max, q1, q2, q3 };
}

function getTScore(val, stats, direction) {
    if(!val || !stats || stats.stdDev === 0) return 50;
    // Standard T-Score formula: 10 * (z-score) + 50
    // If direction is -1 (lower is better), we flip the z-score
    let z = (val - stats.mean) / stats.stdDev;
    if(direction === -1) z = (stats.mean - val) / stats.stdDev;
    return 10 * z + 50;
}

function getIndicatorDirection(ind) {
    const meta = appData.indicator_metadata.find(m => m['지표명'] === ind);
    if (meta && meta['평가성향']) {
        return (meta['평가성향'] === '부') ? -1 : 1;
    }
    if (TARGETS[ind]) return TARGETS[ind].dir;
    return 1; // Default
}

function getPercentile(rs, school, kpiName, year) {
    if(!school || school === 'all') return { value: null, topPct: 50, score: 50, percentile: 50 };
    
    let kpi = kpiName;
    let yr = year;
    if ((!kpi || !yr) && rs && rs.length > 0) {
        kpi = rs[0]['지표명'];
        yr = rs[0]['연도'];
    }
    
    if (!kpi || !yr) return { value: null, topPct: 50, score: 50, percentile: 50 };

    const r = appData.records.find(x => x['지표명'] === kpi && x['연도'] === yr && x['학교명'] === school);
    if(!r || r['값'] == null) return { value: null, topPct: 50, score: 50, percentile: 50 };
    
    const schoolValue = r['값'];
    
    const pop = (rs || []).filter(x => x['값'] != null).map(x => x['값']);
    const totalUnivs = pop.length;
    if (totalUnivs <= 1) return { value: schoolValue, topPct: 0, score: 100 };

    // DAX logic: 나보다 명확하게 '작은' 값의 개수 세기
    const countStrictlyLess = pop.filter(v => v < schoolValue).length;
    
    // Raw Percentile: (나보다 작은 개수) / (전체 개수 - 1)
    let rawPercentile = countStrictlyLess / (totalUnivs - 1);
    
    // Excel-like Truncate (3 decimal places)
    let excelPercentile = Math.floor(rawPercentile * 1000 + 1e-9) / 1000;
    
    // Evaluation Type handling (정: 큰게 좋음, 부: 작은게 좋음)
    const meta = appData.indicator_metadata.find(m => m['지표명'] === kpi);
    const evalType = meta ? meta['평가성향'] : '정';
    
    let finalPercentile = (evalType === '부') ? (1 - excelPercentile) : excelPercentile;
    
    return {
        value: schoolValue,
        topPct: (1 - finalPercentile) * 100, 
        score: finalPercentile * 100,
        percentile: finalPercentile * 100
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
    const regChecked = Array.from(document.querySelectorAll('#region-checkbox-list input:checked')).map(i => i.value);
    const reg = regChecked.length > 0 ? regChecked : 'all';
    const typ = document.getElementById('type-select').value;
    const scaleSel = document.getElementById('scale-select');

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
    if(activePageId === 'page-scatter') renderScatter(sch, cmp, reg, typ, scaleSel.value);
    if(activePageId === 'page-ranking') renderRanking(sch, cmp, ind, reg, typ, scaleSel.value);
    if(activePageId === 'page-evaluation') renderEvaluation(sch);
    if(activePageId === 'page-rivalry') renderRivalry(sch, cmp);
    if(activePageId === 'page-our-university') renderOurUniversity(sch, ind);
}

function getGroupLabel(reg, typ) {
    if ((reg === 'all' || (Array.isArray(reg) && reg.length === appData.filters.regions.length)) && typ === 'all') return "전국 평균";
    const parts = [];
    if (reg !== 'all') {
        if (Array.isArray(reg)) {
            if (reg.length < 4) parts.push(reg.join('·'));
            else parts.push('선택지역');
        } else {
            parts.push(reg);
        }
    }
    if (typ !== 'all') parts.push(typ);
    return parts.join('·') + " 평균";
}

function getFilteredRs(ind, year, sch, cmp, reg, typ) {
    let allYearRecs = appData.records.filter(r => r['연도'] === year && r['지표명'] === ind);
    let groupRs = allYearRecs;

    // 1. Region Filter (Array support)
    if (reg !== 'all') {
        if (Array.isArray(reg)) {
            groupRs = groupRs.filter(r => reg.includes(r['지역']));
        } else {
            groupRs = groupRs.filter(r => r['지역'] === reg);
        }
    }

    // 2. Type Filter (Simplified Mapping)
    if (typ !== 'all') {
        groupRs = groupRs.filter(r => {
            const mapped = (r['설립구분'] === '사립') ? '사립' : '국공립';
            return (mapped === typ);
        });
    }

    // 3. Scale Filter (Dynamic lookup using latest available enrollment data)
    const scale = document.getElementById('scale-select').value;
    if (scale !== 'all') {
        const scaleIndName = appData.filters.indicators.find(i => i.includes('학부') && i.includes('정원') && i.includes('재학생'));
        // Find newest available year for scale data
        const newestScaleYear = appData.filters.years.slice().reverse().find(y => 
            appData.records.some(r => r['연도'] === y && r['지표명'] === scaleIndName)
        );
        const univSizeRecs = appData.records.filter(r => r['연도'] === newestScaleYear && r['지표명'] === scaleIndName);

        if (univSizeRecs.length > 0) {
            groupRs = groupRs.filter(r => {
                const sizeValue = univSizeRecs.find(sr => sr['학교명'] === r['학교명'])?.['값'];
                if (sizeValue == null) return true; // If size data is missing for this school, keep it (don't over-filter)
                return getScaleGroup(sizeValue) === scale;
            });
        }
    }
    
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
                layout: { padding: 30 },
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
                    layout: { padding: { top: 25 } },
                    plugins: { 
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
                        datalabels: { 
                            anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, 
                            formatter: (v, context) => {
                                const kpiNames = [
                                    '[1.3] 세입 중 등록금 비율', 
                                    '[1.3] 세입 중 기부금 비율', 
                                    '[1.3] 세입 중 법인전입금 비율(사립대)'
                                ];
                                return formatKpiValue(v, kpiNames[context.dataIndex]);
                            } 
                        }
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
                    layout: { padding: { top: 25 } },
                    plugins: { 
                        legend: { display: false },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: (v) => formatKpiValue(v, dormKpi) }
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
                    layout: { padding: { top: 25 } },
                    plugins: { 
                        legend: { display: false },
                        datalabels: { anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, formatter: (v) => formatKpiValue(v, enrollKpi) }
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
        if(renderTimeout) clearTimeout(renderTimeout);
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
        
        renderTimeout = setTimeout(() => {
            allIndicators.forEach((kpi, idx) => {
                try {
                    const ctxNode = document.getElementById(`trend-${idx}`);
                    if(!ctxNode) return;
                    const themeColor = dynamicPalette[idx % dynamicPalette.length];
                    const displayYears = appData.filters.years.slice(-3);
                    
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

                    if(charts.massiveTrends[`trend-${idx}`]) charts.massiveTrends[`trend-${idx}`].destroy();
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
                                    formatter: (v) => formatKpiValue(v, kpi)
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

            if(charts.research) charts.research.destroy();
            charts.research = new Chart(document.getElementById('researchChart').getContext('2d'), {
                type: 'bar',
                data: { labels: ['논문 성과', '외부 연구비'], datasets },
                options: { 
                    responsive: true, maintainAspectRatio: false, 
                    layout: { padding: { top: 25 } },
                    plugins: { 
                        legend: { display: true, position: 'bottom' },
                        datalabels: { 
                            anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' }, 
                            formatter: (v, context) => {
                                const ind = (context.dataIndex === 0) ? r1 : r2;
                                return formatKpiValue(v, ind);
                            } 
                        }
                    } 
                }
            });
        }
    } catch (e) { console.error("researchChart Error:", e); }
}

// 2. Benchmarking
function renderBenchmarking(sch, cmp, ind) {
    const regChecked = Array.from(document.querySelectorAll('#region-checkbox-list input:checked')).map(i => i.value);
    const activeReg = regChecked.length > 0 ? regChecked : 'all';
    const activeTyp = document.getElementById('type-select').value;
    const activeScale = document.getElementById('scale-select').value;

    const latestYear = getActiveYear();
    const groupLabel = getGroupLabel(activeReg, activeTyp);
    const { group, target, compares } = getFilteredRs(ind, latestYear, sch, cmp, activeReg, activeTyp, activeScale);
    
    const ctx = document.getElementById('benchmark-canvas').getContext('2d');
    if(charts.benchmarking) charts.benchmarking.destroy();
    if(charts.benchDots) charts.benchDots.destroy(); // Fix: destroy both benchmarking charts
    
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
            layout: { padding: { right: 80 } }, // Increase right padding to avoid datalabel clipping
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

    let { group: rsX } = getFilteredRs(indX, latestYear, sch, cmp, regFilter, typFilter);
    let { group: rsY } = getFilteredRs(indY, latestYear, sch, cmp, regFilter, typFilter);

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

function renderRanking(sch, cmp, ind, regFilter, typFilter, scaleFilter) {
    const latestYear = getActiveYear();
    let { group: rs } = getFilteredRs(ind, latestYear, sch, cmp, regFilter, typFilter);
    rs = rs.filter(r => r['값'] != null);

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
                renderRanking(sch, cmp, ind, regFilter, typFilter, scaleFilter);
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
            const regChecked = Array.from(document.querySelectorAll('#region-checkbox-list input:checked')).map(i => i.value);
            const rReg = regChecked.length > 0 ? regChecked : 'all';
            const rTyp = document.getElementById('type-select').value;
            const rScale = document.getElementById('scale-select').value;
            
            const groupRs = getFilteredRs(k, latestYear, sName, [], rReg, rTyp, rScale).group;
            
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
                    formatter: (v) => v !== null && v !== undefined ? Number(v).toFixed(1) : ''
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

// -------------------
// PAGE 7: OUR UNIVERSITY DASHBOARD
// -------------------
function renderOurUniversity(sch, ind) {
    console.error("DEBUG: renderOurUniversity START", {sch, ind, activePage: document.querySelector('.nav-item.active')?.dataset.target});
    if (sch === 'all') sch = appData.filters.schools[0];
    const year = getActiveYear();
    const direction = getIndicatorDirection(ind);
    const meta = appData.indicator_metadata.find(m => m['지표명'] === ind);
    const unit = meta && meta['단위'] !== 'NaN' ? meta['단위'] : '';

    // Update basic text
    document.getElementById('dash-school-name').textContent = sch;
    document.getElementById('dash-indicator-name').textContent = ind;
    document.querySelectorAll('.active-ind-name').forEach(el => el.textContent = ind.replace(/\[\d+\.\d+\]\s*/, ''));

    const tabContainer = document.getElementById('dash-year-tabs');
    if (tabContainer.children.length === 0) {
        appData.filters.years.slice(-3).forEach(y => {
            const tab = document.createElement('div');
            tab.className = 'year-tab' + (y === year ? ' active' : '');
            tab.textContent = y + '년';
            tab.onclick = () => {
                document.getElementById('year-select').value = y;
                updateDashboard();
            };
            tabContainer.appendChild(tab);
        });
    } else {
        Array.from(tabContainer.children).forEach(tab => {
            tab.classList.toggle('active', tab.textContent.includes(year));
        });
    }

    // Clear old charts
    ['dashChange', 'dashTrend', 'dashRegion', 'dashScale', 'dashBenchmarkDots', 'dashRankTrend', 'dashDist'].forEach(key => {
        if (charts[key]) charts[key].destroy();
    });

    // 1. Calculations & Data Extraction
    const allYears = appData.filters.years.slice(-3);
    const checkedRegions = Array.from(document.querySelectorAll('#region-checkbox-list input:checked')).map(i => i.value);
    const typFilter = document.getElementById('type-select').value;
    const grpFilter = document.getElementById('region-group-select').value;
    const scaleFilter = document.getElementById('scale-select').value;

    const scaleIndName = appData.filters.indicators.find(i => i.includes('학부') && i.includes('정원') && i.includes('재학생'));
    const univSizeRecs = appData.records.filter(r => r['연도'] === year && r['지표명'] === scaleIndName);

    const getFilteredRecords = (recs) => {
        return recs.filter(r => {
            const meta = appData.schoolMetadataMap[r['학교명']];
            
            // 1. Region (Multiple Checkbox)
            const matchesReg = (checkedRegions.length === 0) || (checkedRegions.includes(r['지역']));
            
            // 2. Type (Simplified Mapping)
            let matchesTyp = true;
            if (typFilter !== 'all') {
                const mappedTyp = (r['설립구분'] === '사립') ? '사립' : '국공립';
                matchesTyp = (mappedTyp === typFilter);
            }

            // 3. Region Group
            const matchesGrp = (grpFilter === 'all') || (getCustomRegion(r['지역']) === grpFilter);
            
            // 4. Scale
            let matchesScale = true;
            if (scaleFilter !== 'all') {
                const sizeValue = univSizeRecs.find(sizeR => sizeR['학교명'] === r['학교명'])?.['값'];
                if (sizeValue != null) {
                    matchesScale = (getScaleGroup(sizeValue) === scaleFilter);
                }
            }

            return matchesReg && matchesTyp && matchesGrp && matchesScale;
        });
    };

    const yearBaseRecords = appData.records.filter(r => r['연도'] === year && r['지표명'] === ind);
    const yearRecords = getFilteredRecords(yearBaseRecords);
    
    const stats = getStats(yearRecords);
    // Always look up target school from UNFILTERED records to prevent null when school is outside selected region
    const targetRec = yearBaseRecords.find(r => r['학교명'] === sch);
    const val = targetRec ? targetRec['값'] : null;

    // T-Score & Percentile (based on filtered population)
    const pData = getPercentile(yearRecords, sch, ind, year);
    const tScore = getTScore(val, stats, direction);

    document.getElementById('dash-main-value').textContent = formatKpiValue(val, ind);
    document.getElementById('dash-main-unit').textContent = unit;
    document.getElementById('dash-t-score').textContent = formatKpiValue(tScore, 'T-점수');
    document.getElementById('dash-percentile').textContent = (100 - pData.topPct).toFixed(2) + '%';


    // 2. Row 1: KPI Change Chart
    const prevYear = allYears[allYears.length - 2];
    const currYear = allYears[allYears.length - 1];
    const recsPrev = appData.records.filter(r => r['학교명'] === sch && r['지표명'] === ind && r['연도'] === prevYear);
    const recsCurr = appData.records.filter(r => r['학교명'] === sch && r['지표명'] === ind && r['연도'] === currYear);
    const valPrev = recsPrev.length ? recsPrev[0]['값'] : 0;
    const valCurr = recsCurr.length ? recsCurr[0]['값'] : 0;
    const changeRate = valPrev !== 0 ? ((valCurr / valPrev) - 1) * 100 : 0;

    charts.dashChange = new Chart(document.getElementById('dash-change-chart'), {
        type: 'bar',
        data: {
            labels: ['변화율'],
            datasets: [{
                data: [changeRate],
                backgroundColor: changeRate >= 0 ? '#005a9c' : '#ff7b72',
                borderRadius: 4,
                barThickness: 30
            }]
        },
        options: {
            indexAxis: 'y', responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: true, color: '#000', font: { weight: 'bold' }, anchor: changeRate >= 0 ? 'end' : 'start', align: changeRate >= 0 ? 'right' : 'left',
                    formatter: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
                } 
            },
            scales: { 
                x: { 
                    grid: { color: '#eee' }, 
                    ticks: { font: { size: 10 } },
                    // suggestedMin: -Math.max(10, Math.abs(changeRate)*1.5),
                    // suggestedMax: Math.max(10, Math.abs(changeRate)*1.5)
                    min: changeRate >= 0 ? -10 : Math.min(-10, changeRate * 1.2),
                    max: changeRate >= 0 ? Math.max(10, changeRate * 1.2) : 10
                }, 
                y: { display: false } 
            }
        }
    });

    // Trend Chart
    const trendData = allYears.map(y => {
        const yrBaseRecs = appData.records.filter(r => r['연도'] === y && r['지표명'] === ind);
        const yrRecs = getFilteredRecords(yrBaseRecs);
        const yrStats = getStats(yrRecs);
        const schRec = yrRecs.find(r => r['학교명'] === sch);
        return { year: y, univ: schRec ? schRec['값'] : null, avg: yrStats.mean };
    });

    charts.dashTrend = new Chart(document.getElementById('dash-trend-chart'), {
        type: 'line',
        data: {
            labels: trendData.map(d => d.year + '년'),
            datasets: [
                { label: '우리대학교값', data: trendData.map(d => d.univ), borderColor: '#f97316', backgroundColor: '#f97316', tension: 0.3, pointRadius: 5 },
                { label: '대학평균', data: trendData.map(d => d.avg), borderColor: '#0891b2', borderDash: [5, 5], tension: 0.3, pointRadius: 0 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 35 } },
            plugins: { 
                legend: { position: 'top', align: 'end', labels: { boxWidth: 10, font: { size: 10 } } },
                datalabels: {
                    display: true, align: 'top', font: { size: 10, weight: 'bold' },
                    formatter: (v) => formatKpiValue(v, ind)
                }
            },
            scales: { y: { beginAtZero: false, grid: { borderDash: [2, 2] } } }
        }
    });

    const targetCustomRegion = getCustomRegion(appData.schoolMetadataMap[sch]?.reg);

    // Region comparison: always use FULL (unfiltered) records so all 5 regions show values regardless of sidebar filter
    const regionData = customRegions.map(cr => {
        const regRs = yearBaseRecords.filter(r => getCustomRegion(r['지역']) === cr);
        return getAvgValue(regRs);
    });

    charts.dashRegion = new Chart(document.getElementById('dash-region-chart'), {
        type: 'bar',
        data: {
            labels: customRegions,
            datasets: [{
                data: regionData,
                backgroundColor: customRegions.map(r => (targetCustomRegion === r ? '#f97316' : '#94a3b8')),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            indexAxis: 'y',
            layout: { padding: { right: 80 } },
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: true, anchor: 'end', align: 'right', font: { size: 9 },
                    formatter: (v) => formatKpiValue(v, ind)
                } 
            },
            scales: { x: { display: false }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } }
        }
    });

    // Scale (Size) Comparison
    const targetSize = univSizeRecs.find(r => r['학교명'] === sch)?.['값'] || 0;
    const targetGroup = getScaleGroup(targetSize);

    // Scale comparison: use FULL (unfiltered) records for fair group averages
    const scaleAvgData = scaleGroups.map(grp => {
        const schoolsInGrp = univSizeRecs.filter(r => getScaleGroup(r['값']) === grp).map(r => r['학교명']);
        const grpRs = yearBaseRecords.filter(r => schoolsInGrp.includes(r['학교명']));
        return getAvgValue(grpRs);
    });

    charts.dashScale = new Chart(document.getElementById('dash-scale-chart'), {
        type: 'bar',
        data: {
            labels: scaleGroups,
            datasets: [{
                data: scaleAvgData,
                backgroundColor: scaleGroups.map(g => (g === targetGroup ? '#003366' : '#94a3b8')),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 45 } },
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: true, anchor: 'end', align: 'top', font: { size: 9 },
                    formatter: (v) => formatKpiValue(v, ind)
                } 
            },
            scales: { y: { display: false }, x: { grid: { display: false }, ticks: { font: { size: 10 } } } }
        }
    });

    // Benchmark Dots Chart (Ranking Visual)
    const sortedForDots = [...yearRecords].filter(r => r['값'] != null).sort((a,b) => direction === 1 ? b['값'] - a['값'] : a['값'] - b['값']);
    const top10ForDots = sortedForDots.slice(0, 10);
    if (!top10ForDots.find(r => r['학교명'] === sch) && targetRec) {
        top10ForDots.push(targetRec);
    }
    top10ForDots.sort((a,b) => direction === 1 ? b['값'] - a['값'] : a['값'] - b['값']);

    charts.dashBenchmarkDots = new Chart(document.getElementById('dash-benchmark-dots-chart'), {
        type: 'line',
        data: {
            labels: top10ForDots.map(r => r['학교명']),
            datasets: [{
                data: top10ForDots.map(r => r['값']),
                borderColor: '#003366',
                backgroundColor: top10ForDots.map(r => r['학교명'] === sch ? '#f97316' : '#003366'),
                showLine: true,
                pointRadius: 6,
                pointHoverRadius: 8,
                tension: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 35 } },
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: true, align: 'top', offset: 5, font: { size: 9, weight: 'bold' },
                    formatter: (v) => formatKpiValue(v, ind)
                } 
            },
            scales: { 
                x: { 
                    grid: { display: false }, 
                    ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45, padding: 8 } 
                }, 
                y: { display: false } 
            }
        }
    });


    // 4. Row 3: Ranking & Stats
    // Rank Trend: Sync with active filters
    const rankTrend = allYears.map(y => {
        const yrBase = appData.records.filter(r => r['연도'] === y && r['지표명'] === ind && r['값'] != null);
        const yrSizeRecs = appData.records.filter(r => r['연도'] === y && r['지표명'] === scaleIndName);
        
        const filtered = yrBase.filter(r => {
            const matchesReg = (checkedRegions.length === 0) || (checkedRegions.includes(r['지역']));
            const matchesTyp = (typFilter === 'all') || (((r['설립구분'] === '사립') ? '사립' : '국공립') === typFilter);
            const matchesGrp = (grpFilter === 'all') || (getCustomRegion(r['지역']) === grpFilter);
            let matchesScale = true;
            if (scaleFilter !== 'all') {
                const sVal = yrSizeRecs.find(sr => sr['학교명'] === r['학교명'])?.['값'];
                if (sVal != null) matchesScale = (getScaleGroup(sVal) === scaleFilter);
            }
            return matchesReg && matchesTyp && matchesGrp && matchesScale;
        });

        filtered.sort((a,b) => direction === 1 ? b['값'] - a['값'] : a['값'] - b['값']);
        const rIndex = filtered.findIndex(r => r['학교명'] === sch);
        const rank = rIndex >= 0 ? rIndex + 1 : null;
        
        console.log(`[RankTrend] ${y} | Pop: ${filtered.length} | Handong: ${rank}`);
        return { year: y, rank: rank };
    });
    console.error("DEBUG: rankTrend final result", rankTrend);

    charts.dashRankTrend = new Chart(document.getElementById('dash-rank-trend-chart'), {
        type: 'line',
        data: {
            labels: rankTrend.map(d => d.year + '년'),
            datasets: [{
                data: rankTrend.map(d => d.rank),
                borderColor: '#003366',
                backgroundColor: '#f97316',
                borderWidth: 3,
                pointRadius: 5,
                fill: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 35 } },
            scales: { 
                y: { reverse: true, ticks: { stepSize: 1 }, grid: { borderDash: [2, 2] } } 
            },
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: true, align: 'top', font: { weight: 'bold' },
                    formatter: (v) => formatKpiValue(v, '순위') // Fixed rank formatting
                } 
            }
        }
    });

    // Ranking Table
    const tableBody = document.querySelector('#dash-ranking-table tbody');
    tableBody.innerHTML = '';
    // Use all records in filtered population for table
    sortedForDots.forEach((r, idx) => {
        const row = document.createElement('tr');
        if (r['학교명'] === sch) row.style.backgroundColor = '#fff7ed';
        
        const pData = getPercentile(sortedForDots, r['학교명'], ind, year);
        
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td style="font-weight:700;">${r['학교명']}</td>
            <td>${formatKpiValue(r['값'], ind)}</td>
            <td>${unit}</td>
            <td style="color:#666;">${pData.percentile.toFixed(1)}%</td>
        `;
        tableBody.appendChild(row);

        // Scroll to target school if it matches
        if (r['학교명'] === sch) {
            setTimeout(() => {
                row.scrollIntoView({ block: 'nearest' });
            }, 100);
        }
    });

    // Distribution Bar
    const val25 = (direction === 1) ? stats.q3 : stats.q1;
    const val75 = (direction === 1) ? stats.q1 : stats.q3;

    charts.dashDist = new Chart(document.getElementById('dash-dist-chart'), {
        type: 'bar',
        data: {
            labels: ['우리대학교값', '상위 75%', '중위수', '상위 25%', '최댓값', '평균'],
            datasets: [{
                data: [val, val75, stats.q2, val25, stats.max, stats.mean],
                backgroundColor: ['#f97316', '#64748b', '#94a3b8', '#cbd5e1', '#003366', '#854d0e'],
                borderRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 45 } },
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: true, anchor: 'end', align: 'top', font: { size: 9, weight: 'bold' },
                    formatter: (v) => formatKpiValue(v, ind)
                } 
            },
            scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { display: false } }
        }
    });

    const distTable = document.getElementById('dash-dist-table');
    distTable.innerHTML = `
        <thead>
            <tr>
                <th>우리대학교값</th>
                <th>상위 75%</th>
                <th>중위수</th>
                <th>상위 25%</th>
                <th>최댓값</th>
                <th>평균</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td style="font-weight:800; color:#f97316;">${formatKpiValue(val, ind)}</td>
                <td>${formatKpiValue(val75, ind)}</td>
                <td>${formatKpiValue(stats.q2, ind)}</td>
                <td>${formatKpiValue(val25, ind)}</td>
                <td>${formatKpiValue(stats.max, ind)}</td>
                <td>${formatKpiValue(stats.mean, ind)}</td>
            </tr>
        </tbody>
    `;
}

