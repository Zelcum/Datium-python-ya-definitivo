checkAuth();
const urlParams = new URLSearchParams(window.location.search);
const systemId = urlParams.get('id');
let allTables = [];
let currentRegisterTableId = null;
let currentRegisterFields = [];
const relationCache = {};

async function init() {
    await loadSystemDetails();
    await loadTables();
    loadSidebarInfo();
}

async function loadSystemDetails() {
    const res = await apiFetch(`/systems/${systemId}`);
    if (res.ok) {
        const system = await res.json();
        document.getElementById('systemName').innerText = system.name;
        document.getElementById('systemDesc').innerText = system.description || 'Sin descripción';
        document.title = `${system.name} - Datium`;

        const img = document.getElementById('systemLogo');
        img.src = system.imageUrl || '/static/img/Isotipo modo claro.jpeg';
        img.onerror = () => { img.src = '/static/img/Isotipo modo claro.jpeg'; };
    }
}

async function loadTables() {
    const res = await apiFetch(`/systems/${systemId}/tables`);
    if (res.ok) {
        allTables = await res.json();
        filterTables();
    }
}

function filterTables() {
    const search = document.getElementById('tableSearchInput').value.toLowerCase();
    const filtered = allTables.filter(t =>
        t.name.toLowerCase().includes(search) ||
        (t.description && t.description.toLowerCase().includes(search))
    );
    renderTables(filtered);
}

function renderTables(tables) {
    const container = document.getElementById('tablesList');

    if (tables.length === 0) {
        container.className = 'col-span-1 md:col-span-2 lg:col-span-3 text-center py-12';
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center text-gray-400">
                <span class="material-symbols-outlined text-6xl mb-2 opacity-20">table_off</span>
                <p class="text-sm">No se encontraron tablas</p>
            </div>
         `;
        return;
    }

    container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    container.innerHTML = tables.map(table => `
        <div class="bg-white dark:bg-[#151f2b] rounded-2xl p-5 border border-gray-200 dark:border-gray-800 shadow-md hover:shadow-lg transition-shadow group relative flex flex-col h-full">
            <div class="flex justify-between items-start mb-3">
                <div class="p-2.5 bg-blue-500/10 rounded-xl text-blue-500">
                    <span class="material-symbols-outlined text-2xl">table_rows</span>
                </div>
                <div class="flex gap-1">
                    <a href="table_form.html?systemId=${systemId}&tableId=${table.id}" 
                        class="text-gray-400 hover:text-blue-500 transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20" title="Editar Tabla">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </a>
                     <button onclick="deleteTable(${table.id}); event.stopPropagation();" 
                        class="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Eliminar Tabla">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                    <button onclick="triggerBulkImport(${table.id}); event.stopPropagation();" 
                        class="text-gray-400 hover:text-emerald-500 transition-colors p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20" title="Importar Datos (CSV/JSON)">
                        <span class="material-symbols-outlined text-lg">upload_file</span>
                    </button>
                </div>
            </div>
            
            <h3 class="font-bold text-[#111418] dark:text-white text-lg mb-1 truncate" title="${table.name}">${table.name}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 min-h-[2.5em] mb-4 flex-grow">${table.description || 'Sin descripción'}</p>
            
            <div class="flex flex-col gap-2 pt-4 border-t border-gray-100 dark:border-gray-800 mt-auto">
                <button onclick="openRegisterModal(${table.id}, '${table.name}')" 
                    class="w-full py-2 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm transition-colors flex items-center justify-center gap-2">
                    <span class="material-symbols-outlined text-lg">add_circle</span>
                    Registrar
                </button>
                <a href="table.html?id=${table.id}" 
                    class="w-full py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-sm transition-colors flex items-center justify-center gap-2">
                    Ver Datos
                    <span class="material-symbols-outlined text-lg">arrow_forward</span>
                </a>
            </div>
        </div>
    `).join('');
}

async function openRegisterModal(tableId, tableName) {
    currentRegisterTableId = tableId;

    const sysName = document.getElementById('systemName').innerText;
    const sysLogoSrc = document.getElementById('systemLogo').src;

    document.getElementById('modalSystemName').innerText = sysName;
    document.getElementById('modalTableName').innerText = tableName;
    document.getElementById('modalSystemLogo').src = sysLogoSrc;

    document.getElementById('modalFieldsContainer').innerHTML = `
        <div class="text-center py-8">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p class="text-gray-400 text-sm">Cargando campos...</p>
        </div>
    `;
    document.getElementById('registerModal').classList.remove('hidden');

    try {
        const res = await apiFetch(`/tables/${tableId}/fields`);
        if (res.ok) {
            currentRegisterFields = await res.json();
            await renderModalFields();
        } else {
            document.getElementById('modalFieldsContainer').innerHTML = '<p class="text-red-500 text-center">Error cargando campos</p>';
        }
    } catch (e) {
        console.error(e);
        document.getElementById('modalFieldsContainer').innerHTML = '<p class="text-red-500 text-center">Error de conexión</p>';
    }
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
    currentRegisterTableId = null;
    currentRegisterFields = [];
    document.getElementById('registerForm').reset();
}

async function renderModalFields() {
    const container = document.getElementById('modalFieldsContainer');
    if (currentRegisterFields.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center">Esta tabla no tiene campos definidos.</p>';
        return;
    }

    const htmlPromises = currentRegisterFields.map(async f => {
        const baseInputClass = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white placeholder-gray-400";
        let inputHtml = '';

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
                if (!relationCache[f.relatedTableId]) {
                    try {
                        const res = await apiFetch(`/tables/${f.relatedTableId}/records`);
                        if (res.ok) {
                            const recs = await res.json();
                            const map = {};
                            recs.forEach(r => {
                                const val = f.relatedFieldName ? r.fieldValues[f.relatedFieldName] : r.id;
                                map[r.id] = val;
                            });
                            relationCache[f.relatedTableId] = map;
                            options = Object.entries(map).map(([id, val]) => ({ id, val }));
                        }
                    } catch (err) { console.error(err); }
                } else {
                    options = Object.entries(relationCache[f.relatedTableId]).map(([id, val]) => ({ id, val }));
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
            const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
            inputHtml = `<input type="${type}" id="modal_field_${f.id}" class="${baseInputClass}" placeholder="${f.name}">`;
        }

        return `
            <div>
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
                    ${f.name} ${f.required ? '<span class="text-red-500">*</span>' : ''}
                </label>
                ${inputHtml}
            </div>
        `;
    });

    const htmlParts = await Promise.all(htmlPromises);
    container.innerHTML = htmlParts.join('');
}

async function submitRegister() {
    if (!currentRegisterTableId) return;

    const values = {};
    let hasError = false;

    currentRegisterFields.forEach(f => {
        const el = document.getElementById(`modal_field_${f.id}`);
        const searchEl = document.getElementById(`search_modal_field_${f.id}`);
        const val = el ? el.value : '';

        const visualEl = searchEl || el;

        if (f.required && !val) {
            if (visualEl) visualEl.classList.add('border-red-500');
            hasError = true;
        } else {
            if (visualEl) visualEl.classList.remove('border-red-500');
        }
        values[f.id] = val;
    });

    if (hasError) {
        showError('Por favor completa los campos requeridos');
        return;
    }

    showLoading('Guardando registro...');

    try {
        const res = await apiFetch(`/tables/${currentRegisterTableId}/records`, {
            method: 'POST',
            body: JSON.stringify({ values: values })
        });

        if (res.ok) {
            closeRegisterModal();
            loadTables();
            showSuccess('Registro guardado');
        } else {
            try {
                const errorData = await res.json();
                showError(errorData.message || errorData.error || 'Error al guardar');
            } catch (e) {
                showError('Error al guardar datos');
            }
        }
    } catch (e) {
        console.error(e);
        showError('Error de conexión');
    }
}

function goToCreateTable() {
    window.location.href = `table_form.html?systemId=${systemId}`;
}

async function deleteTable(id) {
    showConfirm('¿Eliminar tabla? Se perderán todos los datos permanentemente.', () => {
        promptPassword(async () => {
            showLoading('Eliminando tabla...');
            try {
                const res = await apiFetch(`/systems/${systemId}/tables/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    await loadTables(); 
                    showSuccess('Tabla eliminada correctamente');
                } else {
                    showError('No se pudo eliminar la tabla');
                }
            } catch (e) {
                console.error(e);
                showError('Error de red al eliminar');
            }
        });
    });
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
    const filtered = data.filter(d => String(d.val).toLowerCase().includes(text) || String(d.id).includes(text));
    renderRelationOptions(fieldId, filtered);
    list.style.display = 'block';
}

function renderRelationOptions(fieldId, options) {
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    if (options.length === 0) {
        list.innerHTML = '<div class="p-3 text-gray-500 text-sm">No se encontraron resultados</div>';
        return;
    }
    list.innerHTML = options.map(o => `
        <a href="javascript:void(0)" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
           onclick="selectRelationOption(${fieldId}, '${o.id}', '${o.val.replace(/'/g, "\\'")}')">
           ${o.val} <span class="text-xs text-gray-400 ml-2">#${o.id}</span>
        </a>
    `).join('');
}

function selectRelationOption(fieldId, id, val) {
    document.getElementById(`modal_field_${fieldId}`).value = id;
    document.getElementById(`search_modal_field_${fieldId}`).value = val;
    hideRelationOptions(fieldId);
}


let targetImportTableId = null;

function triggerBulkImport(tableId) {
    targetImportTableId = tableId;
    document.getElementById('bulkImportInput').click();
}

async function handleBulkImport(event) {
    const file = event.target.files[0];
    if (!file || !targetImportTableId) return;

    const formData = new FormData();
    formData.append('file', file);

    showLoading('Importando datos...');

    try {
        const res = await apiFetch(`/tables/${targetImportTableId}/import`, {
            method: 'POST',
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            showSuccess(`Se importaron ${data.count} registros correctamente.`);
            loadTables(); 
        } else {
            const err = await res.json();
            showError(err.error || 'Error al importar');
        }
    } catch (e) {
        console.error(e);
        showError('Error de conexión al importar');
    } finally {
        event.target.value = ''; 
        targetImportTableId = null;
    }
}

function openInviteModal() {
    document.getElementById('inviteModal').classList.remove('hidden');
    const list = document.getElementById('inviteTablesList');
    list.innerHTML = allTables.map(t => `
        <div class="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-gray-400">table_rows</span>
                <span class="text-sm font-bold text-gray-700 dark:text-gray-200">${sanitize(t.name)}</span>
            </div>
            <div class="flex gap-4">
                <label class="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase cursor-pointer" title="Leer">
                    <input type="checkbox" class="table-perm-read rounded border-gray-300 text-primary" data-table-id="${t.id}" checked> R
                </label>
                <label class="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase cursor-pointer" title="Crear">
                    <input type="checkbox" class="table-perm-create rounded border-gray-300 text-primary" data-table-id="${t.id}"> C
                </label>
                <label class="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase cursor-pointer" title="Editar">
                    <input type="checkbox" class="table-perm-update rounded border-gray-300 text-primary" data-table-id="${t.id}"> U
                </label>
                <label class="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase cursor-pointer" title="Eliminar">
                    <input type="checkbox" class="table-perm-delete rounded border-gray-300 text-primary" data-table-id="${t.id}"> D
                </label>
            </div>
        </div>
    `).join('');
}

function closeInviteModal() {
    document.getElementById('inviteModal').classList.add('hidden');
    document.getElementById('inviteEmail').value = '';
}

function toggleAllPerms(type) {
    const checked = document.getElementById(`selectAll${type.charAt(0).toUpperCase() + type.slice(1)}`).checked;
    document.querySelectorAll(`.table-perm-${type}`).forEach(cb => cb.checked = checked);
}

async function submitInvite() {
    const email = document.getElementById('inviteEmail').value.trim();
    if (!email) return showError('Ingresa un email válido');

    const tablePerms = allTables.map(t => ({
        tableId: t.id,
        read: document.querySelector(`.table-perm-read[data-table-id="${t.id}"]`)?.checked || false,
        create: document.querySelector(`.table-perm-create[data-table-id="${t.id}"]`)?.checked || false,
        update: document.querySelector(`.table-perm-update[data-table-id="${t.id}"]`)?.checked || false,
        delete: document.querySelector(`.table-perm-delete[data-table-id="${t.id}"]`)?.checked || false
    }));

    promptPassword(async (ownerPassword) => {
        showLoading('Enviando invitación...');
        try {
            const res = await apiFetch(`/systems/${systemId}/invite`, {
                method: 'POST',
                body: JSON.stringify({ email, ownerPassword, tablePerms })
            });
            hideLoading();
            if (res.ok) {
                showSuccess('Invitación enviada exitosamente');
                closeInviteModal();
            } else {
                const err = await res.json().catch(() => ({}));
                showError(err.error || 'No se pudo enviar la invitación');
            }
        } catch (e) {
            hideLoading();
            showError('Error de servidor');
        }
    });
}

init();
