/* ══════════════════════════════════════════════════════════════
   RONDA FONOAUDIOLÓGICA — Fase 1
   Funciona sin conexión. Todo lo que registras queda en el teléfono
   hasta que el servidor confirma que lo escribió en la planilla.
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Servicios: color y nombre largo ──────────────────────────
   El color va por servicio y no por tramo de cama: los rangos de cama se solapan
   entre unidades, así que el número por sí solo no dice de qué servicio se trata.
   Los colores siguen DESIGN.md de Stitch. Si prefieres MQ en morado, como quedó
   en la maqueta de la Ronda, cambia solo esta línea.                          */
const SERVICIOS = {
  'UTI':             { color: '#2563eb', nombre: 'Cuidados Intermedios' },
  'UCI':             { color: '#0d9488', nombre: 'Cuidados Intensivos' },
  'MQ':              { color: '#d97706', nombre: 'Médico Quirúrgico' },
  'NEO':             { color: '#7c3aed', nombre: 'Neonatología' },
  'UTI NEO':         { color: '#9333ea', nombre: 'Intermedio Neonatal' },
  'UTIP':            { color: '#ea580c', nombre: 'Intensivo Pediátrico' },
  'PED':             { color: '#db2777', nombre: 'Pediatría' },
  'UHCIP':           { color: '#0891b2', nombre: 'Cuidados Intensivos Psiquiátricos' },
  'UEA':             { color: '#dc2626', nombre: 'Emergencia Adulto' },
  'UE':              { color: '#dc2626', nombre: 'Emergencia' },
  'MATER':           { color: '#c026d3', nombre: 'Maternidad' },
  'MEDICINA FISICA': { color: '#475569', nombre: 'Medicina Física' },
  'SAIP':            { color: '#64748b', nombre: 'SAIP' },
  'PAB':             { color: '#64748b', nombre: 'Pabellón' }
};
const SERVICIO_POR_DEFECTO = { color: '#64748b', nombre: '' };

const servicioInfo = (s) => SERVICIOS[String(s || '').trim().toUpperCase()] || SERVICIO_POR_DEFECTO;

/* El orden de los grupos sigue el de SERVICIOS: primero las unidades críticas,
   después el resto. Un servicio que no esté en la lista va al final, alfabético. */
const ORDEN_SERVICIOS = Object.keys(SERVICIOS);
const ordenServicio = (s) => {
  const i = ORDEN_SERVICIOS.indexOf(String(s || '').trim().toUpperCase());
  return i === -1 ? ORDEN_SERVICIOS.length : i;
};

const EVALUACIONES  = ['Deglución', 'Voz', 'Habla', 'Lenguaje', 'Audición', 'Función Cognitiva'];
const INTERVENCIONES = ['FMO', 'MTXD', 'Voz', 'Habla', 'Lenguaje', 'OFAS', 'ECOG'];
const DISF = [['M','Mecánica'],['PS','Psicógena'],['S','Sarcopénica'],
              ['N','Neurológica'],['I','Iatrogénica'],['U','UCI']];
const CATEGORIZACIONES = [['2','Alta (2)'],['1','Media (1)'],['1-2 POR SEMANA','Baja'],['NSP','No se presenta']];
const EGRESOS = [
  ['Alta',           'Alta'],
  ['Fallecimiento',  'Fallecimiento'],
  ['Otro Hospital',  'Traslado a otro hospital'],
  ['Otro Servicio',  'Traslado a otro servicio'],
  ['Nivel Primario', 'Derivación a nivel primario'],
  ['ACV REF APS',    'ACV referido a APS'],
  ['Abandono',       'Abandono']
];

/* ── Iconos ────────────────────────────────────────────────── */
const ICO = {
  buscar:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  check:   '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.3-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z"/></svg>',
  circulo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>',
  alerta:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>',
  mas:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  archivo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h18v13H3z"/><path d="M3 7l2-3h14l2 3"/></svg>',
  flecha:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  atras:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
  menu:    '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  nube:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 17H7A4 4 0 0 1 7 9a5 5 0 0 1 9.6-1.2A3.5 3.5 0 0 1 17 17z"/><path d="m3 3 18 18"/></svg>',
  ok:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>',
  luna:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></svg>',
  lista:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
  grafico: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="11" width="4" height="9" rx="1"/><rect x="10" y="5" width="4" height="15" rx="1"/><rect x="16" y="14" width="4" height="6" rx="1"/></svg>',
  doc:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/></svg>',
  cama:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 18V7M3 12h18v6M8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>',
  salida:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 21H5V3h5M16 16l4-4-4-4M20 12H10"/></svg>',
  volver:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  cal:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  persona: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  entrada: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 21h5V3h-5M8 8l-4 4 4 4M4 12h10"/></svg>',
  ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  chispa:  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2zM18.5 14l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z"/></svg>',
  escudo:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l8 3v6c0 5-3.4 8.2-8 9-4.6-.8-8-4-8-9V6l8-3z"/><path d="m9 12 2 2 4-4"/></svg>'
};

/* ══════════════════════════════════════════════════════════════
   ALMACENAMIENTO LOCAL (IndexedDB)
   Sobrevive a cerrar la app, quedarse sin batería y reiniciar.
   ══════════════════════════════════════════════════════════════ */
const DB = (() => {
  let db = null;

  function abrir() {
    return new Promise((res, rej) => {
      const req = indexedDB.open('ronda-fono', 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains('config')) d.createObjectStore('config');
        if (!d.objectStoreNames.contains('censo'))  d.createObjectStore('censo', { keyPath: 'rut' });
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'uuid' });
      };
      req.onsuccess = () => { db = req.result; res(db); };
      req.onerror = () => rej(req.error);
    });
  }

  const tx = (store, modo) => db.transaction(store, modo).objectStore(store);
  const prom = (req) => new Promise((res, rej) => {
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });

  return {
    abrir,
    get:      (store, key) => prom(tx(store, 'readonly').get(key)),
    todos:    (store)      => prom(tx(store, 'readonly').getAll()),
    guardar:  (store, val, key) => prom(tx(store, 'readwrite').put(val, key)),
    borrar:   (store, key) => prom(tx(store, 'readwrite').delete(key)),
    limpiar:  (store)      => prom(tx(store, 'readwrite').clear()),
    async reemplazar(store, lista) {
      const s = tx(store, 'readwrite');
      await prom(s.clear());
      for (const item of lista) s.put(item);
      return new Promise((res) => { s.transaction.oncomplete = res; });
    }
  };
})();

/* ══════════════════════════════════════════════════════════════
   CACHÉ DE CONSULTAS
   El dashboard y los informes se calculan en la planilla y tardan. Sin esto,
   cada cambio de vista rehace el mismo cálculo y la app parece congelada.
   Se guarda lo ya calculado y se muestra al instante, con la hora en que se
   calculó; solo se vuelve a pedir cuando ella toca actualizar.

   Solo guarda cifras agregadas. La nómina de pacientes NO se cachea: se pide
   en el momento de generar el PDF y se descarta al terminar.
   ══════════════════════════════════════════════════════════════ */

const cache = {
  leer(clave) {
    try {
      const raw = localStorage.getItem('cache:' + clave);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return (o && o.t && o.d) ? { datos: o.d, cuando: o.t } : null;
    } catch (e) { return null; }      // modo privado o dato corrupto
  },
  /** @param {number} [t] Cuándo empezó el cálculo; lo que se envíe después ya no está incluido. */
  escribir(clave, datos, t = Date.now()) {
    try {
      localStorage.setItem('cache:' + clave, JSON.stringify({ d: datos, t }));
    } catch (e) { /* sin cuota: la app funciona igual, solo sin caché */ }
  },
  limpiar() {
    try {
      Object.keys(localStorage)
        .filter(k => k.indexOf('cache:') === 0)
        .forEach(k => localStorage.removeItem(k));
    } catch (e) { /* nada que limpiar */ }
  }
};

/**
 * Cuándo se envió por última vez algo de un mes. Si es posterior a la hora en
 * que se calculó el dashboard de ese mes, las cifras guardadas ya no incluyen
 * todo y la pantalla tiene que decirlo en vez de mostrarlas como al día.
 */
function marcarCambio(mes) {
  try { localStorage.setItem('cambio:' + mes, String(Date.now())); } catch (e) { /* sin almacenamiento */ }
}
function ultimoCambio(mes) {
  try { return Number(localStorage.getItem('cambio:' + mes)) || 0; } catch (e) { return 0; }
}

/** "hoy 08:12", "ayer 17:40", "1 oct 17:40". Una hora fija no envejece mientras se mira la pantalla. */
function fechaHora(t) {
  const d = new Date(t);
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const dias = diasDesde(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  if (dias === 0) return `hoy ${hora}`;
  if (dias === 1) return `ayer ${hora}`;
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
  return `${d.getDate()} ${meses[d.getMonth()]} ${hora}`;
}

/* ══════════════════════════════════════════════════════════════
   ESTADO
   ══════════════════════════════════════════════════════════════ */
const estado = {
  config: null,
  censo: [],
  egresos: [],
  catalogos: { servicios: [], fonoaudiólogos: [] },
  diagnostico: null,   // por qué la ronda salió vacía, cuando sale vacía
  diasCenso: 14,
  diasPorDefecto: 14,
  ventana: null,       // { desde, vence } mientras se mira una ventana más larga que la habitual
  actualizado: 0,      // cuándo se trajo la ronda de la planilla por última vez
  ocupado: '',         // lo que se está haciendo con la red, para mostrarlo en la píldora
  outbox: [],
  vista: 'ronda',
  busqueda: '',
  buscadorAbierto: false,
  paciente: null,
  enLinea: navigator.onLine
};

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }));

const normRut = (r) => String(r || '').toUpperCase().replace(/[^0-9K]/g, '');
/* Escapa también las comillas: el texto va a parar a atributos (data-rut,
   data-grupo, value) y la ronda ahora muestra filas escritas por otras personas. */
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/**
 * Fecha de la última atención de ESTA profesional. ultimaFecha es la de
 * cualquier colega: si otra fonoaudióloga lo vio hoy, no significa que ella ya
 * lo haya registrado. Un censo guardado por la versión anterior no trae
 * ultimaFechaMia, y ahí ultimaFecha ya era la propia.
 */
const ultimaMia = (p) => ('ultimaFechaMia' in p) ? p.ultimaFechaMia : p.ultimaFecha;

/** RUT ya registrados hoy, sea porque están en la bandeja o porque el censo los trae. */
function registradosHoy() {
  const hoy = hoyISO();
  const set = new Set();
  estado.outbox.forEach(s => { if (s.fecha === hoy && s.tipo === 'sesion') set.add(normRut(s.rut)); });
  estado.censo.forEach(p => { if (ultimaMia(p) === hoy) set.add(normRut(p.rut)); });
  return set;
}

/** Atenciones sugeridas por semana según la categorización, para calcular la brecha. */
function diasSugeridos(categorizacion) {
  const c = String(categorizacion || '').toUpperCase();
  if (c === '2') return 3;
  if (c === '1') return 7;
  if (c.startsWith('1-2') || c.startsWith('01-2')) return 7;
  return 14;
}

/* ══════════════════════════════════════════════════════════════
   RED
   Apps Script tarda varios segundos la primera vez (arranque en frío) y de
   vez en cuando responde una página HTML de error en vez de datos. Sin tiempo
   máximo, una petición colgada por mala señal dejaba el botón sin respuesta;
   sin reintento, un error momentáneo obligaba a tocar varias veces.
   ══════════════════════════════════════════════════════════════ */
const ESPERA_MAX_MS = 40000;

/** Errores que reintentar no arregla: la clave, la configuración o los datos. */
const ERROR_DEFINITIVO = /clave|configurarToken|desconocida|inválid|no lo registró|no tiene marca|Falta/i;

function falla(msg, { reintentable = false, red = false } = {}) {
  const e = new Error(msg);
  e.reintentable = reintentable;
  e.red = red;
  return e;
}

async function pedirUnaVez(url, opciones, espera) {
  const ctrl = new AbortController();
  const reloj = setTimeout(() => ctrl.abort(), espera);
  try {
    const r = await fetch(url, { ...opciones, redirect: 'follow', signal: ctrl.signal });
    const texto = await r.text();
    let j = null;
    try { j = JSON.parse(texto); } catch (e) { /* no era JSON */ }
    if (!j) {
      // Google contesta con una página HTML cuando el script está saturado o
      // falla al arrancar. Casi siempre pasa sola.
      throw falla(`La planilla respondió con un error (${r.status}).`, { reintentable: true });
    }
    if (!j.ok) {
      const msg = j.error || 'El servidor rechazó la petición.';
      throw falla(msg, { reintentable: !ERROR_DEFINITIVO.test(msg) });
    }
    return j;
  } catch (err) {
    if ('reintentable' in err) throw err;
    // fetch solo lanza por falta de red, por CORS o por el tiempo máximo.
    throw falla(err.name === 'AbortError' ? 'La planilla tardó demasiado en responder.'
              : navigator.onLine ? 'No hubo respuesta de la planilla.' : 'Sin conexión.',
                { reintentable: true, red: true });
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * Pide y devuelve el JSON de la API. Reintenta una vez los errores pasajeros;
 * es seguro porque leer no cambia nada y cada sesión viaja con su uuid.
 */
async function pedirJSON(url, opciones = {}, { intentos = 2, espera = ESPERA_MAX_MS } = {}) {
  let error = null;
  for (let i = 0; i < intentos; i++) {
    if (i) {
      if (estado.ocupado) { estado.ocupado = 'Reintentando…'; pintarEstadoSync(); }
      await new Promise(r => setTimeout(r, 2000));
    }
    try {
      return await pedirUnaVez(url, opciones, espera);
    } catch (err) {
      error = err;
      if (!err.reintentable || !navigator.onLine) break;
    }
  }
  throw error;
}

/** POST con text/plain a propósito: application/json dispara una petición
    previa OPTIONS que Apps Script no sabe responder. */
const postJSON = (cuerpo) => ({
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(cuerpo)
});

/* ══════════════════════════════════════════════════════════════
   API
   ══════════════════════════════════════════════════════════════ */
const API = {
  /** @param {object} [cfg] La configuración a usar; la pantalla de configuración prueba una que aún no se guardó. */
  censo(dias, cfg = estado.config) {
    const { url, token, fono, servicios } = cfg;
    const q = `${url}?api=censo&token=${encodeURIComponent(token)}&fono=${encodeURIComponent(fono || '')}` +
              (dias ? `&dias=${encodeURIComponent(dias)}` : '') +
              (servicios && servicios.length ? `&servicios=${encodeURIComponent(servicios.join(','))}` : '');
    return pedirJSON(q, { method: 'GET' });
  },

  enviar(sesiones, opciones) {
    const { url, token } = estado.config;
    return pedirJSON(url, postJSON({ token, accion: 'sesiones', sesiones }), opciones);
  },

  /** Limpia las marcas de egreso de una fila ya escrita, ubicada por su uuid. */
  async anular(uuidEgreso) {
    const { url, token } = estado.config;
    const pedir = () => pedirJSON(url, postJSON({ token, accion: 'anular', uuid: uuidEgreso }), { intentos: 1 });
    try {
      return await pedir();
    } catch (err) {
      if (!err.red || !navigator.onLine) throw err;
      // El primer intento pudo llegar y perderse solo la respuesta. Si el
      // reintento encuentra la fila ya limpia, el resultado es el que se pidió.
      // Solo en el reintento: a la primera, ese mensaje es un error de verdad.
      try {
        return await pedir();
      } catch (err2) {
        if (/no tiene marca de egreso/i.test(err2.message)) return { ok: true };
        throw err2;
      }
    }
  },

  ping(url, token) {
    return pedirJSON(`${url}?api=ping&token=${encodeURIComponent(token)}`, { method: 'GET' });
  }
};

/* ══════════════════════════════════════════════════════════════
   SINCRONIZACIÓN
   Nada se borra del teléfono hasta que el servidor confirma el uuid.
   Enviar NO cambia la lista de la ronda: antes, cada envío recargaba la ronda
   por detrás y, si se estaba mirando una ventana ampliada, los pacientes aún
   no atendidos desaparecían de golpe.
   ══════════════════════════════════════════════════════════════ */
const Sync = {
  enCurso: null,   // promesa del envío en marcha
  // Confirmados hace poco: si una descarga de la ronda salió antes de que se
  // escribieran, la planilla todavía no los trae y hay que seguir mostrándolos.
  recientes: [],

  /**
   * Envía lo pendiente. Devuelve { enviadas, errores }; si no hay conexión
   * lanza, y todo sigue guardado en el teléfono.
   */
  async enviar(opciones) {
    // Con un envío en marcha se espera a que termine y después se manda lo que
    // haya quedado: dos lotes a la vez solo competirían por el candado.
    // Esperar y reclamar sin un await de por medio: si dos envíos esperan al
    // mismo tiempo, solo uno sale y el otro vuelve a esperar.
    do { await this.esperar(); } while (this.enCurso);
    // Los que la planilla rechazó por datos no se reenvían solos: fallarían
    // igual. Esperan a que se corrijan desde la bandeja.
    const lote = estado.outbox.filter(s => !s.error);
    if (!lote.length) return { enviadas: 0, errores: [] };

    this.enCurso = this._enviar(lote, opciones);
    pintarEstadoSync();
    try {
      return await this.enCurso;
    } finally {
      this.enCurso = null;
      pintarEstadoSync();
    }
  },

  async _enviar(lote, opciones) {
    // Desde aquí no se sabe si la planilla lo escribió hasta que responda: con
    // mala señal puede escribirlo y perderse solo la respuesta. Deshacer o
    // descartar un registro así exige confirmar primero (ver restaurarEgreso).
    for (const s of lote) {
      if (!s.intentado) { s.intentado = true; await DB.guardar('outbox', s); }
    }
    const res = await API.enviar(lote.map(limpiarParaEnvio), opciones);

    // Guardadas y duplicadas salen de la bandeja por igual: en ambos casos
    // la fila ya está escrita en la planilla.
    const confirmados = new Set([...(res.guardadas || []), ...(res.duplicadas || [])]);
    for (const id of confirmados) await DB.borrar('outbox', id);
    const ahora = Date.now();
    lote.filter(s => confirmados.has(s.uuid)).forEach(s => {
      marcarCambio(String(s.fecha).slice(0, 7));
      this.recientes.push({ uuid: s.uuid, rut: s.rut, tipo: s.tipo, en: ahora });
    });
    estado.outbox = estado.outbox.filter(s => !confirmados.has(s.uuid));

    // Se quedan en la bandeja con el motivo a la vista, no se pierden. Un
    // rechazo es seguro que no se escribió.
    const errores = res.errores || [];
    for (const e of errores) {
      const s = estado.outbox.find(x => x.uuid === e.uuid);
      if (s) { s.error = e.msg; delete s.intentado; await DB.guardar('outbox', s); }
    }
    return { enviadas: confirmados.size, errores };
  },

  /**
   * Espera a que termine el envío en marcha, si lo hay. Quien después vaya a
   * tocar la bandeja tiene que volver a mirar enCurso: otro envío en cola pudo
   * arrancar justo entre medio (do { await Sync.esperar() } while (Sync.enCurso)).
   */
  async esperar() {
    while (this.enCurso) {
      try { await this.enCurso; } catch (e) { /* lo informa quien lo lanzó */ }
    }
  },

  /**
   * Después de guardar: un intento corto y silencioso, para que lo registrado
   * llegue a la planilla cuanto antes. No toca la lista; si falla, queda para
   * el botón Actualizar.
   */
  enSegundoPlano() {
    if (!navigator.onLine) return;
    this.enviar({ intentos: 1, espera: 20000 }).catch(() => {}).then(() => pintarEstadoSync());
  }
};

/** Quita los campos internos que el servidor no necesita. */
function limpiarParaEnvio(s) {
  const { enviada, error, tipo, creado, intentado, previo, ...resto } = s;
  return resto;
}

async function encolar(sesion) {
  sesion.uuid = sesion.uuid || uuid();
  sesion.creado = sesion.creado || Date.now();
  await DB.guardar('outbox', sesion);
  estado.outbox.push(sesion);
  pintar();
  Sync.enSegundoPlano();
}

/* ══════════════════════════════════════════════════════════════
   CENSO
   ══════════════════════════════════════════════════════════════ */

/** Lo que hay que recordar de la ronda además de los pacientes. */
function guardarCacheLocal() {
  return DB.guardar('config', {
    egresos: estado.egresos,
    catalogos: estado.catalogos,
    diagnostico: estado.diagnostico,
    diasCenso: estado.diasCenso,
    diasPorDefecto: estado.diasPorDefecto,
    ventana: estado.ventana,
    actualizado: estado.actualizado
  }, 'cache');
}

/** "2026-10-03" desplazada n días. En UTC para no tropezar con el cambio de hora. */
function sumarDias(iso, n) {
  const p = String(iso).split('-').map(Number);
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
  return d.toISOString().slice(0, 10);
}

/**
 * Amplía la ventana de la ronda hasta una fecha fija. Es fija a propósito: con
 * "los últimos N días" el paciente del borde se caía al día siguiente. Vence
 * sola a la semana, cuando ya hubo tiempo de atender a quienes siguen.
 */
function ampliarVentana(dias) {
  const hoy = hoyISO();
  return actualizar({ ventana: { desde: sumarDias(hoy, -(dias - 1)), vence: sumarDias(hoy, 7) } });
}

function volverVentanaNormal() {
  return actualizar({ ventana: null });
}

/**
 * @param {object|null} ventana La ventana a pedir. Queda en el estado solo si
 *   la ronda llegó: si no, el aviso diría "viendo desde…" sobre la lista de
 *   siempre.
 */
async function traerCenso(ventana) {
  if (ventana && hoyISO() > ventana.vence) ventana = null;
  // Nunca menos que la ventana habitual: pedir 10 días achicaría la ronda.
  const dias = ventana
    ? Math.max(diasDesde(ventana.desde) + 1, estado.diasPorDefecto || 14) : 0;

  const pedidoEn = Date.now();
  const j = await API.censo(dias);
  fusionarCenso(j.pacientes || [], j.egresos || [], pedidoEn);
  estado.ventana = ventana;
  estado.catalogos = j.catalogos || estado.catalogos;
  estado.diagnostico = j.diagnostico || null;
  if (j.diasCenso) estado.diasCenso = j.diasCenso;
  if (j.diasPorDefecto) estado.diasPorDefecto = j.diasPorDefecto;
  estado.actualizado = Date.now();
  await DB.reemplazar('censo', estado.censo);
  await guardarCacheLocal();
}

/**
 * Junta la ronda que manda la planilla con lo que todavía no le llegó.
 *
 * Reemplazarla sin más borraba de la vista lo hecho sin conexión: un ingreso
 * sin enviar desaparecía, un egreso sin enviar devolvía al paciente a la ronda
 * y un cambio de cama volvía al valor anterior.
 *
 * @param {number} [pedidoEn] Cuándo salió la petición. Lo confirmado después
 *   (un envío en segundo plano que llegó antes que la ronda) puede no estar en
 *   lo que leyó la planilla, así que cuenta como pendiente.
 */
function fusionarCenso(pacientes, egresos, pedidoEn = 0) {
  const locales = new Map(estado.censo.map(p => [normRut(p.rut), p]));

  const recientes = Sync.recientes.filter(x => x.en >= pedidoEn);
  Sync.recientes = recientes;   // lo confirmado antes de pedir ya viene en la ronda

  const conPendiente = new Set();   // RUT con sesiones o ingresos que la planilla aún no trae
  const egresoPendiente = new Set();  // uuid de egresos que la planilla aún no trae
  for (const s of [...estado.outbox, ...recientes]) {
    if (s.tipo === 'egreso') egresoPendiente.add(s.uuid);
    else conPendiente.add(normRut(s.rut));
  }
  const egresadosAca = estado.egresos.filter(e => egresoPendiente.has(e.uuidEgreso));
  const fueraDeRonda = new Set(egresadosAca.map(e => normRut(e.rut)));

  const censo = [];
  const vistos = new Set();
  for (const p of pacientes) {
    const r = normRut(p.rut);
    if (vistos.has(r) || fueraDeRonda.has(r)) continue;
    vistos.add(r);
    const local = locales.get(r);

    // La planilla aún no tiene lo de hoy: manda lo que hay en el teléfono.
    if (local && conPendiente.has(r)) { censo.push(local); continue; }

    // Cama o diagnóstico cambiados aquí y todavía sin una sesión que los lleve.
    // Valen hasta que la planilla tenga una fila de un día posterior.
    if (local && local.cambios && !(p.ultimaFecha > local.cambios.fecha)) {
      Object.assign(p, local.cambios.valores);
      p.cambios = local.cambios;
    }
    censo.push(p);
  }
  // Ingresos hechos en el teléfono que la planilla todavía no conoce.
  for (const [r, local] of locales) {
    if (!vistos.has(r) && conPendiente.has(r) && !fueraDeRonda.has(r)) {
      censo.push(local);
      vistos.add(r);
    }
  }

  const listaEgresos = egresadosAca.slice();
  for (const e of egresos) {
    const r = normRut(e.rut);
    if (!vistos.has(r) && !fueraDeRonda.has(r)) { listaEgresos.push(e); fueraDeRonda.add(r); }
  }

  estado.censo = censo;
  estado.egresos = listaEgresos;
}

/* ══════════════════════════════════════════════════════════════
   ACTUALIZAR
   El único punto que trae datos nuevos: primero envía lo pendiente y después
   baja la ronda. Nada lo dispara solo; la lista cambia cuando ella lo toca.
   Tocarlo varias veces no lanza peticiones en paralelo: se espera la que ya
   está en curso, con el icono girando para que se note que está trabajando.
   ══════════════════════════════════════════════════════════════ */
let actualizacion = null;

/**
 * @param {object} [cambios] { ventana } para pedir otra ventana, o
 *   { config: true } tras cambiar la configuración. Si hay una actualización
 *   en curso, esa salió con los valores de antes: se encadena otra en vez de
 *   devolverla como si sirviera.
 * @returns {Promise<boolean>} Si la ronda llegó.
 */
function actualizar(cambios = {}) {
  const otraVentana = 'ventana' in cambios;
  if (actualizacion) {
    return (otraVentana || cambios.config) ? actualizacion.then(() => actualizar(cambios)) : actualizacion;
  }
  const ventana = otraVentana ? cambios.ventana : estado.ventana;

  actualizacion = (async () => {
    estado.ocupado = 'Actualizando…';
    pintarOcupado();
    buscarVersionNueva();
    try {
      const envio = await Sync.enviar();
      estado.ocupado = 'Trayendo la ronda…';
      pintarEstadoSync();
      await traerCenso(ventana);

      const n = estado.censo.length;
      let msg = `Ronda al día: ${n} ${n === 1 ? 'paciente' : 'pacientes'}`;
      if (envio.enviadas) {
        msg += ` · ${envio.enviadas} ${envio.enviadas === 1 ? 'registro enviado' : 'registros enviados'}`;
      }
      if (envio.errores.length) {
        toast(`${msg}. ${envio.errores.length} con error: toca el aviso rojo de arriba.`, 'error');
      } else {
        toast(msg, 'ok');
      }
      return true;
    } catch (err) {
      toast('No se pudo actualizar. ' + err.message +
            (estado.outbox.length ? ' Lo registrado sigue guardado en el teléfono.' : ''), 'error');
      return false;
    } finally {
      estado.ocupado = '';
      actualizacion = null;
      pintarOcupado();
      pintar();
    }
  })();
  return actualizacion;
}

/** El icono de actualizar gira mientras trabaja. */
function pintarOcupado() {
  const btn = document.getElementById('btnRefrescar');
  if (btn) {
    // estado.ocupado y no la promesa: al pintarse por primera vez, la promesa
    // todavía no terminó de asignarse.
    btn.classList.toggle('girando', !!estado.ocupado);
    btn.setAttribute('aria-busy', estado.ocupado ? 'true' : 'false');
  }
  pintarEstadoSync();
}

/**
 * Aprovecha el toque para ver si hay una versión nueva de la app publicada.
 * Si la hay, el service worker la instala y aparece el aviso para recargar.
 */
function buscarVersionNueva() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.getRegistration()
    .then(r => r && r.update())
    .catch(() => { /* sin red: se verá la próxima vez */ });
}

/* ══════════════════════════════════════════════════════════════
   AVISOS
   ══════════════════════════════════════════════════════════════ */
let toastTimer = null;
function toast(msg, tipo = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${tipo} visible`;
  clearTimeout(toastTimer);
  // Un error se lee con más calma que un "listo".
  toastTimer = setTimeout(() => { t.className = 'toast ' + tipo; }, tipo === 'error' ? 6000 : 3200);
}

/* ══════════════════════════════════════════════════════════════
   PINTADO — barra superior
   ══════════════════════════════════════════════════════════════ */
function pintarEstadoSync() {
  const el = document.getElementById('pillSync');
  if (!el) return;
  const pend = estado.outbox.length;
  const conError = estado.outbox.filter(s => s.error).length;

  if (estado.ocupado) {
    el.className = 'pill sync-off';
    el.textContent = estado.ocupado;
  } else if (Sync.enCurso) {
    el.className = 'pill sync-off';
    el.textContent = 'Sincronizando…';
  } else if (conError) {
    el.className = 'pill sync-error';
    el.innerHTML = `${ICO.alerta} ${conError} con error`;
  } else if (pend > 0) {
    el.className = 'pill sync-pend';
    el.innerHTML = `${ICO.nube} ${pend} sin sincronizar`;
  } else if (!estado.enLinea) {
    el.className = 'pill sync-off';
    el.innerHTML = `${ICO.nube} Sin conexión`;
  } else {
    el.className = 'pill sync-ok';
    el.innerHTML = `${ICO.ok} Todo sincronizado`;
  }
}

/**
 * De cuándo es la lista. Como ya no se recarga sola, tiene que verse si es de
 * hoy o de ayer: una lista de ayer es la explicación de "faltan pacientes".
 */
function pintarEstadoLista() {
  const el = document.getElementById('estadoLista');
  if (!el) return;
  if (!estado.actualizado) {
    el.textContent = 'Lista sin descargar · toca ↻';
    el.className = 'frescura alerta';
    return;
  }
  const deHoy = diasDesde(isoDe(estado.actualizado)) === 0;
  const cuando = fechaHora(estado.actualizado);   // "hoy 08:12", "ayer 17:40", "1 oct 17:40"
  el.textContent = deHoy ? `Lista de las ${cuando.slice(4)}`
                         : `Lista ${cuando.startsWith('ayer') ? 'de' : 'del'} ${cuando} · toca ↻`;
  el.className = 'frescura' + (deHoy ? '' : ' alerta');
}

/** Fecha local de una marca de tiempo, como "2026-10-03". */
function isoDe(t) {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** La fecha de la cabecera. Se repinta al volver a la app: puede haber quedado abierta desde ayer. */
function pintarFecha() {
  const el = document.getElementById('fechaHoy');
  if (!el) return;
  const d = new Date();
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  el.textContent = `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`.replace(/^./, m => m.toUpperCase());
}

/* ══════════════════════════════════════════════════════════════
   PINTADO — ronda
   ══════════════════════════════════════════════════════════════ */
function pintar() {
  pintarEstadoSync();
  if (estado.vista === 'ronda') pintarRonda();
}

function pacientesFiltrados() {
  const q = estado.busqueda.trim().toUpperCase();
  if (!q) return estado.censo;
  const qRut = normRut(q);
  return [...estado.censo, ...estado.egresos].filter(p =>
    String(p.cama).toUpperCase().includes(q) ||
    String(p.nombre).toUpperCase().includes(q) ||
    (qRut.length >= 3 && normRut(p.rut).includes(qRut))
  );
}

/**
 * Una ronda vacía tiene tres causas muy distintas y conviene distinguirlas:
 * que no haya nadie hospitalizado, que el nombre elegido no coincida con el de
 * la planilla, o que la planilla no se esté leyendo. En blanco se confunden.
 */
function motivoRondaVacia() {
  const d = estado.diagnostico;
  const dias = estado.diasCenso || 14;

  if (!estado.actualizado && !d) {
    return `<p>La ronda todavía no se ha descargado en este teléfono.</p>
            <p class="meta">Toca <strong>↻</strong> arriba a la derecha para traerla de la planilla.</p>`;
  }

  if (!d) return `<p>No hay pacientes activos. Usa Ingreso para agregar uno.</p>`;

  if (!d.filasLeidas) {
    return `<p>La hoja <strong>${esc(d.hoja || '')}</strong> está vacía.</p>
            <p class="meta">Revisa el nombre de la pestaña en Codigo.gs.</p>`;
  }

  if (!d.filasDelProfesional) {
    return `<p>La planilla no tiene registros a nombre de
              <strong>${esc(estado.config.fono || '')}</strong>.</p>
            <p class="meta">Tiene ${fmtMil(d.filasLeidas)} filas en total.
              Puede que el nombre no esté escrito igual que en la columna
              FONOAUDIÓLOGA: revísalo con el engranaje de arriba a la derecha.</p>`;
  }

  const ultimo = fechaCorta(d.registroMasReciente);
  const brecha = diasDesde(d.registroMasReciente);

  return `<p>Nadie con atención registrada en los últimos ${dias} días.</p>
          <p class="meta">${ultimo
            ? `Tu registro más reciente en la planilla es del <strong>${esc(ultimo)}</strong>${
                brecha ? `, hace ${brecha} días` : ''}.`
            : ''} La ronda solo muestra a quienes siguen hospitalizados.</p>
          ${(brecha && brecha > dias && brecha <= 120) ? `
            <button class="btn btn-secundario" id="ampliarCenso" style="margin-top:14px">
              Ver los últimos ${diasParaAmpliar()} días
            </button>
            <p class="meta" style="margin-top:8px">Por si alguno sigue hospitalizado
              y no quieres volver a escribirlo.</p>` : `
            <p class="meta">Usa <strong>Ingreso</strong> para agregar el primer paciente de hoy.</p>`}`;
}

const fmtMil = (n) => Number(n || 0).toLocaleString('es-CL');

/**
 * Cuántos días pedir para ver la ronda que había en su último día de registro:
 * los 14 días habituales contados desde ese día, no desde hoy. Antes se pedían
 * solo los días transcurridos más uno, y eso traía únicamente a los pacientes
 * de su último día; los que veía cada dos o tres días, o una vez por semana
 * (UTI), quedaban fuera.
 */
function diasParaAmpliar() {
  const brecha = diasDesde(estado.diagnostico && estado.diagnostico.registroMasReciente);
  return Math.min(brecha + (estado.diasPorDefecto || 14), 120);
}

/**
 * Días entre una fecha ISO y hoy.
 * Se calcula en UTC a propósito: en Chile el cambio de hora de septiembre hace
 * que dos fechas separadas por 16 días disten 15 días y 23 horas, y redondear
 * hacia abajo se comería un día justo en el borde de la ventana del censo.
 */
function diasDesde(iso) {
  if (!iso) return 0;
  const p = String(iso).split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return 0;
  const h = new Date();
  const dif = Date.UTC(h.getFullYear(), h.getMonth(), h.getDate()) - Date.UTC(p[0], p[1] - 1, p[2]);
  return Math.max(0, Math.round(dif / 86400000));
}

/** "2026-05-28" -> "28 de mayo". Sin año: la planilla no lo guarda. */
function fechaCorta(iso) {
  if (!iso) return '';
  const p = String(iso).split('-');
  const m = parseInt(p[1], 10);
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio',
                 'agosto','septiembre','octubre','noviembre','diciembre'];
  return (meses[m - 1]) ? `${parseInt(p[2], 10)} de ${meses[m - 1]}` : '';
}

/* Servicios plegados por ella. Por teléfono: es una comodidad, no un dato. */
const plegados = {
  leer() {
    try { return new Set(JSON.parse(localStorage.getItem('plegados') || '[]')); } catch (e) { return new Set(); }
  },
  alternar(servicio) {
    const s = this.leer();
    if (s.has(servicio)) s.delete(servicio); else s.add(servicio);
    try { localStorage.setItem('plegados', JSON.stringify([...s])); } catch (e) { /* sin almacenamiento */ }
  }
};

function pintarRonda() {
  pintarEstadoLista();
  const cont = document.getElementById('lista');
  const reg = registradosHoy();
  const lista = pacientesFiltrados();

  // Progreso: solo sobre el censo real, no sobre el resultado de una búsqueda.
  // Los de un servicio que solo cubre (UTI algunos días) no cuentan como
  // pendientes: si no, la barra no llegaría nunca al 100% los otros días.
  const propios = estado.censo.filter(p => !p.cubierto || reg.has(normRut(p.rut)));
  const total = propios.length;
  const hechos = propios.filter(p => reg.has(normRut(p.rut))).length;
  const pct = total ? Math.round(hechos * 100 / total) : 0;

  document.getElementById('progresoTexto').innerHTML =
    `<strong>${hechos} de ${total}</strong> registrados`;
  document.getElementById('progresoPct').textContent = total ? pct + '%' : '—';
  document.getElementById('progresoRelleno').style.width = pct + '%';

  // Con la ventana ampliada pueden aparecer pacientes ya dados de alta sin que
  // nadie lo registrara. Conviene decirlo antes de que los dé por activos, y
  // dar la salida a la vista normal en el mismo lugar.
  const avisoVentana = (estado.ventana && !estado.busqueda) ? `
    <div class="banda info" style="margin-bottom:12px">
      Viendo desde el <strong>${esc(fechaCorta(estado.ventana.desde))}</strong>, no solo los
      últimos ${estado.diasPorDefecto} días.
      <span class="meta">Algunos pueden haber egresado ya. Registra a los que sigan
      hospitalizados; esta vista se mantiene hasta el ${esc(fechaCorta(estado.ventana.vence))}.</span>
      <button class="btn-bloque" id="ventanaNormal">Volver a los últimos ${estado.diasPorDefecto} días</button>
    </div>` : '';

  if (!lista.length) {
    cont.innerHTML = avisoVentana + `<div class="vacio">${ICO.cama}${
      estado.busqueda ? '<p>Sin resultados para esa búsqueda.</p>' : motivoRondaVacia()}</div>`;
    document.getElementById('bloqueEgresos').classList.add('oculto');

    const amp = document.getElementById('ampliarCenso');
    if (amp) amp.addEventListener('click', () => {
      amp.disabled = true;
      amp.textContent = 'Buscando…';
      ampliarVentana(diasParaAmpliar());
    });
    conectarVentanaNormal(cont);
    return;
  }

  // Agrupado por servicio; dentro de cada grupo, camas en orden numérico.
  const grupos = new Map();
  for (const p of lista) {
    const k = String(p.servicio || '—').trim().toUpperCase();
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(p);
  }
  for (const arr of grupos.values()) {
    arr.sort((a, b) => (parseInt(a.cama, 10) || 0) - (parseInt(b.cama, 10) || 0));
  }

  // Primero los servicios con pacientes propios; al final los que solo cubre,
  // para que los días que no va a UTI su lista de siempre quede arriba.
  const soloCubierto = (arr) => arr.every(p => p.cubierto && !reg.has(normRut(p.rut)));
  const ordenados = [...grupos.entries()].sort((a, b) => {
    const c = soloCubierto(a[1]) - soloCubierto(b[1]);
    if (c !== 0) return c;
    const d = ordenServicio(a[0]) - ordenServicio(b[0]);
    return d !== 0 ? d : a[0].localeCompare(b[0]);
  });

  const cerrados = estado.busqueda ? new Set() : plegados.leer();
  let html = avisoVentana;
  for (const [servicio, pacientes] of ordenados) {
    const info = servicioInfo(servicio);
    const cerrado = cerrados.has(servicio);
    const cubre = soloCubierto(pacientes);
    html += `<button class="grupo-titulo${cerrado ? ' cerrado' : ''}" data-grupo="${esc(servicio)}"
                     aria-expanded="${cerrado ? 'false' : 'true'}">
        <span class="grupo-punto" style="background:${info.color}"></span>
        <span class="grupo-nombre">${esc(servicio)}${info.nombre ? ' · ' + esc(info.nombre) : ''}</span>
        ${cubre ? '<span class="grupo-etiqueta">Cubres</span>' : ''}
        <span class="grupo-conteo">${pacientes.length} ${pacientes.length === 1 ? 'paciente' : 'pacientes'}</span>
        <span class="grupo-flecha">${ICO.flecha}</span>
      </button>`;
    html += `<div class="grupo-cuerpo${cerrado ? ' oculto' : ''}">${
      pacientes.map(p => tarjeta(p, reg, info)).join('')}</div>`;
  }
  // La ventana de 14 días deja fuera a quien no se registró en dos semanas.
  // Antes la única salida aparecía con la ronda vacía.
  if (!estado.ventana && !estado.busqueda) {
    html += `<button class="enlace-mas" id="verMasDias">¿Falta alguien? Ver los últimos 30 días</button>`;
  }
  cont.innerHTML = html;

  const mas = document.getElementById('verMasDias');
  if (mas) mas.addEventListener('click', () => {
    mas.disabled = true;
    mas.textContent = 'Buscando…';
    ampliarVentana(30);
  });

  cont.querySelectorAll('[data-rut]').forEach(el => {
    el.addEventListener('click', () => abrirSesion(el.dataset.rut));
  });
  // Tocar el título de un servicio lo pliega: útil para esconder UTI los días
  // que no le toca, sin sacarla de la configuración.
  cont.querySelectorAll('[data-grupo]').forEach(el => {
    el.addEventListener('click', () => {
      // Durante una búsqueda los grupos se muestran abiertos: plegar sin que se
      // note escondería a los pendientes al volver a la lista completa.
      if (estado.busqueda) return;
      plegados.alternar(el.dataset.grupo);
      pintarRonda();
    });
  });
  conectarVentanaNormal(cont);

  // Egresos recuperables
  const bloque = document.getElementById('bloqueEgresos');
  if (estado.egresos.length && !estado.busqueda) {
    bloque.classList.remove('oculto');
    document.getElementById('egresosTexto').textContent = `Egresos recientes (${estado.egresos.length})`;
  } else {
    bloque.classList.add('oculto');
  }
}

function conectarVentanaNormal(cont) {
  const btn = cont.querySelector('#ventanaNormal');
  if (btn) btn.addEventListener('click', () => {
    btn.disabled = true;
    btn.textContent = 'Volviendo…';
    volverVentanaNormal();
  });
}

function tarjeta(p, reg, info) {
  const hecho = reg.has(normRut(p.rut));
  const limite = diasSugeridos(p.categorizacion);
  const atrasado = !hecho && p.diasSinAtencion > limite;
  const esEgreso = !!p.motivoEgreso;

  const detalle = [p.diagnostico1, p.rem1 ? 'REM ' + p.rem1 : '', p.ges ? 'GES ' + p.ges : '']
    .filter(Boolean).join(' · ');

  // Si la última atención la registró una colega, se dice quién: es lo que
  // explica que un paciente de UTI aparezca aunque ella no lo haya visto.
  const otra = !hecho && p.fono && estado.config && p.fono !== estado.config.fono;
  const quien = otra
    ? `Última atención: ${p.fono}${p.ultimaFecha ? ', ' + fechaCorta(p.ultimaFecha) : ''}` : '';

  return `<button class="tarjeta${atrasado ? ' alerta' : ''}${esEgreso ? ' egresado' : ''}" data-rut="${esc(p.rut)}">
      <span class="cama" style="background:${info.color}">${esc(p.cama)}</span>
      <span class="tarjeta-cuerpo">
        <span class="tarjeta-nombre">${esc(p.nombre)}</span>
        <span class="tarjeta-detalle">${esc(detalle)}</span>
        ${quien ? `<span class="tarjeta-detalle">${esc(quien)}</span>` : ''}
        ${atrasado ? `<span class="tarjeta-aviso">${ICO.alerta} ${p.diasSinAtencion} días sin atención</span>` : ''}
        ${esEgreso ? `<span class="tarjeta-detalle">Egresado · ${esc(p.motivoEgreso)}</span>` : ''}
      </span>
      <span class="tarjeta-estado ${hecho ? 'estado-ok' : 'estado-pend'}">
        ${hecho ? ICO.check : ICO.circulo}
      </span>
    </button>`;
}

/* ══════════════════════════════════════════════════════════════
   BUSCADOR
   ══════════════════════════════════════════════════════════════ */
function alternarBuscador(abrir) {
  estado.buscadorAbierto = abrir;
  document.getElementById('buscadorCerrado').classList.toggle('oculto', abrir);
  document.getElementById('buscadorAbierto').classList.toggle('oculto', !abrir);
  if (abrir) {
    document.getElementById('inputBuscar').focus();
  } else {
    estado.busqueda = '';
    document.getElementById('inputBuscar').value = '';
    pintarRonda();
  }
}

/* ══════════════════════════════════════════════════════════════
   ARRANQUE
   ══════════════════════════════════════════════════════════════ */
async function iniciar() {
  await DB.abrir();

  // Una recarga conserva el estado del historial: si quedó la marca de una
  // pantalla abierta, cerrarPantalla volvería atrás sobre la lista.
  if (history.state && history.state.pantalla) history.replaceState(null, '');

  // Lo que la versión anterior guardó del dashboard no sirve: pudo quedar un mes
  // guardado con las cifras de otro, un mes calculado antes de terminar o las
  // alertas con nombres de pacientes. Se borra una vez y se vuelve a calcular.
  try {
    if (localStorage.getItem('cacheVer') !== '2') {
      cache.limpiar();
      localStorage.setItem('cacheVer', '2');
    }
  } catch (e) { /* sin almacenamiento: no hay nada guardado */ }

  // Pide al navegador que no borre los datos por falta de espacio.
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch (e) { /* no crítico */ }
  }

  estado.config = await DB.get('config', 'app');
  // En el orden en que se registraron: la base los devuelve ordenados por uuid,
  // que es azar, y un egreso podía llegar a la planilla antes que la sesión del
  // mismo día y dejar al paciente de vuelta en la ronda.
  estado.outbox = (await DB.todos('outbox')).sort((a, b) => (a.creado || 0) - (b.creado || 0));
  estado.censo  = await DB.todos('censo');

  const guardado = await DB.get('config', 'cache');
  if (guardado) {
    estado.egresos     = guardado.egresos || [];
    estado.catalogos   = guardado.catalogos || estado.catalogos;
    estado.diagnostico = guardado.diagnostico || null;
    estado.diasCenso     = guardado.diasCenso || estado.diasCenso;
    estado.diasPorDefecto = guardado.diasPorDefecto || estado.diasPorDefecto;
    estado.ventana     = guardado.ventana || null;
    // La versión anterior solo guardaba la hora del servidor.
    estado.actualizado = guardado.actualizado || Date.parse(guardado.generado || '') || 0;
  }

  const tema = await DB.get('config', 'tema');
  if (tema) document.documentElement.dataset.tema = tema;

  if (!estado.config || !estado.config.url || !estado.config.token) {
    mostrarConfiguracion();
    return;
  }

  // Configuraciones anteriores no tenían servicios cubiertos. La usuaria cubre
  // UTI una o dos veces por semana: queda marcada para que sus pacientes
  // aparezcan sin pasar por la configuración. Se cambia desde el engranaje.
  if (!Array.isArray(estado.config.servicios)) {
    estado.config.servicios = ['UTI'];
    await DB.guardar('config', estado.config, 'app');
  }

  // La versión anterior, al guardar la configuración, dejaba en memoria el
  // nombre de la profesional vacío hasta cerrar la app. Lo registrado en ese
  // rato la planilla lo rechazaba ("Faltan campos obligatorios: Fonoaudiólogo/a")
  // y quedaba en el teléfono para siempre. Todo lo de este teléfono es suyo.
  for (const s of estado.outbox) {
    if (!String(s['fonoaudiólogo'] || '').trim() && estado.config.fono) {
      s['fonoaudiólogo'] = estado.config.fono;
      delete s.error;
      await DB.guardar('outbox', s);
    }
  }

  mostrarApp();
  pintar();
  // Sin descarga automática al abrir: la lista cambia solo cuando ella toca
  // actualizar. Lo único que se hace solo es intentar enviar lo pendiente.
  if (estado.outbox.some(s => !s.error)) Sync.enSegundoPlano();
}

// La conexión solo cambia lo que dice la píldora; no dispara descargas.
window.addEventListener('online',  () => { estado.enLinea = true;  pintarEstadoSync(); });
window.addEventListener('offline', () => { estado.enLinea = false; pintarEstadoSync(); });
// Al volver a la app se repinta: si quedó abierta desde ayer, la fecha y los
// "registrado hoy" tienen que ser los de hoy.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !estado.config || document.getElementById('app').classList.contains('oculto')) return;
  pintarFecha();
  pintar();
  // "Calculado hoy" también puede haber quedado de ayer.
  if (estado.vista === 'dashboard') pintarDashboard();
  else if (estado.vista === 'informes') pintarInformes();
});

window.addEventListener('DOMContentLoaded', () => {
  iniciar().catch(err => {
    document.body.innerHTML =
      `<div class="centrado"><h1>No se pudo iniciar</h1><p>${esc(err.message)}</p></div>`;
  });
});
