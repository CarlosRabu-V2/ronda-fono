/**
 * INFORMES Y RESUMEN CON IA — Fase 3
 *
 * Archivo nuevo. Va en el mismo proyecto, junto a Codigo.gs, Api.gs y Dashboard.gs.
 *
 * El PDF NO se genera aquí: lo arma el propio teléfono. Este archivo solo entrega
 * la nómina de pacientes y, si lo pides, el resumen narrativo del mes.
 */

/**
 * El modelo NO se escribe a mano. Google retira nombres cada cierto tiempo
 * ("no longer available to new users") y dejarlo fijo rompe el resumen sin aviso.
 *
 * En su lugar se le pregunta a la API qué modelos hay disponibles y se elige uno,
 * guardándolo para no repetir la consulta. Si el guardado deja de existir, se
 * descarta y se busca otro. Una llamada al mes cabe de sobra en la capa gratuita.
 */
var GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/';

/** Palabras que descartan un modelo para este uso. */
var GEMINI_DESCARTAR = /embedding|aqa|vision|image|imagen|tts|audio|live|native|veo|learnlm/i;


/**
 * Pregunta a la API qué modelos puede usar esta clave y elige el mejor para
 * redactar el resumen: uno de la familia "flash", que es la más barata y rápida.
 */
function descubrirModelo_(clave) {
  var r = UrlFetchApp.fetch(GEMINI_API + 'models?pageSize=200', {
    method: 'get',
    headers: { 'x-goog-api-key': clave },
    muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) {
    throw new Error('No se pudo consultar los modelos de Gemini (' +
                    r.getResponseCode() + '). Revisa que la clave sea válida.');
  }

  var lista = (JSON.parse(r.getContentText()).models || []).filter(function (m) {
    var met = m.supportedGenerationMethods || m.supportedActions || [];
    return met.indexOf('generateContent') !== -1 && !GEMINI_DESCARTAR.test(m.name);
  }).map(function (m) { return m.name.replace(/^models\//, ''); });

  if (!lista.length) throw new Error('La clave de Gemini no tiene ningún modelo disponible.');

  // Preferencias, de mejor a peor para este uso.
  var preferidos = [
    function (n) { return n === 'gemini-flash-latest'; },
    function (n) { return /flash/.test(n) && !/lite|preview|exp|thinking/.test(n); },
    function (n) { return /flash/.test(n) && !/preview|exp/.test(n); },
    function (n) { return /flash/.test(n); },
    function (n) { return !/preview|exp/.test(n); },
    function ()  { return true; }
  ];

  for (var i = 0; i < preferidos.length; i++) {
    var c = lista.filter(preferidos[i]).sort();
    // El último al ordenar es el de número de versión más alto.
    if (c.length) return c[c.length - 1];
  }
  return lista[0];
}

/** El modelo a usar, recordando el último que funcionó. */
function modeloGemini_(clave, forzarBusqueda) {
  var props = PropertiesService.getScriptProperties();
  if (!forzarBusqueda) {
    var guardado = props.getProperty('GEMINI_MODEL');
    if (guardado) return guardado;
  }
  var m = descubrirModelo_(clave);
  props.setProperty('GEMINI_MODEL', m);
  return m;
}

/**
 * Muestra qué modelos acepta tu clave y cuál está en uso.
 * Ejecútala desde el editor si quieres cambiarlo a mano.
 */
function listarModelosGemini() {
  var clave = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!clave) { Logger.log('No hay clave guardada. Ejecuta configurarGemini() primero.'); return; }

  var r = UrlFetchApp.fetch(GEMINI_API + 'models?pageSize=200', {
    method: 'get', headers: { 'x-goog-api-key': clave }, muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) {
    Logger.log('Error ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 300));
    return;
  }
  var models = JSON.parse(r.getContentText()).models || [];
  Logger.log('MODELOS QUE ACEPTAN generateContent:');
  models.forEach(function (m) {
    var met = m.supportedGenerationMethods || m.supportedActions || [];
    if (met.indexOf('generateContent') !== -1) Logger.log('  ' + m.name.replace(/^models\//, ''));
  });
  Logger.log('');
  Logger.log('En uso ahora: ' + (PropertiesService.getScriptProperties()
                                   .getProperty('GEMINI_MODEL') || '(aun sin elegir)'));
  Logger.log('Para fijar uno a mano, ejecuta:');
  Logger.log("  PropertiesService.getScriptProperties().setProperty('GEMINI_MODEL', 'el-que-quieras')");
}


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


/**
 * Confirma que la clave quedó guardada, sin mostrarla.
 * Ejecútala después de configurarGemini() y mira el registro de ejecución.
 */
function verificarGemini() {
  var k = PropertiesService.getScriptProperties().getProperty('GEMINI_KEY');
  if (!k) {
    Logger.log('NO hay clave guardada. Ejecuta configurarGemini() con la clave pegada.');
    return false;
  }
  Logger.log('Clave guardada correctamente (termina en ...' + k.slice(-4) +
             ', ' + k.length + ' caracteres).');
  return true;
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

  var cuerpoPeticion = JSON.stringify({
    contents: [{ parts: [{ text: instruccion }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 800 }
  });

  function pedir(modelo) {
    return UrlFetchApp.fetch(GEMINI_API + 'models/' + modelo + ':generateContent', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': clave },
      payload: cuerpoPeticion,
      muteHttpExceptions: true
    });
  }

  var modelo = modeloGemini_(clave, false);
  var respuesta = pedir(modelo);

  // Google retira modelos sin avisar. Si el guardado ya no existe, se busca otro
  // y se reintenta una vez, para que el resumen no se caiga por un cambio ajeno.
  if (respuesta.getResponseCode() === 404) {
    modelo = modeloGemini_(clave, true);
    respuesta = pedir(modelo);
  }

  var codigo = respuesta.getResponseCode();
  var cuerpo = respuesta.getContentText();

  if (codigo !== 200) {
    var detalle = cuerpo;
    try { detalle = JSON.parse(cuerpo).error.message; } catch (e) { /* texto plano */ }
    throw new Error('Gemini respondió ' + codigo + ' con el modelo ' + modelo + ': ' + detalle);
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
    modelo: modelo,
    enviado: Object.keys(datos.mesActual)   // qué secciones viajaron, para que puedas auditarlo
  };
}
