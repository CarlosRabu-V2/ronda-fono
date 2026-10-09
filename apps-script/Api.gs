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

  // Se comparan recortados: al copiar la clave del registro de ejecución es
  // fácil arrastrar un espacio o un salto de línea invisible.
  var recibido = String(token == null ? '' : token).trim();
  if (recibido === '') throw new Error('No se envió la clave de acceso.');
  if (recibido !== String(guardado).trim()) throw new Error('Clave de acceso incorrecta.');
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

  // OJO: ejecutada desde el editor, getUrl() devuelve la direccion de PRUEBAS,
  // la que termina en /dev. Esa exige sesion de Google y no manda cabeceras CORS,
  // asi que la app nunca podra conectarse con ella.
  var url = '';
  try { url = ScriptApp.getService().getUrl() || ''; } catch (e) { url = ''; }
  var esPruebas = /\/dev\/?$/.test(url);

  Logger.log('══════════════════════════════════════════');
  Logger.log('DIRECCION DE LA APP WEB');
  if (!url) {
    Logger.log('  (todavia no implementada: Implementar -> Nueva implementacion)');
  } else if (esPruebas) {
    Logger.log('  ' + url);
    Logger.log('  >>> ESTA ES LA DIRECCION DE PRUEBAS Y NO SIRVE PARA LA APP.');
    Logger.log('  >>> Busca la que termina en /exec en:');
    Logger.log('  >>> Implementar -> Gestionar implementaciones -> URL de la aplicacion web');
  } else {
    Logger.log('  ' + url);
  }
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

/**
 * Lo que dice _sync de cada fila de la planilla. Una fila puede tener varias
 * entradas: el ingreso, la atención y la salida de un mismo día van juntos.
 * La cuarta columna marca las salidas deshechas (ver anularEgreso_).
 */
function leerSync_() {
  var res = { uuids: {}, usos: {}, ultimoUuid: {}, anuladas: {} };
  var hojaSync = getHojaSync_();
  var ultima = hojaSync.getLastRow();
  if (ultima < 2) return res;
  hojaSync.getRange(2, 1, ultima - 1, 4).getValues().forEach(function (f) {
    if (!f[0]) return;
    res.uuids[String(f[0])] = true;
    var n = Number(f[2]);
    if (!n) return;
    res.usos[n] = (res.usos[n] || 0) + 1;
    res.ultimoUuid[n] = String(f[0]);
    // Manda la última entrada: si la fila vacía se volvió a ocupar, ya no está anulada.
    res.anuladas[n] = f[3] === 'anulado';
  });
  return res;
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
    if (e.parameter.api === 'censo') {
      return json_(construirCenso_(e.parameter.fono, e.parameter.dias, e.parameter.servicios));
    }
    // Con los catálogos: la configuración de la app los necesita para elegir el
    // nombre, y sin ellos tenía que descargar la ronda de todo el hospital.
    if (e.parameter.api === 'ping')  return json_({ ok: true, hoja: HOJA_DATOS, catalogos: getOpcionesFormulario() });
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
 * Días completos entre dos fechas, contando por día calendario y no por horas.
 * En UTC a propósito: con el cambio de hora de septiembre, 16 días de
 * diferencia dan 15 días y 23 horas, y eso dejaba fuera de la ronda a un
 * paciente que caía justo en el borde.
 */
function diasEntre_(desde, hasta) {
  var a = Date.UTC(desde.getFullYear(), desde.getMonth(), desde.getDate());
  var b = Date.UTC(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.round((b - a) / 86400000);
}

/**
 * El censo son los episodios abiertos: el último registro de cada RUT, que no
 * tenga marca de egreso y que sea reciente.
 *
 * El corte por antigüedad es necesario: buena parte de los episodios no recibe
 * una fila de egreso, porque el paciente simplemente deja de aparecer cuando se
 * va. Sin corte, la ronda acumularía pacientes que ya no están. El plazo sale de
 * medir cada cuánto se repiten las sesiones de un mismo paciente.
 *
 * Entra a la ronda quien esta profesional atendió dentro del plazo, y además
 * todo paciente activo de los servicios que cubre. Antes solo se miraban sus
 * propias filas: los pacientes de UTI, registrados por otra colega, nunca
 * aparecían los días que le tocaba ir a UTI.
 *
 * Dónde está el paciente y si egresó lo dice su última fila, sea de quien sea:
 * si una colega le dio el alta, el episodio está cerrado aunque la última
 * atención de esta profesional no lo diga.
 *
 * @param {string|number} [diasPedidos] Amplía la ventana por esta vez. Sirve
 *   cuando pasaron varios días sin registrar y hay pacientes que siguen
 *   hospitalizados: sin esto habría que reescribirlos uno por uno.
 *   Se limita a 120 días; más allá son episodios cerrados con seguridad.
 * @param {string} [serviciosCubiertos] Servicios separados por coma, por
 *   ejemplo "UTI,UCI".
 */
function construirCenso_(fono, diasPedidos, serviciosCubiertos) {
  var dias = parseInt(diasPedidos, 10);
  if (isNaN(dias) || dias < 1) dias = DIAS_CENSO;
  dias = Math.min(dias, 120);

  var cubre = {};
  String(serviciosCubiertos || '').split(',').forEach(function (s) {
    var n = normalizarTexto_(s);
    if (n) cubre[n] = true;
  });
  var fonoBuscado = String(fono || '').trim();

  var datos = leerDatosBusqueda_();
  var hoy = new Date();
  var anioActual = hoy.getFullYear();

  var MESES = { ENERO:0, FEBRERO:1, MARZO:2, ABRIL:3, MAYO:4, JUNIO:5, JULIO:6,
                AGOSTO:7, SEPTIEMBRE:8, SETIEMBRE:8, OCTUBRE:9, NOVIEMBRE:10, DICIEMBRE:11 };

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

  // Qué fila escribió cada registro de la app, para poder deshacer un egreso.
  var sync = leerSync_();

  var ultima = {};    // última fila de cada RUT, de cualquier profesional
  var propia = {};    // última fila de cada RUT escrita por esta profesional
  var conteo = {};
  var filasPropias = 0, masReciente = null;

  for (var i = 0; i < datos.length; i++) {
    var fila = datos[i];
    var rut = normalizarRut_(fila[COL.RUT]);
    if (!rut) continue;
    // Una salida deshecha que no traía atención dejó la fila vacía: no es una
    // atención, y contarla dejaba al paciente como atendido ese día.
    if (sync.anuladas[i + 2] && esFilaVacia_(fila)) continue;

    var reg = { fila: fila, fecha: fechaDeFila(fila), indice: i };
    conteo[rut] = (conteo[rut] || 0) + 1;
    if (esMasReciente_(reg, ultima[rut])) ultima[rut] = reg;

    // Sin nombre se toman todas las filas, como antes.
    if (fonoBuscado && String(fila[COL.FONO]).trim() !== fonoBuscado) continue;
    filasPropias++;
    if (esMasReciente_(reg, propia[rut])) propia[rut] = reg;
    if (reg.fecha && (!masReciente || reg.fecha > masReciente)) masReciente = reg.fecha;
  }

  var activos = [], egresosRecientes = [];
  var tz = Session.getScriptTimeZone();
  var iso = function (d) { return d ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : ''; };

  function paciente(reg, mia, diasSin, n) {
    var p = filaAPaciente_(reg.fila);
    p.cama            = String(reg.fila[COL.CAMA] || '');
    p.categorizacion  = String(reg.fila[COL.CATEGORIZA] || '');
    p.fono            = String(reg.fila[COL.FONO] || '');      // quién lo atendió por última vez
    p.ultimaFecha     = iso(reg.fecha);                        // última atención de cualquiera
    p.ultimaFechaMia  = mia ? iso(mia.fecha) : '';             // la de esta profesional
    p.diasSinAtencion = diasSin;
    p.atencionesPrevias = n;
    // Lo ingresó y todavía no registra la primera sesión: en la ronda sigue
    // pendiente, no atendido. La sesión completará esa misma fila.
    if (mia && esIngresoSinSesion_(mia.fila)) p.soloIngreso = true;
    return p;
  }

  function comoEgreso(p, reg) {
    p.motivoEgreso = motivoEgreso_(reg.fila);
    // Sin el uuid, la app no puede deshacer el egreso después de recargar
    // el censo. leerDatosBusqueda_ parte en la fila 2 de la hoja.
    p.uuidEgreso = sync.ultimoUuid[reg.indice + 2] || '';
    return p;
  }

  Object.keys(ultima).forEach(function (rut) {
    var reg = ultima[rut];
    var mia = propia[rut];
    var diasSin = reg.fecha ? diasEntre_(reg.fecha, hoy) : 9999;
    var diasMia = (mia && mia.fecha) ? diasEntre_(mia.fecha, hoy) : 9999;

    // Qué cierra el episodio depende de quién escribió la fila. Una salida
    // marcada por ella, incluidos el traslado a otro servicio y las
    // derivaciones, dice que el paciente dejó SU cuidado: así lo marca la app al
    // tocar "Marcar salida", y así se usa en la planilla (tras un traslado, el
    // paciente casi siempre sigue con otra colega). La marca de una colega solo
    // lo cierra si el paciente dejó el hospital: un traslado de UTI a MQ no lo
    // saca de la ronda de MQ.
    //
    // Si ella le dio la salida y después lo registró otra colega (un control
    // ambulatorio, un reingreso), eso es otro episodio: no vuelve a su ronda,
    // salvo que esté en un servicio que ella cubre.
    var cerradoPorElla = !!mia && mia !== reg && esSalida_(mia.fila);
    var suyo = diasMia <= dias && !cerradoPorElla;
    var enCubierto = diasSin <= dias && cubre[normalizarTexto_(reg.fila[COL.SERVICIO])] === true;

    if (!suyo && !enCubierto) {
      // Su salida reciente se sigue mostrando, para poder deshacerla.
      if (cerradoPorElla && diasMia <= DIAS_EGRESO) {
        egresosRecientes.push(comoEgreso(paciente(mia, mia, diasMia, conteo[rut]), mia));
      }
      return;
    }

    var p = paciente(reg, mia, diasSin, conteo[rut]);
    // "Cubierto" dice dónde está, no quién lo atendió: un paciente de UTI que
    // ella vio el martes sigue siendo de UTI el miércoles, y no debe contar como
    // pendiente de su ronda los días que no va.
    if (enCubierto) p.cubierto = true;

    // En un servicio que solo cubre, cualquier salida significa que el paciente
    // ya no está en ese servicio.
    var cerrado = (!suyo || reg === mia) ? esSalida_(reg.fila) : esEgreso_(reg.fila);
    if (cerrado) {
      // Egresos recientes sirve para deshacer: solo entran las salidas que
      // marcó ella. La de una colega no se puede deshacer desde la app.
      if (reg === mia && diasSin <= DIAS_EGRESO) egresosRecientes.push(comoEgreso(p, reg));
    } else {
      activos.push(p);
    }
  });

  // Orden: por servicio y dentro de cada servicio por número de cama.
  activos.sort(function (a, b) {
    if (a.servicio !== b.servicio) return a.servicio < b.servicio ? -1 : 1;
    return (parseInt(a.cama, 10) || 0) - (parseInt(b.cama, 10) || 0);
  });

  // Cuando la ronda sale vacía hay que poder decir por qué. Sin esto, la
  // pantalla queda en blanco y no se distingue "no hay nadie hospitalizado"
  // de "la app no está leyendo la planilla".
  return {
    ok: true,
    generado: Utilities.formatDate(hoy, tz, "yyyy-MM-dd'T'HH:mm:ss"),
    diasCenso: dias,
    diasPorDefecto: DIAS_CENSO,
    pacientes: activos,
    egresos: egresosRecientes,
    diagnostico: {
      filasLeidas: datos.length,
      filasDelProfesional: filasPropias,
      personasDistintas: Object.keys(propia).length,
      registroMasReciente: iso(masReciente),
      hoja: HOJA_DATOS
    },
    catalogos: getOpcionesFormulario()
  };
}

/**
 * Si la fila nueva es más reciente que la guardada para el mismo paciente.
 * Una fila sin fecha legible no desplaza a una fechada; en el mismo día gana la
 * de más abajo, que es la última que se escribió.
 */
function esMasReciente_(nueva, actual) {
  if (!actual || !actual.fecha) return true;
  return !!(nueva.fecha && nueva.fecha >= actual.fecha);
}

/** La fila marca que el paciente dejó el hospital (alta, abandono, fallecimiento, otro hospital). */
function esEgreso_(fila) {
  return COLS_EGRESO.some(function (c) { return Number(fila[c]) === 1; });
}

/** Cualquiera de las siete salidas del REM, incluidos el traslado y las derivaciones. */
function esSalida_(fila) {
  return COLS_EGRESO_REM.some(function (c) { return Number(fila[c]) === 1; });
}

function motivoEgreso_(fila) {
  if (Number(fila[COL.ALTA]) === 1)          return 'Alta';
  if (Number(fila[COL.FALLECIMIENTO]) === 1) return 'Fallecimiento';
  if (Number(fila[COL.OTRO_HOSP]) === 1)     return 'Otro hospital';
  if (Number(fila[COL.ABANDONO]) === 1)      return 'Abandono';
  if (Number(fila[COL.OTRO_SERV]) === 1)     return 'Otro servicio';
  if (Number(fila[COL.NIVEL_PRIM]) === 1)    return 'Nivel primario';
  if (Number(fila[COL.ACV_APS]) === 1)       return 'ACV referido a APS';
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
 *
 * En la planilla, lo de un mismo paciente en un mismo día va en una sola fila:
 * el ingreso, la atención y la salida. Por eso no siempre se agrega una fila
 * (ver unirConElDia_), y entonces varias entradas de _sync apuntan a la misma.
 */
function guardarSesiones_(sesiones) {
  if (!sesiones.length) return { ok: true, guardadas: [], duplicadas: [], errores: [] };

  // Un solo candado para todo el lote: dos sincronizaciones simultáneas no se pisan.
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var hoja = getHoja_();
    var hojaSync = getHojaSync_();
    var sync = leerSync_();
    var yaEscritos = sync.uuids;

    var guardadas = [], duplicadas = [], errores = [];
    var filasNuevas = [], filasSync = [];
    var completadas = {};   // filas ya escritas que cambian: número de fila → valores
    var primeraFila = hoja.getLastRow() + 1;

    // Última fila de cada paciente en el día (claveDelDia_ → { n, fila, app }):
    // las de este lote, que son las más recientes, y las de la planilla, que
    // se leen solo si llega algo que podría unirse a ellas.
    var delLote = {}, escritas = null;

    sesiones.forEach(function (s) {
      if (!s.uuid) { errores.push({ uuid: null, msg: 'Sesión sin identificador.' }); return; }
      if (yaEscritos[s.uuid]) { duplicadas.push(s.uuid); return; }

      // Solo un dato inválido se devuelve como rechazo de ese registro: queda
      // en la bandeja para corregirlo. Un fallo al leer la planilla, más abajo,
      // hace fallar el lote entero y el teléfono lo reintenta solo.
      var fila;
      try {
        validarDatos_(s);
        fila = construirFila_(s);
      } catch (err) {
        errores.push({ uuid: s.uuid, msg: String(err.message || err) });
        return;
      }
      var clave = claveDelDia_(fila);

      var previa = delLote[clave] || null;
      if (!previa && Number(fila[COL.INGRESO]) !== 1) {
        if (!escritas) escritas = filasDelDia_(hoja, primeraFila - 1, sync, fila.length);
        previa = escritas.porClave[clave] || null;
      }
      var unida = null;
      if (previa && yaEscritaEn_(previa, fila)) {
        // Reintento de un lote que se cortó después de completar esa fila: ya
        // dice lo que este registro iba a escribir. Se apunta a ella sin agregar otra.
        unida = previa.fila;
      } else if (previa) {
        unida = unirConElDia_(previa, fila);
        // Una salida tiene que quedar en la última fila del paciente ese día, sea
        // de quien sea: si una colega lo registró después, el censo leería esa
        // fila y el paciente seguiría en la ronda. Entonces va en una fila nueva.
        if (unida && esSalida_(unida) && previa.n < primeraFila &&
            escritas && escritas.ultimaDelDia[claveDelPaciente_(fila)] !== previa.n) {
          unida = null;
        }
      }

      var n;
      if (unida) {
        n = previa.n;
        if (n >= primeraFila) filasNuevas[n - primeraFila] = unida;
        else completadas[n] = unida;
        fila = unida;
      } else {
        filasNuevas.push(fila);
        n = primeraFila + filasNuevas.length - 1;
      }
      // usos 0: lo de este lote nunca es un reintento a medias (ver yaEscritaEn_).
      delLote[clave] = { n: n, fila: fila, app: true, usos: 0 };

      filasSync.push([s.uuid, new Date(), n]);
      yaEscritos[s.uuid] = true;
      guardadas.push(s.uuid);
    });

    // Se escribe primero la planilla y después el registro de sincronización.
    // Si algo falla en medio, la sesión se reenvía y como su uuid no quedó
    // registrado se vuelve a intentar, en vez de darse por guardada.
    Object.keys(completadas).forEach(function (n) {
      hoja.getRange(Number(n), 1, 1, completadas[n].length).setValues([completadas[n]]);
    });
    if (filasNuevas.length) {
      hoja.getRange(primeraFila, 1, filasNuevas.length, filasNuevas[0].length).setValues(filasNuevas);
    }
    if (filasSync.length) {
      hojaSync.getRange(hojaSync.getLastRow() + 1, 1, filasSync.length, 3).setValues(filasSync);
    }

    return { ok: true, guardadas: guardadas, duplicadas: duplicadas, errores: errores };

  } finally {
    lock.releaseLock();
  }
}

var FILAS_DEL_DIA = 500;   // cuántas filas del final se revisan buscando las del mismo día

/**
 * La última fila de cada paciente, profesional y día entre las últimas filas
 * de la planilla. Lo que se une es siempre del mismo día, así que está cerca
 * del final.
 *
 * @returns {{porClave: Object, ultimaDelDia: Object}} porClave: claveDelDia_ →
 *   { n: número de fila, fila, app: si la escribió la app, anulada: si tiene
 *   una salida deshecha }. Solo las de la app se pueden completar: una fila
 *   escrita a mano desde el PC no se toca. ultimaDelDia: claveDelPaciente_ →
 *   número de la última fila de ese paciente ese día, de cualquier profesional.
 */
function filasDelDia_(hoja, ultimaFila, sync, ancho) {
  var res = { porClave: {}, ultimaDelDia: {} };
  var desde = Math.max(2, ultimaFila - FILAS_DEL_DIA + 1);
  if (ultimaFila < desde) return res;
  hoja.getRange(desde, 1, ultimaFila - desde + 1, ancho).getValues().forEach(function (fila, i) {
    var n = desde + i;
    res.porClave[claveDelDia_(fila)] = { n: n, fila: fila, app: !!sync.usos[n], usos: sync.usos[n] || 0,
                                         anulada: !!sync.anuladas[n] };
    res.ultimaDelDia[claveDelPaciente_(fila)] = n;
  });
  return res;
}

/**
 * Si la fila ya dice lo que el registro iba a escribir: pasa al reintentar un
 * lote que se cortó después de completar una fila y antes de anotar en _sync.
 * Sin esto, el reintento agregaba otra fila con la misma atención o el mismo egreso.
 */
function yaEscritaEn_(previa, fila) {
  if (!previa.app) return false;
  // La sesión ya ocupó la fila del ingreso, pero su entrada en _sync no llegó a
  // escribirse: la fila tiene solo la del ingreso. Con dos entradas sería una
  // segunda sesión igual a la primera, que sí va aparte.
  var conIngreso = fila.slice();
  conIngreso[COL.INGRESO] = 1;
  if (previa.usos === 1 && Number(fila[COL.INGRESO]) !== 1 && filasIguales_(previa.fila, conIngreso)) return true;
  // La salida sin atención ya está marcada en esa fila: una segunda igual sería un egreso doble.
  if (esSalidaSinAtencion_(fila) &&
      COLS_EGRESO_REM.every(function (c) { return Number(previa.fila[c]) === Number(fila[c]); })) return true;
  // El registro ya ocupó la fila que había dejado vacía una salida deshecha.
  return previa.anulada && filasIguales_(previa.fila, fila);
}

/** Igualdad celda a celda, sin distinguir el número 70 del texto "70" que devuelve la planilla. */
function filasIguales_(a, b) {
  var largo = Math.max(a.length, b.length);
  for (var c = 0; c < largo; c++) {
    var x = a[c] === null || a[c] === undefined ? '' : String(a[c]).trim();
    var y = b[c] === null || b[c] === undefined ? '' : String(b[c]).trim();
    if (x !== y) return false;
  }
  return true;
}

/**
 * Si el registro que llega completa la fila que el paciente ya tiene ese día,
 * devuelve cómo queda esa fila; si va en una fila aparte, null.
 *
 * - Tras un ingreso sin atenciones, la sesión (con o sin salida) o la salida
 *   ocupan la fila del ingreso. Así lo anota la planilla: el ingreso va junto
 *   con la primera atención.
 * - Tras una sesión, una salida sin atenciones se marca en la fila de esa
 *   sesión. Antes quedaban dos filas: la atención y otra vacía con el alta.
 *
 * - Una salida deshecha sin atención dejó la fila vacía: el registro que llega
 *   la ocupa tal cual, en vez de dejar una fila vacía y otra nueva.
 *
 * Una segunda sesión del día, o una salida cuando ya hay otra, van aparte.
 *
 * @param {{fila: Array, app: boolean, anulada: boolean}} previa La última fila del día.
 * @param {Array} fila La fila del registro que llega.
 */
function unirConElDia_(previa, fila) {
  if (!previa.app) return null;
  if (previa.anulada && esFilaVacia_(previa.fila)) return fila.slice();
  if (Number(fila[COL.INGRESO]) === 1) return null;

  if (esIngresoSinSesion_(previa.fila)) {
    var unida = fila.slice();
    unida[COL.INGRESO] = 1;
    return unida;
  }

  if (esSalidaSinAtencion_(fila) && !esSalida_(previa.fila)) {
    var conSalida = previa.fila.slice();
    COLS_EGRESO_REM.forEach(function (c) { conSalida[c] = fila[c]; });
    return conSalida;
  }
  return null;
}

/** Fila con una salida y nada más: así se registra un alta que ocurrió sin atención. */
function esSalidaSinAtencion_(fila) {
  return Number(fila[COL.INGRESO]) !== 1 && esSalida_(fila) && sinAtencion_(fila);
}

/** El mismo paciente, la misma profesional y el mismo día. */
function claveDelDia_(fila) {
  return [normalizarRut_(fila[COL.RUT]), String(fila[COL.FONO]).trim(),
          normalizarTexto_(fila[COL.MES]), parseInt(fila[COL.DIA], 10)].join('|');
}

/** El mismo paciente y el mismo día, de cualquier profesional. */
function claveDelPaciente_(fila) {
  return [normalizarRut_(fila[COL.RUT]), normalizarTexto_(fila[COL.MES]), parseInt(fila[COL.DIA], 10)].join('|');
}

/**
 * Fila de ingreso sin ninguna atención anotada, que es como la escribe la app
 * al tocar "Registrar ingreso".
 */
function esIngresoSinSesion_(fila) {
  return Number(fila[COL.INGRESO]) === 1 && !esSalida_(fila) && sinAtencion_(fila);
}

/** Sin ingreso, sin salida y sin atención: lo que queda al deshacer una salida sin atención. */
function esFilaVacia_(fila) {
  return Number(fila[COL.INGRESO]) !== 1 && !esSalida_(fila) && sinAtencion_(fila);
}

/** Nada anotado desde la columna de atenciones en adelante. */
function sinAtencion_(fila) {
  for (var c = COL.ATENCIONES; c < fila.length; c++) {
    if (fila[c] !== '' && fila[c] !== 0 && fila[c] !== null) return false;
  }
  return true;
}


/**
 * Deshace un egreso marcado por error: pone en cero las columnas de salida de
 * la fila que escribió la app, ubicada por su identificador único.
 *
 * Solo funciona con filas escritas por la app, porque son las únicas que tienen
 * uuid en la hoja _sync. No borra la fila ni toca el resto: la atención y el
 * ingreso anotados en esa misma fila se quedan, que es exactamente lo que
 * habría sido si no te hubieras equivocado.
 */
function anularEgreso_(uuid) {
  if (!uuid) throw new Error('Falta el identificador del egreso.');

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var hojaSync = getHojaSync_();
    var ultima = hojaSync.getLastRow();
    if (ultima < 2) throw new Error('No hay registros de sincronización.');

    var registros = hojaSync.getRange(2, 1, ultima - 1, 4).getValues();
    var fila = null, entrada = null, yaAnulado = false;
    for (var i = registros.length - 1; i >= 0; i--) {
      if (String(registros[i][0]) === String(uuid)) {
        fila = Number(registros[i][2]);
        entrada = i + 2;
        yaAnulado = registros[i][3] === 'anulado';
        break;
      }
    }
    if (!fila) throw new Error('Ese egreso no lo registró la app.');
    // Un reintento tras perder la respuesta: ya se deshizo. Volver a hacerlo
    // borraría una salida nueva que haya ocupado después esa misma fila.
    if (yaAnulado) return { ok: true, fila: fila };

    var hoja = getHoja_();
    // Columnas de condición: de INGRESO a NIVEL PRIMARIO, en base 1.
    var desde = COL.INGRESO + 1;
    var ancho = COL.NIVEL_PRIM - COL.INGRESO + 1;
    var actual = hoja.getRange(fila, desde, 1, ancho).getValues()[0];

    // Las siete salidas, no solo las que dejan el hospital: la app también
    // registra traslados y derivaciones, y esos se tienen que poder deshacer.
    var eraEgreso = COLS_EGRESO_REM.some(function (c) {
      return Number(actual[c - COL.INGRESO]) === 1;
    });
    if (!eraEgreso) throw new Error('Esa fila no tiene marca de egreso.');

    // Solo las salidas: la fila puede llevar también el ingreso de ese día.
    hoja.getRange(fila, desde, 1, ancho).setValues([actual.map(function (v, k) {
      return COLS_EGRESO_REM.indexOf(COL.INGRESO + k) !== -1 ? 0 : v;
    })]);
    // Si la salida no traía atención, la fila queda vacía: con esta marca el
    // censo no la cuenta como atención y el próximo registro del día la ocupa.
    hojaSync.getRange(entrada, 4).setValue('anulado');
    return { ok: true, fila: fila };

  } finally {
    lock.releaseLock();
  }
}
