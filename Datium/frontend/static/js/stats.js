checkAuth();

let sysSelect;
let tabSelect;
let exportMainBtn;
let exportDropdown;
let emptyState;
const cards = ['cardTotalRecords', 'cardFieldTypes', 'cardTableInfo', 'cardTopValues', 'cardAdvancedStats', 'cardDistributionStats'];
let statsData = { tables: [], fields: {}, records: {} };
let chartInstances = {};

function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); }
}

function onExportBackdropClick(ev) {
    if (!exportDropdown || !exportMainBtn) return;
    if (ev.target.closest('#exportMainBtn') || ev.target.closest('#exportDropdown')) return;
    exportDropdown.classList.add('hidden');
}

async function initStats() {
    sysSelect = document.getElementById('statsSystemSelect');
    tabSelect = document.getElementById('statsTableSelect');
    exportMainBtn = document.getElementById('exportMainBtn');
    exportDropdown = document.getElementById('exportDropdown');
    emptyState = document.getElementById('statsEmptyState');
    if (!sysSelect || !tabSelect || !exportMainBtn || !exportDropdown) return;

    await fetchSystems();
    sysSelect.addEventListener('change', onSystemChange);
    tabSelect.addEventListener('change', onTableChange);

    exportMainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', onExportBackdropClick);
}

async function fetchSystems() {
    try {
        const res = await apiFetch('/systems');
        if (res && res.ok) {
            const systems = await res.json();
            sysSelect.innerHTML = '<option value="" disabled selected>Selecciona Sistema...</option>';
            systems.forEach(s => {
                const o = document.createElement('option');
                o.value = s.id; o.textContent = s.name;
                sysSelect.appendChild(o);
            });
        }
    } catch (e) { }
}

async function onSystemChange() {
    const sysId = sysSelect.value;
    if (!sysId) return;
    tabSelect.disabled = true;
    tabSelect.innerHTML = '<option value="" selected>Todas las Tablas</option>';
    statsData = { tables: [], fields: {}, records: {} };

    try {
        const res = await apiFetch(`/systems/${sysId}/tables`);
        if (res && res.ok) {
            statsData.tables = await res.json();
            statsData.tables.forEach(t => {
                const o = document.createElement('option');
                o.value = t.id; o.textContent = t.name;
                tabSelect.appendChild(o);
            });
            tabSelect.disabled = false;

            for (const t of statsData.tables) {
                const fRes = await apiFetch(`/tables/${t.id}/fields`);
                if (fRes && fRes.ok) statsData.fields[t.id] = await fRes.json();
                const rRes = await apiFetch(`/tables/${t.id}/records`);
                if (rRes && rRes.ok) statsData.records[t.id] = await rRes.json();
            }

            renderStats();
            exportMainBtn.disabled = false;
        }
    } catch (e) { }
}

function onTableChange() {
    renderStats(tabSelect.value || null);
}

function renderStats(filterTableId) {
    if (emptyState) emptyState.classList.add('hidden');
    cards.forEach(id => document.getElementById(id).classList.remove('hidden'));

    let tables = statsData.tables;
    if (filterTableId) tables = tables.filter(t => String(t.id) === String(filterTableId));

    let totalRecords = 0;
    const recPerTable = [];
    const fieldTypeCounts = {};
    const topValues = {};

    tables.forEach(t => {
        const recs = statsData.records[t.id] || [];
        const fields = statsData.fields[t.id] || [];
        totalRecords += recs.length;
        recPerTable.push({ name: t.name, count: recs.length });

        fields.forEach(f => {
            fieldTypeCounts[f.type] = (fieldTypeCounts[f.type] || 0) + 1;

            if (f.type === 'text' || f.type === 'select') {
                const valueCounts = {};
                recs.forEach(r => {
                    const v = r.fieldValues[f.id];
                    if (v) valueCounts[v] = (valueCounts[v] || 0) + 1;
                });
                const sorted = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                if (sorted.length > 0) {
                    topValues[`${t.name} → ${f.name}`] = sorted;
                }
            }
        });
    });

    document.getElementById('totalRecordsCount').textContent = totalRecords;
    renderBarChart('recordsPerTableChart', recPerTable);
    renderPieChart('fieldTypesChart', fieldTypeCounts);
    renderRadarChart('advancedStatsChart', recPerTable, fieldTypeCounts);
    renderPolarChart('distributionStatsChart', fieldTypeCounts);
    renderTableDetail(tables);
    renderTopValues(topValues);
}

function renderRadarChart(containerId, recData, fieldData) {
    const el = document.getElementById(containerId);
    if (recData.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos avanzados</p>'; return; }
    
    el.innerHTML = '<div class="relative w-full h-full p-2"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);
    
    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#9ca3af' : '#4b5563';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: recData.map(d => d.name.length > 8 ? d.name.slice(0,8)+'…' : d.name),
            datasets: [{
                label: 'Registros Totales',
                data: recData.map(d => d.count),
                backgroundColor: 'rgba(19, 127, 236, 0.2)',
                borderColor: '#137fec',
                pointBackgroundColor: '#137fec',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    angleLines: { color: color },
                    grid: { color: color },
                    pointLabels: { color: textColor, font: { size: 10 } },
                    ticks: { display: false } // hide numbers radially
                }
            }
        }
    });
}

function renderBarChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (data.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos</p>'; return; }
    
    el.innerHTML = '<div class="relative w-full h-full pb-4"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name.length > 10 ? d.name.slice(0, 10)+'…' : d.name),
            datasets: [{
                label: 'Registros',
                data: data.map(d => d.count),
                backgroundColor: 'rgba(19, 127, 236, 0.8)',
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

function renderPieChart(containerId, data) {
    const el = document.getElementById(containerId);
    const entries = Object.entries(data);
    if (entries.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos</p>'; return; }
    
    el.innerHTML = '<div class="relative w-full h-full pb-4"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#d1d5db' : '#374151';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: entries.map(e => e[0].toUpperCase()),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: ['#137fec', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#151f2b' : '#ffffff'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { color: textColor, font: { size: 10 } } }
            }
        }
    });
}

function renderPolarChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const entries = Object.entries(data);
    if (entries.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos de distribución</p>'; return; }
    
    el.innerHTML = '<div class="relative w-full h-full p-2"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);

    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#d1d5db' : '#374151';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: entries.map(e => e[0].toUpperCase()),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: [
                    'rgba(19, 127, 236, 0.5)', 
                    'rgba(139, 92, 246, 0.5)', 
                    'rgba(16, 185, 129, 0.5)', 
                    'rgba(245, 158, 11, 0.5)', 
                    'rgba(239, 68, 68, 0.5)'
                ],
                borderColor: isDark ? '#151f2b' : '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } }
            },
            scales: {
                r: {
                    grid: { color: color },
                    ticks: { display: false }
                }
            }
        }
    });
}

function renderTableDetail(tables) {
    const el = document.getElementById('cardTableInfo');
    if (!el) return;
    const tbody = el.querySelector('tbody') || el;
    const container = el.querySelector('.table-detail-body') || tbody;

    let html = '';
    tables.forEach(t => {
        const recs = statsData.records[t.id] || [];
        const fields = statsData.fields[t.id] || [];
        html += `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 rounded-xl mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <span class="material-symbols-outlined text-sm">table_chart</span>
                    </div>
                    <div>
                        <div class="text-sm font-bold text-gray-900 dark:text-white">${t.name}</div>
                        <div class="text-xs text-gray-500">${fields.length} campos · ${recs.length} registros</div>
                    </div>
                </div>
            </div>
        `;
    });

    if (tables.length === 0) html = '<p class="text-sm text-gray-400 text-center py-4">Sin tablas</p>';
    container.innerHTML = html;
}

function renderTopValues(topValues) {
    const el = document.getElementById('cardTopValues');
    if (!el) return;
    const container = el.querySelector('.top-values-body') || el.querySelector('.p-4') || el;

    const entries = Object.entries(topValues);
    if (entries.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-400 text-center py-4">Sin datos frecuentes aún</p>';
        return;
    }

    let html = '';
    entries.slice(0, 3).forEach(([label, values]) => {
        html += `<div class="mb-3">
            <div class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">${label}</div>`;
        values.forEach(([val, count]) => {
            const barWidth = Math.min(100, (count / values[0][1]) * 100);
            html += `
                <div class="flex items-center gap-2 mb-1">
                    <div class="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-5 overflow-hidden">
                        <div class="h-full bg-primary/60 rounded-full flex items-center px-2" style="width:${barWidth}%">
                            <span class="text-[10px] font-bold text-white truncate">${val}</span>
                        </div>
                    </div>
                    <span class="text-xs font-mono text-gray-500 w-8 text-right">${count}</span>
                </div>`;
        });
        html += '</div>';
    });
    container.innerHTML = html;
}

function statDownloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapeHtmlStat(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function buildStatsExportPayload(filterTableId) {
    const sysId = sysSelect.value;
    const sysName = sysSelect.options[sysSelect.selectedIndex]?.text || '';
    let tables = statsData.tables || [];
    if (filterTableId) tables = tables.filter((t) => String(t.id) === String(filterTableId));
    const out = {
        sistemaId: sysId,
        sistemaNombre: sysName,
        generado: new Date().toISOString(),
        tablas: [],
    };
    tables.forEach((t) => {
        const recs = statsData.records[t.id] || [];
        const fields = statsData.fields[t.id] || [];
        const tipos = {};
        fields.forEach((f) => {
            tipos[f.type] = (tipos[f.type] || 0) + 1;
        });
        out.tablas.push({
            id: t.id,
            nombre: t.name,
            campos: fields.length,
            registros: recs.length,
            tiposCampos: tipos,
        });
    });
    return out;
}

function exportData(format) {
    if (!sysSelect || !sysSelect.value) {
        showError('Selecciona un sistema');
        return;
    }
    const filterTableId = tabSelect && tabSelect.value ? tabSelect.value : null;
    const payload = buildStatsExportPayload(filterTableId);
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
        statDownloadBlob(blob, `Datium_Estadisticas_${stamp}.json`);
        showSuccess('Export JSON listo');
        return;
    }

    if (format === 'csv') {
        let csv = '\uFEFF';
        csv += 'Tabla,Registros,Campos,Resumen_Tipos\n';
        payload.tablas.forEach((t) => {
            const tipos = Object.entries(t.tiposCampos || {})
                .map(([k, v]) => `${k}:${v}`)
                .join(' | ');
            csv += `"${String(t.nombre || '').replace(/"/g, '""')}",${t.registros},${t.campos},"${tipos.replace(/"/g, '""')}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        statDownloadBlob(blob, `Datium_Estadisticas_${stamp}.csv`);
        showSuccess('Export CSV listo');
        return;
    }

    if (format === 'pdf') {
        const w = window.open('', '_blank');
        if (!w) {
            showError('Permite ventanas emergentes para exportar PDF');
            return;
        }
        const rows = payload.tablas
            .map(
                (t) =>
                    `<tr><td>${escapeHtmlStat(t.nombre)}</td><td>${t.registros}</td><td>${t.campos}</td></tr>`
            )
            .join('');
        w.document.write(
            `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Estadísticas Datium</title>` +
                `<style>body{font-family:Inter,system-ui,sans-serif;padding:28px;color:#111;background:#fff}` +
                `h1{font-size:22px;margin:0 0 8px}p.meta{color:#555;font-size:13px;margin:0 0 20px}` +
                `table{width:100%;border-collapse:collapse;font-size:13px}` +
                `th,td{border:1px solid #e5e7eb;padding:10px 12px;text-align:left}` +
                `th{background:#f3f4f6;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.06em}` +
                `</style></head><body>` +
                `<h1>Datium — Estadísticas</h1>` +
                `<p class="meta"><strong>Sistema:</strong> ${escapeHtmlStat(payload.sistemaNombre)} · ` +
                `${new Date().toLocaleString('es')}</p>` +
                `<table><thead><tr><th>Tabla</th><th>Registros</th><th>Campos</th></tr></thead><tbody>` +
                rows +
                `</tbody></table></body></html>`
        );
        w.document.close();
        w.focus();
        setTimeout(() => {
            w.print();
        }, 250);
        showSuccess('Listo para guardar como PDF desde el diálogo de impresión');
    }
}

window.exportData = exportData;

document.addEventListener('DOMContentLoaded', () => {
    initStats();
});
