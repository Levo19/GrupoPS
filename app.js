console.log("APP JS VERSION: 20260103_1030 - DEBUG CAJA V4 (REPARENT)");
// ===== STATE =====
let currentUser = null;
let currentView = 'dashboard';
let currentRoomsList = [];
let currentProductsList = [];
let currentUsersList = [];
let currentReservationsList = [];
let currentCaja = null; // [NEW] Shift Management State
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
        initCajaSession(); // [NEW] Ensure Caja State is loaded
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
async function loadRooms() {
    try {
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getHabitaciones' })
        });
        const data = await response.json();
        if (data.success) {
            currentRoomsList = data.habitaciones;
            // Optionally update views if they are active?
            // renderRooms(currentRoomsList); // Only if needed based on view
            console.log('Habitaciones recargadas:', currentRoomsList.length);
        } else {
            console.error('Error cargando habitaciones:', data.error);
        }
    } catch (e) {
        console.error('Error de red al cargar habitaciones:', e);
    }
}
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
    initCajaSession(); // [NEW] Restore Caja State
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
// currentRoomsList is now global at top

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

        // [NEW] Check for "Reservado" Today (Imminent Check-in)
        // If room is 'Disponible' but has a reservation starting TODAY, we show RESERVADO.
        if (normStatus === 'disponible') {
            const todayIso = new Date().toLocaleDateString('sv').split('T')[0]; // Local YYYY-MM-DD
            const hasResToday = currentReservationsList && currentReservationsList.some(res => {
                // Check Room Match
                if (String(res.habitacionId) !== String(r.id) && String(res.habitacionId) !== String(r.numero)) return false;
                // Check Date Match (Start Date)
                const resStart = new Date(res.fechaEntrada).toLocaleDateString('sv').split('T')[0];
                return resStart === todayIso && (res.estado === 'Reserva' || res.estado === 'Activa');
            });

            if (hasResToday) {
                statusClass = 'status-warning'; // Yellow/Orange
                statusLabel = 'RESERVADO (HOY)';
            } else {
                statusClass = 'status-disponible';
                statusLabel = 'DISPONIBLE';
            }
        }
        else if (normStatus === 'ocupado') {
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
        }
        else if (normStatus === 'reservado') {
            statusClass = 'status-warning';
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
    calculateCheckInBalance(); // [FIX] Instant Recalculation
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

// ===== CLEANING LOGIC =====
async function markRoomClean(id) {
    if (!confirm('¿Confirmar que la habitación está limpia y lista?')) return;

    const r = currentRoomsList.find(r => r.id == id);
    if (r) r.estado = 'Disponible';
    renderRooms(currentRoomsList);
    // Optimistic Calendar Update
    if (document.getElementById('view-calendar').style.display !== 'none' && typeof renderCalendarTimeline === 'function') {
        renderCalendarTimeline(currentRoomsList, currentReservationsList || []);
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'cleanRoom',
                habitacionId: id
            })
        });
        const data = await res.json();

        if (data.success) {
            // alert('✅ Habitación Limpia'); 
            showToast('Habitación Limpia');
            loadRoomsView(); // Refresh real state
        } else {
            alert('❌ Error: ' + data.error);
            loadRoomsView(); // Revert
        }
    } catch (e) {
        alert('❌ Error de conexión');
        console.error(e);
        loadRoomsView();
    }
}

// Helper Toast (Simple implementation if not exists)
function showToast(msg) {
    // If we have a toast system use it, otherwise alert
    // checking if Toast exists in HTML... usually separate component
    // For now simple console log or alert if needed, but alert interrupts.
    // Let's create a temporary toast or use existing if any.
    // Based on previous code, there is no explicit toast function shown in first 800 lines.
    // Use fallback
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.background = '#22c55e';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '8px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3000);
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



// Restore openCheckIn for top-bar button
function openCheckIn(roomId, roomNum) {
    console.log("OpenCheckIn ID:", roomId);
    checkInMode = 'checkin';
    const title = document.getElementById('modalTitleCheckIn');
    const btn = document.getElementById('btnSubmitCheckIn');
    if (title) title.innerHTML = '🏨 Check-In (Ingreso)';
    if (btn) {
        btn.innerText = 'Confirmar Ingreso';
        btn.style.background = 'var(--accent)';
    }
    setupCheckInModal(roomId, roomNum, null);
}

// [NEW] Open New Reservation from Calendar
function openNewReservation(roomId, roomNum, dateStr) {
    console.log("OpenNewReservation:", roomId, dateStr);
    checkInMode = 'reservation';

    const title = document.getElementById('modalTitleCheckIn');
    const btn = document.getElementById('btnSubmitCheckIn');
    if (title) title.innerHTML = '📅 Nueva Reserva';
    if (btn) {
        btn.innerText = 'Guardar Reserva';
        btn.style.background = '#eab308'; // Orange/Yellow
    }

    setupCheckInModal(roomId, roomNum, dateStr);
}

async function setupCheckInModal(roomId, roomNum, preSelectedDate) {
    try {
        // console.log("Setup CheckIn: ", roomId); 
        const form = document.getElementById('formCheckIn');
        form.reset();

        // UI Elements
        const roomLabel = document.getElementById('checkInRoomNum');
        if (!roomId) roomLabel.style.display = 'none'; // Pre-emptive hide
        const roomSelect = document.getElementById('checkInRoomSelect');
        const roomIdInput = document.getElementById('checkInRoomId');

        // Ensure Data exists (Fix for "Cargando..." issue)
        if (!currentRoomsList || currentRoomsList.length === 0) {
            // If global, show loading in the select
            if (!roomId) {
                roomSelect.style.display = 'block';
                roomSelect.innerHTML = '<option>Cargando datos...</option>';
            }
            await loadRooms(); // Wait for fetch
        }

        // 1. Setup Room Selection
        let linkedRes = null;

        if (roomId) {
            if (roomIdInput) roomIdInput.value = roomId;
            if (roomLabel) {
                roomLabel.innerText = 'Habitación ' + roomNum;
                roomLabel.style.display = 'inline-block';
            }
            if (roomSelect) roomSelect.style.setProperty('display', 'none', 'important');

            // DETECT RESERVATION FOR TODAY
            if (checkInMode !== 'reservation' && currentReservationsList) {
                const today = new Date().toISOString().split('T')[0];
                linkedRes = currentReservationsList.find(r =>
                    r.habitacionId == roomId &&
                    r.estado === 'Reserva' &&
                    r.fechaEntrada.substring(0, 10) <= today // Start date is today or past due
                );
            }

            // Init Picker for Room
            initDatePicker(roomId, preSelectedDate);
        } else {
            // GLOBAL (No ID)
            if (roomIdInput) roomIdInput.value = '';
            if (roomLabel) {
                roomLabel.innerText = '';
                roomLabel.style.display = 'none';
            }

            if (roomSelect) {
                roomSelect.style.display = 'block';
                roomSelect.value = ""; // Reset selection

                // Populate
                let ops = '<option value="" disabled selected>-- Elija Habitación --</option>';
                if (currentRoomsList && Array.isArray(currentRoomsList) && currentRoomsList.length > 0) {
                    let count = 0;
                    currentRoomsList.forEach(r => {
                        // Strict Filter for Check-In Mode
                        if (checkInMode === 'checkin' && (r.estado === 'Ocupado' || r.estado === 'Sucio')) return;

                        // [MOD] Add data-price
                        ops += `<option value="${r.id}" data-price="${r.precio}">Hab. ${r.numero} - ${r.tipo} (S/ ${r.precio})</option>`;
                        count++;
                    });
                    if (count === 0) ops += '<option disabled>Sin habitaciones disponibles</option>';
                } else {
                    ops += '<option disabled>Error: No se pudieron cargar las habitaciones</option>';
                }

                roomSelect.innerHTML = ops;

                // Listener for Global Select
                roomSelect.onchange = function () {
                    if (roomIdInput) roomIdInput.value = this.value;
                    initDatePicker(this.value);
                    calculateCheckInBalance(); // Trig calc
                };
            }
        }

        // Listeners for Balance Calculation
        const adelantoInput = document.getElementById('checkInAdelanto');
        if (adelantoInput) adelantoInput.oninput = calculateCheckInBalance;


        // PRE-FILL FROM RESERVATION
        const clientInput = document.getElementById('checkInCliente');
        const outInput = document.getElementById('checkInSalida');

        // Hidden input for reservation ID
        let hRes = document.getElementById('checkInLinkedResId');
        if (!hRes) {
            hRes = document.createElement('input');
            hRes.type = 'hidden';
            hRes.id = 'checkInLinkedResId';
            const f = document.getElementById('formCheckIn');
            if (f) f.appendChild(hRes);
        }
        hRes.value = '';

        const balanceDiv = document.getElementById('checkInBalanceInfo');

        if (linkedRes) {
            if (clientInput) clientInput.value = linkedRes.cliente;

            // Set Out Date
            if (outInput && linkedRes.fechaSalida) {
                try { outInput.value = linkedRes.fechaSalida.substring(0, 10); } catch (e) { }
                outInput.disabled = true; // Lock date
                outInput.title = "Fecha fijada por reserva. Use 'Liberar' para cambiar.";
            }

            hRes.value = linkedRes.id;

            // Show Alert with Release Button
            if (balanceDiv) {
                const paid = Number(linkedRes.pagado) || 0;
                balanceDiv.setAttribute('data-pre-paid', paid);

                // Release Button ID: btnReleaseLinkedRes
                balanceDiv.innerHTML = `
                    <div style="background:#dbeafe; color:#1e40af; padding:10px; border-radius:6px; margin-bottom:10px; font-size:0.9rem; border:1px solid #93c5fd;">
                        <div style="display:flex; justify-content:space-between; align-items:start;">
                            <div>
                                <i class="fas fa-bookmark"></i> <strong>Reserva Detectada</strong><br>
                                Huésped: <strong>${linkedRes.cliente}</strong><br>
                                <span style="font-size:0.85rem">Abono: S/ ${paid.toFixed(2)}</span>
                            </div>
                            <button type="button" id="btnReleaseLinkedRes" style="background:#fff; border:1px solid #1e40af; color:#1e40af; border-radius:4px; padding:2px 6px; font-size:0.75rem; cursor:pointer;" title="Permitir ingreso a otro cliente">
                                <i class="fas fa-unlink"></i> Liberar
                            </button>
                        </div>
                    </div>
                `;
                balanceDiv.style.display = 'block';

                // Attach Listener manually (as innerHTML kills previous bindings inside, but here safe)
                setTimeout(() => {
                    const btn = document.getElementById('btnReleaseLinkedRes');
                    if (btn) {
                        btn.onclick = function () {
                            if (!confirm('¿Desea desvincular la reserva de este Check-In? (La reserva original se mantendrá pendiente)')) return;
                            // Reset Form
                            document.getElementById('checkInLinkedResId').value = '';
                            if (clientInput) clientInput.value = '';
                            if (outInput) {
                                outInput.disabled = false;
                                outInput.title = "";
                            }
                            document.getElementById('checkInBalanceInfo').innerHTML = '';
                            document.getElementById('checkInBalanceInfo').style.display = 'none';
                            document.getElementById('checkInBalanceInfo').removeAttribute('data-pre-paid');
                            calculateCheckInBalance();
                        };
                    }
                }, 100);
            }
            // Trigger balance calc
            setTimeout(calculateCheckInBalance, 300);
        } else {
            if (balanceDiv) {
                balanceDiv.removeAttribute('data-pre-paid');
                // Only clear if it contains our specific alert, to avoid clearing other potential info
                if (balanceDiv.innerHTML.includes('Reserva Encontrada')) {
                    balanceDiv.innerHTML = '';
                    balanceDiv.style.display = 'none';
                }
            }
        }

        // Ensure modal is visible
        document.getElementById('modalCheckIn').style.display = 'flex';

    } catch (e) {
        alert("Error crítico en CheckIn setup: " + e.message);
        console.error(e);
    }
}

function calculateCheckInBalance() {
    try {
        const rParam = document.getElementById('checkInRoomId') ? document.getElementById('checkInRoomId').value : '';
        const rSelect = document.getElementById('checkInRoomSelect');

        // Determine Price
        let price = 0;
        if (rSelect && rSelect.offsetParent !== null && rSelect.selectedOptions[0]) {
            price = Number(rSelect.selectedOptions[0].getAttribute('data-price')) || 0;
        } else {
            // Find in list
            if (currentRoomsList) {
                const r = currentRoomsList.find(x => x.id == rParam);
                if (r) price = Number(r.precio) || 0;
            }
        }

        // Determine Days
        const fIn = document.getElementById('checkInEntrada') ? document.getElementById('checkInEntrada').value : '';
        const fOut = document.getElementById('checkInSalida') ? document.getElementById('checkInSalida').value : '';

        let days = 1;
        if (fIn && fOut) {
            const d1 = new Date(fIn);
            const d2 = new Date(fOut);
            const diff = d2 - d1;
            days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days < 1) days = 1;
        }

        const total = days * price;
        const adelanto = Number(document.getElementById('checkInAdelanto') ? document.getElementById('checkInAdelanto').value : 0) || 0;

        // Check for Pre-Paid (Reservation)
        let infoDiv = document.getElementById('checkInBalanceInfo');
        let prePaid = 0;
        if (infoDiv && infoDiv.hasAttribute('data-pre-paid')) {
            prePaid = Number(infoDiv.getAttribute('data-pre-paid')) || 0;
        }

        const totalPaid = adelanto + prePaid;
        const restante = total - totalPaid;

        // Find or Create Display Info
        if (!infoDiv) {
            const notes = document.getElementById('checkInNotas');
            if (notes) {
                infoDiv = document.createElement('div');
                infoDiv.id = 'checkInBalanceInfo';
                infoDiv.style.marginTop = '10px';
                infoDiv.style.padding = '10px';
                infoDiv.style.background = '#f8fafc';
                infoDiv.style.borderRadius = '8px';
                infoDiv.style.fontSize = '0.9rem';
                notes.parentNode.appendChild(infoDiv); // Append inside form-group or after
            }
        }

        if (infoDiv) {
            let color = restante > 0 ? '#ef4444' : '#22c55e'; // Red if debt, Green if paid
            let text = restante > 0 ? 'Falta Pagar' : 'Pagado';
            if (price === 0) text = 'Precio no disp.';

            // Keep existing alert if any (Reservation Found)
            let existingAlert = '';
            // We need to parse existing alert carefully or re-inject it based on data-pre-paid
            // Simpler: if data-pre-paid exists, re-generate the alert HTML part
            if (prePaid > 0) {
                const clientName = document.getElementById('checkInCliente').value || 'Cliente';
                existingAlert = `
                    <div style="background:#dbeafe; color:#1e40af; padding:10px; border-radius:6px; margin-bottom:10px; font-size:0.9rem; border:1px solid #93c5fd;">
                        <i class="fas fa-bookmark"></i> <strong>Reserva Encontrada</strong><br>
                        Huésped: <strong>${clientName}</strong><br>
                        <span style="font-size:0.85rem">Abono registrado: S/ ${prePaid.toFixed(2)}</span>
                    </div>`;
            }

            infoDiv.innerHTML = `
                ${existingAlert}
                <div style="display:flex; justify-content:space-between; font-weight:bold; color:#475569;">
                    <span>Total (${days} noches):</span>
                    <span>S/ ${total.toFixed(2)}</span>
                </div>
                ${prePaid > 0 ? `
                <div style="display:flex; justify-content:space-between; color:#3b82f6; font-size:0.85rem;">
                    <span>Abono Reserva:</span>
                    <span>- S/ ${prePaid.toFixed(2)}</span>
                </div>` : ''}
                ${adelanto > 0 ? `
                <div style="display:flex; justify-content:space-between; color:#22c55e; font-size:0.85rem;">
                    <span>Pago Ahora:</span>
                    <span>- S/ ${adelanto.toFixed(2)}</span>
                </div>` : ''}
                <div style="display:flex; justify-content:space-between; color:${color}; margin-top:5px; border-top:1px dashed #cbd5e1; padding-top:5px;">
                    <span>${text}:</span>
                    <span>S/ ${restante.toFixed(2)}</span>
                </div>
            `;
            infoDiv.style.display = 'block';
        }
    } catch (e) { console.warn("Balance calc error", e); }
}

function closeCheckIn() {
    document.getElementById('modalCheckIn').style.display = 'none';
}

async function processCheckIn(e) {
    e.preventDefault();

    // [NEW] Shift Management Validation
    if (!currentCaja) {
        alert('⚠️ Debe ABRIR CAJA (Turno) antes de realizar ingresos o movimientos.');
        toggleCajaAction(); // Open the modal for them
        return;
    }

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
    } else {
        // [NEW] Smart Check-In: Use detected Linked Reservation
        const hRes = document.getElementById('checkInLinkedResId');
        const linkedId = hRes ? hRes.value : null;

        if (linkedId) {
            console.log("Using linked reservation for Check-In:", linkedId);
            // We treat this as a confirmation of an existing reservation
            data.action = 'checkIn'; // We keep action 'checkIn' but pass id to update
            data.isReservation = true; // Flag to tell backend this is confirming a res
            data.reservationId = linkedId; // Explicit ID

            // Also pass adelanto if any, to be added as payment
            data.adelanto = document.getElementById('checkInAdelanto') ? document.getElementById('checkInAdelanto').value : 0;
            data.metodo = document.getElementById('checkInMetodo') ? document.getElementById('checkInMetodo').value : 'Efectivo';
        } else {
            // Normal Walk-In / New Reservation
            data.action = 'checkIn';
            data.adelanto = document.getElementById('checkInAdelanto') ? document.getElementById('checkInAdelanto').value : 0;
            data.metodo = document.getElementById('checkInMetodo') ? document.getElementById('checkInMetodo').value : 'Efectivo';
        }
    }

    // [NEW] Attach Caja ID
    data.cajaId = currentCaja ? currentCaja.id : null;

    if ((!data.isExtension && !data.fechaEntrada) || !data.fechaSalida || !data.cliente) {
        alert('Por favor complete todos los campos.');
        submitBtn.innerText = 'Confirmar'; // Reset
        submitBtn.disabled = false;
        return;
    }

    // Initial Load
    checkSession();

    // [NEW] Background Auto-Refresh (60s)
    setInterval(() => {
        // Only refresh if user is logged in and page is visible
        if (!document.hidden && localStorage.getItem('erp_token')) {
            console.log("🔄 Auto-refreshing data...");
            // Silent Refresh based on current view
            if (document.getElementById('view-calendar').style.display !== 'none') {
                loadCalendarView(); // This might be too heavy? Ideally partial refresh.
                // For now, full reload is safe to ensure consistency.
            } else if (document.getElementById('view-rooms').style.display !== 'none') {
                loadRooms();
            }
        }
    }, 60000); // 60 seconds

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
        // Update Room Status Locally
        const room = currentRoomsList.find(r => r.id == data.habitacionId);
        if (room) {
            room.estado = 'Ocupado';
            room.cliente = data.cliente;
        }

        // Update / Create Reservation Locally
        if (data.reservationId) {
            // Confirming existing
            const existing = currentReservationsList.find(r => r.id === data.reservationId);
            if (existing) {
                existing.estado = 'Activa';
                existing.habitacionId = data.habitacionId;
                // Optimistic Payment Update
                if (Number(data.adelanto) > 0) {
                    if (!existing.pagos) existing.pagos = [];
                    existing.pagos.push({
                        monto: Number(data.adelanto),
                        metodo: data.metodo,
                        fecha: new Date().toISOString()
                    });
                    existing.pagado = (Number(existing.pagado) || 0) + Number(data.adelanto);
                }
            }
        } else {
            // New Walk-In
            const tempId = 'temp-' + new Date().getTime();
            currentReservationsList.push({
                id: tempId,
                habitacionId: data.habitacionId,
                cliente: data.cliente,
                fechaEntrada: data.fechaEntrada,
                fechaSalida: data.fechaSalida,
                estado: 'Activa',
                total: 100, // Dummy until reload
                pagado: Number(data.adelanto),
                notas: data.notas + ' (Sincronizando...)'
            });
        }
    }

    // Render Immediately
    renderCalendarTimeline();
    showToast('Check-In registrado. Sincronizando...');

    // 5. Backend Sync
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const d = await res.json();

        if (d.success) {
            showToast('Check-In Sincronizado Correctamente');
            // Allow backend to refresh full real data
            loadCalendarView();
        } else {
            alert('Error en servidor: ' + d.error);
            loadCalendarView(); // Revert
        }
    } catch (e) {
        console.error(e);
        alert('Error de conexión. Verifique internet.');
        loadCalendarView(); // Revert
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
    const btn = document.querySelector('#modalLiquidation .btn-submit-pay') || document.querySelector('#modalLiquidation button[onclick="submitPago()"]');

    if (!monto || !resId) return alert('Ingrese monto');

    // UI Loading
    const originalText = btn ? btn.innerText : 'Ingresar Pago';
    if (btn) {
        btn.innerText = 'Procesando...';
        btn.disabled = true;
    }

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
    } catch (e) {
        alert('Error guardando pago');
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}

function printVoucher() {
    if (!currentLiqData) return;

    const w = window.open('', '_blank', 'width=400,height=600');
    const d = currentLiqData;
    const itemsHtml = d.internals.map(i => `<tr><td>${i.descripcion}</td><td align="right">${i.monto.toFixed(2)}</td></tr>`).join('') +
        d.externals.map(e => `<tr><td>${e.descripcion}</td><td align="right">${e.monto.toFixed(2)}</td></tr>`).join('');

    // Dates
    const checkIn = new Date(d.reservation.fechaEntrada).toLocaleDateString();
    const checkOut = new Date(d.reservation.fechaSalida).toLocaleDateString();

    // Payments List
    let paymentsHtml = '';
    if (d.payments && d.payments.length > 0) {
        paymentsHtml = `
            <div style="margin-top:5px; border-bottom:1px dashed black; padding-bottom:2px;">
                <div style="font-weight:bold; margin-bottom:2px;">HISTORIAL PAGOS:</div>
                <table style="width:100%">`;
        d.payments.forEach(p => {
            paymentsHtml += `
              <tr>
                 <td style="font-size:10px;">${new Date(p.fecha).toLocaleDateString()} ${p.metodo.substring(0, 6)}</td>
                 <td align="right">S/ ${p.monto.toFixed(2)}</td>
              </tr>`;
        });
        paymentsHtml += `</table></div>`;
    }

    const html = `
    <html>
    <head>
        <title>Voucher Casa Munay</title>
        <style>
            body { font-family: 'Courier New', monospace; font-size: 11px; max-width: 280px; margin: 0 auto; padding: 5px; color: black; }
            .header { text-align: center; border-bottom: 1px dashed black; padding-bottom: 5px; margin-bottom: 5px; }
            .totals { border-top: 1px dashed black; margin-top: 5px; padding-top: 5px; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 2px 0; }
            .brand { font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
            .sub-brand { font-size: 10px; margin-bottom: 5px; }
            .qr-container { text-align: center; margin-top: 10px; }
            .qr-img { width: 80px; height: 80px; }
        </style>
    </head>
    <body onload="window.print()">
        <div class="header">
            <div class="brand">HOSPEDAJE CASA MUNAY</div>
            <div class="sub-brand">RUC: 20610099999</div>
            ----------------<br>
            Cliente: <b>${d.reservation.cliente}</b><br>
            Hab: <b>${d.reservation.habitacionNombre || d.reservation.habitacionId}</b> | Recibo: ${new Date().getTime().toString().substr(-6)}<br>
            Estadía: ${checkIn} - ${checkOut}<br>
            Fecha Emisión: ${new Date().toLocaleString()}
        </div>
        
        <table>
            <tr><td style="border-bottom:1px solid #000;">Concepto</td><td align="right" style="border-bottom:1px solid #000;">Total</td></tr>
            <tr><td>${d.stay.descripcion}</td><td align="right">${d.stay.monto.toFixed(2)}</td></tr>
            ${itemsHtml}
        </table>
        
        ${paymentsHtml}

        <div class="totals">
            <table>
                <tr><td><strong>TOTAL:</strong></td><td align="right"><strong>S/ ${d.totals.consumption.toFixed(2)}</strong></td></tr>
                <tr><td>PAGADO:</td><td align="right">S/ ${d.totals.paid.toFixed(2)}</td></tr>
                <tr><td>SALDO:</td><td align="right">S/ ${d.totals.balance.toFixed(2)}</td></tr>
            </table>
        </div>
        
        <div class="qr-container">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=CASAMUNAY-RES-${d.reservation.id}" class="qr-img"><br>
            <span style="font-size:9px;">Reserva #${d.reservation.id}</span>
        </div>
        
        <div style="text-align:center; margin-top:10px; font-size:10px;">
            ¡Gracias por su preferencia!<br>
            www.casamunay.com
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
            // [FIX] Also refresh calendar if we are looking at it
            if (document.getElementById('view-calendar').style.display !== 'none') {
                loadCalendarView();
            }
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

        // Robust Image Logic
        let imgDisplay = '<div style="width:40px; height:40px; background:#f1f5f9; border-radius:4px; display:flex; align-items:center; justify-content:center;"><i class="fas fa-image" style="color:#cbd5e1;"></i></div>';

        if (p.imagen_url && p.imagen_url.length > 5) {
            // Handle Google Drive links specifically if needed, but standard <img> usually works if public
            imgDisplay = `<img src="${p.imagen_url}" 
                style="width:40px; height:40px; border-radius:4px; object-fit:cover;" 
                onerror="this.onerror=null; this.parentNode.innerHTML='<div style=\'width:40px; height:40px; background:#fee2e2; border-radius:4px; display:flex; align-items:center; justify-content:center;\'><i class=\'fas fa-exclamation-triangle\' style=\'color:#f87171;\'></i></div>'">`;
        }

        // Robust Price Logic
        let displayPrice = 'S/ 0.00';
        const priceNum = Number(p.precio);

        if (!isNaN(priceNum) && p.precio !== '' && p.precio !== null) {
            displayPrice = 'S/ ' + priceNum.toFixed(2);
        } else {
            // Graceful error: Show warning but allow editing to fix it
            displayPrice = `<span style="color:#ef4444; font-weight:bold; cursor:help;" title="Valor inválido: ${p.precio}">
                                <i class="fas fa-exclamation-circle"></i> Revisar
                            </span>`;
        }

        html += `
        <tr style="border-bottom:1px solid #f1f5f9;">
            <td style="padding:15px;">${imgDisplay}</td>
            <td style="padding:15px;">
                <div style="font-weight:600;">${p.nombre}</div>
                <div style="font-size:0.8rem; color:#94a3b8;">${p.descripcion || ''}</div>
            </td>
            <td style="padding:15px;"><span style="color:${catColor}; font-weight:bold;">${p.categoria}</span></td>
            
            <td style="padding:15px;">${displayPrice}</td>
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

    // RESET BUTTON
    const btn = document.querySelector('#modalProductEditor button[type="submit"]');
    if (btn) {
        btn.disabled = false;
        btn.innerText = 'Guardar Producto';
    }

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
    // Show Preview if URL exists
    if (p.imagen_url) {
        document.getElementById('imgPreview').src = p.imagen_url;
        document.getElementById('imagePreviewContainer').style.display = 'block';
    } else {
        document.getElementById('imagePreviewContainer').style.display = 'none';
        document.getElementById('imgPreview').src = '';
    }

    // RESET BUTTON
    const btn = document.querySelector('#modalProductEditor button[type="submit"]');
    if (btn) {
        btn.disabled = false;
        btn.innerText = 'Guardar Cambios';
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

    // VALIDATION
    if (!prodData.nombre || prodData.nombre.trim() === '') {
        alert("El nombre del producto es obligatorio");
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }
    if (isNaN(Number(prodData.precio)) || Number(prodData.precio) < 0) {
        alert("El precio debe ser un número válido mayor o igual a 0");
        btn.innerText = originalText;
        btn.disabled = false;
        return;
    }

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

// Helper for Local YYYY-MM-DD
function getLocalISODate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function renderCalendarTimeline(rooms, reservations) {
    // Guard against undefined/null inputs (Fix for crash)
    if (!rooms || !Array.isArray(rooms)) {
        console.warn('renderCalendarTimeline: rooms is invalid', rooms);
        rooms = [];
    }
    if (!reservations || !Array.isArray(reservations)) {
        reservations = [];
    }

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
    <div class="calendar-container" style="overflow-x:auto;"> 
        <!-- Sticky Header Context -->
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px; background:white; position:sticky; top:0; left:0; z-index:40; border-bottom:1px solid #f1f5f9; min-width:800px;">
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

        <table style="width:100%; border-collapse:collapse; min-width:800px; table-layout: fixed;">
            <thead>
                <tr>
                    <th class="sticky-header sticky-col" style="padding:10px; text-align:left; border-bottom:2px solid #e2e8f0; width:100px; background:white; z-index:41;">Hab.</th>
                    ${dates.map(d => {
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
        const dayNum = d.getDate();
        const fullIso = getLocalISODate(d); // FIXED: Local Date
        const todayIso = getLocalISODate(new Date()); // FIXED: Local Date
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

    // Tooltip Helpers (Injected here or global)
    // We rely on Global showTooltip defined later or inline

    rooms.forEach(r => {
        const isDirty = (r.estado || '').toLowerCase() === 'sucio';
        let statusDot = '';
        if (isDirty) {
            statusDot = `<i class='fas fa-broom' style='color:#f59e0b; margin-left:5px; font-size:0.8rem;' title='Limpieza Requerida'></i>`;
        } else if ((r.estado || '').toLowerCase() === 'ocupado') {
            statusDot = `<span style='display:inline-block; width:8px; height:8px; background:${colorActive}; border-radius:50%; margin-left:5px;'></span>`;
        }

        html += `<tr class="calendar-row" style="border-bottom:1px solid #f1f5f9;">
                    <td class="sticky-col" style="padding:15px 10px; font-weight:bold; color:var(--primary); cursor:pointer; background:white; z-index:30;" onclick="openRoomDetail('${r.id}')" onmouseenter="showTooltip(event, 'Habitación ${r.numero}<br><small>${r.tipo}</small>')" onmouseleave="hideTooltip()">
                        ${r.numero} ${statusDot}<br>
                        <span style="font-size:0.7rem; color:#94a3b8; font-weight:normal;">${r.tipo}</span>
                    </td>`;

        dates.forEach(date => {
            const isoDate = getLocalISODate(date); // FIXED
            const todayIso = getLocalISODate(new Date()); // FIXED
            const isToday = isoDate === todayIso;
            const isPast = isoDate < todayIso;

            // Highlight Column & Dirty Logic
            let tdClass = isToday ? 'cell-today-col' : '';

            // Dirty Pattern (Only for empty slots in Today/Future)
            const isDirty = (r.estado || '').toLowerCase() === 'sucio';

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

                // S/E Robust Parsing (Handling Timezones)
                let s, e;
                try {
                    // Backend returns ISO string. 
                    // To handle "date" consistently, we need to map Reservation dates to LOCAL YYYY-MM-DD
                    // BUT Backend "checkin" stores them as UTC moments.
                    // If stored as "2024-01-01T19:00:00Z" (for 14:00 Local), 
                    // new Date(str) -> Local Date Object (Jan 1 14:00).
                    // getLocalISODate -> "2024-01-01". CORRECT.

                    s = getLocalISODate(new Date(res.fechaEntrada));
                    e = getLocalISODate(new Date(res.fechaSalida));
                } catch (err) { return false; }

                return isoDate >= s && isoDate <= e;
            });

            // [NEW] Detect overlapping reservations (check-out + check-in on same day)
            let checkOutRes = null;
            let checkInRes = null;

            matches.forEach(res => {
                const s = getLocalISODate(new Date(res.fechaEntrada));
                const e = getLocalISODate(new Date(res.fechaSalida));

                if (isoDate === e && isoDate !== s) {
                    checkOutRes = res; // This reservation ends today
                } else if (isoDate === s) {
                    checkInRes = res; // This reservation starts today
                }
            });

            // If both exist, we have overlapping reservations
            const hasOverlap = checkOutRes && checkInRes;

            if (matches.length > 0) {
                // Prioritize rendering logic
                const res = hasOverlap ? checkOutRes : matches[0];
                barId = res.id;

                let s = getLocalISODate(new Date(res.fechaEntrada));
                let e = getLocalISODate(new Date(res.fechaSalida));

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
                    if (isoDate === getLocalISODate(dates[0])) {
                        barLabel = (res.cliente || '').split(' ')[0];
                    }
                }

                if (!barLabel && barType === 'res-bar-single') barLabel = (res.cliente || '').split(' ')[0];

                // Calculate tooltip data
                const total = Number(res.total) || 0;
                const paid = Number(res.pagado) || 0; // This might need a refresh signal or be approx
                let realPaid = paid;
                if (res.pagos && Array.isArray(res.pagos)) {
                    realPaid = res.pagos.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
                }
                const pending = total - realPaid;

                const d1 = new Date(res.fechaEntrada);
                const d2 = new Date(res.fechaSalida);
                const nights = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));

                // [MOD] Enhanced Rich Tooltip - Use JSON data attribute to avoid quote escaping issues
                const tooltipData = {
                    cliente: res.cliente || '',
                    estado: res.estado,
                    nights: nights,
                    total: total.toFixed(2),
                    paid: realPaid.toFixed(2),
                    pending: pending.toFixed(2),
                    pendingColor: pending > 0 ? '#f87171' : '#4ade80',
                    paidColor: pending <= 0 ? '#4ade80' : '#fff',
                    notas: res.notas || ''
                };

                const tooltipJson = JSON.stringify(tooltipData).replace(/"/g, '&quot;');

                // Single Debt Dot
                let debtHtml = '';
                if (pending > 0.5) { // Small tolerance
                    // FIXED: Use single quotes inside HTML string to avoid conflict
                    debtHtml = `<span style='position:absolute; right:2px; top:2px; height:6px; width:6px; background:red; border-radius:50%;'></span>`;
                }

                // [NEW] OVERLAPPING RESERVATIONS: Render both if they exist
                // CENTER LABEL LOGIC
                // Calculate which day index (0-based) this is relative to the reservation start
                // We need to know the Total Duration of the reservation this bar belongs to.

                let targetResForLabel = null;
                let isCheckInLabel = false; // If true, we are labeling the Right Side of a Split

                // Identify which reservation we are currently rendering a segment for
                if (hasOverlap) {
                    // Split Cell: We have TWO reservations here.
                    // The LEFT half is the End of Res 1.
                    // The RIGHT half is the Start of Res 2.
                    // We must handle labels for BOTH independently.
                } else {
                    if (barId) targetResForLabel = res; // Standard case
                }

                // Helper to determine if we show label based on VISIBLE overlap
                const shouldShowLabel = (reservation) => {
                    if (!reservation) return false;

                    // 1. Get Visible Range Boundaries
                    // dates[] is sorted.
                    const visibleStart = dates[0];
                    const visibleEnd = dates[dates.length - 1];

                    // 2. Get Reservation Range
                    const rStart = new Date(reservation.fechaEntrada);
                    const rEnd = new Date(reservation.fechaSalida);

                    // 3. Normalize to Noon to avoid time boundary issues for comparison
                    const vStartNorm = new Date(visibleStart); vStartNorm.setHours(12, 0, 0, 0);
                    const vEndNorm = new Date(visibleEnd); vEndNorm.setHours(12, 0, 0, 0);
                    const rStartNorm = new Date(rStart); rStartNorm.setHours(12, 0, 0, 0);
                    const rEndNorm = new Date(rEnd); rEndNorm.setHours(12, 0, 0, 0);

                    // 4. Calculate Overlap
                    // Overlap Start is max(visibleStart, resStart)
                    // Overlap End is min(visibleEnd, resEnd)
                    const overlapStart = rStartNorm > vStartNorm ? rStartNorm : vStartNorm;
                    const overlapEnd = rEndNorm < vEndNorm ? rEndNorm : vEndNorm;

                    // If no overlap, return false
                    if (overlapStart > overlapEnd) return false;

                    // 5. Calculate Visible Duration
                    // What is the index of the CURRENT `date` within the overlap range?
                    const currentNorm = new Date(date); currentNorm.setHours(12, 0, 0, 0);

                    if (currentNorm < overlapStart || currentNorm > overlapEnd) return false;

                    const daysFromOverlapStart = Math.round((currentNorm - overlapStart) / (1000 * 60 * 60 * 24));
                    const visibleDays = Math.round((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1;

                    // 6. Midpoint of visible range
                    const midPoint = Math.floor((visibleDays - 1) / 2); // 0-based index

                    return daysFromOverlapStart === midPoint;
                };

                // Logic inside HTML generation:

                if (hasOverlap) {
                    const res2 = checkInRes;
                    // tooltipJson for checkOutRes is already calculated as 'tooltipJson'

                    const total2 = Number(res2.total) || 0;
                    const paid2 = Number(res2.pagado) || 0;
                    let realPaid2 = paid2;
                    if (res2.pagos && Array.isArray(res2.pagos)) {
                        realPaid2 = res2.pagos.reduce((sum, p) => sum + (Number(p.monto) || 0), 0);
                    }
                    const pending2 = total2 - realPaid2;
                    const d1_2 = new Date(res2.fechaEntrada);
                    const d2_2 = new Date(res2.fechaSalida);
                    const nights2 = Math.max(1, Math.ceil((d2_2 - d1_2) / (1000 * 60 * 60 * 24)));

                    const tooltipData2 = {
                        cliente: res2.cliente || '', estado: res2.estado, nights: nights2,
                        total: total2.toFixed(2), paid: realPaid2.toFixed(2), pending: pending2.toFixed(2),
                        pendingColor: pending2 > 0 ? '#ef4444' : '#22c55e',
                        paidColor: pending2 <= 0 ? '#22c55e' : '#fff',
                        notas: res2.notas || ''
                    };
                    const tooltipJson2 = JSON.stringify(tooltipData2).replace(/"/g, '&quot;');

                    let col2 = colorFuture;
                    if (res2.estado === 'Activa' || res2.estado === 'Ocupada') col2 = colorActive;
                    if (res2.estado === 'Finalizada') col2 = colorPast;

                    // Calc Labels
                    // Res 1 (Left/End): current 'res' (which is checkOutRes)
                    const showLabel1 = shouldShowLabel(checkOutRes);
                    const label1 = showLabel1 ? (checkOutRes.cliente || '').split(' ')[0].substring(0, 8) : '';

                    // Res 2 (Right/Start): 'res2' (which is checkInRes)
                    const showLabel2 = shouldShowLabel(res2);
                    const label2 = showLabel2 ? (res2.cliente || '').split(' ')[0].substring(0, 8) : '';

                    html += `<td class="${tdClass}" style="padding:0; height:40px; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; vertical-align:middle;">
                                <div style="display:flex; width:100%; height:100%; align-items:center;">
                                    <div class="res-bar-base" 
                                         style="background:${barColor}; flex:1; height:28px; border-radius:0 4px 4px 0; margin-right:1px; padding-left:4px; font-size:0.7rem;" 
                                         onclick="openReservationDetail('${checkOutRes.id}')"
                                         onmouseenter="showTooltipFromData(event, this)" 
                                         onmouseleave="hideTooltip()"
                                         data-tooltip-data="${tooltipJson}">
                                         ${label1}
                                         ${pending > 0.5 ? `<span style='position:absolute; right:2px; top:2px; height:6px; width:6px; background:red; border-radius:50%;'></span>` : ''}
                                    </div>
                                    <div class="res-bar-base" 
                                         style="background:${col2}; flex:1; height:28px; border-radius:4px 0 0 4px; margin-left:1px; padding-left:4px; font-size:0.7rem;" 
                                         onclick="openReservationDetail('${checkInRes.id}')"
                                         onmouseenter="showTooltipFromData(event, this)" 
                                         onmouseleave="hideTooltip()"
                                         data-tooltip-data="${tooltipJson2}">
                                         ${label2}
                                         ${pending2 > 0.5 ? `<span style='position:absolute; right:2px; top:2px; height:6px; width:6px; background:red; border-radius:50%;'></span>` : ''}
                                    </div>
                                </div>
                             </td>`;

                } else if (barType === 'res-bar-end') {
                    // Ends today
                    const showLabel = shouldShowLabel(res);
                    const label = showLabel ? barLabel : '';

                    html += `<td class="${tdClass}" style="padding:0; height:40px; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; vertical-align:middle;">
                                <div style="display:flex; width:100%; height:100%; align-items:center;">
                                     <div class="res-bar-base" 
                                         style="background:${barColor}; width:50%; height:28px; border-radius:0 4px 4px 0; margin:0; padding-left:4px;" 
                                         onclick="openReservationDetail('${barId}')"
                                         onmouseenter="showTooltipFromData(event, this)" 
                                         onmouseleave="hideTooltip()"
                                         data-tooltip-data="${tooltipJson}">
                                         ${label}
                                         ${debtHtml}
                                    </div>
                                    <div style="flex:1; height:100%; cursor:pointer;" 
                                         onclick="openNewReservation('${r.id}', '${r.numero}', '${isoDate}')"
                                         class="cell-hover" title="Disponible">
                                    </div>
                                </div>
                             </td>`;

                } else if (barType === 'res-bar-start') {
                    // Starts today
                    const showLabel = shouldShowLabel(res);
                    const label = showLabel ? barLabel : '';

                    html += `<td class="${tdClass}" style="padding:0; height:40px; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; vertical-align:middle;">
                                <div style="display:flex; width:100%; height:100%; align-items:center;">
                                    <div style="flex:1; height:100%; cursor:pointer;" 
                                         onclick="openNewReservation('${r.id}', '${r.numero}', '${isoDate}')"
                                         class="cell-hover" title="Disponible">
                                    </div>
                                     <div class="res-bar-base" 
                                         style="background:${barColor}; width:50%; height:28px; border-radius:4px 0 0 4px; margin:0; padding-left:4px;" 
                                         onclick="openReservationDetail('${barId}')"
                                         onmouseenter="showTooltipFromData(event, this)" 
                                         onmouseleave="hideTooltip()"
                                         data-tooltip-data="${tooltipJson}">
                                         ${label}
                                         ${debtHtml}
                                    </div>
                                </div>
                             </td>`;

                } else if (barType === 'res-bar-mid') {
                    // MIDDLE
                    const showLabel = shouldShowLabel(res);
                    const label = showLabel ? barLabel : '';

                    html += `<td class="${tdClass}" style="padding:0; height:40px; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; vertical-align:middle;">
                                <div style="display:flex; width:100%; height:100%; align-items:center;">
                                    <div class="res-bar-base" 
                                         style="background:${barColor}; width:100%; height:28px; border-radius:0; margin:0; padding-left:4px;" 
                                         onclick="openReservationDetail('${barId}')"
                                         onmouseenter="showTooltipFromData(event, this)" 
                                         onmouseleave="hideTooltip()"
                                         data-tooltip-data="${tooltipJson}">
                                         ${label}
                                         ${debtHtml}
                                    </div>
                                </div>
                             </td>`;

                } else {
                    // SINGLE DAY (Isolated)
                    // Always show label for single day
                    html += `<td class="${tdClass}" style="padding:0; height:40px; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; vertical-align:middle;">
                                <div style="display:flex; justify-content:center; align-items:center; width:100%; height:100%;">
                                    <div class="res-bar-base" 
                                         style="background:${barColor}; width:90%; height:28px; border-radius:4px; padding-left:4px;" 
                                         onclick="openReservationDetail('${barId}')"
                                         onmouseenter="showTooltipFromData(event, this)" 
                                         onmouseleave="hideTooltip()"
                                         data-tooltip-data="${tooltipJson}">
                                         ${barLabel}
                                         ${debtHtml}
                                    </div>
                                </div>
                             </td>`;
                }

            } else {
                // Empty Cell
                let cellInnerClass = "cell-hover";
                let dirtyMarker = "";
                if (isDirty && !isPast) {
                    // dirtyMarker = ... (User requested to remove this from cells)
                    dirtyMarker = "";
                }

                html += `<td class="${tdClass}" style="padding:0; height:40px; border-bottom:1px solid #f1f5f9; border-right:1px solid #f1f5f9; text-align:center;">
                            <div onclick="openNewReservation('${r.id}', '${r.numero}', '${isoDate}')" 
                                 style="height:100%; width:100%; cursor:pointer; display:flex; justify-content:center; align-items:center;" 
                                 class="${cellInnerClass}">
                                 ${dirtyMarker}
                            </div>
                        </td>`;
            }
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>
    <style>
        .cell-hover:hover { background-color: #f1f5f9; }
        .res-bar-base {
            display: flex; 
            align-items: center; 
            color: white; 
            font-size: 0.75rem; 
            font-weight: 500; 
            white-space: nowrap; 
            overflow: hidden;
            cursor: pointer;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05); 
            transition: opacity 0.2s;
        }
        .res-bar-base:hover {
            opacity: 0.85;
        }
    </style>`;

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

    // [MOD] Concierge Info Elements (Need to ensure these exist in HTML or inject them)
    // For now, we'll inject meaningful HTML into 'rdActions' or a new container if needed.
    // Let's assume we reuse the modal structure and inject a "Dashboard" into a specific container.
    // Or simpler: Build a rich HTML string for the "Actions" area which is actually the body of the card?
    // Looking at index.html (not fully visible but checking standard modal layout), 
    // usually there are specific fields.
    // Let's use the 'rdActions' container to append the Dashboard Info + Buttons.

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

    // 3. Status logic
    const status = (r.estado || 'Disponible').toLowerCase();
    let statusText = 'DISPONIBLE';
    let badgeColor = '#10b981'; // green

    // Find Active Reservation Context (Corrected for Today)
    let activeRes = null;
    const todayNum = new Date().setHours(0, 0, 0, 0);

    // Filter relevant reservations
    const candidateRes = currentReservationsList.filter(res =>
        (String(res.habitacionId) === String(r.id) || String(res.habitacionNumero) === String(r.numero)) &&
        (res.estado === 'Activa' || res.estado === 'Ocupada')
    );

    // Find one that actually overlaps today
    activeRes = candidateRes.find(res => {
        const s = new Date(res.fechaEntrada).setHours(0, 0, 0, 0);
        const e = new Date(res.fechaSalida).setHours(0, 0, 0, 0);
        return todayNum >= s && todayNum <= e; // strictly strictly inside or on edge
        // Note: Often check-out day is technically "occupied" in morning, but "free" in afternoon.
        // If we want "Current Guest", usually it's someone who checked in <= today and checks out >= today.
    });

    // Fallback: If no date overlap (maybe bad dates?), take the most recently created one
    if (!activeRes && candidateRes.length > 0) {
        // Sort by ID descending (assuming numeric or time-based ID) or simply take last
        // If IDs are RES-timestamp, we can string compare
        candidateRes.sort((a, b) => (b.id > a.id) ? 1 : -1);
        activeRes = candidateRes[0];
    }

    // Fallback for "Dirty" but physically occupied? Or "Reserved" pending?
    let pendingRes = currentReservationsList.find(res =>
        (String(res.habitacionId) === String(r.id) || String(res.habitacionNumero) === String(r.numero)) &&
        (res.estado === 'Reserva') &&
        new Date(res.fechaEntrada).toDateString() === new Date().toDateString() // Today
    );

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
        badgeColor = '#64748B';
    }
    badge.innerText = statusText;
    badge.style.backgroundColor = badgeColor;

    // 4. Build Dashboard HTML
    let dashHtml = '';

    // A. Guest Info Section (If Occupied or Active)
    if (activeRes) {
        // Calculate Balance
        const total = activeRes.total || 0;
        const paid = activeRes.pagado || 0; // This might need a refresh signal or be approx
        // We can't easily get live balance here without async. 
        // For "Concierge View", let's show what we have or a "Ver Detalle" to fetch updated.
        // Or reuse r.deuda from Room List? 
        // r.deuda was populated by getHabitaciones backend!
        const debt = r.deuda !== undefined ? r.deuda : 0;
        const debtColor = debt > 0 ? '#ef4444' : '#22c55e';
        const debtText = debt > 0 ? `Pendiente: S/ ${debt.toFixed(2)}` : 'Pagado';

        dashHtml += `
            <div style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:15px; border-left:4px solid ${badgeColor};">
                <div style="font-size:0.8rem; color:#64748B; font-weight:bold; text-transform:uppercase;">Huésped Actual</div>
                <div style="font-size:1.2rem; font-weight:bold; color:#1e293b; margin-bottom:5px;">${activeRes.cliente}</div>
                <div style="display:flex; gap:15px; font-size:0.9rem; color:#334155;">
                    <div><i class="fas fa-sign-in-alt"></i> ${new Date(activeRes.fechaEntrada).toLocaleDateString()}</div>
                    <div><i class="fas fa-sign-out-alt"></i> ${new Date(activeRes.fechaSalida).toLocaleDateString()}</div>
                </div>
                <div style="margin-top:10px; font-weight:bold; color:${debtColor}; display:flex; justify-content:space-between; align-items:center;">
                    <span>${debtText}</span>
                    <button onclick="closeRoomDetail(); openReservationDetail('${activeRes.id}')" style="background:#fff; border:1px solid #3b82f6; color:#3b82f6; border-radius:4px; font-size:0.75rem; padding:4px 10px; cursor:pointer;">
                        Ver Detalle / Pagos <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `;
    } else if (pendingRes) {
        dashHtml += `
            <div style="background:#fffbeb; padding:15px; border-radius:8px; margin-bottom:15px; border-left:4px solid #eab308;">
                <div style="font-size:0.8rem; color:#b45309; font-weight:bold; text-transform:uppercase;">Reservado para Hoy</div>
                <div style="font-size:1.1rem; font-weight:bold; color:#78350f;">${pendingRes.cliente}</div>
                <div style="margin-top:5px; font-size:0.9rem; color:#92400e;">Llegada esperando confirmación.</div>
                <button onclick="closeRoomDetail(); openReservationDetail('${pendingRes.id}')" style="margin-top:8px; background:#fff; border:1px solid #d97706; color:#d97706; border-radius:4px; font-size:0.75rem; padding:4px 10px; cursor:pointer;">
                    Ver Reserva / Check-In
                </button>
            </div>
        `;
    } else if (status === 'disponible') {
        dashHtml += `
            <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:15px; text-align:center;">
                <div style="color:#15803d; font-weight:600;">Habitación Lista</div>
                <div style="font-size:0.85rem; color:#166534;">Limpia y preparada para recibir huéspedes.</div>
            </div>
        `;
    }

    // B. Actions Buttons
    dashHtml += '<div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">';

    if (status === 'disponible') {
        dashHtml += `<button class="rd-btn" style="background:#22c55e; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;" onclick="closeRoomDetail(); openCheckIn('${r.id}', '${r.numero}')"><i class="fas fa-check"></i> Check-In</button>`;
        dashHtml += `<button class="rd-btn" style="background:#eab308; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;" onclick="closeRoomDetail(); openReservation('${r.id}', '${r.numero}')"><i class="fas fa-calendar-alt"></i> Reservar</button>`;
    }
    else if (status === 'ocupado') {
        dashHtml += `<button class="rd-btn" style="background:#ef4444; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;" onclick="closeRoomDetail(); openCheckOut('${r.id}')"><i class="fas fa-sign-out-alt"></i> Finalizar Estadia</button>`;
        // Extension
        if (activeRes) {
            dashHtml += `<button class="rd-btn" style="background:#3b82f6; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;" onclick="closeRoomDetail(); openReservation('${r.id}', '${r.numero}', '', '', 'extend', '${activeRes.id}', '${activeRes.fechaSalida}')"><i class="fas fa-clock"></i> Extender</button>`;
        }
    }
    else if (status === 'sucio') {
        dashHtml += `<button class="rd-btn" style="background:#64748B; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;" onclick="closeRoomDetail(); markRoomClean('${r.id}')"><i class="fas fa-broom"></i> Marcar Limpio</button>`;
        // Allow Check-In Override
        dashHtml += `<button class="rd-btn" style="background:#cbd5e1; color:#475569; padding:12px; border:none; border-radius:8px; font-weight:bold;" onclick="if(confirm('¿Hacer Check-In en habitación sucia?')) { closeRoomDetail(); openCheckIn('${r.id}', '${r.numero}'); }"><i class="fas fa-check"></i> Check-In Rápido</button>`;
    }
    else if (status === 'reservado') {
        // Actions for Reserved but not yet Occupied (physically)
        // Usually handled by pendingRes block above which gives "Ver Reserva"
        dashHtml += `<button class="rd-btn" style="background:#22c55e; color:white; padding:12px; border:none; border-radius:8px; font-weight:bold;" onclick="closeRoomDetail(); openCheckIn('${r.id}', '${r.numero}')"><i class="fas fa-check"></i> Check-In Directo</button>`;
    }

    dashHtml += '</div>'; // End grid

    // Inject
    const actionsContainer = document.getElementById('rdActions');
    actionsContainer.innerHTML = dashHtml;
    actionsContainer.style.display = 'block'; // Ensure visible

    // Show Modal
    const modal = document.getElementById('modalRoomDetail');
    modal.style.display = 'flex';
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

    if (!currentCaja) { alert('⚠️ Caja Cerrada. Abra caja para registrar movimientos.'); toggleCajaAction(); return; }

    if (!pId || !qty || !cost) return alert('Datos incompletos');

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'registerPurchase',
                productoId: pId,
                cantidad: qty,
                cajaId: currentCaja.id,
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

    if (!currentCaja) { alert('⚠️ Caja Cerrada. Abra caja para registrar gastos.'); toggleCajaAction(); return; }

    if (!desc || !amt || !date) return alert('Datos incompletos');

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveGasto',
                descripcion: desc,
                categoria: cat,
                monto: amt,
                fecha: date,
                cajaId: currentCaja.id
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
}


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

    if (!currentCaja) { alert('⚠️ Caja Cerrada. Abra caja para registrar consumos/pagos.'); toggleCajaAction(); return; }

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
            productoId: prodId,
            cajaId: currentCaja.id
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
            fechaProgramada: date,
            cajaId: currentCaja.id
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

// [NEW] SMART FULL CHECK-IN LOGIC
function openCheckIn(roomId, roomNum) {
    // 1. Global Call (No Room Selected)
    if (!roomId) {
        const modal = document.getElementById('modalCheckIn');
        if (modal) {
            modal.style.display = 'flex';
            if (typeof setupCheckInModal === 'function') setupCheckInModal();
        } else {
            alert("Seleccione una habitación para hacer Check-In.");
        }
        return;
    }

    // 2. Room Specific Logic
    const todayStr = new Date().toDateString();

    // Find SCHEDULED Reservation (Yellow) for Today
    const scheduledRes = currentReservationsList.find(r =>
        (String(r.habitacionId) === String(roomId) || String(r.habitacionNumero) === String(roomNum)) &&
        r.estado === 'Reserva' &&
        new Date(r.fechaEntrada).toDateString() === todayStr
    );

    if (scheduledRes) {
        // Found a match!
        if (confirm(`📅 Existe una reserva programada para HOY de: ${scheduledRes.cliente}.\n\n[ACEPTAR] = Hacer Check-In a ${scheduledRes.cliente}\n[CANCELAR] = Ignorar y registrar otro cliente (Walk-in)`)) {
            // Open Detail to Process Check-In
            openReservationDetail(scheduledRes.id);
            return;
        }
    }

    // 3. Fallback: Direct Walk-In (New Reservation starting NOW)
    // Use local YYYY-MM-DD to ensure input[type=date] works
    const todayIso = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
    openNewReservation(roomId, roomNum, todayIso);

    // Customize for Walk-In
    setTimeout(() => {
        const title = document.getElementById('resModalTitle');
        if (title) title.innerHTML = '<i class="fas fa-user-check"></i> Nuevo Check-In (Walk-in)';

        // LOCK DATE for Walk-in (Must be Today)
        const inDate = document.getElementById('resInDate');
        if (inDate) {
            inDate.value = todayIso;
            inDate.disabled = true;
        }
        // [NEW] Set Check-In Flag
        document.getElementById('resIsCheckIn').value = 'true';
    }, 50);
}

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

    // 4. Load Payments (Async)
    const paymentsContainer = document.getElementById('rdPaymentsContainer') || createPaymentsContainer();
    loadReservationPayments(res.id, paymentsContainer);

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

// Helper for UI
function createPaymentsContainer() {
    const parent = document.querySelector('.modal-card #rdNotes').parentNode.parentNode; // Locate somewhat safely
    const div = document.createElement('div');
    div.id = 'rdPaymentsContainer';
    div.style.marginTop = '15px';
    div.style.paddingTop = '15px';
    div.style.borderTop = '1px solid #e2e8f0';

    // Insert before footer actions
    const footer = document.getElementById('rdActionsContainer');
    footer.parentNode.insertBefore(div, footer);
    return div;
}

// [OPTIMIZED] Load Payments from Local State (Preloaded)
function loadReservationPayments(resId, container) {
    // container.innerHTML = '<div style="font-size:0.85rem; color:#64748B;"><i class="fas fa-spinner fa-spin"></i> Cargando historial de pagos...</div>';

    // 1. Find Reservation in Local State
    const res = currentReservationsList.find(r => String(r.id) === String(resId));
    const pagos = (res && res.pagos) ? res.pagos : [];

    renderPaymentsTable(resId, container, pagos);
}

function renderPaymentsTable(resId, container, pagos) {
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h4 style="margin:0; font-size:0.95rem; color:#334155;">Pagos Realizados</h4>
            <button onclick="addPaymentToReservation('${resId}')" style="background:#fff; border:1px solid #22c55e; color:#22c55e; border-radius:4px; font-size:0.75rem; padding:2px 8px; cursor:pointer;">
                <i class="fas fa-plus"></i> Agregar Pago
            </button>
        </div>
    `;

    if (pagos.length === 0) {
        html += '<div style="font-size:0.85rem; color:#94a3b8; font-style:italic;">No hay pagos registrados.</div>';
    } else {
        html += '<table style="width:100%; font-size:0.8rem; border-collapse:collapse;">';
        let total = 0;

        pagos.forEach(p => {
            total += p.monto;
            html += `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:4px;">${new Date(p.fecha).toLocaleDateString()}</td>
                <td style="padding:4px;">${p.metodo}</td>
                <td style="padding:4px; text-align:right; font-weight:bold;">S/ ${p.monto.toFixed(2)}</td>
            </tr>`;
        });
        html += `
            <tr style="font-weight:bold; color:#166534; background:#f0fdf4;">
                <td colspan="2" style="padding:6px;">TOTAL PAGADO</td>
                <td style="padding:6px; text-align:right;">S/ ${total.toFixed(2)}</td>
            </tr>
       `;
        html += '</table>';
    }
    container.innerHTML = html;
}

async function addPaymentToReservation(resId) {
    const amountStr = prompt("Ingrese el monto a pagar (S/):");
    if (!amountStr) return;
    const amount = Number(amountStr);
    if (isNaN(amount) || amount <= 0) return;

    const method = prompt("Medio de pago (Efectivo, Yape, Plin, Tarjeta):", "Efectivo");
    if (!method) return;

    if (!currentCaja) { alert('⚠️ Caja Cerrada. Abra caja para registrar pagos.'); toggleCajaAction(); return; }

    // [OPTIMISTIC UI UPDATE]
    const res = currentReservationsList.find(r => String(r.id) === String(resId));
    if (res) {
        if (!res.pagos) res.pagos = [];
        // Add Temporary Entry
        res.pagos.push({
            id: 'temp-' + new Date().getTime(),
            monto: amount,
            metodo: method,
            fecha: new Date().toISOString(),
            notas: 'Pago manual (Sincronizando...)'
        });

        // Re-render immediately
        const container = document.getElementById('rdPaymentsContainer');
        if (container) renderPaymentsTable(resId, container, res.pagos);
    }

    // Backend Sync (Background)
    try {
        const payload = {
            action: 'savePago',
            reservaId: resId,
            monto: amount,
            metodo: method,
            notas: 'Pago manual desde Detalle Reserva',
            fecha: new Date(),
            cajaId: currentCaja.id
        };

        // Just send, don't block
        fetch(CONFIG.API_URL, {
            method: 'POST', body: JSON.stringify(payload)
        }).then(r => r.json()).then(d => {
            if (!d.success) alert("Error guardando pago en servidor: " + d.error);
            else showToast('Pago sincronizado');
        }).catch(e => console.error("Error background pago", e));

    } catch (e) { alert('Error iniciando solicitud de pago'); }
}


async function confirmReservation(resId) {
    if (!currentCaja) { alert('⚠️ Caja Cerrada. Abra caja para procesar ingresos.'); toggleCajaAction(); return; }

    if (!confirm('¿Confirmar ingreso del huésped? Estado pasará a Activa.')) return;
    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST', body: JSON.stringify({ action: 'confirmReservation', id: resId, cajaId: currentCaja.id })
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

    // [FIX] Reset Adelanto to avoid persistence
    if (document.getElementById('resAdelanto')) document.getElementById('resAdelanto').value = '';

    // Reset Check-In Flag (Default to Reservation)
    document.getElementById('resIsCheckIn').value = 'false';

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

        // Ensure YYYY-MM-DD
        if (date) {
            try { inDate.value = new Date(date).toISOString().split('T')[0]; }
            catch (e) { inDate.value = date.substring(0, 10); }
        }
        if (currentEnd) {
            try { outDate.value = new Date(currentEnd).toISOString().split('T')[0]; }
            catch (e) { outDate.value = currentEnd.substring(0, 10); }
        }

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

    // Attach Listeners for Balance
    const adelanto = document.getElementById('resAdelanto');
    if (adelanto) adelanto.oninput = calculateReservationBalance;
    inDate.onchange = calculateReservationBalance;
    outDate.onchange = calculateReservationBalance;

    // Trigger initial
    calculateReservationBalance();

    // FORCE BUTTON RESET (Fix "Stuck" Issue)
    if (btn) {
        btn.disabled = false;
        // Text is already set above based on mode, just ensuring enabled.
    }
}

function calculateReservationBalance() {
    try {
        const roomId = document.getElementById('resRoomId').value;
        const r = currentRoomsList.find(x => x.id == roomId);
        const price = r ? (Number(r.precio) || 0) : 0;

        const inDate = document.getElementById('resInDate').value;
        const outDate = document.getElementById('resOutDate').value;
        const adelanto = Number(document.getElementById('resAdelanto').value) || 0;

        // Calculate Days
        let days = 1;
        if (inDate && outDate) {
            const d1 = new Date(inDate);
            const d2 = new Date(outDate);
            const diff = d2 - d1;
            days = Math.ceil(diff / (1000 * 60 * 60 * 24));
            if (days < 1) days = 1;
        }

        const total = days * price;
        const restante = total - adelanto;

        // Find Info Div or Create
        let infoDiv = document.getElementById('resBalanceInfo');
        if (!infoDiv) {
            const notesGroup = document.getElementById('resNotes').parentNode;
            infoDiv = document.createElement('div');
            infoDiv.id = 'resBalanceInfo';
            infoDiv.style.marginTop = '10px';
            infoDiv.style.padding = '10px';
            infoDiv.style.background = '#f8fafc';
            infoDiv.style.borderRadius = '8px';
            infoDiv.style.fontSize = '0.9rem';
            notesGroup.parentNode.insertBefore(infoDiv, notesGroup.nextSibling);
        }

        if (infoDiv) {
            let color = restante > 0 ? '#ef4444' : '#22c55e';
            let text = restante > 0 ? 'Falta Pagar' : 'Pagado';

            infoDiv.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-weight:bold; color:#475569;">
                    <span>Total (${days} noches):</span>
                    <span>S/ ${total.toFixed(2)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; color:${color}; margin-top:5px;">
                    <span>${text}:</span>
                    <span>S/ ${restante.toFixed(2)}</span>
                </div>
            `;
        }

    } catch (e) { console.warn("Balance Res Error", e); }
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

            // [OPTIMISTIC UI] Close modal immediately
            document.getElementById('modalReservation').style.display = 'none';

            // [OPTIMISTIC UI] Update local reservation
            const resIndex = currentReservationsList.findIndex(r => r.id === resId);
            if (resIndex !== -1) {
                currentReservationsList[resIndex].fechaSalida = newEnd + ' 11:00';
                currentReservationsList[resIndex].notas = notes;
            }

            // [OPTIMISTIC UI] Re-render calendar
            renderCalendarTimeline(currentRoomsList, currentReservationsList);
            showToast('Extendiendo estadía...');

            // [BACKGROUND SYNC] Send to backend
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
            if (!d.success) {
                alert('Error al extender: ' + d.error);
                loadCalendarView(); // Revert to backend state
            } else {
                showToast('✅ Estadía Extendida');
                loadCalendarView(); // Refresh from backend
            }

        } else if (mode === 'edit') {
            const client = document.getElementById('resClient').value;
            const start = document.getElementById('resInDate').value;
            const end = document.getElementById('resOutDate').value;

            if (!client || !start || !end) throw new Error('Completa todos los campos');

            // [OPTIMISTIC UI] Close modal immediately
            document.getElementById('modalReservation').style.display = 'none';

            // [OPTIMISTIC UI] Update local reservation
            const resIndex = currentReservationsList.findIndex(r => r.id === resId);
            if (resIndex !== -1) {
                currentReservationsList[resIndex].cliente = client;
                currentReservationsList[resIndex].fechaEntrada = start + ' 14:00';
                currentReservationsList[resIndex].fechaSalida = end + ' 11:00';
                currentReservationsList[resIndex].notas = notes;
            }

            // [OPTIMISTIC UI] Re-render calendar
            renderCalendarTimeline(currentRoomsList, currentReservationsList);
            showToast('Actualizando reserva...');

            // [BACKGROUND SYNC] Send to backend
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
            if (!d.success) {
                alert('Error al actualizar: ' + d.error);
                loadCalendarView(); // Revert to backend state
            } else {
                showToast('✅ Reserva Actualizada');
                loadCalendarView(); // Refresh from backend
            }

        } else {
            // New Reservation
            const client = document.getElementById('resClient').value;
            const start = document.getElementById('resInDate').value;
            const end = document.getElementById('resOutDate').value;
            const adelanto = document.getElementById('resAdelanto') ? document.getElementById('resAdelanto').value : 0;
            const metodo = document.getElementById('resMetodo') ? document.getElementById('resMetodo').value : 'Efectivo';

            if (!client || !start || !end) throw new Error('Completa todos los campos');

            // [NEW] Check-In vs Reservation Logic
            const isCheckIn = document.getElementById('resIsCheckIn').value === 'true';

            // [Enforce Caja] If Check-In OR Payment involved
            if (isCheckIn || Number(adelanto) > 0) {
                if (!currentCaja) {
                    alert('⚠️ Caja Cerrada. Abra caja para realizar Check-Ins o recibir Pagos.');
                    toggleCajaAction();
                    throw new Error('Caja Cerrada');
                }
            }

            // OPTIMISTIC UI: Render immediately
            const tempId = 'OPT-' + new Date().getTime();
            const tempRes = {
                id: tempId,
                habitacionId: roomId,
                cliente: client,
                fechaEntrada: start + ' 14:00', // Mock time
                fechaSalida: end + ' 11:00',
                estado: isCheckIn ? 'Ocupada' : 'Reserva', // [FIX] Dynamic Status
                notas: notes,
                pagado: Number(adelanto) || 0 // Optimistic Payment
            };
            currentReservationsList.push(tempRes);
            renderCalendarTimeline(currentRoomsList, currentReservationsList);
            document.getElementById('modalReservation').style.display = 'none';

            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'checkIn',
                    habitacionId: roomId,
                    cliente: client,
                    fechaEntrada: start,
                    fechaSalida: end,
                    fechaSalida: end,
                    notas: notes,
                    isReservation: !isCheckIn, // [FIX] False if Check-In
                    adelanto: adelanto,
                    metodo: metodo,
                    cajaId: currentCaja ? currentCaja.id : null // [NEW] Attach Caja ID
                })
            });
            const d = await res.json();
            if (!d.success) {
                // Rollback
                currentReservationsList = currentReservationsList.filter(r => r.id !== tempId);
                renderCalendarTimeline(currentRoomsList, currentReservationsList);
                throw new Error(d.error);
            }

            showToast('✅ Reserva Creada');
            // Refresh to get real ID
            loadCalendarView();
        }

        // Modal closed optimistically above
        // loadCalendarView(); // Removed here, called inside success/fail logic or kept for sync

    } catch (e) {
        showToast('❌ ' + e.message);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// 3. CHECK-OUT FLOW

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

    if (activeRes) activeRes.estado = 'Finalizada';

    // 2. Mark Room Dirty
    const room = currentRoomsList.find(r => String(r.id) === String(roomId));
    if (room) room.estado = 'sucio';

    // 3. Render
    renderCalendarTimeline(currentRoomsList, currentReservationsList);
    document.getElementById('modalCheckOut').style.display = 'none';

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
            loadCalendarView(); // Refresh real data
        } else {
            // Rollback (Simplest is just reload or alert, but let's throw)
            throw new Error(d.error);
        }
    } catch (e) {
        showToast('❌ Error: ' + e.message);
        // If error, we should reload to get true state
        loadCalendarView();
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// ===== TOOLTIP HELPERS (PHASE 10) =====
let tooltipEl = null;

function showTooltip(e, htmlContent) {
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.className = 'res-tooltip';
        document.body.appendChild(tooltipEl);
    }
    tooltipEl.innerHTML = htmlContent;
    tooltipEl.style.display = 'block';

    // Position Initial
    moveTooltip(e);

    // Track mouse move for this element specifically? 
    // Or just rely on mouseenter/leave + static position if we don't move it?
    // User DX: Following mouse is nicer.
    e.target.onmousemove = moveTooltip;
}

// [NEW] Helper to show tooltip from JSON data attribute (avoids quote escaping issues)
function showTooltipFromData(e, element) {
    const jsonStr = element.getAttribute('data-tooltip-data');
    if (!jsonStr) return;

    try {
        const data = JSON.parse(jsonStr.replace(/&quot;/g, '"'));

        const tooltipHtml = `
            <div style='text-align:left; font-size:0.85rem; min-width:180px;'>
                <div style='font-weight:bold; border-bottom:1px solid rgba(255,255,255,0.2); padding-bottom:5px; margin-bottom:5px; font-size:0.95rem;'>
                    ${data.cliente}
                </div>
                <div style='display:flex; justify-content:space-between;'><span>Estado:</span> <strong>${data.estado}</strong></div>
                <div style='display:flex; justify-content:space-between;'><span>Noches:</span> <strong>${data.nights}</strong></div>
                <div style='margin-top:8px; border-top:1px dashed rgba(255,255,255,0.2); padding-top:5px;'>
                    <div style='display:flex; justify-content:space-between;'><span>Total:</span> <span>S/ ${data.total}</span></div>
                    <div style='display:flex; justify-content:space-between;'><span>Pagado:</span> <span style='color:${data.paidColor};'>S/ ${data.paid}</span></div>
                    <div style='display:flex; justify-content:space-between; font-weight:bold; margin-top:2px;'>
                        <span>Falta:</span> <span style='color:${data.pendingColor};'>S/ ${data.pending}</span>
                    </div>
                </div>
                ${data.notas ? `<div style='margin-top:5px; font-style:italic; font-size:0.75rem; color:#cbd5e1;'>${data.notas}</div>` : ''}
            </div>
        `;

        showTooltip(e, tooltipHtml);
    } catch (err) {
        console.error('Tooltip parse error:', err);
    }
}

function moveTooltip(e) {
    if (!tooltipEl) return;
    const x = e.clientX;
    const y = e.clientY;

    // Position above cursor with offset
    // Check boundaries if needed, but for now simple offset
    tooltipEl.style.left = (x) + 'px';
    tooltipEl.style.top = (y - 10) + 'px';
}

function hideTooltip() {
    if (tooltipEl) {
        tooltipEl.style.display = 'none';
    }
}


// ===== SHIFT MANAGEMENT (CAJA) LOGIC (NEW) =====
function initCajaSession() {
    const saved = localStorage.getItem('gps_caja');
    if (saved) {
        try {
            currentCaja = JSON.parse(saved);
        } catch (e) {
            console.error('Error parsing saved caja:', e);
            currentCaja = null;
        }
    }
    updateCajaWidget();
}

function updateCajaWidget() {
    const w = document.getElementById('cajaStatusWidget');
    if (!w) return;

    if (currentCaja) {
        w.innerHTML = '<span style="font-size: 0.6rem;">🟢</span> ' + currentCaja.responsable;
        w.style.background = '#dcfce7'; // green-100
        w.style.color = '#166534'; // green-800
        w.style.borderColor = '#86efac';
    } else {
        w.innerHTML = '<span style="font-size: 0.6rem;">🔴</span> Caja Cerrada';
        w.style.background = '#fee2e2';
        w.style.color = '#ef4444';
        w.style.borderColor = '#fca5a5';
    }
}

function toggleCajaAction() {
    console.log('toggleCajaAction Called!', currentCaja); // Debug
    if (currentCaja) {
        // Open Close Modal
        const closeMod = document.getElementById('modalCloseCaja');
        if (!closeMod) { console.error('Close Modal not found'); return; }

        // [FIX] Force Move to Body
        if (closeMod.parentNode !== document.body) {
            document.body.appendChild(closeMod);
        }

        document.getElementById('lblCloseInicial').innerText = 'S/ ' + parseFloat(currentCaja.montoInicial || 0).toFixed(2);

        // [FIX] Calculate Totals (Local Estimation)
        // Note: This only counts loaded reservations. For full accuracy, backend should provide this.
        // For now, calculating from Initial + 0 to ensure at least Initial is shown.
        let estimatedSales = 0;
        let estimatedExpenses = 0;

        // Try to sum loads from currentReservationsList if available
        if (typeof currentReservationsList !== 'undefined') {
            const start = new Date(currentCaja.fechaInicio);
            currentReservationsList.forEach(r => {
                if (r.pagos) {
                    r.pagos.forEach(p => {
                        const pDate = new Date(p.fecha);
                        if (pDate >= start && (!p.cajaId || p.cajaId === currentCaja.id)) {
                            // Only sum CASH for "Esperado" if we strictly mean Cash Drawer
                            // But usually Esperado implies Total or Cash? 
                            // User UI separates Cash vs Digital.
                            // Let's assume strict Cash for the drawer check.
                            if (p.metodo === 'Efectivo') {
                                estimatedSales += (Number(p.monto) || 0);
                            }
                        }
                    });
                }
            });
        }

        const inicial = parseFloat(currentCaja.montoInicial || 0);
        const esperado = inicial + estimatedSales - estimatedExpenses;

        document.getElementById('lblCloseVentasCash').innerText = '+ S/ ' + estimatedSales.toFixed(2);
        document.getElementById('lblCloseGastos').innerText = '- S/ ' + estimatedExpenses.toFixed(2);
        document.getElementById('lblCloseEsperado').innerText = 'S/ ' + esperado.toFixed(2);

        closeMod.style.display = 'flex';

        // DEBUG: VISIBILITY CHECK
        const rect = closeMod.getBoundingClientRect();
        console.log('Close Modal Rect:', rect);
    } else {
        // OPEN MODAL
        const openMod = document.getElementById('modalOpenCaja');
        if (!openMod) { console.error('Open Modal not found'); return; }

        // [FIX] Force Move to Body to avoid container issues
        if (openMod.parentNode !== document.body) {
            document.body.appendChild(openMod);
            console.log('Moved modalOpenCaja to body');
        }

        const userName = currentUser ? currentUser.nombre : (document.getElementById('userDisplay') ? document.getElementById('userDisplay').innerText : 'Usuario');
        document.getElementById('txtOpenCajaResponsable').value = userName;
        openMod.style.display = 'flex';

        // DEBUG: VISIBILITY CHECK
        const rect = openMod.getBoundingClientRect();
        const style = window.getComputedStyle(openMod);
        console.log('--- DEBUG CAJA MODAL ---');
        console.log('Rect:', rect.width, 'x', rect.height, 'at', rect.top, ',', rect.left);
        console.log('Visibility:', style.visibility);
        console.log('Opacity:', style.opacity);
        console.log('Position:', style.position);
        console.log('Z-Index:', style.zIndex);
        console.log('Background:', style.backgroundColor);
    }
}

async function processOpenCaja() {
    const btn = document.querySelector('#modalOpenCaja button');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Abriendo...';

    const monto = parseFloat(document.getElementById('txtOpenCajaMonto').value) || 0;
    const responsable = document.getElementById('txtOpenCajaResponsable').value;

    const newCaja = {
        id: 'CAJA-' + Date.now(),
        responsable: responsable,
        montoInicial: monto,
        fechaInicio: new Date().toISOString(),
        estado: 'Abierta'
    };

    // 1. Save Local
    currentCaja = newCaja;
    localStorage.setItem('gps_caja', JSON.stringify(currentCaja));
    updateCajaWidget();

    // 2. Sync Backend
    try {
        await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'openCaja',
                caja: newCaja
            })
        });
        document.getElementById('modalOpenCaja').style.display = 'none';
    } catch (e) {
        alert('⚠️ Caja abierta localmente, pero hubo error de sincronización: ' + e.message);
        document.getElementById('modalOpenCaja').style.display = 'none';
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

async function processCloseCaja() {
    if (!currentCaja) return;

    const btn = document.querySelector('#modalCloseCaja button');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = 'Cerrando...';

    const realCash = parseFloat(document.getElementById('txtCloseCajaReal').value) || 0;
    const notas = document.getElementById('txtCloseCajaNotas').value;

    const cierreData = {
        ...currentCaja,
        fechaFin: new Date().toISOString(),
        montoFinal: realCash,
        notas: notas,
        estado: 'Cerrada'
    };

    // 1. Clear Local
    currentCaja = null;
    localStorage.removeItem('gps_caja');
    updateCajaWidget();

    // 2. Sync Backend
    try {
        await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'closeCaja',
                caja: cierreData
            })
        });
        document.getElementById('modalCloseCaja').style.display = 'none';

        // [NEW] Print Ticket
        printShiftTicket(cierreData);

        alert('✅ Turno cerrado correctamente.');
    } catch (e) {
        alert('⚠️ Turno cerrado localmente, pero error de red: ' + e.message);
        document.getElementById('modalCloseCaja').style.display = 'none';
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// ===== FINANCE EXTENSIONS (SHIFT MANAGEMENT) =====

function switchFinanceTab(tab) {
    // 1. UI Toggles
    document.getElementById('tabIngresos').style.borderBottom = 'none';
    document.getElementById('tabIngresos').style.color = '#94a3b8';
    document.getElementById('tabGastos').style.borderBottom = 'none';
    document.getElementById('tabGastos').style.color = '#94a3b8';
    if (document.getElementById('tabShifts')) {
        document.getElementById('tabShifts').style.borderBottom = 'none';
        document.getElementById('tabShifts').style.color = '#94a3b8';
    }

    const activeBtn = tab === 'ingresos' ? 'tabIngresos' : (tab === 'gastos' ? 'tabGastos' : 'tabShifts');
    const btnEl = document.getElementById(activeBtn);
    if (btnEl) {
        btnEl.style.borderBottom = '3px solid var(--primary)';
        btnEl.style.color = 'var(--primary)';
    }

    // 2. Load Data
    if (tab === 'shifts') {
        loadShiftHistory();
    } else {
        // Existing Logic (assumed loadFinanceData handles 'ingresos' vs 'gastos' via internal state or we just reload)
        // For now, let's just re-trigger main loader but ideally we filter UI.
        // Simplified: The existing loadFinanceData probably renders one of them. 
        // We might need to adjust loadFinanceData if it doesn't support tabs.
        // Checking previous code, loadFinanceData renders BOTH or one? 
        // Assuming we need to implement specific rendering for Income/Expense if not unified.
        // For this task, we focus on Shifts.
        console.log("Switching to", tab);
        // If we need to restore original view:
        if (typeof loadFinanceData === 'function') loadFinanceData();
    }
}

async function loadShiftHistory() {
    const tbody = document.getElementById('financeTbody');
    const thead = document.getElementById('financeThead');

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Cargando historial...</td></tr>';

    // Setup Headers
    thead.innerHTML = `
        <tr style="color:#64748B; border-bottom:1px solid #cbd5e1;">
            <th style="padding:10px; text-align:left;">Inicio</th>
            <th style="padding:10px; text-align:left;">Responsable</th>
            <th style="padding:10px; text-align:right;">Monto Inicial</th>
            <th style="padding:10px; text-align:right;">Monto Final</th>
            <th style="padding:10px; text-align:center;">Estado</th>
        </tr>
    `;

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getCajaHistory' })
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        const history = data.history || [];

        if (history.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">No hay turnos registrados.</td></tr>';
            return;
        }

        let html = '';
        history.forEach(h => {
            const start = new Date(h.fechaInicio).toLocaleString();
            // const end = h.fechaFin ? new Date(h.fechaFin).toLocaleString() : '-';
            const statusColor = h.estado === 'Abierta' ? '#22c55e' : '#ef4444';

            html += `
                <tr style="border-bottom:1px solid #f1f5f9;">
                    <td style="padding:12px;">
                        <div style="font-weight:bold; color:#1e293b;">${new Date(h.fechaInicio).toLocaleDateString()}</div>
                        <div style="font-size:0.8rem; color:#64748B;">${new Date(h.fechaInicio).toLocaleTimeString()}</div>
                    </td>
                    <td style="padding:12px;">${h.responsable}</td>
                    <td style="padding:12px; text-align:right;">S/ ${parseFloat(h.montoInicial).toFixed(2)}</td>
                    <td style="padding:12px; text-align:right;">${h.montoFinal ? 'S/ ' + parseFloat(h.montoFinal).toFixed(2) : '-'}</td>
                    <td style="padding:12px; text-align:center;">
                        <span style="background:${statusColor}20; color:${statusColor}; padding:4px 8px; border-radius:12px; font-weight:bold; font-size:0.8rem;">
                            ${h.estado}
                        </span>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding:20px;">Error: ${e.message}</td></tr>`;
    }
}

function printShiftTicket(caja) {
    // Determine context
    const now = new Date();
    const start = new Date(caja.fechaInicio);
    const durationHrs = ((now - start) / (1000 * 60 * 60)).toFixed(1);

    // Calculate Totals locally or use passed data
    // Assuming caja object has updated sales/expenses attached OR we grab from DOM for now.
    // Ideally we recalculate or pass full stats. 
    // Let's grab DOM values from the Close Modal for accuracy of what user saw.

    // NOTE: The values in modal are just text. We should re-calc to be safe or parse text.
    // For simplicity and immediate feedback, we parse the ID values if they exist, else 0.

    const txtVentasCash = document.getElementById('lblCloseVentasCash') ? document.getElementById('lblCloseVentasCash').innerText.replace(/[^\d.-]/g, '') : '0';
    const txtVentasDig = document.getElementById('lblCloseVentasDigital') ? document.getElementById('lblCloseVentasDigital').innerText.replace(/[^\d.-]/g, '') : '0';
    const txtGastos = document.getElementById('lblCloseGastos') ? document.getElementById('lblCloseGastos').innerText.replace(/[^\d.-]/g, '') : '0';

    const ventasCash = parseFloat(txtVentasCash);
    // const ventasDig = parseFloat(txtVentasDig); // Not cash, usually not in cash count but good for report
    const gastos = parseFloat(txtGastos); // Negative number usually

    const inicial = parseFloat(caja.montoInicial || 0);
    const finalReal = parseFloat(caja.montoFinal || 0);
    const esperado = inicial + ventasCash + gastos; // Gastos is negative? Let's assume arithmetic sum
    // Actually in modal logic: Total = Inicial + VentasCash - Gastos. 
    // If 'txtGastos' came from text like "- S/ 50.00", parseFloat might be -50.
    // Let's rely on simple math: 

    const diff = finalReal - esperado;

    const ticketContent = `
        <div style="font-family: 'Courier New', monospace; width: 300px; padding: 10px; color:black; font-size:12px;">
            <div style="text-align:center; margin-bottom:10px;">
                <h3 style="margin:0;">GRUPO PS</h3>
                <div>CIERRE DE TURNO</div>
                <div>${now.toLocaleString()}</div>
            </div>
            
            <div style="margin-bottom:5px;">--------------------------------</div>
            
            <div style="display:flex; justify-content:space-between;">
                <span>Responsable:</span>
                <span>${caja.responsable}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span>Duración:</span>
                <span>${durationHrs} hrs</span>
            </div>
            
            <div style="margin-bottom:5px;">--------------------------------</div>
            
            <div style="display:flex; justify-content:space-between;">
                <span>FONDO INICIAL:</span>
                <span>S/ ${inicial.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span>+ Ventas (Efe):</span>
                <span>S/ ${Math.abs(ventasCash).toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between;">
                <span>- Gastos (Efe):</span>
                <span>S/ ${Math.abs(gastos).toFixed(2)}</span>
            </div>
             <div style="margin-bottom:5px;">--------------------------------</div>
            <div style="display:flex; justify-content:space-between; font-weight:bold;">
                <span>ESPERADO:</span>
                <span>S/ ${esperado.toFixed(2)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; font-weight:bold;">
                <span>REAL (ARQUEO):</span>
                <span>S/ ${finalReal.toFixed(2)}</span>
            </div>
             <div style="margin-bottom:5px;">--------------------------------</div>
            <div style="display:flex; justify-content:space-between;">
                <span>DIFERENCIA:</span>
                <span>S/ ${diff.toFixed(2)}</span>
            </div>
            
            <div style="margin-top:15px; text-align:center; font-style:italic;">
                Firma Responsable
                <br><br><br>
                _______________________
            </div>
        </div>
    `;

    // Create iframe for print
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-1000px';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow.document;
    doc.open();
    doc.write('<html><head><title>Ticket Cierre</title></head><body>');
    doc.write(ticketContent);
    doc.write('</body></html>');
    doc.close();

    setTimeout(() => {
        printFrame.contentWindow.focus();
        printFrame.contentWindow.print();
        setTimeout(() => document.body.removeChild(printFrame), 1000);
    }, 500);
}
