/**
 * INFORMES Y RESUMEN CON IA — Fase 3
 *
 * Archivo nuevo. Va en el mismo proyecto, junto a Codigo.gs, Api.gs y Dashboard.gs.
 *
 * El PDF NO se genera aquí: lo arma el propio teléfono. Este archivo solo entrega
 * la nómina de pacientes y, si lo pides, el resumen narrativo del mes.
 */

/**
 * Modelo de Gemini. Los nombres cambian cada cierto tiempo; si la llamada falla
 * con "model not found", cambia esta línea por el modelo vigente en
 * https://aistudio.google.com  (la capa gratuita alcanza de sobra para un resumen
 * mensual: es una llamada al mes).
 */
var MODELO_GEMINI = 'gemini-2.5-flash';


// ══════════════════════════════════════════════════════════
// PUESTA EN MARCHA — ejecutar una vez, solo si quieres el resumen
// ══════════════════════════════════════════════════════════

/**
 * Guarda tu clave de Google AI Studio en el proyecto.
 *
 * 1. Entra a https://aistudio.google.com/apikey y crea una clave (gratuita).
 * 2. Pégala abajo, entre las comillas.
 * 3. Ejecuta esta función una vez.
 * 4. BORRA la clave de esta línea y guarda el archivo.
 *
 * Queda en las propiedades del proyecto, no en el código.
 */
function configurarGemini() {
  var clave = '';   // ← pega aquí tu clave, ejecuta, y vuelve a dejarla vacía

  if (!clave) throw new Error('Pega tu clave de Google AI Studio en la variable "clave".');
  PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', clave);
  Logger.log('Clave de Gemini guardada. Ya puedes borrarla de esta función.');
}


// ══════════════════════════════════════════════════════════
// NÓMINA DE PACIENTES
// ══════════════════════════════════════════════════════════

/**
 * Los pacientes atendidos en el mes, con sus totales.
 * Va del Sheet a tu teléfono y de ahí al PDF. No pasa por ningún tercero.
 */
function construirNomina_(mes, fono) {
  var partes = String(mes || '').split('-');
  var mesNum = parseInt(partes[1], 10);
  if (isNaN(mesNum)) throw new Error('Mes inválido: ' + mes);

  var NOMBRE_MES = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO',
                    'AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'][mesNum - 1];

  var datos = leerDatosCompletos_();
  var porRut = {};

  datos.forEach(function (f) {
    if (normalizarTexto_(f[COL.MES]) !== NOMBRE_MES) return;
    if (fono && String(f[COL.FONO]).trim() !== String(fono).trim()) return;

    var rut = normalizarRut_(f[COL.RUT]);
    if (!rut) return;

    if (!porRut[rut]) {
      porRut[rut] = {
        rut: String(f[COL.RUT]).trim(),
        nombre: String(f[COL.NOMBRE]).trim(),
        sexo: String(f[COL.SEXO]).trim(),
        edad: String(f[COL.EDAD]).trim(),
        rango: String(f[COL.RANGO]).trim(),
        servicio: String(f[COL.SERVICIO]).trim(),
        cama: String(f[COL.CAMA]).trim(),
        diagnostico: String(f[COL.DIAG1]).trim(),
        rem: String(f[COL.REM1]).trim(),
        ges: String(f[COL.GES]).trim(),
        sesiones: 0, atenciones: 0, brechas: 0,
        ingreso: false, egreso: ''
      };
    }

    var p = porRut[rut];
    p.sesiones++;
    p.atenciones += num_(f[COL.ATENCIONES]);
    p.brechas    += num_(f[COL.BRECHA]);
    if (esUno_(f[COL.INGRESO])) p.ingreso = true;
    // motivoEgreso_ vive en Api.gs; en Apps Script todos los archivos del proyecto
    // comparten el mismo ámbito, así que los cuatro tienen que estar presentes.
    if (!p.egreso && COLS_EGRESO.some(function (c) { return esUno_(f[c]); })) {
      p.egreso = motivoEgreso_(f);
    }
    // El último servicio y cama del mes son los que quedan.
    p.servicio = String(f[COL.SERVICIO]).trim() || p.servicio;
    p.cama     = String(f[COL.CAMA]).trim() || p.cama;
  });

  var lista = Object.keys(porRut).map(function (k) { return porRut[k]; });
  lista.sort(function (a, b) {
    if (a.servicio !== b.servicio) return a.servicio < b.servicio ? -1 : 1;
    return (parseInt(a.cama, 10) || 0) - (parseInt(b.cama, 10) || 0);
  });

  return { ok: true, mes: mes, nombreMes: NOMBRE_MES, pacientes: lista };
}


// ══════════════════════════════════════════════════════════
// RESUMEN CON GEMINI
// ══════════════════════════════════════════════════════════

/**
 * Arma lo único que se le manda a Gemini: cifras agregadas.
 *
 * Esta función es la frontera de privacidad del proyecto. Nombres, RUT, camas y
 * diagnósticos escritos a mano NO entran acá, y no es por prolijidad: son datos
 * de salud bajo la Ley 21.719 y la Ley 20.584. El resumen sale igual de bien sin
 * ellos, porque lo que se narra son totales.
 *
 * Si algún día agregas un campo a este objeto, comprueba primero que no
 * identifique a nadie.
 */
function payloadSinIdentificar_(d) {
  var categorias = {};
  Object.keys(d.ingresos.categorias).forEach(function (c) {
    var x = d.ingresos.categorias[c];
    categorias[c] = { total: x.total, hombres: x.hombres, mujeres: x.mujeres,
                      abierta: x.abierta, upc: x.upc, cuidadosMedios: x.medios,
                      porRangoEtario: x.rangos };
  });

  var egresos = {};
  d.egresos.orden.forEach(function (m) {
    if (d.egresos.motivos[m] && d.egresos.motivos[m].total) {
      egresos[m] = d.egresos.motivos[m].total;
    }
  });

  var rem17 = {};
  d.rem17.forEach(function (p) {
    if (p.total) rem17[p.nombre] = { total: p.total, cerrada: p.cerrada,
                                     abierta: p.abierta, urgencia: p.urgencia };
  });

  var porServicio = {};
  Object.keys(d.servicios).forEach(function (s) {
    porServicio[s] = { sesiones: d.servicios[s].sesiones, registros: d.servicios[s].filas };
  });

  return {
    mes: d.nombreMes,
    totales: {
      ingresos: d.resumen.ingresos,
      egresos: d.resumen.egresos,
      evaluacionesIniciales: d.resumen.iniciales,
      evaluacionesIntermedias: d.resumen.intermedias,
      sesionesDeRehabilitacion: d.resumen.sesiones,
      pacientesDistintos: d.resumen.pacientes,
      brechas: d.resumen.brechas,
      atencionesSuspendidas: d.resumen.suspendidas
    },
    ingresosPorCategoriaREM: categorias,
    egresosPorMotivo: egresos,
    prestacionesREM17: rem17,
    procedimientos: d.procedimientos,
    derivaciones: d.derivaciones,
    cargaPorServicio: porServicio
  };
}

function construirResumenIA_(mes, fono, mesAnterior) {
  var clave = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!clave) {
    throw new Error('Falta configurar la clave de Gemini. Ejecuta configurarGemini() en el editor.');
  }

  var d = construirDashboard_(mes, fono);
  var datos = { mesActual: payloadSinIdentificar_(d) };

  if (mesAnterior) {
    try {
      datos.mesAnterior = payloadSinIdentificar_(construirDashboard_(mesAnterior, fono));
    } catch (err) { /* sin mes anterior el resumen igual sirve */ }
  }

  var instruccion =
    'Eres fonoaudiólogo/a clínico en un hospital chileno y redactas el párrafo de ' +
    'resumen que acompaña al REM mensual.\n\n' +
    'Escribe en español de Chile, en tercera persona, entre 120 y 200 palabras, en uno ' +
    'o dos párrafos, sin títulos ni viñetas.\n\n' +
    'Reglas:\n' +
    '- Usa solo las cifras entregadas. No inventes ni estimes nada.\n' +
    '- Menciona el volumen total, las categorías diagnósticas de mayor peso y la ' +
    'distribución entre atención abierta, UPC y cuidados medios.\n' +
    '- Si hay datos del mes anterior, compara en una frase.\n' +
    '- Si hubo brechas o atenciones suspendidas, nómbralas con su número.\n' +
    '- No hagas recomendaciones clínicas ni juicios sobre el desempeño.\n' +
    '- Los datos vienen sin identificar: no te refieras a pacientes individuales.\n\n' +
    'Datos:\n' + JSON.stringify(datos);

  var respuesta = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + MODELO_GEMINI + ':generateContent',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': clave },
      payload: JSON.stringify({
        contents: [{ parts: [{ text: instruccion }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
      }),
      muteHttpExceptions: true
    });

  var codigo = respuesta.getResponseCode();
  var cuerpo = respuesta.getContentText();

  if (codigo !== 200) {
    var detalle = cuerpo;
    try { detalle = JSON.parse(cuerpo).error.message; } catch (e) { /* texto plano */ }
    throw new Error('Gemini respondió ' + codigo + ': ' + detalle);
  }

  var json = JSON.parse(cuerpo);
  var texto = '';
  try {
    texto = json.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
  } catch (e) {
    throw new Error('Gemini devolvió una respuesta que no se pudo leer.');
  }
  if (!texto.trim()) throw new Error('Gemini devolvió un resumen vacío. Inténtalo otra vez.');

  return {
    ok: true,
    mes: mes,
    resumen: texto.trim(),
    modelo: MODELO_GEMINI,
    enviado: Object.keys(datos.mesActual)   // qué secciones viajaron, para que puedas auditarlo
  };
}
