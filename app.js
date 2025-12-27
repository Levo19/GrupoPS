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
    document.getElementById('view-dashboard').style.display = 'none';
    document.getElementById('view-rooms').style.display = 'none';
    document.getElementById('view-calendar').style.display = 'none';

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
        const res = await fetch(CONFIG.API_URL + '?action=getHabitaciones'); // GET for simplicity in reading
        // But code.gs is doPost mostly. Let's check code.gs.
        // It supports doGet (index) and doPost (actions).
        // Let's use POST for actions standard.
        const resPost = await fetch(CONFIG.API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'getHabitaciones' })
        });
        const data = await resPost.json();

        if (data.success) {
            renderRooms(data.habitaciones);
        } else {
            container.innerHTML = `<div style="color:red; text-align:center;">Error: ${data.error}</div>`;
        }
    } catch (e) {
        container.innerHTML = `<div style="color:red; text-align:center;">Error de conexión: ${e.message}</div>`;
    }
}

function loadCalendarView() {
    document.getElementById('view-calendar').innerHTML = `
        <div style="text-align:center; padding: 50px; color: #64748B;">
            <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 15px; color: var(--primary);"></i>
            <h3>Módulo en Construcción</h3>
            <p>Aquí verás el calendario tipo Gantt.</p>
        </div>
    `;
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

function saveRoom(e) {
    e.preventDefault();
    alert('Función de guardado pendiente de implementar en backend');
    closeRoomEditor();
}

function renderRooms(rooms) {
    currentRoomsList = rooms; // Cache for editing
    const container = document.getElementById('view-rooms');

    if (rooms.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding: 40px; background:white; border-radius:10px;">
                <i class="fas fa-box-open" style="font-size:2rem; color:#cbd5e1;"></i>
                <p>No hay habitaciones registradas.</p>
                <button class="btn-login" style="width:auto; margin-top:10px;" onclick="openNewRoom()">+ Crear Primera Habitación</button>
            </div>
        `;
        return;
    }

    let html = '<div class="room-grid">';
    rooms.forEach(r => {
        // Status Badge Logic
        let statusClass = 'status-disponible';
        let statusText = r.estado || 'Desconocido';
        if (statusText.toLowerCase() === 'ocupado') statusClass = 'status-ocupado';
        else if (statusText.toLowerCase() === 'mantenimiento') statusClass = 'status-mantenimiento';
        else if (statusText.toLowerCase() === 'sucio') statusClass = 'status-sucio';

        // Image Logic (Check if it's a URL or JSON string)
        let mainImg = 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=600';
        try {
            if (r.fotos && r.fotos.startsWith('[')) {
                const photos = JSON.parse(r.fotos);
                if (photos.length > 0) mainImg = photos[0];
            } else if (r.fotos && r.fotos.startsWith('http')) {
                mainImg = r.fotos;
            }
        } catch (e) { }

        html += `
        <div class="room-card fade-in">
            <div class="room-img-box">
                <span class="room-status-badge ${statusClass}">${statusText}</span>
                <img src="${mainImg}" class="room-img" alt="Foto">
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

                <div class="room-actions">
                    <button class="btn-icon" title="Editar" onclick="editRoom('${r.id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-icon" title="Calendario"><i class="fas fa-calendar"></i></button>
                    ${r.estado === 'Sucio' ? `<button class="btn-icon" title="Marcar Limpio" style="color:var(--primary);"><i class="fas fa-broom"></i></button>` : ''}
                </div>
            </div>
        </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}
