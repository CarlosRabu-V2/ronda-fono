/**
 * FORMULARIO DE ATENCIÓN FONOAUDIOLÓGICA — Fase 0
 *
 * Reemplaza por completo el Codigo.gs anterior.
 * Cambios respecto de la versión previa: ver CAMBIOS.md
 */

// ══════════════════════════════════════════════════════════
// CONFIGURACIÓN — lo único que deberías necesitar editar
// ══════════════════════════════════════════════════════════

var HOJA_DATOS  = 'ENERO 2025';   // nombre exacto de la pestaña con los registros
var HOJA_TABLAS = 'Tablas';

// Índices de columna (base 0). Si mueves una columna, cámbialo aquí y en ningún otro lado.
var COL = {
  SERVICIO: 0,  FONO: 1,   MES: 2,   DIA: 3,    CAMA: 4,   NOMBRE: 5,
  SEXO: 6,      EDAD: 7,   RANGO: 8, RUT: 9,
  DIAG1: 10,    REM1: 11,  DIAG2: 12, REM2: 13, GES: 14,   ORIGEN: 15,
  INGRESO: 16,  ALTA: 17,  ABANDONO: 18, FALLECIMIENTO: 19,
  ACV_APS: 20,  OTRO_HOSP: 21, OTRO_SERV: 22, NIVEL_PRIM: 23,
  CATEGORIZA: 24, ATENCIONES: 25, BRECHA: 26, SUSP: 27,
  INICIAL: 28,  INTER: 29
};

// Columnas que indican que el paciente dejó la cama.
// OTRO_SERV no va aquí: cambiar de servicio no cierra el episodio.
var COLS_EGRESO = [COL.ALTA, COL.ABANDONO, COL.FALLECIMIENTO, COL.OTRO_HOSP];

// Problemas GES. Se busca un patrón dentro del diagnóstico ya normalizado (sin
// tildes, en mayúsculas), no igualdad exacta: en la planilla "ACV" aparece escrito
// de 7 formas distintas.
// Las siglas cortas llevan \b para no confundirse: sin él, "NAC" calzaría dentro
// de "RECIEN NACIDO".
var TABLA_GES = [
  { busca: /\bACV\b|ATAQUE CEREBRO/,          codigo: 37 },
  { busca: /\bNAC\b|NEUMONIA ADQUIRIDA/,      codigo: 7  },
  { busca: /CADERA|TROCANTER|ENDOPROTESIS/,   codigo: 12 },
  { busca: /POLITRAUMA/,                      codigo: 48 },
  { busca: /ANEURISMA/,                       codigo: 42 },
  { busca: /GRAN QUEMADO/,                    codigo: 55 },
  { busca: /ESCLEROSIS MULTIPLE/,             codigo: 67 },
  { busca: /OSTEOSARCOMA/,                    codigo: 73 }
];

var CONDICIONES = ['Ingreso', 'Alta', 'Abandono', 'Fallecimiento',
                   'ACV REF APS', 'Otro Hospital', 'Otro Servicio', 'Nivel Primario'];

var EVALUACIONES  = ['Deglución', 'Voz', 'Habla', 'Lenguaje', 'Audición', 'Función Cognitiva'];
var INTERVENCIONES = ['FMO', 'MTXD', 'Voz', 'Habla', 'Lenguaje', 'OFAS', 'ECOG'];


// ══════════════════════════════════════════════════════════
// APERTURA DEL FORMULARIO
// ══════════════════════════════════════════════════════════

function mostrarFormulario() {
  var htmlOutput = HtmlService.createHtmlOutputFromFile('Formulario.html')
    .setWidth(750)
    .setHeight(900);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Formulario de Atención');
}

/**
 * Sin parámetros sirve el formulario de siempre.
 * Con ?api=... responde la API que consume la app móvil (ver Api.gs).
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.api) return apiGet_(e);

  return HtmlService.createHtmlOutputFromFile('Formulario.html')
    .setTitle('Formulario de Atención')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


// ══════════════════════════════════════════════════════════
// ACCESO A DATOS
// ══════════════════════════════════════════════════════════

function getHoja_() {
  var hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_DATOS);
  if (!hoja) {
    throw new Error('No existe la hoja "' + HOJA_DATOS + '". ' +
                    'Revisa el nombre en la configuración de Codigo.gs.');
  }
  return hoja;
}

/**
 * Lee solo las columnas necesarias para las búsquedas, en vez de la hoja entera.
 * Con miles de filas la diferencia se nota en el celular.
 */
function leerDatosBusqueda_() {
  var hoja = getHoja_();
  var ultimaFila = hoja.getLastRow();
  if (ultimaFila < 2) return [];
  var nCols = COL.CATEGORIZA + 1;
  return hoja.getRange(2, 1, ultimaFila - 1, nCols).getValues();
}


// ══════════════════════════════════════════════════════════
// NORMALIZACIÓN
// ══════════════════════════════════════════════════════════

/** "12.345.678-k" y "12345678-K" pasan a ser el mismo valor. */
function normalizarRut_(rut) {
  if (rut === null || rut === undefined) return '';
  return String(rut).toUpperCase().replace(/[^0-9K]/g, '');
}

/** Quita tildes y pasa a mayúsculas, para comparar diagnósticos escritos de cualquier forma. */
function normalizarTexto_(texto) {
  if (texto === null || texto === undefined) return '';
  return String(texto)
    .toUpperCase()
    .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * El mismo valor se ha escrito de varias formas a lo largo del tiempo.
 * Todas las filas nuevas se guardan con una sola.
 */
function normalizarCategorizacion_(valor) {
  var v = normalizarTexto_(valor).replace(/\./g, '');
  if (v === '') return '';
  if (v === 'NSP' || v.indexOf('NO SE PRESENTA') === 0) return 'NSP';
  if (v === '0' || v === '1' || v === '2') return v;
  // Cualquier variante de "1-2 por semana", con o sin typos.
  if (/^0?1\s*-?\s*2/.test(v)) return '1-2 POR SEMANA';
  return normalizarTexto_(valor);
}

/** Acepta "65", "7 meses", "5 días". Devuelve el rango etario del REM. */
function calcularRangoEtario(edad) {
  var texto = normalizarTexto_(edad);
  if (texto === '') return '';
  // Expresado en horas, días, semanas o meses: siempre menor de 1 año.
  if (/HORA|DIA|SEMANA|MES/.test(texto)) return '0-4';

  var n = parseInt(texto, 10);
  if (isNaN(n) || n < 0) return '';
  if (n >= 80) return '80 y +';
  var inicio = Math.floor(n / 5) * 5;
  return inicio + '-' + (inicio + 4);
}

/** Busca el problema GES por contenido del diagnóstico, no por igualdad exacta. */
function determinarGES(diagnostico) {
  var texto = normalizarTexto_(diagnostico);
  if (texto === '') return '';
  for (var i = 0; i < TABLA_GES.length; i++) {
    if (TABLA_GES[i].busca.test(texto)) return TABLA_GES[i].codigo;
  }
  return '';
}

/** Devuelve el número del REM tanto si viene "14" como "14 - ENF. CARDIACAS". */
function parsearRem_(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  var n = parseInt(String(valor).split('-')[0].trim(), 10);
  return isNaN(n) ? '' : n;
}

function parsearEntero_(valor) {
  var n = parseInt(valor, 10);
  return isNaN(n) ? 0 : n;
}


// ══════════════════════════════════════════════════════════
// OPCIONES DEL FORMULARIO
// ══════════════════════════════════════════════════════════

function getOpcionesFormulario() {
  var hojaTablas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HOJA_TABLAS);
  if (!hojaTablas) throw new Error('No existe la hoja "' + HOJA_TABLAS + '".');

  var servicios      = hojaTablas.getRange('M2:M15').getValues().flat().filter(String);
  var fonoaudiologos = hojaTablas.getRange('K2:K9').getValues().flat().filter(String);

  var remData = hojaTablas.getRange('C2:D28').getValues();
  var rem = [];
  for (var i = 0; i < remData.length; i++) {
    if (remData[i][0] !== '') rem.push(remData[i][0] + ' - ' + remData[i][1]);
  }

  return { servicios: servicios, fonoaudiólogos: fonoaudiologos, rem: rem };
}


// ══════════════════════════════════════════════════════════
// BÚSQUEDA POR CAMA
// ══════════════════════════════════════════════════════════

/**
 * Devuelve al paciente que ocupa la cama, o null si la cama quedó libre.
 *
 * La versión anterior leía datos[i][16] (columna INGRESO, que vale 1 o 0) y la
 * comparaba con textos como "Alta". Esa comparación nunca era verdadera, así que
 * el filtro de egreso jamás se aplicaba: la cama 204 podía traerte el nombre y el
 * RUT de un paciente dado de alta semanas antes.
 */
function buscarPacientePorCama(cama) {
  var datos = leerDatosBusqueda_();
  var buscada = String(cama).trim();
  if (buscada === '') return null;

  for (var i = datos.length - 1; i >= 0; i--) {
    if (String(datos[i][COL.CAMA]).trim() !== buscada) continue;

    // El registro más reciente de esta cama es un egreso: la cama está libre o la
    // ocupa alguien nuevo. Se corta la búsqueda, no se sigue hacia atrás.
    for (var e = 0; e < COLS_EGRESO.length; e++) {
      if (Number(datos[i][COLS_EGRESO[e]]) === 1) return null;
    }
    return filaAPaciente_(datos[i]);
  }
  return null;
}


// ══════════════════════════════════════════════════════════
// BÚSQUEDA POR RUT — paciente conocido
// ══════════════════════════════════════════════════════════

/**
 * Para el ingreso de un paciente nuevo: si el RUT ya estuvo antes en la planilla,
 * devuelve sus datos demográficos para no volver a tipearlos.
 *
 * A diferencia de la búsqueda por cama, aquí NO importa si el paciente fue dado de
 * alta: justamente el caso útil es el reingreso. La cama no se devuelve, porque es
 * la que estás a punto de asignar.
 */
function buscarPacientePorRut(rut) {
  var buscado = normalizarRut_(rut);
  if (buscado.length < 7) return null;

  var datos = leerDatosBusqueda_();

  for (var i = datos.length - 1; i >= 0; i--) {
    if (normalizarRut_(datos[i][COL.RUT]) !== buscado) continue;

    var p = filaAPaciente_(datos[i]);

    // Contexto de la última atención, para que decidas si reutilizar el diagnóstico.
    p.esConocido       = true;
    p.ultimoMes        = String(datos[i][COL.MES] || '');
    p.ultimoDia        = String(datos[i][COL.DIA] || '');
    p.ultimoServicio   = String(datos[i][COL.SERVICIO] || '');
    p.ultimaCama       = String(datos[i][COL.CAMA] || '');
    p.egresado         = COLS_EGRESO.some(function (c) { return Number(datos[i][c]) === 1; });

    // Cuántas atenciones acumula: sirve para saber si es un reingreso real.
    var total = 0;
    for (var j = 0; j < datos.length; j++) {
      if (normalizarRut_(datos[j][COL.RUT]) === buscado) total++;
    }
    p.atencionesPrevias = total;

    return p;
  }
  return null;
}

/** Convierte una fila de la planilla en el objeto que consume el formulario. */
function filaAPaciente_(fila) {
  return {
    nombre:       String(fila[COL.NOMBRE] || ''),
    sexo:         String(fila[COL.SEXO] || ''),
    edad:         fila[COL.EDAD] === '' ? '' : String(fila[COL.EDAD]),
    rut:          String(fila[COL.RUT] || ''),
    diagnostico1: String(fila[COL.DIAG1] || ''),
    rem1:         fila[COL.REM1] === '' ? '' : String(fila[COL.REM1]),
    diagnostico2: String(fila[COL.DIAG2] || ''),
    rem2:         fila[COL.REM2] === '' ? '' : String(fila[COL.REM2]),
    origen:       fila[COL.ORIGEN] === '' ? '' : String(fila[COL.ORIGEN]),
    servicio:     String(fila[COL.SERVICIO] || '')
  };
}


// ══════════════════════════════════════════════════════════
// GUARDADO
// ══════════════════════════════════════════════════════════

function guardarDatosFormulario(data) {
  validarDatos_(data);
  var hoja = getHoja_();
  hoja.appendRow(construirFila_(data));
  return { fila: hoja.getLastRow() };
}

/**
 * Traduce los datos del formulario a las 46 columnas de la planilla.
 * La usan tanto el formulario de PC como la API de la app móvil, para que ambos
 * escriban exactamente el mismo formato.
 */
function construirFila_(data) {
  // La fecha llega como "2026-09-20". new Date() sobre ese texto la interpreta en
  // UTC, por eso la versión anterior sumaba un día para compensar. Construirla por
  // partes evita el problema y no depende de la zona horaria del script.
  var partes = String(data.fecha).split('-');
  var anio = parseInt(partes[0], 10);
  var mes  = parseInt(partes[1], 10);
  var dia  = parseInt(partes[2], 10);
  if (isNaN(anio) || isNaN(mes) || isNaN(dia)) {
    throw new Error('La fecha "' + data.fecha + '" no es válida.');
  }
  var fecha = new Date(anio, mes - 1, dia);
  var nombreMes = fecha.toLocaleString('es-CL', { month: 'long' }).toUpperCase();

  // Condición de hospitalización: una columna 1/0 por opción.
  var condiciones = [].concat(data.condicionHospitalizacion || []);
  var hospitalizacionData = CONDICIONES.map(function (opcion) {
    return condiciones.indexOf(opcion) !== -1 ? 1 : 0;
  });

  var edadTexto = String(data.edad || '').trim();
  var edadValor = /^\d+$/.test(edadTexto) ? parseInt(edadTexto, 10) : edadTexto;
  var rangoEtario = calcularRangoEtario(edadTexto);

  var diagnostico1 = String(data.diagnosticos[0] || '').trim();
  var diagnostico2 = String(data.diagnosticos[1] || '').trim();
  var rem1 = parsearRem_(data.rems[0]);   // '' en vez de NaN cuando viene vacío
  var rem2 = parsearRem_(data.rems[1]);

  // 1 o celda vacía, igual que en el histórico. Las columnas de condición sí usan 0.
  var evaluacionData = EVALUACIONES.map(function (ev) {
    return (data.evaluaciones || []).indexOf(ev) !== -1 ? 1 : '';
  });

  var intervenciones = data.intervenciones || {};
  var intervencionData = INTERVENCIONES.map(function (nombre) {
    var n = parseFloat(intervenciones[nombre]);
    return isNaN(n) || n === 0 ? '' : n;   // celda vacía, como en el histórico
  });

  var fila = [
    data.servicio,
    data.fonoaudiólogo,
    nombreMes,
    dia,
    data.cama,
    String(data.nombrePaciente || '').trim().toUpperCase(),
    data.sexo,
    edadValor,
    rangoEtario,
    String(data.rut || '').trim().toUpperCase(),
    diagnostico1,
    rem1,
    diagnostico2,
    rem2,
    determinarGES(diagnostico1),
    data.origen,
    hospitalizacionData[0], hospitalizacionData[1], hospitalizacionData[2], hospitalizacionData[3],
    hospitalizacionData[4], hospitalizacionData[5], hospitalizacionData[6], hospitalizacionData[7],
    normalizarCategorizacion_(data.categorizacion),
    parsearEntero_(data.atencionesRealizadas),
    parsearEntero_(data.brechas),
    String(data.suspendidas || '').trim(),
    data.tipoEvaluacion === 'Inicial'    ? 1 : '',
    data.tipoEvaluacion === 'Intermedia' ? 1 : '',
    evaluacionData[0], evaluacionData[1], evaluacionData[2],
    evaluacionData[3], evaluacionData[4], evaluacionData[5],
    intervencionData[0], intervencionData[1], intervencionData[2], intervencionData[3],
    intervencionData[4], intervencionData[5], intervencionData[6],
    intervenciones.DISF || '',
    data.eg ? 1 : '',
    data.ef ? 1 : ''
  ];

  return fila;
}

/**
 * Impide guardar filas incompletas. Sin esta comprobación entran registros sin
 * código REM o sin edad, que después no se pueden contar en el REM.
 */
function validarDatos_(data) {
  var faltan = [];
  if (!data.servicio)                      faltan.push('Servicio');
  if (!data.fonoaudiólogo)                 faltan.push('Fonoaudiólogo/a');
  if (!data.fecha)                         faltan.push('Fecha');
  if (!String(data.cama || '').trim())     faltan.push('N° de cama');
  if (!String(data.nombrePaciente || '').trim()) faltan.push('Nombre del paciente');
  if (!String(data.rut || '').trim())      faltan.push('RUT');
  if (!String(data.edad || '').trim())     faltan.push('Edad');
  if (!data.sexo)                          faltan.push('Sexo');
  if (!String((data.diagnosticos || [])[0] || '').trim()) faltan.push('Diagnóstico 1');
  if (parsearRem_((data.rems || [])[0]) === '')           faltan.push('REM 1');

  if (faltan.length) {
    throw new Error('Faltan campos obligatorios: ' + faltan.join(', ') + '.');
  }
}
