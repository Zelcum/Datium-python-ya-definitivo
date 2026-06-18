checkAuth();
const urlParams = new URLSearchParams(window.location.search);
const tableId = urlParams.get('id');
let currentSystemId = null;
let currentFields = [];
let allRecords = [];
let currentPermissions = { read: true, create: false, update: false, delete: false, is_owner: false };
const relationCache = {};

function goBack() {
    window.history.back();
}

async function init() {
    await getSystemId();
    await loadData();
    loadSidebarInfo();
    initSortable();
}

function initSortable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    Sortable.create(tbody, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: async () => {
            await updateRecordOrder();
        }
    });
}

async function updateRecordOrder() {
    const rows = document.querySelectorAll('#tableBody tr');
    const order = Array.from(rows).map(row => parseInt(row.dataset.id));
    
    showLoading('Actualizando orden...');
    const res = await apiFetch(`/tables/${tableId}/records/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ order })
    });
    
    if (res.ok) {
        showSuccess('Orden actualizado');
    } else {
        showError('Error al actualizar el orden');
        loadData(); // Revert
    }
}

async function getSystemId() {
    if (currentSystemId) return currentSystemId;
    try {
        const res = await apiFetch(`/tables/${tableId}`);
        if (res.ok) {
            const table = await res.json();
            currentSystemId = table.systemId;
            currentPermissions = table.permissions || currentPermissions;
            
            const sysRes = await apiFetch(`/systems/${currentSystemId}`);
            if (sysRes.ok) {
                const sys = await sysRes.json();

                const logoEl = document.getElementById('systemLogo');
                if (logoEl) {
                    logoEl.src = sys.imageUrl || '/static/img/Isotipo modo claro.jpeg';
                    logoEl.onerror = () => { logoEl.src = '/static/img/Isotipo modo claro.jpeg'; };
                }

                document.getElementById('tableName').innerText = table.name;
                document.getElementById('tableDesc').innerText = table.description || 'Sin descripción';
                document.title = `${table.name} - Datium`;
            }
            return currentSystemId;
        }
    } catch (e) { console.error(e); }
    return null;
}

async function loadData() {
    await getSystemId();

    const fieldsRes = await apiFetch(`/tables/${tableId}/fields`);
    if (fieldsRes.ok) {
        currentFields = await fieldsRes.json();
        renderTableHead();
    }

    const recordsRes = await apiFetch(`/tables/${tableId}/records`);
    if (recordsRes.ok) {
        allRecords = await recordsRes.json();
        const countEl = document.getElementById('recordCount');
        if (countEl) countEl.innerText = allRecords.length;
        await resolveForeignKeys(allRecords);
        renderTableBody(allRecords);
    }
}

function filterRecords() {
    const term = document.getElementById('recordSearch').value.toLowerCase();
    const filtered = allRecords.filter(r => {
        if (String(r.id).includes(term)) return true;
        return Object.values(r.fieldValues).some(v => String(v).toLowerCase().includes(term));
    });
    renderTableBody(filtered);
}

document.getElementById('recordSearch').addEventListener('input', filterRecords);

async function resolveForeignKeys(records) {
    const relationFields = currentFields.filter(f => f.relatedTableId);

    for (const field of relationFields) {
        if (!relationCache[field.id]) {
            try {
                const [recsRes, fieldsRes] = await Promise.all([
                    apiFetch(`/tables/${field.relatedTableId}/records`),
                    apiFetch(`/tables/${field.relatedTableId}/fields`)
                ]);
                if (recsRes.ok && fieldsRes.ok) {
                    const relatedRecords = await recsRes.json();
                    const relatedFields = await fieldsRes.json();
                    const pkField = relatedFields.find(rf => rf.isPrimaryKey);
                    const map = {};
                    const pkMap = {};
                    relatedRecords.forEach(r => {
                        const pkVal = pkField ? (r.fieldValues[pkField.name] || r.id) : r.id;
                        const displayVal = field.relatedFieldName ? r.fieldValues[field.relatedFieldName] : pkVal;
                        map[r.id] = displayVal;
                        pkMap[r.id] = pkVal;
                    });
                    relationCache[field.id] = map;
                    relationCache[`${field.id}_pk`] = pkMap;
                }
            } catch (err) {
                console.error(err);
            }
        }
    }
    renderTableBody(records);
}

function renderTableHead() {
    const thead = document.getElementById('tableHead');
    thead.innerHTML = `
        <tr>
            <th class="px-6 py-3 w-10"></th>
            <th class="px-6 py-3 text-left">
                <input type="checkbox" id="selectAll" onchange="toggleSelectAll(this)" class="rounded border-gray-300 text-primary focus:ring-primary">
            </th>
            ${currentFields.map(f => {
                const pkIcon = f.isPrimaryKey ? ' <span class="text-amber-500" title="Llave Primaria">🔑</span>' : '';
                return `<th class="px-6 py-3 font-bold text-gray-500 dark:text-gray-400">${f.name}${pkIcon}</th>`;
            }).join('')}
            ${currentPermissions.update || currentPermissions.delete ? '<th class="px-6 py-3 font-bold text-gray-500 dark:text-gray-400 text-right">Acciones</th>' : ''}
        </tr>
    `;
}

let editingRecordId = null;
let currentRecords = [];

function renderTableBody(records) {
    currentRecords = records;
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = records.map(r => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group" data-id="${r.id}">
            <td class="px-4 py-4 w-10">
                <div class="drag-handle opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-primary transition-all">
                    <span class="material-symbols-outlined text-lg">drag_indicator</span>
                </div>
            </td>
            <td class="px-6 py-4">
                <input type="checkbox" class="record-checkbox rounded border-gray-300 text-primary focus:ring-primary" value="${r.id}" onchange="updateBulkActions()">
            </td>
            ${currentFields.map(f => {
                let val = r.displayValues ? r.displayValues[f.name] : r.fieldValues[f.name];
                
                if (!r.displayValues && f.relatedTableId && relationCache[f.id]) {
                    val = relationCache[f.id][val] || val || '';
                }

                if (f.type === 'boolean') {
                    if (val === true || val === 'true') val = '<span class="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-xs">Sí</span>';
                    else if (val === false || val === 'false') val = '<span class="px-2 py-1 rounded-lg bg-red-500/10 text-red-500 font-bold text-xs">No</span>';
                    else val = '<span class="text-gray-400 text-xs">N/A</span>';
                }

                val = val === null || val === undefined ? '' : val;
                return `<td class="px-6 py-4">${val}</td>`;
            }).join('')}
            ${currentPermissions.update || currentPermissions.delete ? `
            <td class="px-6 py-4 text-right">
                <div class="flex gap-2 justify-end">
                    ${currentPermissions.update ? `
                    <button onclick="editRecord(${r.id})" class="text-blue-500 hover:text-blue-600 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>` : ''}
                    ${currentPermissions.delete ? `
                    <button onclick="deleteRecord(${r.id})" class="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>` : ''}
                </div>
            </td>` : ''}
        </tr>
    `).join('');
    updateBulkActions();
}

function toggleSelectAll(el) {
    const checkboxes = document.querySelectorAll('.record-checkbox');
    checkboxes.forEach(cb => cb.checked = el.checked);
    updateBulkActions();
}

function updateBulkActions() {
    const selectedCount = document.querySelectorAll('.record-checkbox:checked').length;
    const bulkMenu = document.getElementById('bulkActionMenu');
    if (bulkMenu) {
        if (selectedCount > 0) {
            bulkMenu.classList.remove('hidden');
            document.getElementById('selectedCountText').innerText = `${selectedCount} seleccionados`;
        } else {
            bulkMenu.classList.add('hidden');
        }
    }
}

async function bulkDelete() {
    const checkboxes = document.querySelectorAll('.record-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    if (ids.length === 0) return;
    
    if (confirm(`¿Estás seguro de que deseas eliminar ${ids.length} registros seleccionados?`)) {
        try {
            const res = await apiFetch(`/tables/${tableId}/records/bulk-delete`, {
                method: 'POST',
                body: JSON.stringify({ ids })
            });
            if (res.ok) {
                showSuccess(`${ids.length} registros eliminados correctamente`);
                await loadData();
            } else {
                const err = await res.json();
                showError(err.error || 'Error al eliminar registros');
            }
        } catch (e) {
            console.error("Bulk delete error", e);
            showError('Error de conexión');
        }
    }
}

function editRecord(id) {
    const record = allRecords.find(r => r.id === id);
    if (!record) return;

    editingRecordId = id;
    document.getElementById('modalTitle').innerText = 'Editar Registro #' + id;

    openRegisterModal(true);

    currentFields.forEach(f => {
        const el = document.getElementById(`modal_field_${f.id}`);
        const searchEl = document.getElementById(`search_modal_field_${f.id}`);

        const val = record.fieldValues[f.name];

        if (f.type === 'relation') {
            if (el) el.value = val;
            if (searchEl && relationCache[f.id]) {
                searchEl.value = relationCache[f.id][val] || val || '';
            }
        } else {
            if (el) el.value = val || '';
        }
    });
}

function openRegisterModal(isEditing = false) {
    document.getElementById('registerModal').classList.remove('hidden');
    if (!isEditing) {
        editingRecordId = null;
        document.getElementById('modalTitle').innerHTML = '<span class="material-symbols-outlined text-primary">post_add</span> Registrar Datos';
        document.getElementById('recordForm').reset();

        currentFields.forEach(f => {
            if (f.type === 'relation') {
                const el = document.getElementById(`modal_field_${f.id}`);
                if (el) el.value = '';
            }
        });
    }
    renderModalFields();
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
    editingRecordId = null;
}

async function saveRecord() {
    const fieldValues = {};
    currentFields.forEach(f => {
        const el = document.getElementById(`modal_field_${f.id}`);
        const val = el ? el.value : null;
        fieldValues[f.id] = val;
    });

    const method = editingRecordId ? 'PUT' : 'POST';
    const url = editingRecordId
        ? `/tables/${tableId}/records/${editingRecordId}`
        : `/tables/${tableId}/records`;

    showLoading(editingRecordId ? 'Actualizando registro...' : 'Guardando registro...');

    const res = await apiFetch(url, {
        method: method,
        body: JSON.stringify({ values: fieldValues })
    });

    if (res.ok) {
        closeRegisterModal();
        loadData();
        const action = editingRecordId ? 'actualizado' : 'guardado';
        showSuccess(`¡Registro ${action} correctamente!`);
    } else {
        try {
            const errorData = await res.json();
            showError(errorData.message || errorData.error || await res.text());
        } catch (e) {
            showError('Error al guardar datos');
        }
    }
}

async function deleteRecord(id) {
    showConfirm('¿Eliminar registro?', () => {
        promptPassword(async () => {
            showLoading('Eliminando...');
            try {
                const res = await apiFetch(`/tables/${tableId}/records/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    loadData();
                    showSuccess('Registro eliminado');
                } else {
                    showError('Error eliminando registro');
                }
            } catch (e) {
                showError('Error de conexión');
            }
        });
    });
}

async function renderModalFields() {
    const container = document.getElementById('modalFieldsContainer');

    if (container.children.length > 0 && editingRecordId !== null) return;

    container.innerHTML = '';

    if (currentFields.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-4">No hay campos variables definidos.</div>';
        return;
    }

    const htmlPromises = currentFields.map(async f => {
        let inputHtml = '';
        const baseInputClass = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white placeholder-gray-400";

        // Auto-increment fields are filled automatically — show a read-only badge
        if (f.isAutoIncrement) {
            return `
                <div class="col-span-1">
                    <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                        ${f.name} <span class="ml-1 text-purple-500 text-[10px] font-bold">AUTO</span>
                    </label>
                    <div class="w-full bg-gray-100 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm text-gray-400 dark:text-gray-500 italic">
                        Se asigna automáticamente
                    </div>
                    <input type="hidden" id="modal_field_${f.id}">
                </div>
            `;
        }

        if (f.type === 'select') {
            const opts = f.options || [];
            inputHtml = `
                <div class="relative">
                    <select id="modal_field_${f.id}" class="${baseInputClass} appearance-none cursor-pointer">
                        <option value="">Seleccionar...</option>
                        ${opts.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                        <span class="material-symbols-outlined text-lg">expand_more</span>
                    </div>
                </div>
            `;
        } else if (f.type === 'boolean') {
            inputHtml = `
                <div class="relative">
                    <select id="modal_field_${f.id}" class="${baseInputClass} appearance-none cursor-pointer">
                        <option value="">Seleccionar...</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                        <span class="material-symbols-outlined text-lg">expand_more</span>
                    </div>
                </div>
            `;
        } else if (f.type === 'relation') {
            let options = [];
            if (f.relatedTableId) {
                if (!relationCache[f.id] || !relationCache[`${f.id}_pk`]) {
                    try {
                        const [recsRes, fieldsRes] = await Promise.all([
                            apiFetch(`/tables/${f.relatedTableId}/records`),
                            apiFetch(`/tables/${f.relatedTableId}/fields`)
                        ]);
                        if (recsRes.ok && fieldsRes.ok) {
                            const recs = await recsRes.json();
                            const relatedFields = await fieldsRes.json();
                            const pkField = relatedFields.find(rf => rf.isPrimaryKey);

                            const map = {};
                            const pkMap = {};
                            recs.forEach(r => {
                                const pkVal = pkField ? (r.fieldValues[pkField.name] || r.id) : r.id;
                                const val = f.relatedFieldName ? r.fieldValues[f.relatedFieldName] : pkVal;
                                map[r.id] = val;
                                pkMap[r.id] = pkVal;
                            });
                            relationCache[f.id] = map;
                            relationCache[`${f.id}_pk`] = pkMap;
                            options = Object.entries(map).map(([id, val]) => ({ id, val, pkVal: pkMap[id] }));
                        }
                    } catch (err) { console.error(err); }
                } else {
                    const map = relationCache[f.id];
                    const pkMap = relationCache[`${f.id}_pk`] || {};
                    options = Object.entries(map).map(([id, val]) => ({ id, val, pkVal: pkMap[id] || id }));
                }
            }
            const safeOptions = JSON.stringify(options).replace(/"/g, '&quot;');

            const isEmpty = options.length === 0;
            const emptyMessage = isEmpty ? '<p class="text-xs text-red-500 mt-1">No hay registros en esta tabla.</p>' : '';
            const disabledAttr = isEmpty ? 'disabled' : '';
            const placeholder = isEmpty ? 'No hay opciones disponibles' : 'Buscar...';

            inputHtml = `
                <div class="relative relation-search-container">
                    <input type="text" class="${baseInputClass} ${isEmpty ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}" 
                           id="search_modal_field_${f.id}" placeholder="${placeholder}" ${disabledAttr}
                           autocomplete="off" onfocus="showRelationOptions(${f.id})" 
                           oninput="filterRelationOptions(${f.id})" 
                           onblur="setTimeout(() => hideRelationOptions(${f.id}), 200)">
                    <input type="hidden" id="modal_field_${f.id}">
                    <div id="list_modal_field_${f.id}" class="absolute w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-auto z-50" 
                         style="max-height: 200px; display: none;" data-options="${safeOptions}"></div>
                    ${emptyMessage}
                </div>
            `;
        } else {
            inputHtml = `<input type="${getInputType(f.type)}" id="modal_field_${f.id}" class="${baseInputClass}" placeholder="${f.name}">`;
        }

        return `
            <div class="col-span-1">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">${f.name}</label>
                ${inputHtml}
            </div>
        `;
    });

    const htmlParts = await Promise.all(htmlPromises);
    container.innerHTML = htmlParts.join('');
}

function showRelationOptions(fieldId) {
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    const data = JSON.parse(list.dataset.options || '[]');
    renderRelationOptions(fieldId, data);
    list.style.display = 'block';
}

function hideRelationOptions(fieldId) {
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    if (list) list.style.display = 'none';
}

function filterRelationOptions(fieldId) {
    const text = document.getElementById(`search_modal_field_${fieldId}`).value.toLowerCase();
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    const data = JSON.parse(list.dataset.options || '[]');
    const filtered = data.filter(d => String(d.val).toLowerCase().includes(text) || String(d.pkVal || d.id).toLowerCase().includes(text));
    renderRelationOptions(fieldId, filtered);
    list.style.display = 'block';
}

function renderRelationOptions(fieldId, options) {
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    if (options.length === 0) {
        list.innerHTML = '<div class="p-3 text-gray-500 text-sm">No se encontraron resultados</div>';
        return;
    }
    list.innerHTML = options.map(o => {
        const pkLabel = (o.pkVal !== undefined && o.pkVal !== null && String(o.pkVal) !== String(o.val))
            ? `<span class="text-xs text-gray-400 ml-2">(${o.pkVal})</span>`
            : '';
        const safeVal = String(o.val).replace(/'/g, "\\'");
        return `
        <a href="javascript:void(0)" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
           onclick="selectRelationOption(${fieldId}, '${o.id}', '${safeVal}')">
           ${o.val} ${pkLabel}
        </a>
    `}).join('');
}

function selectRelationOption(fieldId, id, val) {
    document.getElementById(`modal_field_${fieldId}`).value = id;
    document.getElementById(`search_modal_field_${fieldId}`).value = val;
    hideRelationOptions(fieldId);
}

function getInputType(type) {
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    if (type === 'email') return 'email';
    if (type === 'url') return 'url';
    if (type === 'phone') return 'tel';
    if (type === 'time') return 'time';
    if (type === 'file') return 'file';
    return 'text';
}

async function exportTable(format = 'csv') {
    showLoading(`Generando archivo ${format.toUpperCase()}...`);
    try {
        const token = getToken();
        if (!token) {
            showError('Sesión expirada. Por favor inicia sesión nuevamente.');
            return;
        }
        
        const endpoint = `/tables/${tableId}/export?format=${format}`;
        console.log('[ExportTable] Requesting:', endpoint);
        
        const response = await apiFetch(endpoint);

        if (!response) {
            throw new Error('Error de red o sesión expirada');
        }

        console.log('[ExportTable] Response status:', response.status, 'ok:', response.ok);

        if (response.ok) {
            const blob = await response.blob();
            console.log('[ExportTable] Blob received. size:', blob.size, 'type:', blob.type);
            
            let finalFilename = '';
            const disposition = response.headers.get('Content-Disposition');
            if (disposition && disposition.indexOf('filename=') !== -1) {
                const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
                if (matches != null && matches[1]) { 
                  finalFilename = matches[1].replace(/['"]/g, '');
                }
            }
            
            if (!finalFilename) {
                const date = new Date().toISOString().slice(0, 10);
                const tableNameEl = document.getElementById('tableName');
                let tableName = 'tabla';
                if (tableNameEl) {
                    tableName = tableNameEl.innerText.replace(/[\r\n]+/g, '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
                }
                const ext = format === 'xlsx' ? 'xlsx' : format;
                finalFilename = `export_${tableName}_${date}.${ext}`;
            }
            
            downloadBlob(blob, finalFilename);
            showSuccess(`¡Tabla exportada con éxito como ${format.toUpperCase()}!`);
        } else {
            let errMsg = `Error al exportar (HTTP ${response.status})`;
            try {
                const errJson = await response.json();
                console.error('[ExportTable] Server error JSON:', errJson);
                errMsg = errJson.error || errJson.detail || errMsg;
            } catch {
                const errText = await response.text().catch(() => '');
                console.error('[ExportTable] Server error text (first 200 chars):', errText.slice(0, 200));
            }
            showError(errMsg);
        }
    } catch (e) {
        console.error('[ExportTable] Network/fetch error:', e);
        showError('No se pudo conectar con el servidor para la exportación');
    } finally {
        hideLoading();
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || "export_datium_data.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { URL.revokeObjectURL(url); }, 2000);
}

function openImportModal() {
    document.getElementById('importModal').classList.remove('hidden');
    document.getElementById('importPreview').classList.add('hidden');
    document.getElementById('btnConfirmImport').disabled = true;
    document.getElementById('btnConfirmImport').classList.add('opacity-50', 'cursor-not-allowed');
}
function closeImportModal() {
    document.getElementById('importModal').classList.add('hidden');
}

function showImportGuide() {
    document.getElementById('guideModal').classList.remove('hidden');
}

let pendingImportData = [];

function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        if (file.name.endsWith('.json')) {
            try {
                pendingImportData = JSON.parse(content);
                showImportPreview();
            } catch (err) { showError('JSON inválido'); }
        } else if (file.name.endsWith('.csv')) {
            pendingImportData = parseCSV(content);
            showImportPreview();
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) return [];
    
    const firstLine = lines[0];
    const separator = firstLine.includes(';') && (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
    
    const parseLine = (line) => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === separator && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else cur += char;
        }
        result.push(cur.trim());
        return result;
    };

    const headers = parseLine(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = parseLine(line);
        const obj = {};
        headers.forEach((h, i) => {
            if (h) {
                let val = values[i] || '';
                if (val.toLowerCase() === 'sí' || val.toLowerCase() === 'si' || val.toLowerCase() === 'true') val = 'true';
                if (val.toLowerCase() === 'no' || val.toLowerCase() === 'false') val = 'false';
                obj[h] = val;
            }
        });
        return obj;
    });
}

function showImportPreview() {
    const preview = document.getElementById('importPreview');
    const container = document.getElementById('importPreviewRows');
    const stats = document.getElementById('importStats');
    const btn = document.getElementById('btnConfirmImport');

    container.innerHTML = pendingImportData.slice(0, 5).map(row => `
        <div class="p-2 border-b border-gray-100 dark:border-gray-800 last:border-0 truncate">
            ${JSON.stringify(row)}
        </div>
    `).join('');
    
    if (pendingImportData.length > 5) {
        container.innerHTML += `<div class="p-2 text-center text-gray-400">... y ${pendingImportData.length - 5} más</div>`;
    }

    stats.innerText = `${pendingImportData.length} Registros detectados`;
    preview.classList.remove('hidden');
    btn.disabled = false;
    btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

async function executeImport() {
    showLoading('Importando datos...');
    try {
        const res = await apiFetch(`/tables/${tableId}/import`, {
            method: 'POST',
            body: JSON.stringify({ records: pendingImportData })
        });
        if (res.ok) {
            const data = await res.json();
            showSuccess(`¡${data.imported} registros importados con éxito!`);
            closeImportModal();
            loadData();
        } else {
            const err = await res.json();
            showError(err.error || 'Error en la importación');
        }
    } catch (e) {
        showError('Error de conexión');
    }
}

async function loadSidebarInfo() {
    const res = await apiFetch('/user/profile');
    if (res && res.ok) {
        const userProfile = await res.json();
        if (typeof window.datiumApplySidebar === 'function') {
            window.datiumApplySidebar(userProfile);
        }
    }
}

function openStyleModal() {
    const existing = document.getElementById('styleModal');
    if (existing) existing.remove();

    const html = `
        <div id="styleModal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div class="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl max-w-md w-full">
                <div class="flex items-center justify-between mb-6">
                    <h3 class="text-lg font-bold text-[#111418] dark:text-white flex items-center gap-2">
                        <span class="material-symbols-outlined text-primary">palette</span>
                        Personalizar Vista
                    </h3>
                    <button onclick="document.getElementById('styleModal').remove()" class="action-btn">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Densidad de filas</label>
                        <select onchange="document.querySelectorAll('#tableBody td').forEach(td => td.style.padding = this.value === 'compact' ? '0.5rem 1.5rem' : this.value === 'comfortable' ? '1.25rem 1.5rem' : '1rem 1.5rem')" class="datium-input">
                            <option value="normal">Normal</option>
                            <option value="compact">Compacta</option>
                            <option value="comfortable">Confortable</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Lineas de separacion</label>
                        <select onchange="document.querySelectorAll('#tableBody tr').forEach(tr => tr.style.borderBottom = this.value === 'none' ? 'none' : this.value === 'full' ? '1px solid var(--border)' : '1px dashed var(--border)')" class="datium-input">
                            <option value="full">Completas</option>
                            <option value="dashed">Punteadas</option>
                            <option value="none">Sin lineas</option>
                        </select>
                    </div>
                </div>
                <div class="flex justify-end mt-6">
                    <button onclick="document.getElementById('styleModal').remove()" class="datium-btn datium-btn-primary">Aplicar</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
}

init();
