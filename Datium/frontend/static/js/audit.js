checkAuth();

const systemIdParam = new URLSearchParams(window.location.search).get('system_id') || null;
let searchTimeout = null;

async function init() {
    await loadSystems();
}

async function loadSystems() {
    try {
        const res = await apiFetch('/systems');
        if (res.ok) {
            const systems = await res.json();
            const select = document.getElementById('auditSystemSelect');
            select.innerHTML = '<option value="-1">Todos los sistemas</option>';
            systems.forEach(sys => {
                select.innerHTML += `<option value="${sys.id}">${sys.name}</option>`;
            });

            if (systemIdParam) {
                select.value = systemIdParam;
            }

            onSystemSelectChange();
        }
    } catch (e) {
        console.error(e);
        showError('Error cargando sistemas');
    }
}

function debounceSearch() {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadAuditLogs();
    }, 500);
}


async function onSystemSelectChange() {
    loadSystemUsers();
    loadAuditLogs();
}

async function loadSystemUsers() {
    const systemId = document.getElementById('auditSystemSelect').value;
    const userSelect = document.getElementById('userSelect');

    userSelect.innerHTML = '<option value="">Todos</option>';

    if (!systemId || systemId === '-1') return;

    try {
        const res = await apiFetch(`/auditoria/sistema/${systemId}/usuarios`);
        if (res.ok) {
            const users = await res.json();
            users.forEach(u => {
                userSelect.innerHTML += `<option value="${u.userId}">${u.name} (${u.email})</option>`;
            });
        }
    } catch (e) {
        console.error("Error loading users", e);
    }
}

async function loadAuditLogs() {
    const systemId = document.getElementById('auditSystemSelect').value;
    const type = document.getElementById('auditTypeSelect').value;
    const search = document.getElementById('searchInput').value;
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    const userId = document.getElementById('userSelect').value;

    const container = document.getElementById('logsContainer');

    if (!systemId) {
        container.innerHTML = `
            <div class="p-8 text-center text-gray-500 dark:text-gray-400 flex flex-col items-center gap-3">
                 <span class="material-symbols-outlined text-4xl opacity-50">search</span>
                 <p>Selecciona un sistema para ver los registros.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
         <div class="p-8 flex justify-center">
            <span class="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
         </div>
    `;

    try {
        const queryParams = new URLSearchParams();
        if (search) queryParams.append('search', search);
        if (dateFrom) queryParams.append('dateFrom', dateFrom);
        if (dateTo) queryParams.append('dateTo', dateTo);
        if (userId) queryParams.append('userId', userId);

        let endpoint = '';
        if (systemId === '-1') {
            if (type === 'security') {
                endpoint = `/auditoria/seguridad/filtrar?${queryParams.toString()}`;
            } else {
                endpoint = `/auditoria/logs/filtrar?${queryParams.toString()}`;
            }
        } else {
            if (type === 'security') {
                endpoint = `/auditoria/sistema/${systemId}/seguridad/filtrar?${queryParams.toString()}`;
            } else {
                endpoint = `/auditoria/sistema/${systemId}/logs/filtrar?${queryParams.toString()}`;
            }
        }

        const res = await apiFetch(endpoint);

        if (res.ok) {
            const logs = await res.json();
            renderLogs(logs, type);
        } else {
            container.innerHTML = `<div class="p-4 text-center text-red-500">Error cargando registros</div>`;
        }
    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="p-4 text-center text-red-500">Error de conexión</div>`;
    }
}

function renderLogs(logs, type) {
    const container = document.getElementById('logsContainer');

    if (logs.length === 0) {
        container.innerHTML = `
             <div class="p-8 text-center text-gray-500 dark:text-gray-400">
                 <p>No se encontraron registros.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = logs.map(log => {
        const date = new Date(log.createdAt).toLocaleString();
        const userName = log.userName || 'Desconocido';

        if (type === 'security') {
            const severityColor = getSeverityColor(log.severity);
            const severityIcon = getSeverityIcon(log.severity);
            return `
                <div class="p-4 flex gap-4 items-start hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div class="mt-1">
                        <span class="material-symbols-outlined ${severityColor}">${severityIcon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start">
                             <div class="flex items-center gap-2">
                                <span class="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-500">${log.systemName || 'Sistema'}</span>
                                <h4 class="font-bold text-sm text-[#111418] dark:text-white">${log.event}</h4>
                            </div>
                            <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${date}</span>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">${log.details || ''}</p>
                        <div class="mt-2 text-xs text-gray-500 flex items-center gap-2">
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-xs">person</span>
                                ${userName}
                            </span>
                            ${log.severity ? `<span class="px-1.5 py-0.5 rounded-md ${getSeverityBadge(log.severity)}">${log.severity}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                 <div class="p-4 flex gap-4 items-start hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div class="mt-1 text-gray-400">
                        <span class="material-symbols-outlined">history</span>
                    </div>
                    <div class="flex-1 min-w-0">
                         <div class="flex justify-between items-start">
                             <div class="flex items-center gap-2">
                                <span class="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-xs font-mono text-gray-500">${log.systemName || 'Sistema'}</span>
                                <h4 class="font-bold text-sm text-[#111418] dark:text-white">${log.action}</h4>
                            </div>
                            <span class="text-xs text-gray-400 whitespace-nowrap ml-2">${date}</span>
                        </div>
                         <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">${log.details || ''}</p>
                         <div class="mt-2 text-xs text-gray-500 flex items-center gap-2">
                            <span class="flex items-center gap-1">
                                <span class="material-symbols-outlined text-xs">person</span>
                                ${userName}
                            </span>
                             <span class="flex items-center gap-1 ml-2">
                                <span class="material-symbols-outlined text-xs">computer</span>
                                ${log.ip || 'IP N/A'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

function getSeverityColor(severity) {
    switch ((severity || '').toLowerCase()) {
        case 'high': return 'text-red-500';
        case 'medium': return 'text-orange-500';
        case 'low': return 'text-blue-500';
        default: return 'text-gray-500';
    }
}

function getSeverityIcon(severity) {
    switch ((severity || '').toLowerCase()) {
        case 'high': return 'gpp_bad';
        case 'medium': return 'warning';
        case 'low': return 'info';
        default: return 'info';
    }
}

function getSeverityBadge(severity) {
    switch ((severity || '').toLowerCase()) {
        case 'high': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
        case 'medium': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
        case 'low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
}

async function downloadAuditLog() {
    const systemId = document.getElementById('auditSystemSelect').value;
    const type = document.getElementById('auditTypeSelect').value;
    const container = document.getElementById('logsContainer');
    const logs = container.querySelectorAll('.p-4');
    
    if (logs.length === 0) {
        showError("No hay registros para exportar");
        return;
    }

    let csv = "Fecha,Usuario,Accion_Evento,Detalles,IP/Severidad\n";
    logs.forEach(row => {
        const date = row.querySelector('.text-gray-400')?.innerText || '';
        const user = row.querySelector('.flex.items-center.gap-1')?.innerText.trim() || '';
        const action = row.querySelector('h4')?.innerText || '';
        const details = row.querySelector('p')?.innerText.replace(/"/g, '""') || '';
        const extra = row.querySelector('.ml-2 .material-symbols-outlined')?.parentElement?.innerText.trim() || '';
        csv += `"${date}","${user}","${action}","${details}","${extra}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Auditoria_Datium_${type}_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    showSuccess("Auditoría exportada exitosamente");
}

init();
