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
                const recsRes = await apiFetch(`/tables/${field.relatedTableId}/records`);
                if (recsRes.ok) {
                    const relatedRecords = await recsRes.json();
                    const map = {};
                    relatedRecords.forEach(r => {
                        // Use displayValues from backend if available, else build #ID label
                        const firstVal = r.fieldValues ? Object.values(r.fieldValues).find(v => v) : null;
                        const label = firstVal ? `#${r.id} - ${firstVal}` : `#${r.id}`;
                        map[r.id] = label;
                    });
                    relationCache[field.id] = map;
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
            <th class="px-4 py-3 text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider whitespace-nowrap">#ID</th>
            ${currentFields.map(f => {
                return `<th class="px-6 py-3 font-bold text-gray-500 dark:text-gray-400">${f.name}</th>`;
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
            <td class="px-4 py-4">
                <span class="text-xs font-mono font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg">#${r.id}</span>
            </td>
            ${currentFields.map(f => {
                let val = r.displayValues ? r.displayValues[f.name] : r.fieldValues[f.name];

                // Fallback to cached relation label if backend didn't resolve it
                if (!r.displayValues && f.relatedTableId && relationCache[f.id]) {
                    val = relationCache[f.id][val] || val || '';
                }

                if (f.type === 'boolean') {
                    if (val === true || val === 'true') val = '<span class="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 font-bold text-xs">Sí</span>';
                    else if (val === false || val === 'false') val = '<span class="px-2 py-1 rounded-lg bg-red-500/10 text-red-500 font-bold text-xs">No</span>';
                    else val = '<span class="text-gray-400 text-xs">N/A</span>';
                }

                // Display relation values as a styled chip
                if (f.type === 'relation' && val) {
                    val = `<span class="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">${val}</span>`;
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

function validateClientConstraints() {
    for (const f of currentFields) {
        const el = document.getElementById(`modal_field_${f.id}`);
        if (!el) continue;
        const val = el.value;
        const constraints = f.constraints || {};

        if (f.required && (val === null || val === undefined || val.trim() === "")) {
            return `El campo "${f.name}" es obligatorio.`;
        }

        if (val !== null && val !== undefined && val.trim() !== "") {
            const valStr = val.trim();

            if (f.type === 'text') {
                if (constraints.min_length !== undefined && valStr.length < constraints.min_length) {
                    return `El campo "${f.name}" debe tener al menos ${constraints.min_length} caracteres.`;
                }
                if (constraints.max_length !== undefined && valStr.length > constraints.max_length) {
                    return `El campo "${f.name}" no puede tener más de ${constraints.max_length} caracteres.`;
                }
                if (constraints.pattern) {
                    try {
                        const rx = new RegExp(constraints.pattern);
                        if (!rx.test(valStr)) {
                            return `El campo "${f.name}" no coincide con el formato requerido.`;
                        }
                    } catch (e) {
                        console.error('Invalid regex pattern:', constraints.pattern);
                    }
                }
            }

            if (f.type === 'number') {
                const num = parseFloat(valStr);
                if (isNaN(num)) {
                    return `El campo "${f.name}" debe ser un número válido.`;
                }
                if (constraints.min_value !== undefined && num < constraints.min_value) {
                    return `El campo "${f.name}" debe ser mayor o igual a ${constraints.min_value}.`;
                }
                if (constraints.max_value !== undefined && num > constraints.max_value) {
                    return `El campo "${f.name}" debe ser menor o igual a ${constraints.max_value}.`;
                }
            }

            if (f.type === 'email') {
                let allowed = constraints.allowed_domains;
                if (allowed) {
                    if (typeof allowed === 'string') {
                        allowed = allowed.split(',').map(d => d.trim().toLowerCase()).filter(d => d);
                    } else if (Array.isArray(allowed)) {
                        allowed = allowed.map(d => d.toLowerCase());
                    }
                    if (allowed && allowed.length > 0) {
                        const domain = valStr.split('@').pop().toLowerCase();
                        if (!allowed.includes(domain)) {
                            return `El campo "${f.name}" debe pertenecer a uno de los dominios permitidos: ${allowed.join(', ')}.`;
                        }
                    }
                }
            }

            if (f.type === 'date') {
                const curDate = new Date(valStr);
                if (constraints.min_date) {
                    const minD = new Date(constraints.min_date);
                    if (curDate < minD) {
                        return `La fecha del campo "${f.name}" no puede ser anterior a ${constraints.min_date}.`;
                    }
                }
                if (constraints.max_date) {
                    const maxD = new Date(constraints.max_date);
                    if (curDate > maxD) {
                        return `La fecha del campo "${f.name}" no puede ser posterior a ${constraints.max_date}.`;
                    }
                }

                // Cross-field date constraints
                if (constraints.min_date_field) {
                    const otherField = currentFields.find(o => String(o.id) === String(constraints.min_date_field) || o.name === constraints.min_date_field);
                    if (otherField) {
                        const otherEl = document.getElementById(`modal_field_${otherField.id}`);
                        if (otherEl && otherEl.value) {
                            if (new Date(valStr) < new Date(otherEl.value)) {
                                return `La fecha de "${f.name}" no puede ser anterior a la de "${otherField.name}".`;
                            }
                        }
                    }
                }

                if (constraints.max_date_field) {
                    const otherField = currentFields.find(o => String(o.id) === String(constraints.max_date_field) || o.name === constraints.max_date_field);
                    if (otherField) {
                        const otherEl = document.getElementById(`modal_field_${otherField.id}`);
                        if (otherEl && otherEl.value) {
                            if (new Date(valStr) > new Date(otherEl.value)) {
                                return `La fecha de "${f.name}" no puede ser posterior a la de "${otherField.name}".`;
                            }
                        }
                    }
                }
            }
        }
    }
    return null;
}

async function saveRecord() {
    const clientErr = validateClientConstraints();
    if (clientErr) {
        showError(clientErr);
        return;
    }

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
        const c = f.constraints || {};
        
        const roAttr = c.read_only ? (f.type === 'select' || f.type === 'boolean' || f.type === 'relation' ? 'disabled' : 'readonly') : '';
        const roClass = c.read_only ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75' : '';

        // Generate type specific validation tags
        let extraAttrs = '';
        if (f.type === 'text') {
            if (c.min_length !== undefined) extraAttrs += ` minlength="${c.min_length}"`;
            if (c.max_length !== undefined) extraAttrs += ` maxlength="${c.max_length}"`;
            if (c.pattern) extraAttrs += ` pattern="${c.pattern}"`;
        } else if (f.type === 'number') {
            if (c.min_value !== undefined) extraAttrs += ` min="${c.min_value}"`;
            if (c.max_value !== undefined) extraAttrs += ` max="${c.max_value}"`;
        } else if (f.type === 'date') {
            if (c.min_date) extraAttrs += ` min="${c.min_date}"`;
            if (c.max_date) extraAttrs += ` max="${c.max_date}"`;
        }

        const helpHtml = c.help_text ? `
            <p class="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1 font-medium">
                <span class="material-symbols-outlined text-[12px]">info</span> ${c.help_text}
            </p>
        ` : '';

        const ph = c.placeholder || f.name;

        if (f.type === 'select') {
            const opts = f.options || [];
            inputHtml = `
                <div class="relative">
                    <select id="modal_field_${f.id}" class="${baseInputClass} ${roClass} appearance-none cursor-pointer" ${roAttr}>
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
                    <select id="modal_field_${f.id}" class="${baseInputClass} ${roClass} appearance-none cursor-pointer" ${roAttr}>
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
                        const [recsRes] = await Promise.all([
                            apiFetch(`/tables/${f.relatedTableId}/records`)
                        ]);
                        if (recsRes.ok) {
                            const recs = await recsRes.json();
                            const map = {};
                            recs.forEach(r => {
                                const firstVal = r.fieldValues
                                    ? Object.values(r.fieldValues).find(v => v && v.toString().trim())
                                    : null;
                                const label = firstVal ? `#${r.id} - ${firstVal}` : `#${r.id}`;
                                const displayLabel = f.relatedFieldName && r.fieldValues[f.relatedFieldName]
                                    ? `#${r.id} - ${r.fieldValues[f.relatedFieldName]}`
                                    : label;
                                map[r.id] = displayLabel;
                            });
                            relationCache[f.id] = map;
                            options = Object.entries(map).map(([id, val]) => ({ id, val }));
                        }
                    } catch (err) { console.error(err); }
                } else {
                    const map = relationCache[f.id];
                    options = Object.entries(map).map(([id, val]) => ({ id, val }));
                }
            }
            const safeOptions = JSON.stringify(options).replace(/"/g, '&quot;');

            const isEmpty = options.length === 0;
            const emptyMessage = isEmpty ? '<p class="text-xs text-red-500 mt-1">No hay registros en esta tabla.</p>' : '';
            const disabledAttr = isEmpty ? 'disabled' : '';
            const placeholder = isEmpty ? 'No hay opciones disponibles' : 'Buscar...';

            inputHtml = `
                <div class="relative relation-search-container">
                    <input type="text" class="${baseInputClass} ${isEmpty || c.read_only ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed opacity-75' : ''}" 
                           id="search_modal_field_${f.id}" placeholder="${placeholder}" ${disabledAttr || roAttr}
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
            inputHtml = `<input type="${getInputType(f.type)}" id="modal_field_${f.id}" class="${baseInputClass} ${roClass}" placeholder="${ph}" ${roAttr} ${extraAttrs}>`;
        }

        return `
            <div class="col-span-1">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                    <span>${f.name}</span>
                    ${c.read_only ? '<span class="material-symbols-outlined text-xs text-gray-400 font-bold" title="Solo lectura">lock</span>' : ''}
                </label>
                ${inputHtml}
                ${helpHtml}
            </div>
        `;
    });

    const htmlParts = await Promise.all(htmlPromises);
    container.innerHTML = htmlParts.join('');

    // Hook up reactive cross-field date bounds in UI
    currentFields.forEach(f => {
        if (f.type === 'date' && f.constraints) {
            const minFieldId = f.constraints.min_date_field;
            const maxFieldId = f.constraints.max_date_field;
            const el = document.getElementById(`modal_field_${f.id}`);
            if (!el) return;

            if (minFieldId) {
                const otherField = currentFields.find(o => String(o.id) === String(minFieldId) || o.name === minFieldId);
                if (otherField) {
                    const otherEl = document.getElementById(`modal_field_${otherField.id}`);
                    if (otherEl) {
                        otherEl.addEventListener('change', () => {
                            el.min = otherEl.value;
                        });
                        if (otherEl.value) {
                            el.min = otherEl.value;
                        }
                    }
                }
            }
            if (maxFieldId) {
                const otherField = currentFields.find(o => String(o.id) === String(maxFieldId) || o.name === maxFieldId);
                if (otherField) {
                    const otherEl = document.getElementById(`modal_field_${otherField.id}`);
                    if (otherEl) {
                        otherEl.addEventListener('change', () => {
                            el.max = otherEl.value;
                        });
                        if (otherEl.value) {
                            el.max = otherEl.value;
                        }
                    }
                }
            }
        }
    });
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
        const safeVal = String(o.val).replace(/'/g, "\\'");
        return `
        <a href="javascript:void(0)" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
           onclick="selectRelationOption(${fieldId}, '${o.id}', '${safeVal}')">
           ${o.val}
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
