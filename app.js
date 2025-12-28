// ===== STATE =====
let currentUser = null;
let currentView = 'dashboard';

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    // Check session
    const token = sessionStorage.getItem('gps_token');
    const user = sessionStorage.getItem('gps_user');

    if (token && user) {
        currentUser = JSON.parse(user);
        initDashboard();
    } else {
        showLogin();
    }
});

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginScreen').style.opacity = '1';
    document.getElementById('appContainer').style.display = 'none';
}

// ===== AUTHENTICATION =====
async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLogin');
    const err = document.getElementById('loginError');

    // UI Loading
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...';
    err.style.display = 'none';

    const email = document.getElementById('txtEmail').value;
    const password = document.getElementById('txtPassword').value;

    // DEMO BYPASS: Si el usuario no ha desplegado el backend aun
    // Permito entrar con admin/admin para que vea la UI
    if (email === 'admin@demo.com' && password === '123') {
        const demoUser = { nombre: 'Demo User', email: 'admin@demo.com', rol: 'Admin' };
        loginSuccess({ user: demoUser, token: 'demo' });
        return;
    }

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', email, password })
        });
        const data = await res.json();

        if (data.success) {
            loginSuccess(data);
        } else {
            throw new Error(data.error || 'Error al iniciar sesión');
        }
    } catch (e) {
        console.error(e);
        err.style.display = 'block';
        err.innerText = '⚠️ ' + (e.message || 'Error de conexión');
        btn.disabled = false;
        btn.innerHTML = 'Iniciar Sesión <i class="fas fa-arrow-right" style="margin-left:8px"></i>';
    }
}

function loginSuccess(data) {
    sessionStorage.setItem('gps_token', data.token);
    sessionStorage.setItem('gps_user', JSON.stringify(data.user));
    currentUser = data.user;

    // Animación de salida login
    const screen = document.getElementById('loginScreen');
    screen.style.opacity = '0';
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
    const views = ['view-dashboard', 'view-rooms', 'view-calendar', 'view-users', 'view-products'];
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
    }
}

// ===== ROOMS MODULE =====
async function loadRoomsView() {
    const container = document.getElementById('view-rooms');
    container.innerHTML = `
        <div style="text-align:center; padding: 50px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            <p style="margin-top:15px; color:#64748B;">Cargando habitaciones...</p>
        </div>
    `;

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getHabitaciones' })
        });
        const data = await res.json();

        if (data.success) {
            renderRooms(data.habitaciones);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${data.error}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:red; text-align:center;">Error de conexión: ${e.message}</div>`;
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

    btn.disabled = true;
    btn.innerText = 'Guardando...';

    const roomData = {
        id: document.getElementById('editRoomId').value,
        numero: document.getElementById('editNum').value,
        tipo: document.getElementById('editTipo').value,
        precio: document.getElementById('editPrecio').value,
        estado: document.getElementById('editEstado').value,
        fotos: document.getElementById('editFoto').value
    };

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'saveHabitacion',
                habitacion: roomData
            })
        });
        const data = await res.json();

        if (data.success) {
            closeRoomEditor();
            loadRoomsView(); // Refresh list
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Error de conexión: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
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
            statusLabel = 'SUCIO';
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

        // Common Reserve Button (Available for all except maybe Maintenance?)
        const btnReservar = `<button onclick="openReservation('${r.id}', '${r.numero}')" style="background:#eab308; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:5px;"><i class="fas fa-calendar-plus"></i> Reservar</button>`;

        if (normStatus === 'disponible') {
            actionsHtml = `
               <div style="display:flex; gap:5px;">
                    <button onclick="openCheckIn('${r.id}', '${r.numero}')" style="background:#22c55e; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:5px;"><i class="fas fa-check"></i> Check-In</button>
                    ${btnReservar}
               </div>
            `;
        } else if (normStatus === 'ocupado') {
            // Show Reserve for future, but Check-In is disabled
            actionsHtml = `
               <div style="display:flex; gap:5px;">
                    <button style="background:#ef4444; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:not-allowed; opacity:0.8; font-size:0.85rem;" disabled><i class="fas fa-ban"></i> Ocupado</button>
                    ${btnReservar}
               </div>
            `;
        } else if (normStatus === 'reservado') {
            // If Reserved, allow Check-In (to confirm arrival) and Reserve (for later)
            actionsHtml = `
               <div style="display:flex; gap:5px;">
                    <button onclick="openCheckIn('${r.id}', '${r.numero}')" style="background:#22c55e; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:5px;"><i class="fas fa-check"></i> Llegada</button>
                    ${btnReservar}
               </div>
            `;
        } else {
            // Maintenance / Dirty
            actionsHtml = `<span style="color:#64748B; font-size:0.9rem; font-style:italic;">No disponible</span>`;
        }

        html += `
        <div class="room-card fade-in">
            <div class="room-img-box">
                <img src="${mainImg}" class="room-img" alt="Foto">
                <span class="room-status-badge ${statusClass}">${statusLabel}</span>
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

                <div class="room-actions" style="justify-content:space-between; width:100%;">
                    ${actionsHtml}
                    <div style="display:flex; gap:5px;">
                        <button class="btn-icon" title="Editar" onclick="editRoom('${r.id}')"><i class="fas fa-pen"></i></button>
                        ${normStatus === 'sucio' ? `<button class="btn-icon" title="Marcar Limpio" style="color:var(--primary);"><i class="fas fa-broom"></i></button>` : ''}
                    </div>
                </div>
            </div>
        </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// ===== CHECK-IN LOGIC (PHASE 5) =====
// ===== CHECK-IN / RESERVATION LOGIC =====
let checkInMode = 'checkin'; // 'checkin' or 'reservation'

function openCheckIn(roomId, roomNum) {
    checkInMode = 'checkin';
    document.getElementById('modalTitleCheckIn').innerText = '🏨 Check-In';
    document.getElementById('btnSubmitCheckIn').innerText = 'Confirmar Ingreso';
    document.getElementById('btnSubmitCheckIn').style.background = 'var(--accent)';

    setupCheckInModal(roomId, roomNum);
}

function openReservation(roomId, roomNum, startInfo) {
    checkInMode = 'reservation';
    document.getElementById('modalTitleCheckIn').innerText = '📅 Nueva Reserva';
    document.getElementById('btnSubmitCheckIn').innerText = 'Confirmar Reserva';
    document.getElementById('btnSubmitCheckIn').style.background = '#22c55e'; // Green for reservation

    setupCheckInModal(roomId, roomNum);
}

function updateEndDate() {
    const startVal = document.getElementById('checkInEntrada').value;
    if (!startVal) return;
    const parts = startVal.split('-');
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const pad = n => n < 10 ? '0' + n : n;
    const toISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    document.getElementById('checkInSalida').value = toISO(end);
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
        // Mode: Specific Room (from Card or Calendar Row)
        roomIdInput.value = roomId;
        roomLabel.innerText = 'Habitación ' + roomNum;
        roomLabel.style.display = 'inline-block';
        roomSelect.style.display = 'none';
    } else {
        // Mode: Generic/Global (from Top Button)
        roomIdInput.value = '';
        roomLabel.style.display = 'none';
        roomSelect.style.display = 'block';

        let ops = '<option value="" disabled selected>-- Elija Habitación --</option>';
        if (typeof currentRoomsList !== 'undefined') {
            currentRoomsList.forEach(r => {
                ops += `<option value="${r.id}">Hab. ${r.numero} - ${r.tipo} (S/ ${r.precio})</option>`;
            });
        }
        roomSelect.innerHTML = ops;
        roomSelect.onchange = function () {
            roomIdInput.value = this.value;
        };
    }

    // 2. Setup Dates
    const now = new Date();
    const pad = n => n < 10 ? '0' + n : n;
    const toDateStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());

    const elEntrada = document.getElementById('checkInEntrada');
    const elSalida = document.getElementById('checkInSalida');

    if (checkInMode === 'checkin') {
        // Check-In: Start is NOW (Today)
        elEntrada.value = toDateStr(now);
        elEntrada.disabled = true; // Locked

        // End Date: Tomorrow default
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        elSalida.value = toDateStr(tomorrow);
    }
    else {
        // Reservation: Flexible Start
        let startDate = now;
        if (preSelectedDate) {
            startDate = new Date(preSelectedDate);
        }

        elEntrada.value = toDateStr(startDate);
        elEntrada.disabled = false; // Editable

        // Auto-calc End Date
        const end = new Date(startDate);
        end.setDate(end.getDate() + 1);
        elSalida.value = toDateStr(end);
    }

    document.getElementById('modalCheckIn').style.display = 'flex';
}

function closeCheckIn() {
    document.getElementById('modalCheckIn').style.display = 'none';
}

async function processCheckIn(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.innerText = 'Procesando...';
    submitBtn.disabled = true;

    // Safely get value even if disabled
    const fechaEntrada = document.getElementById('checkInEntrada').value;

    const data = {
        action: 'checkIn',
        habitacionId: document.getElementById('checkInRoomId').value,
        cliente: document.getElementById('checkInCliente').value,
        fechaEntrada: fechaEntrada,
        fechaSalida: document.getElementById('checkInSalida').value,
        notas: document.getElementById('checkInNotas').value,
        isReservation: (checkInMode === 'reservation')
    };

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.success) {
            alert('✅ Operación exitosa');
            closeCheckIn();
            loadRoomsView();
            // If in calendar view, refresh it too
            if (document.getElementById('view-calendar').style.display === 'block') {
                loadCalendarView();
            }
        } else {
            alert('❌ Error: ' + result.error);
        }
    } catch (error) {
        alert('❌ Error de conexión: ' + error.message);
    } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
    }
}

// ===== USERS MODULE =====
let currentUsersList = [];

async function loadUsersView() {
    const container = document.getElementById('view-users');
    container.innerHTML = `
        <div style="text-align:center; padding: 50px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            <p style="margin-top:15px; color:#64748B;">Cargando usuarios...</p>
        </div>
    `;

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getUsuarios' })
        });
        const data = await res.json();

        if (data.success) {
            currentUsersList = data.usuarios;
            renderUsers(data.usuarios);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${data.error}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:red; text-align:center;">Error de conexión: ${e.message}</div>`;
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
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    const userData = {
        id: document.getElementById('editUserId').value,
        nombre: document.getElementById('editUserNombre').value,
        email: document.getElementById('editUserEmail').value,
        password: document.getElementById('editUserPass').value,
        rol: document.getElementById('editUserRol').value,
        estado: document.getElementById('editUserEstado').value,
    };

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveUsuario', usuario: userData })
        });
        const data = await res.json();

        if (data.success) {
            closeUserEditor();
            loadUsersView();
            // Re-login if updating self? No, keep simple.
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.innerText = 'Guardar Usuario';
        btn.disabled = false;
    }
}


// ===== PRODUCTS MODULE =====
let currentProductsList = [];

async function loadProductsView() {
    const container = document.getElementById('view-products');
    container.innerHTML = `
        <div style="text-align:center; padding: 50px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            <p style="margin-top:15px; color:#64748B;">Cargando inventario...</p>
        </div>
    `;

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getProductos' })
        });
        const data = await res.json();

        if (data.success) {
            currentProductsList = data.productos;
            renderProducts(data.productos);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${data.error}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:red; text-align:center;">Error de conexión: ${e.message}</div>`;
    }
}

function renderProducts(products) {
    const container = document.getElementById('view-products');

    // Group by category for cleaner view if needed, but table is fine for now
    let html = `
    <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
        <div style="display:flex; gap:10px;">
             <button class="btn-login" style="width:auto; background:#64748B;" onclick="renderProducts(currentProductsList)">Todos</button>
             <button class="btn-login" style="width:auto; background:#eab308;" onclick="filterProducts('Snacks')">Snacks</button>
             <button class="btn-login" style="width:auto; background:#3b82f6;" onclick="filterProducts('Bebidas')">Bebidas</button>
             <button class="btn-login" style="width:auto; background:#10b981;" onclick="filterProducts('Tours')">Tours</button>
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
                    <th style="padding:15px;">Empresa</th>
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
        if (p.categoria === 'Tours') catColor = '#10b981';
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
            <td style="padding:15px;">${p.empresa}</td>
            <td style="padding:15px;">S/ ${p.precio}</td>
            <td style="padding:15px; font-weight:bold;">${p.stock}</td>
            <td style="padding:15px;">${p.activo}</td>
            <td style="padding:15px;">
                <button class="btn-icon" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i></button>
            </td>
        </tr>
        `;
    });
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

function filterProducts(cat) {
    const filtered = currentProductsList.filter(p => p.categoria === cat);
    renderProducts(filtered);
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
    document.getElementById('editProdEmpresa').value = 'CasaMunay';
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
    document.getElementById('editProdEmpresa').value = p.empresa;

    document.getElementById('modalProductEditor').style.display = 'flex';
}

function closeProductEditor() {
    document.getElementById('modalProductEditor').style.display = 'none';
}

async function saveProduct(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerText = 'Guardando...';
    btn.disabled = true;

    const prodData = {
        id: document.getElementById('editProdId').value,
        categoria: document.getElementById('editProdCat').value,
        nombre: document.getElementById('editProdNombre').value,
        descripcion: document.getElementById('editProdDesc').value,
        precio: document.getElementById('editProdPrecio').value,
        stock: document.getElementById('editProdStock').value,
        imagen_url: document.getElementById('editProdImg').value,
        activo: document.getElementById('editProdActivo').value,
        empresa: document.getElementById('editProdEmpresa').value
    };

    try {
        const res = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveProducto', producto: prodData })
        });
        const data = await res.json();
        if (data.success) {
            closeProductEditor();
            loadProductsView();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.innerText = 'Guardar';
        btn.disabled = false;
    }
}

// ===== CALENDAR MODULE (PHASE 6) =====
let calendarStartDate = new Date();

async function loadCalendarView() {
    const container = document.getElementById('view-calendar');
    container.innerHTML = `
        <div style="text-align:center; padding: 50px;">
            <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: var(--primary);"></i>
            <p style="margin-top:15px;" class="text-slate-500">Cargando calendario...</p>
        </div>
    `;

    try {
        // Fetch Rooms & Reservations in parallel
        const [resRooms, resRes] = await Promise.all([
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getHabitaciones' }) }).then(r => r.json()),
            fetch(CONFIG.API_URL, { method: 'POST', body: JSON.stringify({ action: 'getReservas' }) }).then(r => r.json())
        ]);

        if (!resRooms.success || !resRes.success) throw new Error('Error cargando datos');

        const rooms = resRooms.habitaciones;
        const reservations = resRes.reservas;

        renderCalendarTimeline(rooms, reservations);

    } catch (e) {
        container.innerHTML = `<div style="color:red; text-align:center;">Error: ${e.message}</div>`;
    }
}

function changeCalendarDate(days) {
    calendarStartDate.setDate(calendarStartDate.getDate() + days);
    loadCalendarView();
}

function renderCalendarTimeline(rooms, reservations) {
    const container = document.getElementById('view-calendar');

    // Config: Show next 15 days from calendarStartDate
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
    const colorPast = '#94a3b8'; // Gray

    let html = `
    <div style="background:white; border-radius:12px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); overflow-x:auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <div style="display:flex; gap:10px; align-items:center;">
                <button onclick="changeCalendarDate(-15)" style="border:1px solid #cbd5e1; background:white; padding:5px 10px; border-radius:6px; cursor:pointer;"><i class="fas fa-chevron-left"></i></button>
                <h2 style="color:var(--primary); font-size:1.5rem; margin:0;">Oc. ${start.toLocaleDateString()}</h2>
                <button onclick="changeCalendarDate(15)" style="border:1px solid #cbd5e1; background:white; padding:5px 10px; border-radius:6px; cursor:pointer;"><i class="fas fa-chevron-right"></i></button>
            </div>
            
            <div style="display:flex; align-items:center; gap:20px;">
                <div style="font-size:0.9rem; color:#64748B;">
                    <span style="display:inline-block; width:12px; height:12px; background:${colorActive}; border-radius:50%; margin-right:5px;"></span>Ocupado
                    <span style="display:inline-block; width:12px; height:12px; background:${colorFuture}; border-radius:50%; margin-right:5px; margin-left:10px;"></span>Reservado
                </div>
                <!-- Generic Reservation Button -->
                <button onclick="openReservation('', '')" style="background:var(--primary); color:white; border:none; padding:8px 16px; border-radius:6px; font-weight:bold; cursor:pointer;">+ Nueva Reserva</button>
            </div>
        </div>

        <table style="width:100%; border-collapse:collapse; min-width:800px;">
            <thead>
                <tr>
                    <th style="padding:10px; text-align:left; border-bottom:2px solid #e2e8f0; width:100px;">Hab.</th>
                    ${dates.map(d => {
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
        const dayNum = d.getDate();
        return `<th style="padding:10px; text-align:center; border-bottom:2px solid #e2e8f0; font-size:0.85rem; color:#64748B;">
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
                    <td style="padding:15px 10px; font-weight:bold; color:var(--primary);">
                        ${r.numero} <br>
                        <span style="font-size:0.7rem; color:#94a3b8; font-weight:normal;">${r.tipo}</span>
                    </td>`;

        dates.forEach(date => {
            let cellColor = '';
            let cellTitle = '';
            let cellText = '';

            const res = reservations.find(res => {
                if (String(res.habitacionId) !== String(r.id) && String(res.habitacionId) !== String(r.numero)) return false;
                const start = new Date(res.fechaEntrada);
                const end = new Date(res.fechaSalida);
                const current = new Date(date).setHours(0, 0, 0, 0);
                const s = new Date(start).setHours(0, 0, 0, 0);
                const e = new Date(end).setHours(0, 0, 0, 0);
                return current >= s && current < e;
            });

            if (res) {
                if (res.estado === 'Activa' || res.estado === 'Ocupada') {
                    cellColor = colorActive;
                    cellTitle = 'Ocupado por: ' + res.cliente;
                } else if (res.estado === 'Reserva' || res.estado === 'Pendiente') {
                    cellColor = colorFuture;
                    cellTitle = 'Reservado: ' + res.cliente;
                }
                cellText = res.cliente.split(' ')[0];
            }

            if (cellColor) {
                html += `<td style="padding:5px;">
                            <div style="background:${cellColor}; color:white; font-size:0.75rem; padding:5px; border-radius:6px; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer;" title="${cellTitle}">
                                ${cellText}
                            </div>
                        </td>`;
            } else {
                // Clickable empty cell
                const dateStr = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate(); // Simple format, better safe with pads usually but openReservation handles Date obj construction if well formatted
                // Better pass ISO substring
                const isoDate = date.toISOString().split('T')[0];

                html += `<td style="padding:5px; text-align:center;">
                            <div onclick="openReservation('${r.id}', '${r.numero}', '${isoDate}')" style="height:30px; border-radius:6px; cursor:pointer; background:#f8fafc;" class="cell-hover" title="Reservar este día"></div>
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
