/**
 * DASHBOARD REM — Fase 2
 *
 * Archivo nuevo. Va en el mismo proyecto de Apps Script, junto a Codigo.gs y Api.gs.
 * Calcula las secciones del REM 28 y del REM 17 a partir de la planilla.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * SUPUESTOS PENDIENTES DE CONFIRMAR — las dos tablas siguientes son lo único
 * que hay que corregir si algún mapeo está mal. Todo lo demás se deriva de ellas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * A qué tipo de atención corresponde cada servicio.
 * Confirmado por la fonoaudióloga el 20-09-2026: UTI NEO a UPC, NEO a cuidados
 * medios, Pediatría a cuidados medios. UTIP quedó como UPC por ser unidad
 * intensiva pediátrica — ver FASE3.md si hay que cambiarlo.
 */
var TIPO_ATENCION = {
  'UTI':      'UPC',
  'UCI':      'UPC',
  'UTI NEO':  'UPC',
  'UTIP':     'UPC',

  'MQ':       'MEDIOS',
  'PED':      'MEDIOS',
  'UHCIP':    'MEDIOS',
  'MATER':    'MEDIOS',
  'NEO':      'MEDIOS',   // confirmado: neonatología va a cuidados medios
  'SAIP':     'MEDIOS',
  'PAB':      'MEDIOS',

  'MEDICINA FISICA': 'ABIERTA',

  'UEA':      'URGENCIA',
  'UE':       'URGENCIA'
};
var TIPO_POR_DEFECTO = 'MEDIOS';

/**
 * Qué columna de la planilla alimenta cada prestación del REM 17.
 * `col` son índices de COL; se suman los valores de esas columnas.
 * `contar: true` cuenta filas con valor, en vez de sumar cantidades.
 */
var PRESTACIONES_REM17 = [
  { codigo: '0102503', nombre: 'Evaluación de la deglución',        cols: ['EV_DEG'],              contar: true },
  { codigo: '0102504', nombre: 'Rehabilitación de la deglución',    cols: ['IN_FMO', 'IN_MTXD', 'IN_OFAS'] },
  { codigo: '0102505', nombre: 'Evaluación de funciones cognitivas', cols: ['EV_FXCOG'],           contar: true },
  { codigo: '0102506', nombre: 'Rehabilitación de funciones cognitivas', cols: ['IN_ECOG'] },
  { codigo: '1303001', nombre: 'Evaluación de voz',                 cols: ['EV_VOZ'],              contar: true },
  { codigo: '1303002', nombre: 'Evaluación de habla',               cols: ['EV_HAB'],              contar: true },
  { codigo: '1303003', nombre: 'Evaluación del lenguaje',           cols: ['EV_LGJE'],             contar: true },
  { codigo: '1303004', nombre: 'Rehabilitación de la voz',          cols: ['IN_VOZ'] },
  { codigo: '1303005', nombre: 'Rehabilitación del habla y/o lenguaje', cols: ['IN_HAB', 'IN_LGJE'] }
];

/** Columnas que no tienen destino asignado todavía. Se muestran aparte, nunca se ocultan. */
var SIN_ASIGNAR = [
  { col: 'EV_AUDI',  etiqueta: 'Audición · evaluación sin código en el REM 17' }
];


// ══════════════════════════════════════════════════════════
// Índices de las columnas de evaluación e intervención
// ══════════════════════════════════════════════════════════

var COLX = {
  EV_DEG: 30, EV_VOZ: 31, EV_HAB: 32, EV_LGJE: 33, EV_AUDI: 34, EV_FXCOG: 35,
  IN_FMO: 36, IN_MTXD: 37, IN_VOZ: 38, IN_HAB: 39, IN_LGJE: 40, IN_OFAS: 41, IN_ECOG: 42,
  DISF: 43, EG: 44, EF: 45
};

/** Las 27 categorías del REM 28 B.1, en el orden del formulario oficial. */
var CATEGORIAS_REM = [
  'Ataque cerebro vascular (ACV)', 'Traumatismo encéfalo craneano (TEC)', 'Lesión medular',
  'Neuromusculares agudas', 'Neuromusculares crónicas', 'Disrafias espinales',
  'Otras neurológicas', 'Trastornos del Neurodesarrollo', 'Parálisis cerebral',
  'Recién nacido de alto riesgo', 'Síndrome POST-UCI', 'COVID-19',
  'Enfermedades respiratorias', 'Enfermedades cardíacas', 'Dolor musculoesquelético crónico',
  'Artritis reumatoidea', 'Otras reumatológicas', 'Traumatológicos',
  'Otros pre y post quirúrgicos', 'Oncológicos', 'Genitourinarias', 'Amputación',
  'Quemados', 'Sensoriales auditivos', 'Sensoriales visuales',
  'Trastorno espectro autista', 'Otros'
];

/**
 * Para el REM, un egreso es cualquiera de los siete motivos de la sección B.1,
 * incluidos los traslados a otro servicio y las derivaciones a nivel primario.
 *
 * Es una lista distinta de COLS_EGRESO, que usa la ronda: ahí solo cuentan los
 * motivos por los que el paciente deja la cama. Si fueran la misma, el dashboard
 * mostraría 19 egresos en la tarjeta y 20 en la tabla del REM.
 */
var COLS_EGRESO_REM = [COL.ALTA, COL.ABANDONO, COL.FALLECIMIENTO, COL.ACV_APS,
                       COL.OTRO_HOSP, COL.OTRO_SERV, COL.NIVEL_PRIM];

/** Los 17 rangos etarios del REM 28, en el mismo formato que la columna RANGO. */
var RANGOS_REM = ['0-4','5-9','10-14','15-19','20-24','25-29','30-34','35-39','40-44',
                  '45-49','50-54','55-59','60-64','65-69','70-74','75-79','80 y +'];


// ══════════════════════════════════════════════════════════
// LECTURA
// ══════════════════════════════════════════════════════════

/** El dashboard necesita las 46 columnas, no solo las 25 de las búsquedas. */
function leerDatosCompletos_() {
  var hoja = getHoja_();
  var ultima = hoja.getLastRow();
  if (ultima < 2) return [];
  return hoja.getRange(2, 1, ultima - 1, 46).getValues();
}

function tipoAtencion_(servicio) {
  return TIPO_ATENCION[normalizarTexto_(servicio)] || TIPO_POR_DEFECTO;
}

/** REM 28 solo distingue Abierta de Cerrada, y la cerrada en UPC o cuidados medios. */
function tipoRem28_(servicio) {
  var t = tipoAtencion_(servicio);
  if (t === 'ABIERTA') return 'abierta';
  if (t === 'UPC')     return 'upc';
  return 'medios';           // urgencia cuenta como cuidados medios en el REM 28
}

/** REM 17 sí separa la urgencia. */
function tipoRem17_(servicio) {
  var t = tipoAtencion_(servicio);
  if (t === 'ABIERTA')  return 'abierta';
  if (t === 'URGENCIA') return 'urgencia';
  return 'cerrada';
}

function normalizarRango_(valor) {
  var r = normalizarTexto_(valor).replace(/\s+/g, ' ');
  if (r === '80 Y +' || r === '80 Y MAS' || r === '80+') return '80 y +';
  return RANGOS_REM.indexOf(r) !== -1 ? r : (RANGOS_REM.indexOf(valor) !== -1 ? valor : '');
}

function num_(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
function esUno_(v) { return Number(v) === 1; }


// ══════════════════════════════════════════════════════════
// CÁLCULO
// ══════════════════════════════════════════════════════════

/**
 * Devuelve todo lo que necesita la Vista 2 para un mes.
 * @param {string} mes  "2026-09"
 * @param {string} fono Nombre del profesional; vacío = todos.
 */
function construirDashboard_(mes, fono) {
  var partes = String(mes || '').split('-');
  var anio = parseInt(partes[0], 10);
  var mesNum = parseInt(partes[1], 10);
  if (isNaN(anio) || isNaN(mesNum)) throw new Error('Mes inválido: ' + mes);

  var NOMBRE_MES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO',
                    'AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][mesNum - 1];

  var datos = leerDatosCompletos_();

  // Solo las filas del mes y del profesional pedidos. La planilla no guarda el año,
  // así que el filtro es por nombre de mes.
  var filas = datos.filter(function (f) {
    if (normalizarTexto_(f[COL.MES]) !== NOMBRE_MES) return false;
    if (fono && String(f[COL.FONO]).trim() !== String(fono).trim()) return false;
    return String(f[COL.RUT]).trim() !== '';
  });

  return {
    ok: true,
    mes: mes,
    nombreMes: NOMBRE_MES,
    filas: filas.length,
    resumen:   calcularResumen_(filas),
    ingresos:  calcularIngresos_(filas),
    egresos:   calcularEgresos_(filas),
    profesional: calcularProfesional_(filas),
    derivaciones: calcularDerivaciones_(filas),
    procedimientos: calcularProcedimientos_(filas),
    rem17:     calcularRem17_(filas),
    sinAsignar: calcularSinAsignar_(filas),
    servicios: calcularPorServicio_(filas),
    alertas:   calcularAlertas_(filas, fono),
    validacion: null
  };
}

/**
 * La misma comprobación que trae el formulario oficial: la suma por rango etario
 * tiene que dar igual que la suma por tipo de atención. Si no cuadra, el
 * dashboard dice qué sección falla en vez de dejarte descubrirlo al entregar.
 */
function calcularValidacion_(d) {
  var problemas = [];

  function revisar(nombre, celda) {
    var porRango = 0;
    Object.keys(celda.rangos || {}).forEach(function (k) { porRango += celda.rangos[k]; });
    var porTipo = (celda.abierta || 0) + (celda.upc || 0) + (celda.medios || 0);
    if (porRango !== celda.total || porTipo !== celda.total) {
      problemas.push({ seccion: nombre, total: celda.total, porRango: porRango, porTipo: porTipo });
    }
  }

  revisar('B.1 Ingresos', d.ingresos.total);
  revisar('B.1 Egresos', d.egresos.total);

  ['inicial', 'intermedia', 'sesiones'].forEach(function (k) {
    var c = d.profesional[k];
    var porRango = 0;
    Object.keys(c.rangos).forEach(function (r) { porRango += c.rangos[r]; });
    var porTipo = c.abierta + c.upc + c.medios;
    if (porRango !== c.total || porTipo !== c.total) {
      problemas.push({
        seccion: { inicial: 'B.2 Evaluación inicial', intermedia: 'B.3 Evaluación intermedia',
                   sesiones: 'B.4 Sesiones' }[k],
        total: c.total, porRango: porRango, porTipo: porTipo });
    }
  });

  return { ok: problemas.length === 0, problemas: problemas };
}

function celdaVacia_() {
  return { total: 0, hombres: 0, mujeres: 0, abierta: 0, upc: 0, medios: 0,
           rangos: {}, rangoSexo: {} };
}

function acumular_(celda, fila) {
  celda.total++;
  var sexo = normalizarTexto_(fila[COL.SEXO]);
  if (sexo.indexOf('M') === 0 && sexo.indexOf('MU') !== 0) celda.hombres++; else celda.mujeres++;

  celda[tipoRem28_(fila[COL.SERVICIO])]++;

  var rango = normalizarRango_(fila[COL.RANGO]);
  if (rango) {
    celda.rangos[rango] = (celda.rangos[rango] || 0) + 1;
    var clave = rango + '|' + (sexo.indexOf('MU') === 0 ? 'M' : 'H');
    celda.rangoSexo[clave] = (celda.rangoSexo[clave] || 0) + 1;
  }
}

function calcularResumen_(filas) {
  var r = { ingresos: 0, egresos: 0, iniciales: 0, intermedias: 0, sesiones: 0,
            brechas: 0, pacientes: 0, suspendidas: 0 };
  var ruts = {};
  filas.forEach(function (f) {
    if (esUno_(f[COL.INGRESO])) r.ingresos++;
    if (COLS_EGRESO_REM.some(function (c) { return esUno_(f[c]); })) r.egresos++;
    if (esUno_(f[COL.INICIAL])) r.iniciales++;
    if (esUno_(f[COL.INTER]))   r.intermedias++;
    r.sesiones += num_(f[COL.ATENCIONES]);
    r.brechas  += num_(f[COL.BRECHA]);
    if (String(f[COL.SUSP]).trim() !== '') r.suspendidas++;
    ruts[normalizarRut_(f[COL.RUT])] = true;
  });
  r.pacientes = Object.keys(ruts).length;
  return r;
}

/** REM 28 B.1 — ingresos por categoría diagnóstica. */
function calcularIngresos_(filas) {
  var porCategoria = {};
  var total = celdaVacia_();
  var sinRem = 0;

  filas.forEach(function (f) {
    if (!esUno_(f[COL.INGRESO])) return;
    var rem = parseInt(f[COL.REM1], 10);
    if (isNaN(rem) || rem < 1 || rem > 27) { sinRem++; return; }

    var nombre = CATEGORIAS_REM[rem - 1];
    if (!porCategoria[nombre]) porCategoria[nombre] = celdaVacia_();
    acumular_(porCategoria[nombre], f);
    acumular_(total, f);
  });

  return { categorias: porCategoria, total: total, sinRem: sinRem, orden: CATEGORIAS_REM };
}

/** REM 28 B.1 — egresos por motivo. */
function calcularEgresos_(filas) {
  var motivos = {
    'Egresos por alta': COL.ALTA,
    'Egresos por abandono': COL.ABANDONO,
    'Egresos por fallecimiento': COL.FALLECIMIENTO,
    'Egresos ACV referido a APS': COL.ACV_APS
  };
  var res = {};
  Object.keys(motivos).forEach(function (m) { res[m] = celdaVacia_(); });
  res['Otros'] = celdaVacia_();
  var total = celdaVacia_();

  filas.forEach(function (f) {
    var asignado = null;
    Object.keys(motivos).forEach(function (m) {
      if (!asignado && esUno_(f[motivos[m]])) asignado = m;
    });
    if (!asignado && (esUno_(f[COL.OTRO_HOSP]) || esUno_(f[COL.OTRO_SERV]) || esUno_(f[COL.NIVEL_PRIM]))) {
      asignado = 'Otros';
    }
    if (!asignado) return;
    acumular_(res[asignado], f);
    acumular_(total, f);
  });

  return { motivos: res, total: total,
           orden: ['Egresos por alta','Egresos por abandono','Egresos por fallecimiento',
                   'Egresos ACV referido a APS','Otros'] };
}

/** REM 28 B.2, B.3 y B.4 — evaluaciones y sesiones del fonoaudiólogo. */
function calcularProfesional_(filas) {
  function vacio() { return { total: 0, abierta: 0, upc: 0, medios: 0, rangos: {} }; }
  var res = { inicial: vacio(), intermedia: vacio(), sesiones: vacio() };

  filas.forEach(function (f) {
    var t = tipoRem28_(f[COL.SERVICIO]);
    var rango = normalizarRango_(f[COL.RANGO]);

    function sumar(destino, cantidad) {
      if (!cantidad) return;
      destino.total += cantidad;
      destino[t] += cantidad;
      if (rango) destino.rangos[rango] = (destino.rangos[rango] || 0) + cantidad;
    }

    if (esUno_(f[COL.INICIAL])) sumar(res.inicial, 1);
    if (esUno_(f[COL.INTER]))   sumar(res.intermedia, 1);
    sumar(res.sesiones, num_(f[COL.ATENCIONES]));
  });

  return res;
}

/** REM 28 B.5 — derivaciones. */
function calcularDerivaciones_(filas) {
  var res = { 'A otro hospital (hospitalizado)': 0, 'A nivel primario': 0, 'A otro servicio': 0 };
  filas.forEach(function (f) {
    if (esUno_(f[COL.OTRO_HOSP]))   res['A otro hospital (hospitalizado)']++;
    if (esUno_(f[COL.NIVEL_PRIM]))  res['A nivel primario']++;
    if (esUno_(f[COL.OTRO_SERV]))   res['A otro servicio']++;
  });
  return res;
}

/** REM 28 B.6 — procedimientos y actividades. */
function calcularProcedimientos_(filas) {
  var res = {
    'Estimulación cognitiva': 0,
    'Rehabilitación de la voz, habla y/o lenguaje': 0,
    'Rehabilitación de la deglución': 0,
    'Educación a usuario/a, cuidador/a y/o familiar': 0
  };
  filas.forEach(function (f) {
    res['Estimulación cognitiva'] += num_(f[COLX.IN_ECOG]);
    res['Rehabilitación de la voz, habla y/o lenguaje'] +=
      num_(f[COLX.IN_VOZ]) + num_(f[COLX.IN_HAB]) + num_(f[COLX.IN_LGJE]);
    res['Rehabilitación de la deglución'] +=
      num_(f[COLX.IN_FMO]) + num_(f[COLX.IN_MTXD]) + num_(f[COLX.IN_OFAS]);
    res['Educación a usuario/a, cuidador/a y/o familiar'] +=
      (esUno_(f[COLX.EG]) ? 1 : 0) + (esUno_(f[COLX.EF]) ? 1 : 0);
  });
  return res;
}

/** REM 17 — prestaciones por código, separadas en cerrada, abierta y urgencia. */
function calcularRem17_(filas) {
  return PRESTACIONES_REM17.map(function (p) {
    var fila = { codigo: p.codigo, nombre: p.nombre, total: 0, cerrada: 0, abierta: 0, urgencia: 0 };
    filas.forEach(function (f) {
      var cantidad = 0;
      p.cols.forEach(function (c) {
        cantidad += p.contar ? (esUno_(f[COLX[c]]) ? 1 : 0) : num_(f[COLX[c]]);
      });
      if (!cantidad) return;
      fila.total += cantidad;
      fila[tipoRem17_(f[COL.SERVICIO])] += cantidad;
    });
    return fila;
  });
}

/** Lo que no tiene destino asignado. Se muestra para que no desaparezca en silencio. */
function calcularSinAsignar_(filas) {
  return SIN_ASIGNAR.map(function (s) {
    var total = 0;
    filas.forEach(function (f) {
      var v = f[COLX[s.col]];
      total += (s.col.indexOf('EV_') === 0) ? (esUno_(v) ? 1 : 0) : num_(v);
    });
    return { etiqueta: s.etiqueta, total: total };
  }).filter(function (s) { return s.total > 0; });
}

function calcularPorServicio_(filas) {
  var res = {};
  filas.forEach(function (f) {
    var s = String(f[COL.SERVICIO]).trim() || '(sin servicio)';
    if (!res[s]) res[s] = { sesiones: 0, filas: 0, tipo: tipoAtencion_(s) };
    res[s].sesiones += num_(f[COL.ATENCIONES]);
    res[s].filas++;
  });
  return res;
}

/**
 * Alertas por reglas fijas, sin IA. Son deterministas: o se cumplen o no.
 */
function calcularAlertas_(filas, fono) {
  var alertas = [];

  var sinRem = filas.filter(function (f) {
    var r = parseInt(f[COL.REM1], 10);
    return isNaN(r) || r < 1 || r > 27;
  }).length;
  if (sinRem) {
    alertas.push({ tipo: 'error', titulo: 'Codificación faltante',
      detalle: sinRem + (sinRem === 1 ? ' sesión sin código REM válido' : ' sesiones sin código REM válido') +
               '. No se pueden contar en el REM 28.' });
  }

  var sinEdad = filas.filter(function (f) { return normalizarRango_(f[COL.RANGO]) === ''; }).length;
  if (sinEdad) {
    alertas.push({ tipo: 'error', titulo: 'Rango etario faltante',
      detalle: sinEdad + ' filas sin rango etario. El desglose por edad no va a cuadrar.' });
  }

  var brechas = filas.reduce(function (s, f) { return s + num_(f[COL.BRECHA]); }, 0);
  if (brechas) {
    alertas.push({ tipo: 'aviso', titulo: 'Brechas del mes',
      detalle: brechas + (brechas === 1 ? ' atención no realizada' : ' atenciones no realizadas') + '.' });
  }

  // Pacientes activos que llevan más días sin atención que los sugeridos.
  try {
    var censo = construirCenso_(fono);
    censo.pacientes.forEach(function (p) {
      var limite = p.categorizacion === '2' ? 3 : (p.categorizacion === '1' ? 7 : 7);
      if (p.diasSinAtencion > limite) {
        alertas.push({ tipo: 'aviso', titulo: 'Cama ' + p.cama + ' · ' + p.servicio,
          detalle: p.diasSinAtencion + ' días sin atención registrada (' + p.nombre + ').' });
      }
    });
  } catch (err) { /* el censo no es imprescindible para el dashboard */ }

  return alertas;
}
