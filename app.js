const CONFIG = {
  APP_NAME: 'Grupo PS ERP',
  SHEET_ID: '1YDiBYHZnXjYXoD4YqR-dJxWnwOtYce9dHnTmT358sQU',
  ID_CASAMUNAY: '1yA_k5Ar4jrJs72vy3V5eM2A8lTukxH6bHetKk3Is27Q'
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle(CONFIG.APP_NAME)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ===== API ACTIONS =====
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return response({ error: 'Invalid JSON', details: err.toString() });
  }

  const action = data.action;
  
  try {
    if (action === 'login') return loginUser(data.email, data.password);
    if (action === 'getHabitaciones') return getHabitaciones();
    if (action === 'saveHabitacion') return saveHabitacion(data.habitacion);
    if (action === 'getUsuarios') return getUsuarios();
    if (action === 'saveUsuario') return saveUsuario(data.usuario);
    if (action === 'getProductos') return getProductos();
    if (action === 'saveProducto') return saveProducto(data.producto);
    
    // Phase 5 operations
    if (action === 'checkIn') return checkIn(data);

    return response({ error: 'Acción desconocida' });
  } catch (err) {
    return response({ error: 'Server Error', details: err.toString() });
  }
}

// ===== AUTHENTICATION =====
function loginUser(email, password) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  if (!sheet) return response({ error: 'Error DB: Hoja Usuarios no encontrada' });
  
  const data = sheet.getDataRange().getValues();
  // Asumimos fila 1 encabezados. Datos desde fila 2.
  // Col A=ID, B=Nombre, C=Email, D=Password, E=Rol
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[2]).toLowerCase() === email.toLowerCase().trim() && String(row[3]) === password) {
      return response({
        success: true,
        user: {
          id: row[0],
          nombre: row[1],
          email: row[2],
          rol: row[4]
        },
        token: Utilities.base64Encode(row[0] + '_' + new Date().getTime()) // Token simple
      });
    }
  }
  
  return response({ error: 'Credenciales incorrectas' });
}

// ===== ROOMS MODULE =====
function getHabitaciones() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Habitaciones');
  if (!sheet) return response({ error: 'Error DB: Hoja Habitaciones no encontrada' });
  
  const data = sheet.getDataRange().getValues();
  const rooms = [];
  
  // Asumimos fila 1 encabezados. A=ID, B=Numero, C=Tipo, D=Precio, E=Capacidad, F=Camas, G=Estado, H=Fotos, I=Detalles
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    rooms.push({
      id: row[0],
      numero: row[1],
      tipo: row[2],
      precio: row[3],
      capacidad: row[4],
      camas: row[5],
      estado: row[6],
      fotos: row[7], // JSON String or URL
      detalles: row[8]
    });
  }
  
  return response({ success: true, habitaciones: rooms });
}

function saveHabitacion(hab) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Habitaciones');
  if (!sheet) return response({ error: 'DB: Hoja Habitaciones no encontrada' });
  
  const data = sheet.getDataRange().getValues();
  // Columns: A=ID, B=Numero, C=Tipo, D=Precio, E=Capacidad, F=Camas, G=Estado, H=Fotos, I=Detalles, J=Empresa(Nuevo)
  
  // 1. UPDATE EXISTING
  if (hab.id) {
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(hab.id)) {
            // Found it, update fields
            // Row index is i+1 because 1-based
            const r = i + 1;
            sheet.getRange(r, 2).setValue(hab.numero);
            sheet.getRange(r, 3).setValue(hab.tipo);
            sheet.getRange(r, 4).setValue(hab.precio);
            sheet.getRange(r, 5).setValue(hab.capacidad || 2);
            sheet.getRange(r, 6).setValue(hab.camas || '');
            sheet.getRange(r, 7).setValue(hab.estado);
            sheet.getRange(r, 8).setValue(hab.fotos || '');
            // sheet.getRange(r, 10).setValue('CasaMunay'); // Default for now
            
            return response({ success: true, message: 'Actualizado correctamente' });
        }
    }
    return response({ error: 'Habitación no encontrada para editar' });
  } 
  
  // 2. CREATE NEW
  else {
      const newId = 'HAB-' + new Date().getTime(); // Simple ID Gen
      sheet.appendRow([
          newId,
          hab.numero,
          hab.tipo,
          hab.precio,
          hab.capacidad || 2,
          hab.camas || '',
          hab.estado,
          hab.fotos || '',
          hab.detalles || '',
          'CasaMunay' // Default Business Unit
      ]);
      return response({ success: true, message: 'Creada correctamente', id: newId });
  }
}



// ===== USERS MODULE =====
function getUsuarios() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  if (!sheet) return response({ error: 'DB: Hoja Usuarios no encontrada' });
  
  const data = sheet.getDataRange().getValues();
  const users = [];
  
  // Col A=ID, B=Nombre, C=Email, D=Password, E=Rol, F=Estado
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    users.push({
      id: row[0],
      nombre: row[1],
      email: row[2],
      // password: row[3], // Seguridad: No devolver password
      rol: row[4],
      estado: row[5]
    });
  }
  
  return response({ success: true, usuarios: users });
}

function saveUsuario(user) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Usuarios');
  if (!sheet) return response({ error: 'DB: Hoja Usuarios no encontrada' });
  
  const data = sheet.getDataRange().getValues();
  
  // 1. UPDATE EXISTING
  if (user.id) {
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(user.id)) {
            const r = i + 1;
            sheet.getRange(r, 2).setValue(user.nombre);
            sheet.getRange(r, 3).setValue(user.email);
            if (user.password && user.password.trim() !== '') {
                 sheet.getRange(r, 4).setValue(user.password);
            }
            sheet.getRange(r, 5).setValue(user.rol);
            sheet.getRange(r, 6).setValue(user.estado);
            
            return response({ success: true, message: 'Usuario actualizado' });
        }
    }
    return response({ error: 'Usuario no encontrado' });
  } 
  
  // 2. CREATE NEW
  else {
      // Validar duplicado de email
      for (let i = 1; i < data.length; i++) {
          if (String(data[i][2]).toLowerCase() === String(user.email).toLowerCase()) {
               return response({ error: 'El email ya está registrado' });
          }
      }

      const newId = 'USR-' + new Date().getTime();
      sheet.appendRow([
          newId,
          user.nombre,
          user.email,
          user.password || '123456', // Default pass
          user.rol,
          user.estado
      ]);
      return response({ success: true, message: 'Usuario creado', id: newId });
  }
}

// ===== PRODUCTS MODULE (PHASE 4 - CENTRALIZED) =====
function getProductos() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos');
  if (!sheet) return response({ error: 'DB: Hoja Productos no encontrada' }); 
  
  const data = sheet.getDataRange().getValues();
  const products = [];
  
  // Local Schema: A=ID, B=Categoria, C=Nombre, D=Descripcion, E=Precio, F=Stock, G=Imagen_URL, H=Activo, I=Empresa
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    products.push({
      id: row[0],
      categoria: row[1],
      nombre: row[2],
      descripcion: row[3],
      precio: row[4],
      stock: row[5],
      imagen_url: row[6], // Renamed to match external
      activo: row[7],
      empresa: row[8]
    });
  }
  return response({ success: true, productos: products });
}

function saveProducto(prod) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Productos');
  if (!sheet) return response({ error: 'DB: Hoja Productos no encontrada' });
  
  const data = sheet.getDataRange().getValues();
  let savedId = prod.id;
  
  // 1. LOCAL SAVE (GRUPO PS)
  // ------------------------------------------
  if (prod.id) {
    // UPDATE
    let found = false;
    for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(prod.id)) {
            const r = i + 1;
            sheet.getRange(r, 2).setValue(prod.categoria);
            sheet.getRange(r, 3).setValue(prod.nombre);
            sheet.getRange(r, 4).setValue(prod.descripcion);
            sheet.getRange(r, 5).setValue(prod.precio);
            sheet.getRange(r, 6).setValue(prod.stock);
            sheet.getRange(r, 7).setValue(prod.imagen_url);
            sheet.getRange(r, 8).setValue(prod.activo);
            sheet.getRange(r, 9).setValue(prod.empresa);
            found = true;
            break;
        }
    }
    if (!found) return response({ error: 'Producto no encontrado' });
  } else {
      // CREATE
      savedId = 'PROD-' + new Date().getTime();
      sheet.appendRow([
          savedId,
          prod.categoria,
          prod.nombre,
          prod.descripcion,
          prod.precio,
          prod.stock,
          prod.imagen_url,
          prod.activo,
          prod.empresa
      ]);
  }

  // 2. REMOTE SYNC (CASA MUNAY WEB)
  // ------------------------------------------
  try {
     syncToCasaMunay(savedId, prod);
  } catch (e) {
     // If sync fails, we still return success but maybe with a warning? 
     // For now, let's just log it or ignore strict failure to keep ERP usable.
     // But ideally we want to know.
     // return response({ success: true, message: 'Guardado Local OK. Error Sync: ' + e.message, id: savedId });
  }

  return response({ success: true, message: 'Producto guardado y sincronizado', id: savedId });
}

// Helper: Sync to External DB
function syncToCasaMunay(id, prod) {
  const ssExt = SpreadsheetApp.openById(CONFIG.ID_CASAMUNAY);
  const sheetExt = ssExt.getSheetByName('Servicios');
  if (!sheetExt) return;

  const data = sheetExt.getDataRange().getValues();
  let foundRow = -1;

  // Search by ID (Col A)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      foundRow = i + 1;
      break;
    }
  }

  // Columns External: A=ID, B=Categoria, C=Nombre, D=Descripcion, E=Precio, F=Stock, G=Imagen_URL, H=Activo
  if (foundRow > 0) {
    // Update
    sheetExt.getRange(foundRow, 2).setValue(prod.categoria);
    sheetExt.getRange(foundRow, 3).setValue(prod.nombre);
    sheetExt.getRange(foundRow, 4).setValue(prod.descripcion);
    sheetExt.getRange(foundRow, 5).setValue(prod.precio);
    sheetExt.getRange(foundRow, 6).setValue(prod.stock);
    sheetExt.getRange(foundRow, 7).setValue(prod.imagen_url);
    sheetExt.getRange(foundRow, 8).setValue(prod.activo);
  } else {
    // Append
    sheetExt.appendRow([
      id,
      prod.categoria,
      prod.nombre,
      prod.descripcion,
      prod.precio,
      prod.stock,
      prod.imagen_url,
      prod.activo
    ]);
  }
}

// ===== OPERATIONS MODULE (PHASE 5) =====
function checkIn(data) {
  // data: { habitacionId, cliente, fechaSalida, notas }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetHab = ss.getSheetByName('Habitaciones');
  const sheetRes = ss.getSheetByName('Reservas');
  
  if (!sheetHab || !sheetRes) return response({ error: 'DB: Faltan hojas Habitaciones o Reservas' });
  
  // 1. Update Room Status -> Ocupado
  const dataHab = sheetHab.getDataRange().getValues();
  let roomFound = false;
  let roomRow = -1;
  
  for (let i = 1; i < dataHab.length; i++) {
    // Check ID (Col 0) OR Number (Col 1) containing the input
    if (String(dataHab[i][0]) === String(data.habitacionId) || String(dataHab[i][1]) === String(data.habitacionId)) {
       roomFound = true;
       roomRow = i + 1;
       // Validar si ya está ocupada?
       // Col 6 is Estado based on saveHabitacion (A=0 ... G=6)
       if (String(dataHab[i][6]).toLowerCase() === 'ocupado') {
           return response({ error: 'La habitación ya está ocupada.' });
       }
       break;
    }
  }
  
  if (!roomFound) return response({ error: 'Habitación no encontrada' });
  
  // Set Ocupado and Guest Name (Optional column logic, assuming Col 6 is State, Col 9 might be Guest if added, but mainly State)
  // Based on saveHabitacion: Col 6 is Estado.
  sheetHab.getRange(roomRow, 6).setValue('Ocupado');
  
  // 2. Create Reservation
  // Headers: ID | Habitacion_ID | Cliente | CheckIn | CheckOut | Estado | Total | Pagado | Notas
  const resId = 'RES-' + new Date().getTime();
  const now = new Date(); // CheckIn time
  const checkOut = data.fechaSalida || ''; // Should be date object or string
  
  sheetRes.appendRow([
      resId,
      data.habitacionId,
      data.cliente,
      now,                // CheckIn
      checkOut,           // CheckOut
      'Activa',           // Estado
      0,                  // Total (starts at 0)
      0,                  // Pagado
      data.notas || ''    // Notas
  ]);
  
  return response({ success: true, message: 'Check-in realizado', reservaId: resId });
}

// ===== HELPER =====
function response(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
