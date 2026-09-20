/**
 * API DE LA APP MÓVIL — Fase 1
 *
 * Archivo nuevo. Se agrega al mismo proyecto de Apps Script, junto a Codigo.gs.
 * Reutiliza sus constantes (COL, COLS_EGRESO) y su construirFila_().
 *
 * Antes de usarla hay que ejecutar configurarToken() una vez desde el editor.
 */

var DIAS_CENSO   = 14;   // sin sesiones por más días, el episodio sale de la ronda
var DIAS_EGRESO  = 3;    // ventana para deshacer un egreso marcado por error
var HOJA_SYNC    = '_sync';


// ══════════════════════════════════════════════════════════
// PUESTA EN MARCHA — ejecutar una sola vez desde el editor
// ══════════════════════════════════════════════════════════

/**
 * Genera la clave de acceso y la deja guardada en el proyecto.
 * El resultado aparece en el registro de ejecución: cópialo, lo vas a escribir
 * una vez en la app y nunca más. No queda en ningún archivo publicado.
 */
function configurarToken() {
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  PropertiesService.getScriptProperties().setProperty('API_TOKEN', token);
  Logger.log('Clave de acceso para la app:\n\n' + token + '\n');
  return token;
}

function verificarToken_(token) {
  var guardado = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!guardado) throw new Error('Falta ejecutar configurarToken() en el editor de Apps Script.');
  if (String(token) !== guardado) throw new Error('Clave de acceso incorrecta.');
}

/**
 * Muestra de una vez los dos datos que hay que escribir en la app:
 * la dirección de la aplicación web y la clave de acceso.
 *
 * Ejecútala desde el editor y mira el Registro de ejecución.
 * Es segura de repetir: si ya existe una clave la muestra, no la cambia.
 */
function verDatosDeLaApp() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('API_TOKEN');
  var creada = false;

  if (!token) { token = configurarToken(); creada = true; }

  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }

  Logger.log('══════════════════════════════════════════');
  Logger.log('DIRECCION DE LA APP WEB');
  Logger.log(url || '  (todavia no implementada: Implementar -> Nueva implementacion)');
  Logger.log('');
  Logger.log('CLAVE DE ACCESO');
  Logger.log(token);
  Logger.log('');
  Logger.log(creada ? 'Se creo una clave nueva ahora.' : 'Esta es la clave que ya estaba guardada.');
  Logger.log('══════════════════════════════════════════');

  return { url: url, token: token };
}

function getHojaSync_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var hoja = ss.getSheetByName(HOJA_SYNC);
  if (!hoja) {
    // Hoja aparte a propósito: la principal conserva sus 46 columnas intactas
    // para que tu copiado a la planilla oficial no cambie.
    hoja = ss.insertSheet(HOJA_SYNC);
    hoja.appendRow(['uuid', 'sincronizado', 'fila']);
    hoja.hideSheet();
  }
  return hoja;
}


// ══════════════════════════════════════════════════════════
// RESPUESTAS
// ══════════════════════════════════════════════════════════

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}


// ══════════════════════════════════════════════════════════
// GET — descarga del censo
// ══════════════════════════════════════════════════════════

function apiGet_(e) {
  try {
    verificarToken_(e.parameter.token);
    if (e.parameter.api === 'censo') return json_(construirCenso_(e.parameter.fono));
    if (e.parameter.api === 'ping')  return json_({ ok: true, hoja: HOJA_DATOS });
    if (e.parameter.api === 'dashboard') {
      var d = construirDashboard_(e.parameter.mes, e.parameter.fono);
      d.validacion = calcularValidacion_(d);
      return json_(d);
    }
    if (e.parameter.api === 'nomina') {
      return json_(construirNomina_(e.parameter.mes, e.parameter.fono));
    }
    if (e.parameter.api === 'resumen') {
      return json_(construirResumenIA_(e.parameter.mes, e.parameter.fono, e.parameter.anterior));
    }
    throw new Error('Acción desconocida: ' + e.parameter.api);
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/**
 * El censo son los episodios abiertos: último registro de cada RUT que no tenga
 * marca de egreso y cuya última sesión sea reciente.
 *
 * El corte por antigüedad es necesario: buena parte de los episodios no recibe
 * una fila de egreso, porque el paciente simplemente deja de aparecer cuando se
 * va. Sin corte, la ronda acumularía pacientes que ya no están. El plazo sale de
 * medir cada cuánto se repiten las sesiones de un mismo paciente.
 */
function construirCenso_(fono) {
  var datos = leerDatosBusqueda_();
  var hoy = new Date();
  var anioActual = hoy.getFullYear();

  var MESES = { ENERO:0, FEBRERO:1, MARZO:2, ABRIL:3, MAYO:4, JUNIO:5, JULIO:6,
                AGOSTO:7, SEPTIEMBRE:8, OCTUBRE:9, NOVIEMBRE:10, DICIEMBRE:11 };

  function fechaDeFila(fila) {
    var mes = MESES[normalizarTexto_(fila[COL.MES])];
    var dia = parseInt(fila[COL.DIA], 10);
    if (mes === undefined || isNaN(dia)) return null;
    // La planilla no guarda el año. Se asume el actual; si la fecha queda en el
    // futuro, es del año pasado.
    var f = new Date(anioActual, mes, dia);
    if (f > hoy) f = new Date(anioActual - 1, mes, dia);
    return f;
  }

  var porRut = {};
  var conteo = {};

  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var rut = normalizarRut_(fila[COL.RUT]);
    if (!rut) continue;
    if (fono && String(fila[COL.FONO]).trim() !== String(fono).trim()) continue;

    conteo[rut] = (conteo[rut] || 0) + 1;

    var f = fechaDeFila(fila);
    if (!porRut[rut] || !porRut[rut].fecha || (f && f >= porRut[rut].fecha)) {
      porRut[rut] = { fila: fila, fecha: f, indice: i };
    }
  }

  // Qué fila escribió cada sesión de la app, para poder deshacer un egreso.
  var uuidPorFila = {};
  var hojaSync = getHojaSync_();
  if (hojaSync.getLastRow() > 1) {
    hojaSync.getRange(2, 1, hojaSync.getLastRow() - 1, 3).getValues().forEach(function (f) {
      if (f[0] && f[2]) uuidPorFila[Number(f[2])] = String(f[0]);
    });
  }

  var activos = [], egresosRecientes = [];

  Object.keys(porRut).forEach(function (rut) {
    var reg = porRut[rut];
    var dias = reg.fecha ? Math.floor((hoy - reg.fecha) / 86400000) : 9999;

    var egresado = COLS_EGRESO.some(function (c) { return Number(reg.fila[c]) === 1; });
    var p = filaAPaciente_(reg.fila);
    p.cama            = String(reg.fila[COL.CAMA] || '');
    p.categorizacion  = String(reg.fila[COL.CATEGORIZA] || '');
    p.fono            = String(reg.fila[COL.FONO] || '');
    p.ultimaFecha     = reg.fecha ? Utilities.formatDate(reg.fecha, Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
    p.diasSinAtencion = dias;
    p.atencionesPrevias = conteo[rut];

    if (egresado) {
      if (dias <= DIAS_EGRESO) {
        p.motivoEgreso = motivoEgreso_(reg.fila);
        // Sin el uuid, la app no puede deshacer el egreso después de recargar
        // el censo. leerDatosBusqueda_ parte en la fila 2 de la hoja.
        p.uuidEgreso = uuidPorFila[reg.indice + 2] || '';
        egresosRecientes.push(p);
      }
    } else if (dias <= DIAS_CENSO) {
      activos.push(p);
    }
  });

  // Orden: por servicio y dentro de cada servicio por número de cama.
  activos.sort(function (a, b) {
    if (a.servicio !== b.servicio) return a.servicio < b.servicio ? -1 : 1;
    return (parseInt(a.cama, 10) || 0) - (parseInt(b.cama, 10) || 0);
  });

  return {
    ok: true,
    generado: Utilities.formatDate(hoy, Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss"),
    diasCenso: DIAS_CENSO,
    pacientes: activos,
    egresos: egresosRecientes,
    catalogos: getOpcionesFormulario()
  };
}

function motivoEgreso_(fila) {
  if (Number(fila[COL.ALTA]) === 1)          return 'Alta';
  if (Number(fila[COL.FALLECIMIENTO]) === 1) return 'Fallecimiento';
  if (Number(fila[COL.OTRO_HOSP]) === 1)     return 'Otro hospital';
  if (Number(fila[COL.ABANDONO]) === 1)      return 'Abandono';
  return 'Egreso';
}


// ══════════════════════════════════════════════════════════
// POST — sincronización de sesiones
// ══════════════════════════════════════════════════════════

/**
 * Recibe el lote de sesiones que la app guardó sin conexión.
 *
 * El cliente envía Content-Type text/plain a propósito: application/json obliga
 * al navegador a hacer una petición previa de tipo OPTIONS, que Apps Script no
 * sabe responder.
 */
function doPost(e) {
  try {
    var cuerpo = JSON.parse(e.postData.contents);
    verificarToken_(cuerpo.token);

    if (cuerpo.accion === 'sesiones') return json_(guardarSesiones_(cuerpo.sesiones || []));
    if (cuerpo.accion === 'anular')   return json_(anularEgreso_(cuerpo.uuid));
    throw new Error('Acción desconocida: ' + cuerpo.accion);

  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/**
 * Escribe el lote. Cada sesión trae un identificador único generado en el
 * teléfono: si ya está en la hoja _sync, se ignora sin escribir nada.
 * Por eso reintentar nunca duplica una fila.
 */
function guardarSesiones_(sesiones) {
  if (!sesiones.length) return { ok: true, guardadas: [], duplicadas: [], errores: [] };

  // Un solo candado para todo el lote: dos sincronizaciones simultáneas no se pisan.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var hoja = getHoja_();
    var hojaSync = getHojaSync_();

    var yaEscritos = {};
    var ultima = hojaSync.getLastRow();
    if (ultima > 1) {
      hojaSync.getRange(2, 1, ultima - 1, 1).getValues().forEach(function (f) {
        if (f[0]) yaEscritos[String(f[0])] = true;
      });
    }

    var guardadas = [], duplicadas = [], errores = [];
    var filasNuevas = [], filasSync = [];
    var primeraFila = hoja.getLastRow() + 1;

    sesiones.forEach(function (s) {
      if (!s.uuid) { errores.push({ uuid: null, msg: 'Sesión sin identificador.' }); return; }
      if (yaEscritos[s.uuid]) { duplicadas.push(s.uuid); return; }

      try {
        validarDatos_(s);
        filasNuevas.push(construirFila_(s));
        filasSync.push([s.uuid, new Date(), primeraFila + filasNuevas.length - 1]);
        yaEscritos[s.uuid] = true;
        guardadas.push(s.uuid);
      } catch (err) {
        errores.push({ uuid: s.uuid, msg: String(err.message || err) });
      }
    });

    // Se escribe primero la planilla y después el registro de sincronización.
    // Si algo falla en medio, la sesión se reenvía y como su uuid no quedó
    // registrado se vuelve a intentar, en vez de darse por guardada.
    if (filasNuevas.length) {
      hoja.getRange(primeraFila, 1, filasNuevas.length, filasNuevas[0].length).setValues(filasNuevas);
      hojaSync.getRange(hojaSync.getLastRow() + 1, 1, filasSync.length, 3).setValues(filasSync);
    }

    return { ok: true, guardadas: guardadas, duplicadas: duplicadas, errores: errores };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Deshace un egreso marcado por error: pone en cero las columnas de condición de
 * la fila que escribió la app, ubicada por su identificador único.
 *
 * Solo funciona con filas escritas por la app, porque son las únicas que tienen
 * uuid en la hoja _sync. No borra la fila: la deja como una atención sin egreso,
 * que es exactamente lo que habría sido si no te hubieras equivocado.
 */
function anularEgreso_(uuid) {
  if (!uuid) throw new Error('Falta el identificador del egreso.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var hojaSync = getHojaSync_();
    var ultima = hojaSync.getLastRow();
    if (ultima < 2) throw new Error('No hay registros de sincronización.');

    var registros = hojaSync.getRange(2, 1, ultima - 1, 3).getValues();
    var fila = null;
    for (var i = registros.length - 1; i >= 0; i--) {
      if (String(registros[i][0]) === String(uuid)) { fila = Number(registros[i][2]); break; }
    }
    if (!fila) throw new Error('Ese egreso no lo registró la app.');

    var hoja = getHoja_();
    // Columnas de condición: de INGRESO a NIVEL PRIMARIO, en base 1.
    var desde = COL.INGRESO + 1;
    var ancho = COL.NIVEL_PRIM - COL.INGRESO + 1;
    var actual = hoja.getRange(fila, desde, 1, ancho).getValues()[0];

    var eraEgreso = COLS_EGRESO.some(function (c) {
      return Number(actual[c - COL.INGRESO]) === 1;
    });
    if (!eraEgreso) throw new Error('Esa fila no tiene marca de egreso.');

    hoja.getRange(fila, desde, 1, ancho).setValues([actual.map(function () { return 0; })]);
    return { ok: true, fila: fila };

  } finally {
    lock.releaseLock();
  }
}
