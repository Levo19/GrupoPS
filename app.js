// ===== STATE =====
let currentUser = null;
let currentView = 'dashboard';
let currentReservationsList = [];
let checkInMode = 'checkin';
let pickerState = {
    roomId: null,
    currentMonth: new Date(),
    startDate: null,
    endDate: null
};

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    // Check session
    const token = sessionStorage.getItem('gps_token');
    const user = sessionStorage.getItem('gps_user');

    if (token && user) {
        currentUser = JSON.parse(user);
        preloadAppSession(); // Preload data in background
        initDashboard();
    } else {
        showLogin();
        // Phase 11: Dynamic Greeting
        initLoginGreeting();
    }
});

// Phase 11: Dynamic Greeting Logic
async function initLoginGreeting() {
    const title = document.getElementById('welcomeTitle');

    // 1. Time based logic
    const hour = new Date().getHours();
    let greeting = 'Hola';
    if (hour < 12) greeting = 'Buenos días';
    else if (hour < 18) greeting = 'Buenas tardes';
    else greeting = 'Buenas noches';

    try {
        // 2. Fetch Name
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAdminName' })
        });
        const data = await res.json();

        if (data.success && data.name) {
            title.innerText = `${greeting}, ${data.name.split(' ')[0]}`; // Use first name
        } else {
            title.innerText = `${greeting}, Administrador`;
        }

        // 3. Trigger Reveal Animation (Slide Down)
        // Small delay to ensure render
        setTimeout(() => {
            title.classList.add('reveal-visible');
            title.classList.remove('reveal-hidden');
        }, 100);

    } catch (e) {
        title.innerText = `${greeting}, Administrador`;
        title.classList.add('reveal-visible');
        title.classList.remove('reveal-hidden');
    }
}

// ===== PRELOADING =====
async function preloadAppSession() {
    console.log('🚀 Preloading App Data...');
    try {
        const [resRooms, resProds, resUsers, resRes] = await Promise.all([
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getHabitaciones' }) }).then(r => r.json()),
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getProductos' }) }).then(r => r.json()),
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getUsuarios' }) }).then(r => r.json()),
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getReservas' }) }).then(r => r.json())
        ]);

        if (resRooms.success) currentRoomsList = resRooms.habitaciones;
        if (resProds.success) currentProductsList = resProds.productos;
        if (resUsers.success) currentUsersList = resUsers.usuarios;
        if (resRes.success) currentReservationsList = resRes.reservas;

        console.log('✅ Data Preloaded!');

        // If we are already on a view that needs this data, refresh it safely
        const currentId = document.querySelector('.nav-item.active')?.getAttribute('onclick')?.match(/'(.*)'/)?.[1];
        if (currentId === 'rooms') renderRooms(currentRoomsList);
        if (currentId === 'products') renderProducts(currentProductsList);
        if (currentId === 'users') renderUsers(currentUsersList);
        // Calendar is complex, leave it for now or refresh if visible

    } catch (e) {
        console.error('⚠️ Error preloading data', e);
    }
}

// ===== DATA REFRESH HELPERS =====
async function loadReservations() {
    try {
        const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getReservas' }) });
        const data = await res.json();
        if (data.success) {
            currentReservationsList = data.reservas;
            if (document.getElementById('view-calendar').style.display === 'block') {
                renderCalendarTimeline(currentRoomsList, currentReservationsList);
            }
        }
    } catch (e) { console.error(e); }
}

async function loadRooms() {
    try {
        const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getHabitaciones' }) });
        const data = await res.json();
        if (data.success) {
            currentRoomsList = data.habitaciones;
            if (document.getElementById('view-rooms').style.display === 'block') {
                renderRooms(currentRoomsList);
            }
            // Calendar also depends on Rooms
            if (document.getElementById('view-calendar').style.display === 'block') {
                renderCalendarTimeline(currentRoomsList, currentReservationsList);
            }
        }
    } catch (e) { console.error(e); }
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginScreen').style.opacity = '1';
    document.getElementById('appContainer').style.display = 'none';
}

// ===== AUTHENTICATION (SIMPLIFIED PHASE 10) =====
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const err = document.getElementById('loginError');

    // UI Loading
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
    err.style.display = 'none';

    const password = document.getElementById('txtPassword').value;

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'login',
                email: 'admin', // Hardcoded for Single User Mode
                password: password
            })
        });
        const data = await res.json();

        if (data.success) {
            loginSuccess(data);
        } else {
            throw new Error(data.error || 'Contraseña incorrecta');
        }
    } catch (e) {
        console.error(e);
        err.style.display = 'block';
        err.innerText = '⚠️ ' + (e.message || 'Error de conexión');
        btn.disabled = false;
        btn.innerHTML = 'Ingresar <i class="fas fa-arrow-right" style="margin-left:8px"></i>';
    }
}

function loginSuccess(data) {
    sessionStorage.setItem('gps_token', data.token);
    sessionStorage.setItem('gps_user', JSON.stringify(data.user));
    currentUser = data.user;

    // Animación de salida login
    const screen = document.getElementById('loginScreen');
    screen.style.opacity = '0';

    preloadAppSession(); // Start fetching immediately

    setTimeout(() => {
        screen.style.display = 'none';
        initDashboard();
    }, 500);
}

function logout() {
    sessionStorage.clear();
    location.reload();
}

// ===== DASHBOARD INIT =====
function initDashboard() {
    document.getElementById('appContainer').style.display = 'flex';
    document.getElementById('userDisplay').innerText = currentUser.nombre;
    document.getElementById('roleDisplay').innerText = currentUser.rol || 'Staff';

    navigate('dashboard');
}

// ===== NAVIGATION =====
function navigate(viewId) {
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    // Simple logic to find nav item by click (usually handled by event, simplified here)
    // In real app, we iterate based on viewId to set active class

    // Hide all views
    // Hide all views safely
    const views = ['view-dashboard', 'view-rooms', 'view-calendar', 'view-users', 'view-products', 'view-finances'];
    views.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Show Target
    const title = document.getElementById('pageTitle');

    if (viewId === 'dashboard') {
        document.getElementById('view-dashboard').style.display = 'block';
        title.innerText = 'Dashboard Principal';
    } else if (viewId === 'rooms') {
        document.getElementById('view-rooms').style.display = 'block';
        title.innerText = 'Gestión de Habitaciones';
        if (document.getElementById('view-rooms').innerHTML === '') loadRoomsView();
    } else if (viewId === 'calendar') {
        document.getElementById('view-calendar').style.display = 'block';
        title.innerText = 'Calendario de Ocupación';
        if (document.getElementById('view-calendar').innerHTML === '') loadCalendarView();
    } else if (viewId === 'users') {
        document.getElementById('view-users').style.display = 'block';
        title.innerText = 'Gestión de Usuarios';
        loadUsersView();
    } else if (viewId === 'products') {
        document.getElementById('view-products').style.display = 'block';
        title.innerText = 'Inventario Productos & Servicios';
        loadProductsView();
    } else if (viewId === 'finances') {
        document.getElementById('view-finances').style.display = 'block';
        title.innerText = 'Finanzas & Compras';
        renderFinanceView();
    }
}

// ===== ROOMS MODULE =====
async function loadRoomsView() {
    const container = document.getElementById('view-rooms');

    // 1. Optimistic Render (Instant)
    if (currentRoomsList && currentRoomsList.length > 0) {
        renderRooms(currentRoomsList);
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top:15px; color:#64748B;">Cargando habitaciones...</p>
            </div>
        `;
    }

    try {
        // 2. Silent Fetch (Update in background)
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getHabitaciones' })
        });
        const data = await res.json();

        if (data.success) {
            currentRoomsList = data.habitaciones;
            renderRooms(data.habitaciones);
        } else if (currentRoomsList.length === 0) {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${data.error}</div>`;
        }
    } catch (e) {
        if (currentRoomsList.length === 0) {
            container.innerHTML = `<div style="color:red; text-align:center;">Error de conexión: ${e.message}</div>`;
        }
    }
}



// ===== ROOM EDITOR LOGIC =====
let currentRoomsList = []; // Store fetched rooms to find by ID easily

function editRoom(id) {
    const room = currentRoomsList.find(r => r.id == id);
    if (!room) return;

    document.getElementById('editRoomId').value = room.id;
    document.getElementById('editNum').value = room.numero;
    document.getElementById('editTipo').value = room.tipo;
    document.getElementById('editPrecio').value = room.precio;
    document.getElementById('editEstado').value = room.estado;

    // Photo logic
    let photoUrl = '';
    try {
        if (room.fotos && room.fotos.startsWith('[')) {
            photoUrl = JSON.parse(room.fotos)[0] || '';
        } else {
            photoUrl = room.fotos;
        }
    } catch (e) { photoUrl = room.fotos; }
    document.getElementById('editFoto').value = photoUrl;

    document.getElementById('modalRoomEditor').style.display = 'flex';
}

function closeRoomEditor() {
    document.getElementById('modalRoomEditor').style.display = 'none';
}

function openNewRoom() {
    document.getElementById('editRoomId').value = '';
    document.getElementById('editNum').value = '';
    document.getElementById('editTipo').value = 'Matrimonial';
    document.getElementById('editPrecio').value = '';
    document.getElementById('editEstado').value = 'Disponible';
    document.getElementById('editFoto').value = '';
    document.getElementById('modalRoomEditor').style.display = 'flex';
}

async function saveRoom(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    // 1. Get Data
    const id = document.getElementById('editRoomId').value;
    const roomData = {
        id: id,
        numero: document.getElementById('editNum').value,
        tipo: document.getElementById('editTipo').value,
        precio: document.getElementById('editPrecio').value,
        estado: document.getElementById('editEstado').value,
        fotos: document.getElementById('editFoto').value
    };

    // 2. Optimistic Update
    if (id) {
        // Edit
        const index = currentRoomsList.findIndex(r => r.id == id);
        if (index !== -1) {
            currentRoomsList[index] = { ...currentRoomsList[index], ...roomData };
        }
    } else {
        // New (Temp ID for display)
        currentRoomsList.push({ ...roomData, id: 'temp-' + Date.now() });
    }

    // Render Immediately & Close
    renderRooms(currentRoomsList);
    closeRoomEditor();

    // 3. Background Sync
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveHabitacion',
                habitacion: roomData
            })
        });
        const data = await res.json();

        if (!data.success) {
            alert('❌ Error guardando en servidor: ' + data.error);
            // Revert or Refresh
            loadRoomsView();
        } else {
            // Success: Update list with real data from server (to get real ID)
            // loadRoomsView(); // Optional: keeps data strictly synced
            // For now, let's just silently refresh to get the real ID
            loadRoomsView();
        }
    } catch (err) {
        alert('❌ Error de conexión: ' + err.message);
        loadRoomsView(); // Revert
    }
}

function renderRooms(rooms) {
    currentRoomsList = rooms; // Cache for editing
    const container = document.getElementById('view-rooms');

    // Add "New Room" Button Logic
    let html = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:20px;">
        <button class="btn-login" style="width:auto;" onclick="openNewRoom()">+ Nueva Habitación</button>
    </div>
    `;

    if (rooms.length === 0) {
        html += `
            <div style="text-align:center; padding: 40px; background:white; border-radius:10px;">
                <i class="fas fa-box-open" style="font-size:2rem; color:#cbd5e1;"></i>
                <p>No hay habitaciones registradas.</p>
            </div>
        `;
        container.innerHTML = html;
        return;
    }

    html += '<div class="room-grid">';
    rooms.forEach(r => {
        // Status Badge Logic
        let statusClass = 'status-disponible';
        let statusText = r.estado || 'Desconocido';
        let statusLabel = statusText;

        // Normalize status
        const normStatus = statusText.toLowerCase();

        if (normStatus === 'ocupado') {
            statusClass = 'status-ocupado';
            statusLabel = 'OCUPADO';
        }
        else if (normStatus === 'mantenimiento') {
            statusClass = 'status-mantenimiento';
            statusLabel = 'MANTENIMIENTO';
        }
        else if (normStatus === 'sucio') {
            statusClass = 'status-sucio';
            statusLabel = 'LIMPIEZA';
            // User requested that 'Cleaning' means 'Available but Dirty'
            // We can add a quick 'Clean' action later if needed
        }
        else if (normStatus === 'disponible') {
            statusClass = 'status-disponible';
            statusLabel = 'DISPONIBLE';
        } else if (normStatus === 'reservado') {
            statusClass = 'status-mantenimiento'; // Use warning color/orange
            statusLabel = 'RESERVADO';
        }

        // Image Logic
        let mainImg = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=600';
        try {
            if (r.fotos && r.fotos.startsWith('[')) {
                const photos = JSON.parse(r.fotos);
                if (photos.length > 0) mainImg = photos[0];
            } else if (r.fotos && r.fotos.startsWith('http')) {
                mainImg = r.fotos;
            }
        } catch (e) { }

        // Actions Logic
        let actionsHtml = '';

        // Common Reserve Button
        const btnReservar = `<button onclick="openReservation('${r.id}', '${r.numero}')" class="btn-action btn-action-warning"><i class="fas fa-calendar-plus"></i> Reservar</button>`;

        // ACTIONS
        const statusNorm = r.estado.toLowerCase();

        if (statusNorm === 'disponible' || statusNorm === 'sucio') {
            const btnCheckIn = `<button onclick="openCheckIn('${r.id}', '${r.numero}')" class="btn-action btn-action-success"><i class="fas fa-key"></i> Check-In</button>`;

            // Optional: If dirty, show a "Quick Clean" button or just a visual warning inside the grid?
            // User wants dynamic. Let's just give them the Check-In button.
            // If they check-in, it implies it's ready.

            const btnClean = statusNorm === 'sucio'
                ? `<button onclick="markRoomClean('${r.id}')" class="btn-action btn-action-alert" title="Marcar como Limpio"><i class="fas fa-broom"></i> Limpiar</button>`
                : '';

            actionsHtml = `
            <div class="room-actions-grid full-width" style="gap:8px;">
                 ${btnCheckIn}
                 ${statusNorm === 'sucio' ? `<div class="room-actions-grid">${btnClean} ${btnReservar}</div>` : btnReservar}
            </div>`;

        } else if (normStatus === 'ocupado') {
            const clientName = r.cliente_actual || '';

            const btnFinish = `<button onclick="openCheckOut('${r.id}', '${r.numero}', '${clientName}')" class="btn-action btn-action-danger"><i class="fas fa-sign-out-alt"></i> Finalizar</button>`;

            // Extender (Secondary)
            const btnExtend = `<button onclick="openReservation('${r.id}', '${r.numero}', null, '${clientName}', true)" class="btn-action btn-action-success"><i class="fas fa-clock"></i> Extender</button>`;

            // [PHASE 9] Quick Charge Button
            // Using r.reservaActivaId passed from backend
            const btnCharge = `<button onclick="openQuickCharge('${r.id}', '${r.reservaActivaId}')" class="btn-action btn-action-primary" title="Cargar Consumo"><i class="fas fa-cart-plus"></i></button>`;

            // Layout: Finish (Full) on top, then Extend + Charge
            actionsHtml = `
            <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                ${btnFinish}
                <div class="room-actions-grid" style="grid-template-columns: 2fr 1fr;">
                    ${btnExtend}
                    ${btnCharge}
                </div>
            </div>`;

        } else if (normStatus === 'mantenimiento') {
            actionsHtml = `
            <div class="room-actions-grid full-width">
                 <div style="text-align:center; color:#64748B; font-style:italic; font-size:0.85rem; margin-bottom:5px;">Mantenimiento</div>
                 ${btnReservar}
            </div>`;

        } else if (normStatus === 'reservado') {
            // Check-In (Arrival) + Reservar
            const btnArrival = `<button onclick="openCheckIn('${r.id}', '${r.numero}')" class="btn-action btn-action-success"><i class="fas fa-check"></i> Llegada</button>`;

            actionsHtml = `
             <div class="room-actions-grid">
                  ${btnArrival}
                  ${btnReservar}
             </div>`;
        } else {
            actionsHtml = `<span style="color:#64748B; font-size:0.9rem; font-style:italic;">No disponible</span>`;
        }

        // [PHASE 9] DEBT BADGE
        let debtBadge = '';
        if (r.deuda && r.deuda > 0) {
            debtBadge = `<span class="room-status-badge badge-debt" style="top:40px; background:#ef4444; color:white;">Deuda: S/ ${r.deuda.toFixed(2)}</span>`;
        }

        html += `
        <div class="room-card fade-in" id="card-${r.id}">
            <div class="card-inner">
                <!-- FRONT FACE -->
                <div class="card-front">
                    <button class="btn-flip" title="Administrar" onclick="toggleRoomFlip('${r.id}')"><i class="fas fa-cog"></i></button>
                    
                    <div class="room-img-box">
                        <img src="${mainImg}" class="room-img" alt="Foto">
                        <span class="room-status-badge ${statusClass}">${statusLabel}</span>
                        ${debtBadge}
                    </div>
                    <div class="room-body">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <div class="room-number">Hab. ${r.numero}</div>
                                <div class="room-type">${r.tipo}</div>
                            </div>
                            <div class="price-tag">S/ ${r.precio}</div>
                        </div>
                        
                        <div class="room-meta">
                            <span><i class="fas fa-user-friends"></i> ${r.capacidad}</span>
                            <span><i class="fas fa-bed"></i> ${r.camas}</span>
                        </div>

                        <div class="room-actions" style="width:100%;">
                            ${actionsHtml}
                        </div>
                    </div>
                </div>

                <!-- BACK FACE (ADMIN) -->
                <div class="card-back">
                    <div class="card-back-header">
                        <span>Gestión Admin</span>
                        <button class="btn-icon" onclick="toggleRoomFlip('${r.id}')"><i class="fas fa-times"></i></button>
                    </div>
                    <div class="card-back-body">
                         <div class="admin-info-row">
                            <span class="admin-label">ID Sistema</span>
                            <span class="admin-value" style="font-size:0.7rem;">${r.id}</span>
                         </div>
                         <div class="admin-info-row">
                            <span class="admin-label">Precio Base</span>
                            <span class="admin-value">S/ ${r.precio}</span>
                         </div>
                         <div class="admin-info-row">
                            <span class="admin-label">Capacidad</span>
                            <span class="admin-value">${r.capacidad} Pers.</span>
                         </div>
                         <div class="admin-info-row">
                            <span class="admin-label">Tipo</span>
                            <span class="admin-value">${r.tipo}</span>
                         </div>

                         <div style="margin-top:auto;">
                            <button class="btn-action btn-action-warning" onclick="editRoom('${r.id}')">
                                <i class="fas fa-pen"></i> Editar Propiedades
                            </button>
                         </div>
                    </div>
                </div>
            </div>
        </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

function toggleRoomFlip(id) {
    const card = document.getElementById('card-' + id);
    if (card) card.classList.toggle('flipped');
}

// ===== CHECK-IN LOGIC (PHASE 5) =====
// ===== CHECK-IN / RESERVATION LOGIC =====
// ===== CHECK-IN LOGIC (PHASE 5) =====
// ===== CHECK-IN / RESERVATION LOGIC =====
// Variables moved to top of file

// Functions openCheckIn and openReservation are defined as window methods later in the file
// to ensure global scope access for HTML onclick attributes.


// Helper to ensure reservations are loaded for blocking logic
async function ensureReservationsLoaded() {
    if (typeof currentReservationsList !== 'undefined' && currentReservationsList.length > 0) return;
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getReservas' })
        });
        const result = await res.json();
        if (result.success) {
            currentReservationsList = result.reservas; // Fix mismatch (was result.data)
            if (pickerState.roomId) initDatePicker(pickerState.roomId);
        }
    } catch (e) { console.error('Error loading reservations for picker', e); }
}

// [NEW] Date Picker Implementation
function initDatePicker(roomId, preDate = null) {
    pickerState.roomId = roomId;
    pickerState.currentMonth = new Date(); // Always start at current month

    // Strict Logic for Check-In
    if (checkInMode === 'checkin') {
        // Force Start Date = Today
        const today = new Date();
        const isoToday = today.toISOString().split('T')[0];
        pickerState.startDate = isoToday;
        pickerState.endDate = null;

    } else {
        // Reservation Mode
        if (preDate) {
            pickerState.startDate = preDate;
            let d = new Date(preDate);
            d.setDate(d.getDate() + 1);
            pickerState.endDate = d.toISOString().split('T')[0];
            pickerState.currentMonth = new Date(preDate);
        } else {
            pickerState.startDate = null;
            pickerState.endDate = null;
        }
    }

    // Sync Hidden Inputs
    document.getElementById('checkInEntrada').value = pickerState.startDate || '';
    document.getElementById('checkInSalida').value = pickerState.endDate || '';

    renderDatePicker();
}

function changePickerMonth(d) {
    pickerState.currentMonth.setMonth(pickerState.currentMonth.getMonth() + d);
    renderDatePicker();
}

function selectPickerDate(dateStr) {
    const { startDate, endDate, roomId } = pickerState;
    const today = new Date().toISOString().split('T')[0];

    // 1. Strict Check-In Logic
    if (checkInMode === 'checkin') {
        // Cannot change start date (it's locked to today)
        // Can only select End Date > Today

        if (dateStr <= startDate) return; // Ignore clicks before/on start date

        // Validate range
        if (isRangeBlocked(roomId, startDate, dateStr)) {
            alert('⚠️ El rango incluye fechas ocupadas.');
            return;
        }

        pickerState.endDate = dateStr;
    } else {
        // 2. Reservation Logic (Flexible)
        // Prevent past dates
        if (dateStr < today) return;

        const details = getDateDetails(roomId, dateStr);

        if (!startDate || (startDate && endDate)) {
            // Start new range
            // Validating Start Date:
            // Forbidden: 'full', 'full-split', 'checkin-pm' (occupied PM)
            // Allowed: 'free', 'checkout-am' (free PM)

            if (details.type === 'full' || details.type === 'full-split' || details.type === 'checkin-pm') {
                alert('⚠️ Fecha ocupada para ingreso.');
                return;
            }

            pickerState.startDate = dateStr;
            pickerState.endDate = null;
        } else {
            // We have start
            if (dateStr < startDate) {
                // Restart with this date?
                if (details.type === 'full' || details.type === 'full-split' || details.type === 'checkin-pm') {
                    alert('⚠️ Fecha ocupada para ingreso.');
                    return;
                }
                pickerState.startDate = dateStr;
                pickerState.endDate = null;
            } else if (dateStr > startDate) {
                // Validate Range
                // We need to check inclusive/exclusive?
                // getDateDetails returns full for ranges in between.
                // We need to check if ANY date in (start, end) is blocked.
                // And check if 'end' itself is valid as an END date.

                // End Date Validation:
                // Forbidden: 'full', 'full-split', 'checkout-am' (occupied AM)
                // Allowed: 'free', 'checkin-pm' (free AM)
                if (details.type === 'full' || details.type === 'full-split' || details.type === 'checkout-am') {
                    alert('⚠️ Fecha ocupada para salida.');
                    return;
                }

                // Intermediate Dates
                if (isRangeBlocked(roomId, startDate, dateStr)) {
                    alert('⚠️ El rango incluye fechas ocupadas.');
                    return;
                }
                pickerState.endDate = dateStr;
            } else {
                pickerState.endDate = null;
            }
        }
    }

    // Update Hidden
    document.getElementById('checkInEntrada').value = pickerState.startDate || '';
    document.getElementById('checkInSalida').value = pickerState.endDate || '';

    renderDatePicker();
}

// Helper: Determine status of a date
// Helper: Determine status of a date
function getDateDetails(roomId, dateStr) {
    // 1. Past
    const today = new Date().toISOString().split('T')[0];
    if (dateStr < today) return { type: 'past', color: 'grey' };

    if (!roomId || !currentReservationsList) return { type: 'free', color: 'white' };

    // 2. Find all matches
    const matches = currentReservationsList.filter(r => {
        if (String(r.habitacionId) !== String(roomId) && String(r.habitacionId) !== String(r.habitacionNumero)) return false;
        if (r.estado === 'Cancelada') return false;
        // We include Finalizada now to color them gray, but maybe exclude from collision logic elsewhere?
        // Actually for getDateDetails we WANT to see them if we color them.

        const start = r.fechaEntrada.substring(0, 10);
        const end = r.fechaSalida.substring(0, 10);
        return dateStr >= start && dateStr <= end; // Inclusive
    });

    if (matches.length === 0) return { type: 'free', color: 'white' };

    // Analyze occupancy
    let hasStart = false; // Someone arriving
    let hasEnd = false;   // Someone leaving
    let hasFull = false;  // Occupied middle
    let status = 'reserved'; // default priority

    matches.forEach(r => {
        const start = r.fechaEntrada.substring(0, 10);
        const end = r.fechaSalida.substring(0, 10);

        if (r.estado === 'Activa' || r.estado === 'Ocupada') status = 'occupied';
        if (r.estado === 'Finalizada') status = 'finalized';

        if (dateStr > start && dateStr < end) hasFull = true;
        if (dateStr === start) hasStart = true;
        if (dateStr === end) hasEnd = true;
    });

    // Determine specific type
    if (hasFull) {
        if (status === 'finalized') return { type: 'full', color: '#94a3b8' }; // Gray
        return { type: 'full', color: status === 'occupied' ? 'green' : 'yellow' };
    }
    // Logic for splits with Finalized?
    // If Start is Finalized -> CheckIn-PM Gray? 
    // If End is Finalized -> CheckOut-AM Gray?
    // Complicated if mixing Statuses. Assuming simple dominance for now.

    if (hasStart && hasEnd) return { type: 'full-split', color: 'split' };

    if (hasStart) {
        let col = status === 'occupied' ? 'green' : 'yellow';
        if (status === 'finalized') col = '#94a3b8';
        return { type: 'checkin-pm', color: col };
    }
    if (hasEnd) {
        let col = status === 'occupied' ? 'green' : 'yellow';
        if (status === 'finalized') col = '#94a3b8';
        return { type: 'checkout-am', color: col };
    }

    return { type: 'free', color: 'white' };
}

function isDateBlocked(roomId, dateStr) {
    const details = getDateDetails(roomId, dateStr);
    return details.type === 'full' || details.type === 'full-split';
}

function isRangeBlocked(roomId, startStr, endStr) {
    // Check every day from start to end-1
    let curr = new Date(startStr);
    const end = new Date(endStr);

    while (curr < end) {
        const s = curr.toISOString().split('T')[0];
        // We only care if the date is fully blocked for a new reservation
        // If s is 'checkout-am', it's available as START (handled by start select)
        // If s is 'checkin-pm', it's available as END (handled by end select)

        // But for a range PASSING THROUGH 's', 's' must be completely free or compatible?
        // Actually, if we select Start=29 (Checkout AM) and End=31. 
        // 29 is 'checkout-am'. isDateBlocked(29) -> false (because it returns true only for full).
        // So loop passes 29. Correct.
        // 30 is Free. Loop passes. Correct.
        // 31 is End. Loop stops before 31. Correct.

        // What if 29 is 'full'? isDateBlocked -> true. Returns true. Blocked. Correct.

        if (isDateBlocked(roomId, s)) return true;
        curr.setDate(curr.getDate() + 1);
    }
    return false;
}

function renderDatePicker() {
    const container = document.getElementById('customDatePicker');
    const summary = document.getElementById('pickerSummary');

    if (!pickerState.roomId) {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#94a3b8;">Seleccione una habitación primero</div>';
        summary.style.display = 'none';
        return;
    }

    const year = pickerState.currentMonth.getFullYear();
    const month = pickerState.currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    let startDayCode = firstDay.getDay();
    startDayCode = startDayCode === 0 ? 6 : startDayCode - 1;

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Header
    let html = `
    <div class="pixel-calendar">
        <div class="pixel-header">
            <button type="button" onclick="changePickerMonth(-1)" class="btn-icon"><i class="fas fa-chevron-left"></i></button>
            <span>${monthNames[month]} ${year}</span>
            <button type="button" onclick="changePickerMonth(1)" class="btn-icon"><i class="fas fa-chevron-right"></i></button>
        </div>
        <div class="pixel-grid">
            <div class="pixel-day-header">L</div>
            <div class="pixel-day-header">M</div>
            <div class="pixel-day-header">X</div>
            <div class="pixel-day-header">J</div>
            <div class="pixel-day-header">V</div>
            <div class="pixel-day-header">S</div>
            <div class="pixel-day-header">D</div>
    `;

    // Empty Cells
    for (let i = 0; i < startDayCode; i++) {
        html += `<div class="pixel-day empty"></div>`;
    }

    // Days
    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        const iso = d.toISOString().split('T')[0];

        let classes = 'pixel-day';
        let onclick = `onclick="selectPickerDate('${iso}')"`;
        let style = '';

        // Check Status
        const details = getDateDetails(pickerState.roomId, iso);

        if (details.type === 'past') {
            classes += ' blocked';
            onclick = '';
        } else if (details.type === 'full' || details.type === 'full-split') {
            classes += (details.color === 'green' || details.color === 'split' ? ' status-occupied' : ' status-reserved');
            // Allow click to see logic, OR block?
            // selectPickerDate handles alerting.
        } else if (details.type === 'checkin-pm') {
            // Half? visual
            // Bottom half colored
            style = `background: linear-gradient(to bottom, white 50%, ${details.color === 'green' ? '#22c55e' : '#eab308'} 50%);`;
            // Add class for text color logic?
        } else if (details.type === 'checkout-am') {
            // Top half colored
            style = `background: linear-gradient(to bottom, ${details.color === 'green' ? '#22c55e' : '#eab308'} 50%, white 50%);`;
        }

        // Visual Lock for Start Date in Check-CheckIn Mode
        if (checkInMode === 'checkin' && pickerState.startDate === iso) {
            classes += ' selected locked-start';
            onclick = '';
        } else {
            // Normal Selected
            if (pickerState.startDate === iso || pickerState.endDate === iso) {
                classes += ' selected';
            }
        }

        // Range?
        if (pickerState.startDate && pickerState.endDate && iso > pickerState.startDate && iso < pickerState.endDate) {
            classes += ' in-range';
        }

        html += `<div class="${classes}" style="${style}" ${onclick}>${i}</div>`;
    }

    html += `</div></div>`;

    container.innerHTML = html;

    // Update Summary
    if (pickerState.startDate) {
        summary.style.display = 'block';
        if (pickerState.endDate) {
            summary.innerHTML = `📅 Del <b>${pickerState.startDate}</b> al <b>${pickerState.endDate}</b>`;
        } else {
            summary.innerHTML = `📅 Entrada: <b>${pickerState.startDate}</b> <span style="font-weight:normal; font-size:0.8em; color:#64748B;">(Seleccione salida)</span>`;
        }
    } else {
        summary.style.display = 'none';
    }
}

// ===== OPERATIONS VALIDATION =====
// checkInMode is defined at global scope


window.openCheckIn = function (roomId, roomNum) {
    checkInMode = 'checkin';
    const title = document.getElementById('modalTitleCheckIn');
    const btn = document.getElementById('btnSubmitCheckIn');
    if (title) title.innerHTML = '🏨 Check-In (Ingreso)';
    if (btn) {
        btn.innerText = 'Confirmar Ingreso';
        btn.style.background = 'var(--accent)'; // Orange/Red
    }
    setupCheckInModal(roomId, roomNum, null);
}

window.openReservation = function (roomId, roomNum, startDate, clientName, isExtension = false) {
    checkInMode = isExtension ? 'extension' : 'reservation';
    const title = document.getElementById('modalTitleCheckIn');
    const btn = document.getElementById('btnSubmitCheckIn');

    if (title) {
        title.innerHTML = isExtension ? '🔄 Extender Estadía (Continuar)' : '📅 Nueva Reserva';
    }

    if (btn) {
        btn.innerText = isExtension ? 'Confirmar Extensión' : 'Crear Reserva';
        // Force Green if Extension (#22c55e), Yellow if Reserve (#eab308)
        btn.style.background = isExtension ? '#22c55e' : '#eab308';
        btn.style.color = 'white';
    }

    // Determine correct Start Date for Extension (Active CheckOut)
    let finalStartDate = startDate;
    if (isExtension) {
        // Find active reservation check-out date
        const activeRes = currentReservationsList.find(res =>
            (String(res.habitacionId) === String(roomId) || String(res.habitacionId) === String(roomNum)) &&
            (res.estado === 'Activa' || res.estado === 'Ocupada')
        );
        if (activeRes) {
            // Cut off time part if exists
            finalStartDate = activeRes.fechaSalida.split(' ')[0] || activeRes.fechaSalida.substring(0, 10);
        }
    }

    setupCheckInModal(roomId, roomNum, finalStartDate);

    // Pre-fill Client Name if provided (e.g. extending stay)
    // Must be done AFTER setupCheckInModal because it calls form.reset()
    const clientInput = document.getElementById('checkInCliente');
    if (clientInput && clientName) {
        clientInput.value = clientName;
        // Lock Client Name if Extension
        if (isExtension) {
            clientInput.readOnly = true;
            clientInput.style.backgroundColor = '#e2e8f0'; // Gray out
            clientInput.title = "El nombre no se puede cambiar en una extensión.";
        } else {
            clientInput.readOnly = false;
            clientInput.style.backgroundColor = '';
        }
    }

    // Lock Start Date Logic if Extension
    // We handle this by setting picker state but we might need UI feedback or just prevent changing start.
    // For now, relies on user picking End Date, but if they click another start... 
    // Ideally we lock the start in the picker.
    if (isExtension && finalStartDate) {
        // We can visualize this lock in renderDatePicker if needed, 
        // or just rely on 'Locked Start' class if we add it.
        // Let's manually trigger the picker's "First click" state?
        // This requires exposing the picker state. 
        // Simplest: Just inform user "Seleccione la nueva fecha de salida".
    }
}

function setupCheckInModal(roomId, roomNum, preSelectedDate) {
    const form = document.getElementById('formCheckIn');
    form.reset();

    // UI Elements
    const roomLabel = document.getElementById('checkInRoomNum');
    const roomSelect = document.getElementById('checkInRoomSelect');
    const roomIdInput = document.getElementById('checkInRoomId');

    // 1. Setup Room Selection
    if (roomId) {
        roomIdInput.value = roomId;
        roomLabel.innerText = 'Habitación ' + roomNum;
        roomLabel.style.display = 'inline-block';
        roomSelect.style.display = 'none';

        // Init Picker for Room
        initDatePicker(roomId, preSelectedDate);
    } else {
        roomIdInput.value = '';
        roomLabel.style.display = 'none';
        roomSelect.style.display = 'block';

        // Populate
        let ops = '<option value="" disabled selected>-- Elija Habitación --</option>';
        if (typeof currentRoomsList !== 'undefined') {
            currentRoomsList.forEach(r => {
                // Strict Filter for Check-In Mode
                if (checkInMode === 'checkin' && r.estado === 'Ocupado') return; // Skip occupied

                ops += `<option value="${r.id}">Hab. ${r.numero} - ${r.tipo} (S/ ${r.precio})</option>`;
            });
        }
        roomSelect.innerHTML = ops;

        // On Change -> Update Picker Blocks
        roomSelect.onchange = function () {
            roomIdInput.value = this.value;
            initDatePicker(this.value);
        };

        // Init Empty Picker
        initDatePicker(null);
    }

    // Ensure blocks are loaded
    ensureReservationsLoaded();

    document.getElementById('modalCheckIn').style.display = 'flex';
}

function closeCheckIn() {
    document.getElementById('modalCheckIn').style.display = 'none';
}

async function processCheckIn(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    // const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Procesando...';
    submitBtn.disabled = true;

    // Safely get value even if disabled
    const fechaEntrada = document.getElementById('checkInEntrada').value;

    const data = {
        action: 'checkIn', // Default
        habitacionId: document.getElementById('checkInRoomId').value,
        cliente: document.getElementById('checkInCliente').value,
        fechaEntrada: fechaEntrada,
        fechaSalida: document.getElementById('checkInSalida').value,
        notas: document.getElementById('checkInNotas').value,
        isReservation: (checkInMode === 'reservation'),
        isExtension: (checkInMode === 'extension')
    };

    // Extension Logic Override
    if (data.isExtension) {
        data.action = 'extendReservation';
        data.newCheckOutDate = data.fechaSalida;
    }

    if ((!data.isExtension && !data.fechaEntrada) || !data.fechaSalida || !data.cliente) {
        alert('Por favor complete todos los campos.');
        submitBtn.innerText = 'Confirmar'; // Reset
        submitBtn.disabled = false;
        return;
    }

    // Modal close
    closeCheckIn();
    document.getElementById('modalCheckIn').classList.remove('active');

    // OPTIMISTIC UPDATE
    if (data.isExtension) {
        const activeRes = currentReservationsList.find(r =>
            (String(r.habitacionId) === String(data.habitacionId) || String(r.habitacionNumero) === String(data.habitacionId)) &&
            (r.estado === 'Activa' || r.estado === 'Ocupada')
        );
        if (activeRes) {
            // Update locally to reflect change immediately
            activeRes.fechaSalida = data.fechaSalida + ' 11:00';
            // Also need to update the grid view?
            // renderCalendar() will pick this up.
        }
    } else {
        const tempId = 'TEMP-' + new Date().getTime();
        let tempStatus = 'Activa';
        if (data.isReservation) tempStatus = 'Reserva';

        const newRes = {
            id: tempId,
            habitacionId: data.habitacionId,
            cliente: data.cliente,
            fechaEntrada: data.fechaEntrada + ' 14:00',
            fechaSalida: data.fechaSalida + ' 11:00',
            estado: tempStatus,
            notas: data.notas
        };
        currentReservationsList.push(newRes);

        if (!data.isReservation) {
            const roomIdx = currentRoomsList.findIndex(r => r.id == data.habitacionId);
            if (roomIdx !== -1) {
                currentRoomsList[roomIdx].estado = 'Ocupado';
                currentRoomsList[roomIdx].cliente = data.cliente;
            }
        }
    }

    // Update UI
    if (document.getElementById('view-calendar').style.display === 'block') {
        renderCalendarTimeline(currentRoomsList, currentReservationsList);
    } else {
        renderRooms(); // Assumes this function exists and works
    }

    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await response.json();

        if (result.success) {
            alert(data.isExtension ? '¡Estadía extendida correctamente!' : (data.isReservation ? '¡Reserva creada!' : '¡Check-In exitoso!'));
            // Reload real data
            loadReservations();
            loadRooms();
        } else {
            alert('Error: ' + result.error);
            // Revert optimistic?
            loadReservations();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error de conexión');
    } finally {
        submitBtn.innerText = 'Confirmar'; // Reset text just in case re-opened
        submitBtn.disabled = false;
    }
}



// ===== LIQUIDATION & FINANCE LOGIC (PHASE 7) =====

// Helper to check session
function checkSession() {
    if (!currentUser) {
        // Try to restore from storage
        const token = sessionStorage.getItem('gps_token');
        const user = sessionStorage.getItem('gps_user');
        if (token && user) {
            currentUser = JSON.parse(user);
            return true;
        } else {
            alert('Sesión expirada. Inicie sesión nuevamente.');
            showLogin();
            return false;
        }
    }
    return true;
}

// Alias for existing buttons
window.openCheckOut = function (roomId) {
    if (!checkSession()) return;
    openLiquidation(roomId);
}

// Global state for current liquidation
let currentLiqData = null;

async function openLiquidation(roomId) {
    if (!currentRoomsList || currentRoomsList.length === 0) {
        // Try fetch if missing
        try {
            const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getHabitaciones' }) });
            const data = await res.json();
            if (data.success) currentRoomsList = data.habitaciones;
        } catch (e) { console.error(e); }
    }
    const room = currentRoomsList ? currentRoomsList.find(r => r.id == roomId) : null;
    if (!room) return alert('Error: No se encontró la habitación localmente. Recarga la página.');

    document.getElementById('liqRoomId').value = roomId;
    document.getElementById('liqRoomTitle').innerText = `Habitación ${room.numero} - ${room.tipo}`;

    // Show Modal
    document.getElementById('modalLiquidation').style.display = 'flex';
    document.getElementById('modalLiquidation').classList.add('active');

    // Load Data
    loadLiquidationData(roomId);
}

function closeLiquidation() {
    document.getElementById('modalLiquidation').style.display = 'none';
    document.getElementById('modalLiquidation').classList.remove('active');
    currentLiqData = null;
}

async function loadLiquidationData(roomId) {
    // Show loading indicators
    document.getElementById('tableChargesBody').innerHTML = '<tr><td colspan="2" style="text-align:center; padding:20px;">Cargando estado de cuenta...</td></tr>';
    document.getElementById('tablePaymentsBody').innerHTML = '<tr><td colspan="2" style="text-align:center; padding:20px;">Cargando pagos...</td></tr>';

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getAccountStatement', habitacionId: roomId })
        });
        const data = await res.json();

        if (data.success) {
            currentLiqData = data.statement;
            renderLiquidation(data.statement);
        } else {
            document.getElementById('tableChargesBody').innerHTML = `<tr><td colspan="2" style="color:red; text-align:center;">${data.error}</td></tr>`;
            // Disable finalize if no active reservation found
            if (data.error.includes('No se encontró')) {
                document.getElementById('btnFinalizeCheckout').disabled = true;
                document.getElementById('btnFinalizeCheckout').style.background = '#94a3b8';
            }
        }
    } catch (e) {
        console.error(e);
        alert('Error conectando con servidor financiero');
    }
}

function renderLiquidation(statement) {
    document.getElementById('liqResId').value = statement.reservation ? statement.reservation.id : '';
    document.getElementById('btnFinalizeCheckout').disabled = false;
    document.getElementById('btnFinalizeCheckout').style.background = 'var(--accent)';

    // 1. CHARGES
    let htmlCharges = '';

    // Stay
    htmlCharges += `
    <tr style="background:#e0f2fe;">
        <td style="padding:10px; font-weight:600; color:#0369a1;">${statement.stay.descripcion}</td>
        <td style="text-align:right; padding:10px; font-weight:bold; color:#0369a1;">S/ ${statement.stay.monto.toFixed(2)}</td>
    </tr>`;

    // Internals
    statement.internals.forEach(c => {
        htmlCharges += `
        <tr>
            <td style="padding:10px; border-bottom:1px solid #f1f5f9;">
                <div style="font-weight:500;">${c.descripcion}</div>
                <div style="font-size:0.75rem; color:#64748B;">${new Date(c.fecha).toLocaleDateString()} - ${c.tipo}</div>
            </td>
            <td style="text-align:right; padding:10px; border-bottom:1px solid #f1f5f9;">S/ ${c.monto.toFixed(2)}</td>
        </tr>`;
    });

    // Externals
    statement.externals.forEach(c => {
        htmlCharges += `
        <tr>
            <td style="padding:10px; border-bottom:1px solid #f1f5f9; color:#4b5563;">
                 <div style="font-weight:500;">${c.descripcion}</div>
                 <div style="font-size:0.75rem; color:#94a3b8;">Servicio Externo (CasaMunay)</div>
            </td>
            <td style="text-align:right; padding:10px; border-bottom:1px solid #f1f5f9;">S/ ${c.monto.toFixed(2)}</td>
        </tr>`;
    });

    document.getElementById('tableChargesBody').innerHTML = htmlCharges;
    document.getElementById('valTotalConsumos').innerText = `S/ ${statement.totals.consumption.toFixed(2)}`;


    // 2. PAYMENTS
    let htmlPay = '';
    if (statement.payments.length === 0) {
        htmlPay = '<tr><td colspan="2" style="text-align:center; padding:15px; color:#94a3b8; font-style:italic;">No hay pagos registrados</td></tr>';
    } else {
        statement.payments.forEach(p => {
            htmlPay += `
            <tr>
                <td style="padding:8px; border-bottom:1px solid #dcfce7;">
                    <div>${new Date(p.fecha).toLocaleDateString()}</div>
                    <div style="font-size:0.8rem; font-weight:bold; color:#15803d;">${p.metodo}</div>
                </td>
                <td style="text-align:right; padding:8px; border-bottom:1px solid #dcfce7;">S/ ${p.monto.toFixed(2)}</td>
            </tr>`;
        });
    }
    document.getElementById('tablePaymentsBody').innerHTML = htmlPay;

    // 3. BALANCE
    const bal = statement.totals.balance;
    const balanceEl = document.getElementById('valBalance');
    balanceEl.innerText = `S/ ${bal.toFixed(2)}`;

    if (Math.abs(bal) < 0.1) {
        balanceEl.style.color = '#22c55e'; // Green (Paid)
        balanceEl.innerText = 'S/ 0.00 (Pagado)';
    } else if (bal > 0) {
        balanceEl.style.color = '#ef4444'; // Red (Debt)
    } else {
        balanceEl.style.color = '#3b82f6'; // Blue (Refund?)
    }
}

// === ACTIONS ===

function showAddConsumptionForm() {
    const form = document.getElementById('formAddConsumo');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function submitConsumo() {
    const desc = document.getElementById('newConsDesc').value;
    const monto = document.getElementById('newConsMonto').value;
    const resId = document.getElementById('liqResId').value;

    if (!desc || !monto || !resId) return alert('Complete los datos');

    // Optimistic Add (to list) could be done, but reload is safer for totals
    try {
        await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveConsumo',
                reservaId: resId,
                tipo: 'Producto Interno',
                descripcion: desc,
                monto: monto,
                cantidad: 1
            })
        });
        document.getElementById('newConsDesc').value = '';
        document.getElementById('newConsMonto').value = '';
        document.getElementById('formAddConsumo').style.display = 'none';
        loadLiquidationData(document.getElementById('liqRoomId').value); // Reload
    } catch (e) { alert('Error guardando'); }
}

async function submitPago() {
    const monto = document.getElementById('payMonto').value;
    const metodo = document.getElementById('payMetodo').value;
    const resId = document.getElementById('liqResId').value;

    if (!monto || !resId) return alert('Ingrese monto');

    try {
        await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'savePago',
                reservaId: resId,
                monto: monto,
                metodo: metodo
            })
        });
        document.getElementById('payMonto').value = '';
        loadLiquidationData(document.getElementById('liqRoomId').value); // Reload
    } catch (e) { alert('Error guardando pago'); }
}

function printVoucher() {
    if (!currentLiqData) return;

    // Generate simple thermal-like HTML in new window
    const w = window.open('', '_blank', 'width=400,height=600');

    const d = currentLiqData;
    const itemsHtml = d.internals.map(i => `<tr><td>${i.descripcion}</td><td align="right">${i.monto.toFixed(2)}</td></tr>`).join('') +
        d.externals.map(e => `<tr><td>${e.descripcion}</td><td align="right">${e.monto.toFixed(2)}</td></tr>`).join('');

    const html = `
    <html>
    <head>
        <title>Voucher Grupo PS</title>
        <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 10px; }
            .header { text-align: center; border-bottom: 1px dashed black; padding-bottom: 10px; margin-bottom: 10px; }
            .totals { border-top: 1px dashed black; margin-top: 10px; padding-top: 10px; }
            table { width: 100%; }
        </style>
    </head>
    <body onload="window.print()">
        <div class="header">
            <strong>GRUPO PS HOTEL</strong><br>
            RUC: 20123456789<br>
            ----------------<br>
            Cliente: ${d.reservation.cliente}<br>
            Habitación: ${d.reservation.habitacionId}<br>
            Fecha: ${new Date().toLocaleDateString()}
        </div>
        
        <table>
            <tr><td><strong>Concepto</strong></td><td align="right"><strong>Total</strong></td></tr>
            <tr><td>${d.stay.descripcion}</td><td align="right">${d.stay.monto.toFixed(2)}</td></tr>
            ${itemsHtml}
        </table>
        
        <div class="totals">
            <table>
                <tr><td><strong>TOTAL:</strong></td><td align="right"><strong>S/ ${d.totals.consumption.toFixed(2)}</strong></td></tr>
                <tr><td>PAGADO:</td><td align="right">S/ ${d.totals.paid.toFixed(2)}</td></tr>
                <tr><td>SALDO:</td><td align="right">S/ ${d.totals.balance.toFixed(2)}</td></tr>
            </table>
        </div>
        
        <div style="text-align:center; margin-top:20px;">
            ¡Gracias por su visita!
        </div>
    </body>
    </html>
    `;

    w.document.write(html);
    w.document.close();
}

async function finalizeCheckOut() {
    if (!confirm('¿CONFIRMAR SALIDA DEFINITIVA?\nEsto marcará la habitación como SUCIA y cerrará la cuenta.')) return;

    const roomId = document.getElementById('liqRoomId').value;
    const btn = document.getElementById('btnFinalizeCheckout');
    btn.innerText = 'Procesando...';
    btn.disabled = true;

    try {
        // Reuse legacy action but simplified
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'checkOut',
                habitacionId: roomId,
                fechaSalidaReal: new Date().toISOString(), // Use current time
                notas: 'Checkout Finalizado via Liquidador'
            })
        });
        const r = await res.json();
        if (r.success) {
            alert('✅ Checkout Completado.');
            closeLiquidation();
            loadRooms(); // Refresh main view to show 'Sucio'
        } else {
            alert('Error: ' + r.error);
        }
    } catch (e) {
        alert('Error de conexión');
    } finally {
        btn.innerText = 'Finalizar Estadía (Check-Out)';
        btn.disabled = false;
    }
}

// ===== USERS MODULE =====
let currentUsersList = [];

async function markRoomClean(roomId) {
    if (!confirm('¿Marcar habitación como LIMPIA y DISPONIBLE?')) return;

    // Optimistic Update
    const rIdx = currentRoomsList.findIndex(r => r.id == roomId);
    if (rIdx !== -1) {
        currentRoomsList[rIdx].estado = 'Disponible';
        renderRooms(currentRoomsList); // Refresh UI immediately (Fixed: passed arg)
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveHabitacion',
                habitacion: { id: roomId, estado: 'Disponible' }
            })
        });
        const data = await res.json();
        if (!data.success) {
            alert('Error al guardar: ' + data.error);
            loadRooms(); // Revert
        } else {
            // Success silent
            loadRooms();
        }
    } catch (e) {
        alert('Error de conexión');
    }
}

async function loadUsersView() {
    const container = document.getElementById('view-users');

    if (currentUsersList.length > 0) {
        renderUsers(currentUsersList);
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top:15px; color:#64748B;">Cargando usuarios...</p>
            </div>
        `;
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUsuarios' })
        });
        const data = await res.json();

        if (data.success) {
            currentUsersList = data.usuarios;
            renderUsers(data.usuarios);
        } else if (currentUsersList.length === 0) {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${data.error}</div>`;
        }
    } catch (e) {
        if (currentUsersList.length === 0) {
            container.innerHTML = `<div style="color:red; text-align:center;">Error de conexión: ${e.message}</div>`;
        }
    }
}

function renderUsers(users) {
    const container = document.getElementById('view-users');

    let html = `
    <div style="display:flex; justify-content:flex-end; margin-bottom:20px;">
        <button class="btn-login" style="width:auto;" onclick="openNewUser()">+ Nuevo Usuario</button>
    </div>
    <div style="background:white; border-radius:var(--radius-l); padding:20px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
        <table style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="text-align:left; color:#64748B; border-bottom:2px solid #f1f5f9;">
                    <th style="padding:15px;">Nombre</th>
                    <th style="padding:15px;">Email</th>
                    <th style="padding:15px;">Rol</th>
                    <th style="padding:15px;">Estado</th>
                    <th style="padding:15px;">Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    users.forEach(u => {
        let roleColor = '#64748B';
        if (u.rol === 'Admin') roleColor = 'var(--primary)';
        if (u.rol === 'Tours') roleColor = 'var(--accent)';

        let statusBadge = u.estado === 'Activo'
            ? `<span style="background:#dcfce7; color:#166534; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:600;">Activo</span>`
            : `<span style="background:#f1f5f9; color:#64748B; padding:4px 8px; border-radius:6px; font-size:0.8rem; font-weight:600;">Inactivo</span>`;

        html += `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:15px; font-weight:600;">${u.nombre}</td>
            <td style="padding:15px;">${u.email}</td>
            <td style="padding:15px; color:${roleColor}; font-weight:bold;">${u.rol}</td>
            <td style="padding:15px;">${statusBadge}</td>
            <td style="padding:15px;">
                <button class="btn-icon" onclick="editUser('${u.id}')"><i class="fas fa-edit"></i></button>
            </td>
        </tr>
        `;
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function openNewUser() {
    document.getElementById('editUserId').value = '';
    document.getElementById('editUserNombre').value = '';
    document.getElementById('editUserEmail').value = '';
    document.getElementById('editUserPass').value = '';
    document.getElementById('editUserRol').value = 'Recepcion';
    document.getElementById('editUserEstado').value = 'Activo';
    document.getElementById('modalUserEditor').style.display = 'flex';
}

function editUser(id) {
    const user = currentUsersList.find(u => u.id == id);
    if (!user) return;

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserNombre').value = user.nombre;
    document.getElementById('editUserEmail').value = user.email;
    document.getElementById('editUserPass').value = ''; // Blank to keep existing
    document.getElementById('editUserRol').value = user.rol;
    document.getElementById('editUserEstado').value = user.estado;

    document.getElementById('modalUserEditor').style.display = 'flex';
}

function closeUserEditor() {
    document.getElementById('modalUserEditor').style.display = 'none';
}

async function saveUser(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;

    // 1. Get Data
    const id = document.getElementById('editUserId').value;
    const userData = {
        id: id,
        nombre: document.getElementById('editUserNombre').value,
        email: document.getElementById('editUserEmail').value,
        password: document.getElementById('editUserPass').value,
        rol: document.getElementById('editUserRol').value,
        estado: document.getElementById('editUserEstado').value,
    };

    // 2. Optimistic Update
    if (id) {
        // Edit
        const index = currentUsersList.findIndex(u => u.id == id);
        if (index !== -1) {
            currentUsersList[index] = { ...currentUsersList[index], ...userData };
        }
    } else {
        // New
        currentUsersList.push({ ...userData, id: 'temp-' + Date.now() });
    }

    // Render & Close
    renderUsers(currentUsersList);
    closeUserEditor();

    // 3. Background Sync
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveUsuario', usuario: userData })
        });
        const data = await res.json();

        if (!data.success) {
            alert('❌ Error guardando en servidor: ' + data.error);
            loadUsersView();
        } else {
            loadUsersView(); // Silent refresh
        }
    } catch (err) {
        alert('❌ Error de conexión: ' + err.message);
        loadUsersView();
    }
}


// ===== PRODUCTS MODULE =====
let currentProductsList = [];
let currentServicesList = []; // [PHASE 9]
let qcSelectedPrice = 0; // [PHASE 9]
let currentProductFilter = 'Todos';

async function loadProductsView() {
    const container = document.getElementById('view-products');

    // Optimistic
    if (currentProductsList.length > 0) {
        renderProducts(currentProductsList);
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top:15px; color:#64748B;">Cargando inventario...</p>
            </div>
        `;
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getProductos' })
        });
        const data = await res.json();

        if (data.success) {
            currentProductsList = data.productos;
            renderProducts(data.productos);
        } else if (currentProductsList.length === 0) {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${data.error}</div>`;
        }
    } catch (e) {
        if (currentProductsList.length === 0) {
            container.innerHTML = `<div style="color:red; text-align:center;">Error de conexión: ${e.message}</div>`;
        }
    }
}

function renderProducts(products) {
    const container = document.getElementById('view-products');

    // Group by category for cleaner view if needed, but table is fine for now
    const btnClass = (cat) => currentProductFilter === cat ? 'btn-login filter-btn-active' : 'btn-login';

    let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
        <div style="display:flex; gap:10px;">
             <button class="${btnClass('Todos')}" style="width:auto; background:#64748B;" onclick="filterProducts('Todos')">Todos</button>
             <button class="${btnClass('Snacks')}" style="width:auto; background:#eab308;" onclick="filterProducts('Snacks')">Snacks</button>
             <button class="${btnClass('Bebidas')}" style="width:auto; background:#3b82f6;" onclick="filterProducts('Bebidas')">Bebidas</button>
             <button class="${btnClass('Otros')}" style="width:auto; background:#8b5cf6;" onclick="filterProducts('Otros')">Otros</button>
        </div>
        <button class="btn-login" style="width:auto;" onclick="openNewProduct()">+ Nuevo Producto</button>
    </div>
    
    <div style="background:white; border-radius:var(--radius-l); padding:20px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
        <table style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="text-align:left; color:#64748B; border-bottom:2px solid #f1f5f9;">
                    <th style="padding:15px;">Img</th>
                    <th style="padding:15px;">Producto</th>
                    <th style="padding:15px;">Categoría</th>

                    <th style="padding:15px;">Precio</th>
                    <th style="padding:15px;">Stock</th>
                    <th style="padding:15px;">Estado</th>
                    <th style="padding:15px;">Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    products.forEach(p => {
        let catColor = '#64748B';
        if (p.categoria === 'Otros') catColor = '#8b5cf6'; // Purple
        if (p.categoria === 'Bebidas') catColor = '#3b82f6';
        if (p.categoria === 'Snacks') catColor = '#eab308';

        let imgTag = p.imagen_url ? `<img src="${p.imagen_url}" style="width:40px; height:40px; border-radius:4px; object-fit:cover;">` : '<div style="width:40px; height:40px; background:#f1f5f9; border-radius:4px;"></div>';

        html += `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:15px;">${imgTag}</td>
            <td style="padding:15px;">
                <div style="font-weight:600;">${p.nombre}</div>
                <div style="font-size:0.8rem; color:#94a3b8;">${p.descripcion || ''}</div>
            </td>
            <td style="padding:15px;"><span style="color:${catColor}; font-weight:bold;">${p.categoria}</span></td>
            
            <td style="padding:15px;">S/ ${Number(p.precio).toFixed(2)}</td>
            <td style="padding:15px; font-weight:bold;">${p.stock}</td>
            <td style="padding:15px;">${p.activo}</td>

            <td style="padding:15px; display:flex; gap:10px;">
                <button class="btn-icon" onclick="openProductAnalysis('${p.id}')" title="Análisis Logístico" style="color:#0ea5e9; background:#f0f9ff;"><i class="fas fa-chart-line"></i></button>
                <button class="btn-adjust" onclick="openStockAdjustment('${p.id}')" title="Ajuste de Stock"><i class="fas fa-wrench"></i></button>
                <button class="btn-icon" onclick="editProduct('${p.id}')" title="Editar Producto"><i class="fas fa-edit"></i></button>
            </td>
        </tr>
        `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function filterProducts(cat) {
    currentProductFilter = cat;
    if (cat === 'Todos') {
        renderProducts(currentProductsList);
    } else {
        const filtered = currentProductsList.filter(p => p.categoria === cat);
        renderProducts(filtered);
    }
}

function openNewProduct() {
    document.getElementById('editProdId').value = '';
    document.getElementById('editProdCat').value = 'Bebidas';
    document.getElementById('editProdNombre').value = '';
    document.getElementById('editProdDesc').value = '';
    document.getElementById('editProdPrecio').value = '';
    document.getElementById('editProdStock').value = '';
    document.getElementById('editProdImg').value = '';
    document.getElementById('editProdActivo').value = 'Activo';

    // Reset File Input & Preview
    document.getElementById('editProdFile').value = '';
    document.getElementById('imgPreview').src = '';
    document.getElementById('imagePreviewContainer').style.display = 'none';

    document.getElementById('modalProductEditor').style.display = 'flex';
}

function editProduct(id) {
    const p = currentProductsList.find(x => x.id == id);
    if (!p) return;

    document.getElementById('editProdId').value = p.id;
    document.getElementById('editProdCat').value = p.categoria;
    document.getElementById('editProdNombre').value = p.nombre;
    document.getElementById('editProdDesc').value = p.descripcion;
    document.getElementById('editProdPrecio').value = p.precio;
    document.getElementById('editProdStock').value = p.stock;
    document.getElementById('editProdImg').value = p.imagen_url;
    document.getElementById('editProdActivo').value = p.activo;

    // Reset File Input
    document.getElementById('editProdFile').value = '';

    // Show Preview if URL exists
    if (p.imagen_url) {
        document.getElementById('imgPreview').src = p.imagen_url;
        document.getElementById('imagePreviewContainer').style.display = 'block';
    } else {
        document.getElementById('imagePreviewContainer').style.display = 'none';
        document.getElementById('imgPreview').src = '';
    }

    document.getElementById('modalProductEditor').style.display = 'flex';
}

function previewImageUpload(input) {
    const preview = document.getElementById('imgPreview');
    const container = document.getElementById('imagePreviewContainer');

    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
            preview.src = e.target.result;
            container.style.display = 'block';
        }
        reader.readAsDataURL(input.files[0]);
    } else {
        // Keep old image if cancelled? Or clear? 
        // Usually if user cancels file dialog, value remains empty.
        // We'll rely on the hidden input for the 'current' valid URL.
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function closeProductEditor() {
    document.getElementById('modalProductEditor').style.display = 'none';
}

async function saveProduct(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = "Guardar"; // Hardcode or btn.innerText, but better to be safe

    // Start Loading State
    btn.disabled = true;

    // 1. Get Data
    const id = document.getElementById('editProdId').value;
    const prodData = {
        id: id,
        categoria: document.getElementById('editProdCat').value,
        nombre: document.getElementById('editProdNombre').value,
        descripcion: document.getElementById('editProdDesc').value,
        precio: document.getElementById('editProdPrecio').value,
        stock: document.getElementById('editProdStock').value,
        imagen_url: document.getElementById('editProdImg').value,
        activo: document.getElementById('editProdActivo').value,
    };

    try {
        // 1.5 Handle Image Upload
        const fileInput = document.getElementById('editProdFile');
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            btn.innerText = 'Subiendo Imagen...';

            const base64 = await fileToBase64(file);
            const uploadRes = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'uploadImage',
                    base64: base64,
                    filename: file.name,
                    mimeType: file.type || 'image/png'
                })
            });
            const uploadData = await uploadRes.json();

            if (uploadData.success) {
                prodData.imagen_url = uploadData.url;
                document.getElementById('editProdImg').value = uploadData.url;
            } else {
                throw new Error('Error subiendo imagen: ' + uploadData.error);
            }
        } else {
            prodData.imagen_url = document.getElementById('editProdImg').value;
        }

        // 2. Change Button to "Saving"
        btn.innerText = 'Guardando...';

        // 2.5 Optimistic Update
        if (id) {
            const index = currentProductsList.findIndex(p => p.id == id);
            if (index !== -1) {
                currentProductsList[index] = { ...currentProductsList[index], ...prodData };
            }
        } else {
            currentProductsList.push({ ...prodData, id: 'temp-' + Date.now() });
        }
        renderProducts(currentProductsList);
        closeProductEditor(); // We close it optimistically. 
        // IF we want to block until finish, we should NOT close here.
        // User request: "que no se pueda usar hasta que termine". 
        // Maybe keeping it open until success is safer? 
        // The user complained: "luego el formulario queda abierto y nose si esta guardandose".
        // So keeping it open WITH "Guardando..." is good. 
        // Optimistic close might be confusing if error happens.
        // Let's NOT close immediately. Let's wait for success.

        // 3. Background Sync (Now Foreground for UX safety)
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveProducto', producto: prodData })
        });
        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error);
        } else {
            // Success
            loadProductsView();
            // Now close
            // But if we didn't close earlier, the list was not updated?
            // Wait, previous code closed optimistically.
            // If I wait, I should NOT do optimistic render, or do it but kept modal open?
            // Best UX: "Guardando..." -> Success -> Modal Close.
            closeProductEditor();
            showToast('✅ Producto Guardado');
        }

    } catch (err) {
        alert('❌ Error: ' + err.message);
        btn.innerText = originalText;
        btn.disabled = false;
        // Don't close modal on error
    } finally {
        // If success, modal is closed. If error, button is reset.
        // Check if modal still open to reset button just in case?
        if (document.getElementById('modalProductEditor').style.display !== 'none') {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

// ===== CALENDAR MODULE (PHASE 6) =====
let calendarStartDate = new Date();

async function loadCalendarView() {
    const container = document.getElementById('view-calendar');

    // 1. Optimistic Render
    if ((currentRoomsList && currentRoomsList.length > 0) && (currentReservationsList && currentReservationsList.length > 0)) {
        renderCalendarTimeline(currentRoomsList, currentReservationsList);
    } else {
        container.innerHTML = `
            <div style="text-align:center; padding: 50px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
                <p style="margin-top:15px;" class="text-slate-500">Cargando calendario...</p>
            </div>
        `;
    }

    try {
        // 2. Silent Parallel Fetch
        const [resRooms, resRes] = await Promise.all([
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getHabitaciones' }) }).then(r => r.json()),
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getReservas' }) }).then(r => r.json())
        ]);

        if (resRooms.success && resRes.success) {
            currentRoomsList = resRooms.habitaciones;
            currentReservationsList = resRes.reservas; // Ensure sync
            renderCalendarTimeline(currentRoomsList, currentReservationsList);
        } else if (currentRoomsList.length === 0) {
            throw new Error('Error cargando datos');
        }

    } catch (e) {
        if (currentRoomsList.length === 0) {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${e.message}</div>`;
        }
    }
}

function changeCalendarDate(days) {
    calendarStartDate.setDate(calendarStartDate.getDate() + days);
    loadCalendarView();
}

function renderCalendarTimeline(rooms, reservations) {
    const container = document.getElementById('view-calendar');

    // Phase 12: Premium Concierge Calendar
    // Config: Show next 15 days
    const daysToShow = 15;
    const dates = [];
    const start = new Date(calendarStartDate);

    for (let i = 0; i < daysToShow; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        dates.push(d);
    }

    // Colors
    const colorActive = '#22c55e'; // Green
    const colorFuture = '#eab308'; // Yellow
    const colorPast = '#64748b'; // Slate (Finalized)

    let html = `
    <div class="calendar-container">
        <!-- Sticky Header Context -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:white; position:sticky; top:0; left:0; z-index:40; border-bottom:1px solid #f1f5f9;">
            <div style="display:flex; gap:10px; align-items:center;">
                <button onclick="changeCalendarDate(-15)" style="border:1px solid #cbd5e1; background:white; padding:5px 10px; border-radius:6px; cursor:pointer;"><i class="fas fa-chevron-left"></i></button>
                <h2 style="color:var(--primary); font-size:1.5rem; margin:0;">Oc. ${start.toLocaleDateString()}</h2>
                <button onclick="changeCalendarDate(15)" style="border:1px solid #cbd5e1; background:white; padding:5px 10px; border-radius:6px; cursor:pointer;"><i class="fas fa-chevron-right"></i></button>
            </div>
            
            <div style="display:flex; align-items:center; gap:20px;">
                <div style="font-size:0.9rem; color:#64748B;">
                    <span style="display:inline-block; width:12px; height:12px; background:${colorActive}; border-radius:50%; margin-right:5px;"></span>Ocupado
                    <span style="display:inline-block; width:12px; height:12px; background:${colorFuture}; border-radius:50%; margin-right:5px; margin-left:10px;"></span>Reservado
                    <span style="display:inline-block; width:12px; height:12px; background:${colorPast}; border-radius:50%; margin-right:5px; margin-left:10px;"></span>Finalizado
                </div>
                <div style="display:flex; gap:10px;">
                     <button onclick="openCheckIn('', '')" style="background:#22c55e; color:white; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:5px;"><i class="fas fa-check-circle"></i> Check-In</button>
                </div>
            </div>
        </div>

        <table style="width:100%; border-collapse:collapse; min-width:800px;">
            <thead>
                <tr>
                    <th class="sticky-header sticky-col" style="padding:10px; text-align:left; border-bottom:2px solid #e2e8f0; width:100px;">Hab.</th>
                    ${dates.map(d => {
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
        const dayNum = d.getDate();
        const fullIso = d.toISOString().split('T')[0];
        const todayIso = new Date().toISOString().split('T')[0];
        const isToday = fullIso === todayIso;

        return `<th class="sticky-header ${isToday ? 'today-highlight' : ''}" style="padding:10px; text-align:center; border-bottom:2px solid #e2e8f0; font-size:0.85rem; color:#64748B;">
                                    <div>${dayName}</div>
                                    <div style="font-weight:bold; font-size:1.1rem; color:var(--text-main);">${dayNum}</div>
                                </th>`;
    }).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    rooms.forEach(r => {
        html += `<tr style="border-bottom:1px solid #f1f5f9;">
                    <td class="sticky-col" style="padding:15px 10px; font-weight:bold; color:var(--primary); cursor:pointer;" onclick="openRoomDetail('${r.id}')" title="Ver detalle">
                        ${r.numero} <br>
                        <span style="font-size:0.7rem; color:#94a3b8; font-weight:normal;">${r.tipo}</span>
                    </td>`;

        dates.forEach(date => {
            const isoDate = date.toISOString().split('T')[0];
            const todayIso = new Date().toISOString().split('T')[0];
            const isToday = isoDate === todayIso;

            // Highlight Column
            const tdClass = isToday ? 'today-highlight' : '';

            // Logic for Reservation Matching
            let activeRes = null;
            let barType = ''; // 'start', 'mid', 'end', 'single'
            let barColor = '';
            let barLabel = '';
            let barId = '';

            // Find reservation covering this day (Proportional Logic)
            const matches = reservations.filter(res => {
                if (String(res.habitacionId) !== String(r.id) && String(res.habitacionId) !== String(r.numero)) return false;
                if (res.estado === 'Cancelada') return false;

                const s = res.fechaEntrada.substring(0, 10);
                const e = res.fechaSalida.substring(0, 10);

                return isoDate >= s && isoDate <= e;
            });

            if (matches.length > 0) {
                const res = matches[0];
                barId = res.id;

                const s = res.fechaEntrada.substring(0, 10);
                const e = res.fechaSalida.substring(0, 10);

                // Color Logic
                let col = colorFuture; // Default Yellow
                if (res.estado === 'Activa' || res.estado === 'Ocupada') col = colorActive;
                if (res.estado === 'Finalizada') col = colorPast;

                barColor = col;

                // Determine Bar Shape (Proportional)
                if (s === e) {
                    barType = 'res-bar-single';
                    barLabel = (res.cliente || '').split(' ')[0];
                } else if (isoDate === s) {
                    barType = 'res-bar-start'; // Starts at 50%
                    barLabel = (res.cliente || '').split(' ')[0];
                } else if (isoDate === e) {
                    barType = 'res-bar-end'; // Ends at 50%
                } else {
                    barType = 'res-bar-mid';
                    // Repeat name if it's the first visible day of a long booking
                    if (isoDate === dates[0].toISOString().split('T')[0]) {
                        barLabel = (res.cliente || '').split(' ')[0];
                    }
                }

                if (!barLabel && barType === 'res-bar-single') barLabel = (res.cliente || '').split(' ')[0];

                html += `<td class="${tdClass}" style="padding:5px;">
                            <div class="res-bar-base ${barType}" style="background:${barColor};" onclick="openReservationDetail('${barId}')" title="${res.cliente} (${res.estado})">
                                ${barLabel}
                            </div>
                         </td>`;
            } else {
                // Empty - Click to add new
                html += `<td class="${tdClass}" style="padding:5px; text-align:center;">
                            <div onclick="openNewReservation('${r.id}', '${r.numero}', '${isoDate}')" style="height:30px; border-radius:6px; cursor:pointer;" class="cell-hover" title="Nueva Reserva"></div>
                        </td>`;
            }
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>
    <style>.cell-hover:hover{background:#bfdbfe !important;}</style>
    `;

    container.innerHTML = html;
}

// ===== ROOM DETAIL CARD LOGIC =====
function openRoomDetail(roomId) {
    const r = currentRoomsList.find(x => x.id == roomId);
    if (!r) return;

    // Elements
    const img = document.getElementById('rdImg');
    const badge = document.getElementById('rdStatus');
    const title = document.getElementById('rdTitle');
    const type = document.getElementById('rdType');
    const price = document.getElementById('rdPrice');
    const cap = document.getElementById('rdCap');
    const beds = document.getElementById('rdBeds');
    const actions = document.getElementById('rdActions');

    // Lookup Active Reservation for Client Name
    // Relaxed match: ID or Number, Status Activa OR Ocupada
    let clientName = '';
    const activeRes = currentReservationsList.find(res =>
        (String(res.habitacionId) === String(r.id) || String(res.habitacionId) === String(r.numero)) &&
        (res.estado === 'Activa' || res.estado === 'Ocupada')
    );
    if (activeRes) clientName = activeRes.cliente;
    // Fallback: Check if room has "reservado" status but 'Reserva' object?
    if (!clientName && r.estado === 'ocupado') {
        // Maybe manual check-in stored elsewhere or just use generic text?
        // Let's check 'Reserva' status too just in case of mismatch
        const pendingRes = currentReservationsList.find(res =>
            (String(res.habitacionId) === String(r.id) || String(res.habitacionId) === String(r.numero)) &&
            (res.estado === 'Reserva')
        );
        if (pendingRes) clientName = pendingRes.cliente;
    }

    // 1. Image
    let imgUrl = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=600';
    try {
        if (r.fotos && r.fotos.startsWith('[')) imgUrl = JSON.parse(r.fotos)[0] || imgUrl;
        else if (r.fotos && r.fotos.startsWith('http')) imgUrl = r.fotos;
    } catch (e) { }
    img.src = imgUrl;

    // 2. Info
    title.innerText = 'Habitación ' + r.numero;
    type.innerText = r.tipo;
    price.innerText = 'S/ ' + r.precio;
    cap.innerText = (r.capacidad || 2) + ' Personas';
    beds.innerText = (r.camas || 1) + ' Cama';

    // 3. Status & Colors
    const status = (r.estado || 'Disponible').toLowerCase();
    let statusText = 'DISPONIBLE';
    let badgeColor = '#10b981'; // green

    if (status === 'ocupado') {
        statusText = 'OCUPADO';
        badgeColor = '#ef4444';
    } else if (status === 'mantenimiento') {
        statusText = 'MANTENIMIENTO';
        badgeColor = '#f59e0b';
    } else if (status === 'reservado') {
        statusText = 'RESERVADO';
        badgeColor = '#eab308';
    } else if (status === 'sucio') {
        statusText = 'LIMPIEZA';
        badgeColor = '#3b82f6';
    }
    badge.innerText = statusText;
    badge.style.backgroundColor = badgeColor;

    // 4. Dynamic Actions
    let btns = '';

    if (status === 'disponible' || status === 'sucio') {
        // Check In & Reserve
        btns += `<button class="rd-btn btn-checkin" style="background:#22c55e; color:white;" onclick="closeRoomDetail(); openCheckIn('${r.id}', '${r.numero}')"><i class="fas fa-check"></i> Check-In</button>`;
        btns += `<button class="rd-btn btn-reserve" style="background:#eab308; color:white;" onclick="closeRoomDetail(); openReservation('${r.id}', '${r.numero}')"><i class="fas fa-calendar-alt"></i> Reservar</button>`;
        if (status === 'sucio') {
            btns += `<button class="rd-btn btn-clean" style="border:1px dashed #64748B; color:#64748B;" onclick="closeRoomDetail(); alert('Funcionalidad de limpieza rápida pendiente')"><i class="fas fa-broom"></i> Marcar Limpio</button>`;
        }
    } else if (status === 'ocupado') {
        // Check Out & Extend
        btns += `<button class="rd-btn btn-checkout" style="background:#ef4444; color:white;" onclick="closeRoomDetail(); openCheckOut('${r.id}')"><i class="fas fa-sign-out-alt"></i> Finalizar</button>`;

        // Green Extend Button, passing isExtension=true
        btns += `<button class="rd-btn btn-reserve" style="background:#22c55e; color:white;" onclick="closeRoomDetail(); openReservation('${r.id}', '${r.numero}', '', '${clientName}', true)"><i class="fas fa-calendar-plus"></i> Extender</button>`;
    } else if (status === 'reservado') {
        // Check In & Edit
        btns += `<button class="rd-btn btn-checkin" style="background:#22c55e; color:white;" onclick="closeRoomDetail(); openCheckIn('${r.id}', '${r.numero}')"><i class="fas fa-check"></i> Llegada</button>`;
        btns += `<button class="rd-btn btn-reserve" style="background:#eab308; color:white;" onclick="closeRoomDetail(); openReservation('${r.id}', '${r.numero}')"><i class="fas fa-edit"></i> Modificar</button>`;
    } else {
        btns += `<div style="text-align:center; color:#64748B;">No hay acciones disponibles.</div>`;
    }

    // Always Edit
    btns += `<button class="rd-btn" style="background:#f1f5f9; color:#64748B;" onclick="closeRoomDetail(); editRoom('${r.id}')"><i class="fas fa-cog"></i> Editar Propiedades</button>`;

    actions.innerHTML = btns;

    document.getElementById('modalRoomDetail').style.display = 'flex';
}

function closeRoomDetail() {
    document.getElementById('modalRoomDetail').style.display = 'none';
}

// ===== FINANCE MODULE (PHASE 8) =====

let currentFinanceReport = null; // Stores data

function renderFinanceView() {
    // Default to current month
    // loadFinanceData handles fetch
    loadFinanceData();
}

async function loadFinanceData() {
    document.getElementById('financeTbody').innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Cargando datos financieros...</td></tr>';

    // Month Filter
    const filter = document.getElementById('financeMonthSelector').value;
    const now = new Date();
    let start, end;

    if (filter === '0') {
        // Current Month
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
        // Previous Month
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'getFinanceReport',
                start: start.toISOString(),
                end: end.toISOString()
            })
        });
        const data = await res.json();

        if (data.success) {
            currentFinanceReport = data.report;
            updateFinanceUI();
        } else {
            alert('Error cargando finanzas: ' + data.error);
        }
    } catch (e) { console.error(e); alert('Error de conexión'); }
}

function updateFinanceUI() {
    if (!currentFinanceReport) return;
    const r = currentFinanceReport;

    // 1. KPIs
    document.getElementById('kpiIngresos').innerText = `S/ ${r.resumen.totalIngresos.toFixed(2)}`;
    document.getElementById('kpiGastos').innerText = `S/ ${r.resumen.totalGastos.toFixed(2)}`;
    const util = r.resumen.utilidad;
    const utilEl = document.getElementById('kpiUtilidad');
    utilEl.innerText = `S/ ${util.toFixed(2)}`;
    utilEl.style.color = util >= 0 ? '#1e293b' : '#ef4444'; // Red if loss

    // 2. Refresh Table based on active tab
    const activeBtn = document.getElementById('tabIngresos');
    // If Ingresos has border-bottom primary, it's active.
    if (activeBtn.style.borderBottom.includes('var(--primary)') || activeBtn.style.borderBottom.includes('rgb(')) {
        renderFinanceTable('ingresos');
    } else {
        renderFinanceTable('gastos');
    }
}

function switchFinanceTab(tab) {
    const btnIn = document.getElementById('tabIngresos');
    const btnEx = document.getElementById('tabGastos');

    if (tab === 'ingresos') {
        btnIn.style.color = 'var(--primary)';
        btnIn.style.borderBottom = '3px solid var(--primary)';
        btnEx.style.color = '#94a3b8';
        btnEx.style.borderBottom = 'none';
        renderFinanceTable('ingresos');
    } else {
        btnEx.style.color = 'var(--primary)';
        btnEx.style.borderBottom = '3px solid var(--primary)';
        btnIn.style.color = '#94a3b8';
        btnIn.style.borderBottom = 'none';
        renderFinanceTable('gastos');
    }
}

function renderFinanceTable(type) {
    const thead = document.getElementById('financeThead');
    const tbody = document.getElementById('financeTbody');
    const r = currentFinanceReport;

    if (!r) return; // Guard: Data not loaded yet

    if (type === 'ingresos') {
        thead.innerHTML = `
            <tr>
                <th style="padding:12px; text-align:left; color:#64748B;">Fecha</th>
                <th style="padding:12px; text-align:left; color:#64748B;">Descripción</th>
                <th style="padding:12px; text-align:left; color:#64748B;">Método</th>
                <th style="padding:12px; text-align:right; color:#64748B;">Monto</th>
            </tr>`;

        if (r.ingresos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No hay ingresos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = r.ingresos.map(i => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px;">${new Date(i.fecha).toLocaleDateString()}</td>
                <td style="padding:12px; font-weight:500;">${i.descripcion}</td>
                <td style="padding:12px;">
                    <span style="background:#dcfce7; color:#166534; padding:2px 8px; border-radius:10px; font-size:0.8rem;">${i.metodo}</span>
                </td>
                <td style="padding:12px; text-align:right; font-weight:bold; color:#166534;">+ S/ ${i.monto.toFixed(2)}</td>
            </tr>
        `).join('');

    } else {
        // GASTOS
        thead.innerHTML = `
            <tr>
                <th style="padding:12px; text-align:left; color:#64748B;">Fecha</th>
                <th style="padding:12px; text-align:left; color:#64748B;">Descripción</th>
                <th style="padding:12px; text-align:left; color:#64748B;">Categoría</th>
                <th style="padding:12px; text-align:right; color:#64748B;">Monto</th>
            </tr>`;

        if (r.gastos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">No hay gastos registrados</td></tr>';
            return;
        }

        tbody.innerHTML = r.gastos.map(g => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:12px;">${new Date(g.fecha).toLocaleDateString()}</td>
                <td style="padding:12px; font-weight:500;">${g.descripcion}</td>
                <td style="padding:12px;">${g.categoria}</td>
                <td style="padding:12px; text-align:right; font-weight:bold; color:#ef4444;">- S/ ${g.monto.toFixed(2)}</td>
            </tr>
        `).join('');
    }
}

// === MODALS & ACTIONS ===

function openPurchaseModal() {
    // Populate dropdown
    const sel = document.getElementById('purchProdId');
    sel.innerHTML = '<option value="">Cargando productos...</option>';

    // Use cached list
    if (currentProductsList.length > 0) {
        sel.innerHTML = currentProductsList.map(p => `
            <option value="${p.id}">${p.nombre} (Stock: ${p.stock})</option>
        `).join('');
    } else {
        sel.innerHTML = '<option value="">No hay productos</option>';
    }

    document.getElementById('modalPurchase').style.display = 'flex';
}

async function submitPurchase() {
    const pId = document.getElementById('purchProdId').value;
    const qty = document.getElementById('purchQty').value;
    const cost = document.getElementById('purchCost').value;
    const notes = document.getElementById('purchNotes').value;

    if (!pId || !qty || !cost) return alert('Datos incompletos');

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'registerPurchase',
                productoId: pId,
                cantidad: qty,
                costoTotal: cost,
                notas: notes
            })
        });
        const d = await res.json();
        if (d.success) {
            alert('Compra registrada ✅\nStock actualizado.');
            document.getElementById('modalPurchase').style.display = 'none';
            // Reset form
            document.getElementById('purchQty').value = '';
            document.getElementById('purchCost').value = '';
            loadFinanceData(); // Refresh list
            loadProducts(); // Refresh stock in background
        } else {
            alert('Error: ' + d.error);
        }
    } catch (e) { alert('Error de conexión'); }
}

function openExpenseModal() {
    document.getElementById('modalExpense').style.display = 'flex';
    document.getElementById('expDate').valueAsDate = new Date();
}

async function submitExpense() {
    const desc = document.getElementById('expDesc').value;
    const cat = document.getElementById('expCat').value;
    const amt = document.getElementById('expAmount').value;
    const date = document.getElementById('expDate').value;

    if (!desc || !amt || !date) return alert('Datos incompletos');

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveGasto',
                descripcion: desc,
                categoria: cat,
                monto: amt,
                fecha: date
            })
        });
        const d = await res.json();
        if (d.success) {
            alert('Gasto registrado ✅');
            document.getElementById('modalExpense').style.display = 'none';
            document.getElementById('expDesc').value = '';
            document.getElementById('expAmount').value = '';
            loadFinanceData();
        } else {
            alert('Error: ' + d.error);
        }
    } catch (e) { alert('Error de conexión'); }


    async function submitPurchase() {
        const prodId = document.getElementById('purchProdId').value;
        const qty = document.getElementById('purchQty').value;
        const cost = document.getElementById('purchCost').value;
        const notes = document.getElementById('purchNotes').value;

        if (!prodId || !qty || !cost) return alert('Completa los campos obligatorios');

        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'registerPurchase',
                    productoId: prodId,
                    cantidad: qty,
                    costoTotal: cost,
                    notas: notes
                })
            });
            const d = await res.json();
            if (d.success) {
                alert('✅ Stock Repuesto y Gasto Registrado');
                document.getElementById('modalPurchase').style.display = 'none';
                // Clear
                document.getElementById('purchQty').value = '';
                document.getElementById('purchCost').value = '';
                document.getElementById('purchNotes').value = '';

                // Refresh
                loadFinanceData();
                // Also refresh products if needed, but not urgent
            } else {
                alert('Error: ' + d.error);
            }
        } catch (e) { alert('Error de conexión'); }
    }

    // ===== PHASE 9: QUICK CHARGE LOGIC =====

    let qcActiveTab = 'product';

    async function openQuickCharge(roomId, resId) {
        if (!roomId || !resId || resId === 'null') {
            alert('❌ Error: No se identificó la reserva activa. Verifica el estado de la habitación.');
            return;
        }

        document.getElementById('qcRoomId').value = roomId;
        document.getElementById('qcResId').value = resId;
        document.getElementById('modalQuickCharge').style.display = 'flex';

        currentProductFilter = 'Todos'; // Reset filter to show all
        // Ensure Products Loaded
        if (currentProductsList.length === 0) await loadProductsView();
        populateQCProducts();

        // Ensure Services Loaded
        if (currentServicesList.length === 0) loadServicesData();

        switchQCTab('product');
    }

    function switchQCTab(tab) {
        qcActiveTab = tab;
        // UI Updates
        document.getElementById('tabQCProduct').style.background = tab === 'product' ? 'var(--primary)' : 'transparent';
        document.getElementById('tabQCProduct').style.color = tab === 'product' ? 'white' : '#64748B';

        document.getElementById('tabQCService').style.background = tab === 'service' ? 'var(--primary)' : 'transparent';
        document.getElementById('tabQCService').style.color = tab === 'service' ? 'white' : '#64748B';

        document.getElementById('qcFormProduct').style.display = tab === 'product' ? 'block' : 'none';
        document.getElementById('qcFormService').style.display = tab === 'service' ? 'block' : 'none';
    }

    function populateQCProducts() {
        const sel = document.getElementById('qcProdSelect');
        sel.innerHTML = '<option value="">-- Seleccionar Producto --</option>';

        // Filter active products
        currentProductsList.forEach(p => {
            if (String(p.activo).toLowerCase() === 'activo' || p.activo === true || String(p.activo) === 'si') {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.text = `${p.nombre} (S/ ${p.precio})`;
                opt.dataset.price = p.precio;
                opt.dataset.stock = p.stock_actual;
                sel.appendChild(opt);
            }
        });
    }

    function updateQCStockDisplay() {
        const sel = document.getElementById('qcProdSelect');
        if (sel.selectedIndex <= 0) {
            document.getElementById('qcStockDisplay').innerText = 'Stock: -';
            qcSelectedPrice = 0;
            return;
        }
        const opt = sel.options[sel.selectedIndex];
        const stock = opt.dataset.stock;
        qcSelectedPrice = Number(opt.dataset.price);

        document.getElementById('qcStockDisplay').innerText = `Stock Disponible: ${stock}`;
        if (Number(stock) <= 0) {
            document.getElementById('qcStockDisplay').style.color = '#ef4444';
        } else {
            document.getElementById('qcStockDisplay').style.color = '#64748B';
        }
    }

    async function loadServicesData() {
        try {
            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'getServicios' })
            });
            const result = await res.json();
            if (result.success) {
                currentServicesList = result.servicios;
                populateQCServices();
            }
        } catch (e) { console.error('Error fetching services', e); }
    }

    function populateQCServices() {
        const sel = document.getElementById('qcServSelect');
        sel.innerHTML = '<option value="">-- Seleccionar Servicio --</option>';

        currentServicesList.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.text = `${s.nombre} (S/ ${s.precio})`;
            opt.dataset.price = s.precio;
            sel.appendChild(opt);
        });
    }

    async function submitQuickCharge() {
        const resId = document.getElementById('qcResId').value;

        if (qcActiveTab === 'product') {
            const prodId = document.getElementById('qcProdSelect').value;
            const qty = document.getElementById('qcProdQty').value;

            if (!prodId) return alert('Selecciona un producto');
            if (qty <= 0) return alert('Cantidad inválida');

            const sel = document.getElementById('qcProdSelect');
            const stock = Number(sel.options[sel.selectedIndex].dataset.stock);
            if (stock < qty) {
                if (!confirm(`⚠️ Stock insuficiente logicamente (${stock}). ¿Enviar pedido igual?`)) return;
            }

            const total = qcSelectedPrice * Number(qty);
            const prodName = sel.options[sel.selectedIndex].text.split(' (')[0];

            const payload = {
                action: 'saveConsumo',
                reservaId: resId,
                tipo: 'Producto',
                descripcion: `Consumo: ${prodName}`,
                monto: total,
                cantidad: qty,
                productoId: prodId
            };

            if (!confirm(`¿Cargar S/ ${total} por ${qty} ${prodName}?`)) return;

            try {
                const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(payload) });
                const result = await res.json();
                if (result.success) {
                    alert('✅ Consumo Agregado');
                    document.getElementById('modalQuickCharge').style.display = 'none';
                    loadRoomsView(); // Refresh Logic
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (e) { alert('Error red: ' + e.message); }

        } else {
            const servId = document.getElementById('qcServSelect').value;
            const date = document.getElementById('qcServDate').value;
            const notes = document.getElementById('qcServNotes').value;

            if (!servId) return alert('Selecciona un servicio');

            const sel = document.getElementById('qcServSelect');
            const price = Number(sel.options[sel.selectedIndex].dataset.price);
            const servName = sel.options[sel.selectedIndex].text.split(' (')[0];

            const payload = {
                action: 'saveConsumo',
                reservaId: resId,
                tipo: 'Servicio',
                descripcion: `Servicio: ${servName} ${notes ? '(' + notes + ')' : ''}`,
                monto: price,
                cantidad: 1,
                productoId: servId, // Now saving the Service ID for reference
                fechaProgramada: date
            };

            if (!confirm(`¿Reservar ${servName} por S/ ${price}?`)) return;

            try {
                const res = await fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify(payload) });
                const result = await res.json();
                if (result.success) {
                    alert('✅ Servicio Reservado');
                    document.getElementById('modalQuickCharge').style.display = 'none';
                    loadRoomsView();
                } else {
                    alert('Error: ' + result.error);
                }
            } catch (e) { alert('Error red: ' + e.message); }
        }
    }

}

// ===== PHASE 15: PRODUCT INTELLIGENCE (LOGISTICS) =====

let currentAnalysisProdId = null;
let currentAnalysisLastCost = 0;

async function openProductAnalysis(prodId) {
    currentAnalysisProdId = prodId;
    document.getElementById('modalProductAnalysis').style.display = 'flex';
    document.getElementById('anaProdName').innerText = 'Cargando...';

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getProductAnalysis', productoId: prodId })
        });
        const result = await res.json();

        if (result.success) {
            const d = result.data;
            const p = d.product;

            // Header
            document.getElementById('anaProdName').innerText = p.nombre;
            document.getElementById('anaProdCat').innerText = 'Stock Actual: ' + p.stock;

            // Cards
            currentAnalysisLastCost = d.lastCost;
            document.getElementById('anaLastCost').innerText = 'S/ ' + d.lastCost.toFixed(2);
            document.getElementById('anaPriceInput').value = p.precio.toFixed(2);

            calculateAnalysisMargin(); // value update

            // History Table
            const tbody = document.getElementById('anaHistoryBody');
            tbody.innerHTML = '';

            if (d.history.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748B;">Sin historial de compras registrado</td></tr>';
            } else {
                d.history.forEach(h => {
                    const row = document.createElement('tr');
                    const dateStr = new Date(h.fecha).toLocaleDateString();
                    row.innerHTML = `
                        <td style="padding:10px;">${dateStr}</td>
                        <td style="font-weight:bold;">${h.cantidad}</td>
                        <td>S/ ${h.total.toFixed(2)}</td>
                        <td style="color:var(--primary-dark); font-weight:bold;">S/ ${h.unitario.toFixed(2)}</td>
                    `;
                    tbody.appendChild(row);
                });
            }

        } else {
            alert('Error cargando análisis: ' + result.error);
        }
    } catch (e) { console.error(e); alert('Error de conexión'); }
}

function calculateAnalysisMargin() {
    const price = Number(document.getElementById('anaPriceInput').value);
    const cost = currentAnalysisLastCost;

    if (price > 0) {
        const profit = price - cost;
        const margin = (profit / price) * 100;

        document.getElementById('anaMarginPercent').innerText = margin.toFixed(1) + '%';
        document.getElementById('anaProfit').innerText = 'S/ ' + profit.toFixed(2);

        // Color Feedback
        const mCard = document.getElementById('anaMarginCard');
        if (margin < 15) { mCard.style.background = '#fef2f2'; mCard.style.borderColor = '#fca5a5'; } // Red
        else if (margin < 30) { mCard.style.background = '#fffbeb'; mCard.style.borderColor = '#fcd34d'; } // Yellow
        else { mCard.style.background = '#f0fdf4'; mCard.style.borderColor = '#bbf7d0'; } // Green

    } else {
        document.getElementById('anaMarginPercent').innerText = '0%';
        document.getElementById('anaProfit').innerText = 'S/ 0.00';
    }
}

async function saveAnalyzedPrice() {
    if (!currentAnalysisProdId) return;
    const newPrice = document.getElementById('anaPriceInput').value;

    if (!confirm(`¿Actualizar precio de venta a S/ ${newPrice}?`)) return;

    const btn = document.querySelector('#modalProductAnalysis .btn-login'); // Assuming main button style
    // Need to target specific button.
    const submitBtn = document.querySelector('#modalProductAnalysis button[onclick="saveAnalyzedPrice()"]');

    let originalText = "Guardar Nuevo Precio";
    if (submitBtn) {
        originalText = submitBtn.innerText;
        submitBtn.innerText = "Actualizando...";
        submitBtn.disabled = true;
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'quickUpdatePrice',
                id: currentAnalysisProdId,
                newPrice: newPrice
            })
        });
        const d = await res.json();
        if (d.success) {
            showToast('✅ Precio Actualizado');
            document.getElementById('modalProductAnalysis').style.display = 'none';
            loadProductsView();
        } else {
            alert('Error: ' + d.error);
        }
    } catch (e) {
        alert('Error de conexión');
    } finally {
        if (submitBtn) {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    }
}

// ===== PHASE 16: STOCK ADJUSTMENT & TOAST =====

let currentAdjProdId = null;
let currentAdjOldStock = 0;

function showToast(message) {
    const container = document.getElementById('toast-container');
    const msgSpan = document.getElementById('toast-message');
    if (!container || !msgSpan) return console.warn('Toast elements missing');

    msgSpan.innerText = message;
    container.classList.add('show');

    setTimeout(() => {
        container.classList.remove('show');
    }, 3000);
}

function openStockAdjustment(id) {
    const p = currentProductsList.find(x => x.id == id);
    if (!p) return;

    currentAdjProdId = id;
    currentAdjOldStock = Number(p.stock);

    document.getElementById('modalStockAdjustment').style.display = 'flex';
    document.getElementById('adjProdName').innerText = p.nombre;
    document.getElementById('adjCurrentStock').innerText = p.stock;
    document.getElementById('adjNewStock').value = '';
    document.getElementById('adjDiff').innerText = '-';
    document.getElementById('adjNotes').value = '';
    document.getElementById('adjReason').value = 'Correccion Conteo';
    calculateStockDiff();
}

function calculateStockDiff() {
    const val = document.getElementById('adjNewStock').value;
    // Keep diff blank if empty input
    if (val === '') {
        document.getElementById('adjDiff').innerText = '-';
        return;
    }
    const newStock = Number(val);
    const diff = newStock - currentAdjOldStock;
    const sign = diff > 0 ? '+' : '';

    const diffEl = document.getElementById('adjDiff');
    diffEl.innerText = `${sign}${diff}`;

    if (diff < 0) diffEl.style.color = '#ef4444'; // Red (Loss)
    else if (diff > 0) diffEl.style.color = '#22c55e'; // Green (Gain)
    else diffEl.style.color = '#64748B'; // Gray (No change)
}

async function submitStockAdjustment() {
    const newStock = document.getElementById('adjNewStock').value;
    if (newStock === '') return alert('Ingresa el stock real');

    const reason = document.getElementById('adjReason').value;
    const notes = document.getElementById('adjNotes').value;

    if (!confirm(`¿Confirmar ajuste de stock a ${newStock}?`)) return;

    const btn = document.querySelector('#modalStockAdjustment .btn-login'); // Assuming the main button has this class
    // Or better: get by unique context inside modal if possible.
    // The previous code didn't use IDs for buttons. It's risky.
    // Let's rely on finding the button that called this? No, it's global function.
    // Let's add an ID to the button in HTML to be safe, or select carefully.
    // Modal structure: footer > button.
    const submitBtn = document.querySelector('#modalStockAdjustment button[onclick="submitStockAdjustment()"]');

    let originalText = "Confirmar Ajuste";
    if (submitBtn) {
        originalText = submitBtn.innerText;
        submitBtn.innerText = "Procesando...";
        submitBtn.disabled = true;
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'adjustStock',
                id: currentAdjProdId,
                newStock: newStock,
                reason: reason,
                notes: notes
            })
        });
        const d = await res.json();

        if (d.success) {
            document.getElementById('modalStockAdjustment').style.display = 'none';
            showToast('✅ Stock Ajustado Correctamente');
            loadProductsView(); // Refresh
        } else {
            alert('Error: ' + d.error);
        }
    } catch (e) {
        alert('Error de conexión');
    } finally {
        if (submitBtn) {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;
        }
    }
}




// ===== UTILS: UI ROBUSTNESS =====

// Fix for "Text Selection closes Modal" issue
// Instead of simple onclick, we track mousedown to ensure it started on backdrop
function setupSafeModalClose(modalId, closeFn) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    let isMouseDownOnBackdrop = false;

    modal.addEventListener('mousedown', (e) => {
        if (e.target === modal) {
            isMouseDownOnBackdrop = true;
        } else {
            isMouseDownOnBackdrop = false;
        }
    });

    modal.addEventListener('mouseup', (e) => {
        if (e.target === modal && isMouseDownOnBackdrop) {
            // Only close if started AND ended on backdrop
            // Also check if text selection exists? Usually not needed if we check strict target.
            // But dragging out from input will fail 'mousedown on backdrop' check (good).
            window[closeFn] ? window[closeFn]() : (modal.style.display = 'none');
        }
        isMouseDownOnBackdrop = false; // Reset
    });

    // Remove the old aggressive onclick
    modal.onclick = null;
}

// Initialize Safe Closers
document.addEventListener('DOMContentLoaded', () => {
    // We can call this for known modals
    setupSafeModalClose('modalProductEditor', 'closeProductEditor');
    setupSafeModalClose('modalProductAnalysis', 'closeProductAnalysis'); // Assuming this exists or simple hide
    setupSafeModalClose('modalStockAdjustment', null); // Default hide
    setupSafeModalClose('modalReservation', null);
    setupSafeModalClose('modalCheckIn', null);
    setupSafeModalClose('modalCheckOut', null);
    setupSafeModalClose('modalReservationDetail', null);
});


// ===== PHASE 6: CALENDAR INTERACTION LOGIC =====

// 0. NEW RESERVATION (Empty Cell)
function openNewReservation(roomId, roomNum, date) {
    if (!roomId) return console.error('Missing roomId for new res');

    document.getElementById('modalReservation').style.display = 'flex';
    document.getElementById('resRoomId').value = roomId;
    document.getElementById('resRoomNum').value = 'Habitación ' + roomNum;
    document.getElementById('resIsExtension').value = 'false';

    document.getElementById('resModalTitle').innerHTML = '<i class="fas fa-calendar-alt"></i> Nueva Reserva';
    const btn = document.querySelector('#modalReservation .btn-submit');
    btn.innerText = 'Guardar Reserva';
    btn.onclick = submitReservation; // Bind standard submit

    document.getElementById('resClient').value = '';
    document.getElementById('resClient').disabled = false;
    document.getElementById('resInDate').disabled = false;
    document.getElementById('resNotes').value = '';

    // Date Logic
    const inDate = document.getElementById('resInDate');
    const outDate = document.getElementById('resOutDate');

    if (date) {
        inDate.value = date;
        const d = new Date(date);
        d.setDate(d.getDate() + 1);
        outDate.valueAsDate = d;
    } else {
        inDate.valueAsDate = new Date();
        const tmr = new Date();
        tmr.setDate(tmr.getDate() + 1);
        outDate.valueAsDate = tmr;
    }
}

// 1. VIEW/EDIT RESERVATION (Clicking a Bar)
function openReservationDetail(resId) {
    const res = currentReservationsList.find(r => r.id === resId);
    if (!res) return alert('Reserva no encontrada localmente');

    // Populate Detail Modal
    document.getElementById('modalReservationDetail').style.display = 'flex';
    document.getElementById('rdResId').value = res.id;
    document.getElementById('rdRoomId').value = res.habitacionId;

    document.getElementById('rdClientDisplay').innerText = res.cliente;
    document.getElementById('rdStart').innerText = new Date(res.fechaEntrada).toLocaleDateString();
    document.getElementById('rdEnd').innerText = new Date(res.fechaSalida).toLocaleDateString();
    document.getElementById('rdNotes').innerText = res.notas || 'Sin notas';

    // Find Room
    // habitacionId in res might be ID or Number? Backend sends what it has.
    // Try to find Name.
    const room = currentRoomsList.find(r => String(r.id) === String(res.habitacionId) || String(r.numero) === String(res.habitacionId));
    document.getElementById('rdRoomName').innerText = room ? `Habitación ${room.numero}` : `Hab. ${res.habitacionId}`;

    // Badge Color
    const badge = document.getElementById('rdStatusBadge');
    badge.innerText = res.estado.toUpperCase();

    let actionsHtml = '';
    const closeFn = "document.getElementById('modalReservationDetail').style.display='none';";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Parse start date safely
    let startDate = new Date();
    if (res.fechaEntrada) {
        startDate = new Date(res.fechaEntrada);
    }
    startDate.setHours(0, 0, 0, 0);

    // Check-In Active Condition: Today >= StartDate
    const canCheckIn = today >= startDate;

    if (res.estado === 'Activa' || res.estado === 'Ocupada') { // Green
        badge.style.background = '#dcfce7'; badge.style.color = '#166534';

        actionsHtml += `<button onclick="${closeFn} openReservation('${res.habitacionId}', '${room ? room.numero : ''}', '', '${res.cliente}', 'extend', '${res.id}', '${res.fechaSalida}')" class="btn-submit" style="background:#eab308; width:auto;"><i class="fas fa-calendar-plus"></i> Extender</button>`;
        actionsHtml += `<button onclick="${closeFn} openReservation('${res.habitacionId}', '${room ? room.numero : ''}', '${res.fechaEntrada}', '${res.cliente}', 'edit', '${res.id}', '${res.fechaSalida}')" class="btn-submit" style="background:#3b82f6; width:auto;"><i class="fas fa-edit"></i> Editar</button>`;
        actionsHtml += `<button onclick="${closeFn} openCheckOut('${res.habitacionId}')" class="btn-submit" style="background:#ef4444; width:auto;"><i class="fas fa-sign-out-alt"></i> Salida</button>`;

    } else if (res.estado === 'Reserva') { // Yellow
        badge.style.background = '#fef9c3'; badge.style.color = '#854d0e';

        if (canCheckIn) {
            // Confirm Arrival
            actionsHtml += `<button onclick="${closeFn} confirmReservation('${res.id}')" class="btn-submit" style="background:#22c55e; width:auto;"><i class="fas fa-check"></i> Check-In (Ingreso)</button>`;
        } else {
            // Future Reservation
            actionsHtml += `<button disabled class="btn-submit" style="background:#cbd5e1; width:auto; cursor:not-allowed;" title="Disponible desde la fecha de llegada"><i class="fas fa-clock"></i> Esperando Llegada</button>`;
        }

        actionsHtml += `<button onclick="${closeFn} openReservation('${res.habitacionId}', '${room ? room.numero : ''}', '${res.fechaEntrada}', '${res.cliente}', 'edit', '${res.id}', '${res.fechaSalida}')" class="btn-submit" style="background:#3b82f6; width:auto;"><i class="fas fa-edit"></i> Editar</button>`;
        actionsHtml += `<button onclick="${closeFn} cancelReservation('${res.id}', '${res.habitacionId}')" class="btn-submit" style="background:#ef4444; width:auto;"><i class="fas fa-trash-alt"></i> Cancelar / No Show</button>`;

    } else if (res.estado === 'Finalizada') { // Gray (New)
        badge.style.background = '#e2e8f0'; badge.style.color = '#475569';
        actionsHtml += `<div style="text-align:center; width:100%; color:#64748B; font-style:italic;">Reserva Finalizada</div>`;

    } else {
        badge.style.background = '#e2e8f0'; badge.style.color = '#475569';
    }

    document.getElementById('rdActionsContainer').innerHTML = actionsHtml;
}

async function confirmReservation(resId) {
    if (!confirm('¿Confirmar ingreso del huésped? Estado pasará a Activa.')) return;
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'confirmReservation', id: resId })
        });
        const d = await res.json();
        if (d.success) { showToast('✅ Ingreso Confirmado'); loadCalendarView(); }
        else alert('Error: ' + d.error);
    } catch (e) { alert('Error red'); }
}

async function cancelReservation(resId, habId) {
    if (!confirm('¿Cancelar esta reserva? Se liberará la habitación.')) return;
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'cancelReservation', id: resId, habitacionId: habId })
        });
        const d = await res.json();
        if (d.success) { showToast('🗑️ Reserva Cancelada'); loadCalendarView(); }
        else alert('Error: ' + d.error);
    } catch (e) { alert('Error red'); }
}



// 2. EXTENSION & EDIT FLOW (Reusing Reservation Modal)
function openReservation(roomId, roomNum, date, existingClient, mode = 'new', existingResId = null, currentEnd = null) {
    // Mode: 'new' | 'extend' | 'edit'

    document.getElementById('modalReservation').style.display = 'flex';
    document.getElementById('resRoomId').value = roomId;
    document.getElementById('resRoomNum').value = roomNum ? 'Hab. ' + roomNum : 'Habitación';
    document.getElementById('resIsExtension').value = mode;
    document.getElementById('resResId').value = existingResId || '';

    const title = document.getElementById('resModalTitle');
    const btn = document.querySelector('#modalReservation .btn-submit');
    const clientInput = document.getElementById('resClient');
    const inDate = document.getElementById('resInDate');
    const outDate = document.getElementById('resOutDate');

    if (mode === 'extend') {
        title.innerHTML = '<i class="fas fa-calendar-plus"></i> Extender Estadía';
        btn.innerText = 'Confirmar Extensión';

        clientInput.value = existingClient || '';
        clientInput.disabled = true;
        inDate.disabled = true;

        let startDateObj = new Date();
        if (currentEnd) {
            startDateObj = new Date(currentEnd);
        }
        inDate.valueAsDate = startDateObj;

        // Default End = Start + 1
        const tmr = new Date(startDateObj);
        tmr.setDate(tmr.getDate() + 1);
        outDate.valueAsDate = tmr;

    } else if (mode === 'edit') {
        title.innerHTML = '<i class="fas fa-edit"></i> Modificar Reserva';
        btn.innerText = 'Actualizar Datos';

        clientInput.value = existingClient || '';
        clientInput.disabled = false;
        inDate.disabled = false;

        if (date) inDate.value = date;
        if (currentEnd) outDate.value = currentEnd;

        document.getElementById('resNotes').value = '';

    } else { // 'new'
        title.innerHTML = '<i class="fas fa-calendar-alt"></i> Nueva Reserva';
        btn.innerText = 'Guardar Reserva';

        clientInput.value = '';
        clientInput.disabled = false;
        inDate.disabled = false;

        // Date Logic
        if (date) {
            inDate.value = date;
            const d = new Date(date);
            d.setDate(d.getDate() + 1);
            outDate.valueAsDate = d;
        } else {
            inDate.valueAsDate = new Date();
            const tmr = new Date();
            tmr.setDate(tmr.getDate() + 1);
            outDate.valueAsDate = tmr;
        }
    }
}

async function submitReservation() {
    const roomId = document.getElementById('resRoomId').value;
    const mode = document.getElementById('resIsExtension').value; // 'new', 'extend', 'edit'
    const notes = document.getElementById('resNotes').value;
    const resId = document.getElementById('resResId').value;

    // UI Feedback
    const btn = document.querySelector('#modalReservation .btn-submit');
    const originalText = btn.innerText;
    btn.innerText = 'Procesando...';
    btn.disabled = true;

    try {
        if (mode === 'extend') {
            const newEnd = document.getElementById('resOutDate').value;
            if (!newEnd) throw new Error('Selecciona nueva fecha de salida');

            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'extendReservation',
                    habitacionId: roomId,
                    newCheckOutDate: newEnd,
                    notas: notes
                })
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.error);
            showToast('✅ Estadía Extendida');

        } else if (mode === 'edit') {
            const client = document.getElementById('resClient').value;
            const start = document.getElementById('resInDate').value;
            const end = document.getElementById('resOutDate').value;

            if (!client || !start || !end) throw new Error('Completa todos los campos');

            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'updateReservation', // New Backend Action
                    id: resId,
                    habitacionId: roomId, // Support room change if we unlocked it
                    cliente: client,
                    fechaEntrada: start,
                    fechaSalida: end,
                    notas: notes
                })
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.error);
            showToast('✅ Reserva Actualizada');

        } else {
            // New Reservation
            const client = document.getElementById('resClient').value;
            const start = document.getElementById('resInDate').value;
            const end = document.getElementById('resOutDate').value;

            if (!client || !start || !end) throw new Error('Completa todos los campos');

            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'checkIn',
                    habitacionId: roomId,
                    cliente: client,
                    fechaEntrada: start,
                    fechaSalida: end,
                    notas: notes,
                    isReservation: true
                })
            });
            const d = await res.json();
            if (!d.success) throw new Error(d.error);
            showToast('✅ Reserva Creada');
        }

        document.getElementById('modalReservation').style.display = 'none';
        loadCalendarView();

    } catch (e) {
        // alert('❌ Error: ' + e.message); // Ugly
        // Better Alert
        showToast('❌ ' + e.message); // Reuse toast or specific error
        // Ideally use a Modal Alert, but Toast is better than native.
        // Or keep alert for critical errors if toast disappears too fast. 
        // User asked for "Más bonito".
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 2. CHECK-IN FLOW (Walk-In)
function openCheckIn(roomId, roomNum) {
    document.getElementById('modalCheckIn').style.display = 'flex';
    document.getElementById('ciRoomId').value = roomId;
    document.getElementById('ciRoomDisplay').innerText = roomNum ? `Habitación ${roomNum}` : 'Habitación Selecciónada';

    document.getElementById('ciClient').value = '';

    // Default checkout tomorrow
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    document.getElementById('ciOutDate').valueAsDate = tmr;
}

async function submitCheckIn() {
    const roomId = document.getElementById('ciRoomId').value;
    const client = document.getElementById('ciClient').value;
    const end = document.getElementById('ciOutDate').value;
    const notes = document.getElementById('ciNotes').value;

    if (!client || !end) return alert('Completa los campos obligatorios');

    // Feedback
    const btn = document.querySelector('#modalCheckIn .btn-submit');
    const originalText = btn.innerText;
    btn.innerText = 'Registrando...';
    btn.disabled = true;

    try {
        // Start date is TODAY/NOW automatically in backend for Check-In
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'checkIn',
                habitacionId: roomId,
                cliente: client,
                fechaEntrada: new Date().toISOString().split('T')[0], // Today
                fechaSalida: end,
                notas: notes,
                isReservation: false // Immediate Occupancy
            })
        });
        const d = await res.json();

        if (d.success) {
            showToast('✅ Bienvenida/o Realizada');
            document.getElementById('modalCheckIn').style.display = 'none';
            // Refresh Both Views (Calendar + Rooms)
            loadCalendarView();
            // If we are on calendar view, Rooms View might not strictly need refresh unless we switch.
            // But good practice.
        } else {
            throw new Error(d.error);
        }
    } catch (e) {
        alert('❌ Error: ' + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 3. CHECK-OUT FLOW
function openCheckOut(roomId) {
    document.getElementById('modalCheckOut').style.display = 'flex';
    document.getElementById('coRoomId').value = roomId;
}

async function submitCheckOut() {
    const roomId = document.getElementById('coRoomId').value;

    const btn = document.querySelector('#modalCheckOut .btn-submit');
    const originalText = btn.innerText;
    btn.innerText = 'Procesando...';
    btn.disabled = true;

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'checkOut',
                habitacionId: roomId
            })
        });
        const d = await res.json();

        if (d.success) {
            showToast('✅ Salida Exitosa');
            document.getElementById('modalCheckOut').style.display = 'none';
            loadCalendarView();
            // TODO: Open Liquidation/Payment Modal here?
            // For now, just mark Dirty.
        } else {
            throw new Error(d.error);
        }
    } catch (e) {
        alert('❌ Error: ' + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}
