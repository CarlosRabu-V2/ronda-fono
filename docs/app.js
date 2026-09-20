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
   Se guarda lo ya calculado y se muestra al instante; si está viejo, se
   refresca por detrás sin tapar la pantalla.

   Solo guarda cifras agregadas. La nómina de pacientes NO se cachea: se pide
   en el momento de generar el PDF y se descarta al terminar.
   ══════════════════════════════════════════════════════════════ */

const FRESCO_MS = 10 * 60 * 1000;   // pasados 10 minutos se considera viejo

const cache = {
  leer(clave) {
    try {
      const raw = localStorage.getItem('cache:' + clave);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return (o && o.t && o.d) ? { datos: o.d, cuando: o.t } : null;
    } catch (e) { return null; }      // modo privado o dato corrupto
  },
  escribir(clave, datos) {
    try {
      localStorage.setItem('cache:' + clave, JSON.stringify({ d: datos, t: Date.now() }));
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

/** "recién", "hace 5 min", "hace 2 h". */
function hace(t) {
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60)    return 'recién';
  if (s < 3600)  return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
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
const esc = (t) => { const d = document.createElement('div'); d.textContent = t ?? ''; return d.innerHTML; };

/** RUT ya registrados hoy, sea porque están en la bandeja o porque el censo los trae. */
function registradosHoy() {
  const hoy = hoyISO();
  const set = new Set();
  estado.outbox.forEach(s => { if (s.fecha === hoy && s.tipo === 'sesion') set.add(normRut(s.rut)); });
  estado.censo.forEach(p => { if (p.ultimaFecha === hoy) set.add(normRut(p.rut)); });
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
   API
   ══════════════════════════════════════════════════════════════ */
const API = {
  async censo(dias) {
    const { url, token, fono } = estado.config;
    const q = `${url}?api=censo&token=${encodeURIComponent(token)}&fono=${encodeURIComponent(fono || '')}` +
              (dias ? `&dias=${encodeURIComponent(dias)}` : '');
    const r = await fetch(q, { method: 'GET', redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'El servidor rechazó la petición.');
    return j;
  },

  async enviar(sesiones) {
    const { url, token } = estado.config;
    // text/plain a propósito: application/json dispara una petición previa
    // OPTIONS que Apps Script no sabe responder.
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, accion: 'sesiones', sesiones })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'El servidor rechazó el envío.');
    return j;
  },

  /** Limpia las marcas de egreso de una fila ya escrita, ubicada por su uuid. */
  async anular(uuidEgreso) {
    const { url, token } = estado.config;
    const r = await fetch(url, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token, accion: 'anular', uuid: uuidEgreso })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || 'No se pudo anular.');
    return j;
  },

  async ping(url, token) {
    const r = await fetch(`${url}?api=ping&token=${encodeURIComponent(token)}`, { redirect: 'follow' });
    return r.json();
  }
};

/* ══════════════════════════════════════════════════════════════
   SINCRONIZACIÓN
   Nada se borra del teléfono hasta que el servidor confirma el uuid.
   ══════════════════════════════════════════════════════════════ */
const Sync = {
  enCurso: false,

  async intentar({ silencioso = true } = {}) {
    if (this.enCurso || !navigator.onLine) return;
    const pendientes = estado.outbox.filter(s => !s.enviada);
    if (!pendientes.length) {
      if (!silencioso) toast('No hay nada pendiente.', 'info');
      return;
    }

    this.enCurso = true;
    pintarEstadoSync();

    try {
      const res = await API.enviar(pendientes.map(limpiarParaEnvio));

      // Guardadas y duplicadas salen de la bandeja por igual: en ambos casos
      // la fila ya está escrita en la planilla.
      const confirmados = new Set([...(res.guardadas || []), ...(res.duplicadas || [])]);
      for (const id of confirmados) {
        await DB.borrar('outbox', id);
      }
      estado.outbox = estado.outbox.filter(s => !confirmados.has(s.uuid));

      if (res.errores && res.errores.length) {
        // Se quedan en la bandeja con el motivo a la vista, no se pierden.
        for (const e of res.errores) {
          const s = estado.outbox.find(x => x.uuid === e.uuid);
          if (s) { s.error = e.msg; await DB.guardar('outbox', s); }
        }
        toast(`${confirmados.size} guardadas, ${res.errores.length} con error`, 'error');
      } else if (!silencioso || confirmados.size) {
        toast(`${confirmados.size} ${confirmados.size === 1 ? 'sesión sincronizada' : 'sesiones sincronizadas'}`, 'ok');
      }

      if (confirmados.size) await refrescarCenso({ silencioso: true });

    } catch (err) {
      if (!silencioso) toast('No se pudo sincronizar: ' + err.message, 'error');
    } finally {
      this.enCurso = false;
      pintar();
    }
  }
};

/** Quita los campos internos que el servidor no necesita. */
function limpiarParaEnvio(s) {
  const { enviada, error, tipo, ...resto } = s;
  return resto;
}

async function encolar(sesion) {
  sesion.uuid = sesion.uuid || uuid();
  await DB.guardar('outbox', sesion);
  estado.outbox.push(sesion);
  pintar();
  Sync.intentar();
}

/* ══════════════════════════════════════════════════════════════
   CENSO
   ══════════════════════════════════════════════════════════════ */
async function refrescarCenso({ silencioso = false, dias = 0 } = {}) {
  if (!navigator.onLine) {
    if (!silencioso) toast('Sin conexión. Se usa el censo guardado.', 'info');
    return;
  }
  try {
    const j = await API.censo(dias);
    estado.censo = j.pacientes || [];
    estado.egresos = j.egresos || [];
    estado.catalogos = j.catalogos || estado.catalogos;
    estado.diagnostico = j.diagnostico || null;
    if (j.diasCenso) estado.diasCenso = j.diasCenso;
    if (j.diasPorDefecto) estado.diasPorDefecto = j.diasPorDefecto;
    await DB.reemplazar('censo', estado.censo);
    await DB.guardar('config', {
      egresos: estado.egresos,
      catalogos: estado.catalogos,
      diagnostico: estado.diagnostico,
      diasCenso: estado.diasCenso,
      diasPorDefecto: estado.diasPorDefecto,
      generado: j.generado
    }, 'cache');
    if (!silencioso) {
      toast(dias ? `${estado.censo.length} pacientes en los últimos ${dias} días`
                 : `Censo al día: ${estado.censo.length} pacientes`, 'ok');
    }
  } catch (err) {
    if (!silencioso) toast('No se pudo actualizar: ' + err.message, 'error');
  }
  pintar();
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
  toastTimer = setTimeout(() => { t.className = 'toast ' + tipo; }, 3200);
}

/* ══════════════════════════════════════════════════════════════
   PINTADO — barra superior
   ══════════════════════════════════════════════════════════════ */
function pintarEstadoSync() {
  const el = document.getElementById('pillSync');
  const pend = estado.outbox.filter(s => !s.enviada).length;

  if (Sync.enCurso) {
    el.className = 'pill sync-off';
    el.innerHTML = 'Sincronizando…';
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
              FONOAUDIÓLOGA: revísalo en Configuración.</p>`;
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
              Ver los últimos ${brecha + 1} días
            </button>
            <p class="meta" style="margin-top:8px">Por si alguno sigue hospitalizado
              y no quieres volver a escribirlo.</p>` : `
            <p class="meta">Usa <strong>Ingreso</strong> para agregar el primer paciente de hoy.</p>`}`;
}

const fmtMil = (n) => Number(n || 0).toLocaleString('es-CL');

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

function pintarRonda() {
  const cont = document.getElementById('lista');
  const reg = registradosHoy();
  const lista = pacientesFiltrados();

  // Progreso: solo sobre el censo real, no sobre el resultado de una búsqueda.
  const total = estado.censo.length;
  const hechos = estado.censo.filter(p => reg.has(normRut(p.rut))).length;
  const pct = total ? Math.round(hechos * 100 / total) : 0;

  document.getElementById('progresoTexto').innerHTML =
    `<strong>${hechos} de ${total}</strong> registrados`;
  document.getElementById('progresoPct').textContent = total ? pct + '%' : '—';
  document.getElementById('progresoRelleno').style.width = pct + '%';

  if (!lista.length) {
    cont.innerHTML = `<div class="vacio">${ICO.cama}${
      estado.busqueda ? '<p>Sin resultados para esa búsqueda.</p>' : motivoRondaVacia()}</div>`;
    document.getElementById('bloqueEgresos').classList.add('oculto');

    const amp = document.getElementById('ampliarCenso');
    if (amp) amp.addEventListener('click', () => {
      const d = diasDesde(estado.diagnostico && estado.diagnostico.registroMasReciente) + 1;
      amp.disabled = true;
      amp.textContent = 'Buscando…';
      refrescarCenso({ dias: d });
    });
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

  // Con la ventana ampliada pueden aparecer pacientes ya dados de alta sin que
  // nadie lo registrara. Conviene decirlo antes de que los dé por activos.
  let html = (estado.diasCenso > estado.diasPorDefecto) ? `
    <div class="banda info" style="margin-bottom:12px">
      Viendo los últimos <strong>${estado.diasCenso} días</strong>, no los
      ${estado.diasPorDefecto} habituales.
      <span class="meta">Algunos pueden haber egresado ya. Registra una sesión a los
      que sigan hospitalizados y vuelve a la vista normal con el botón de recargar.</span>
    </div>` : '';

  const ordenados = [...grupos.entries()].sort((a, b) => {
    const d = ordenServicio(a[0]) - ordenServicio(b[0]);
    return d !== 0 ? d : a[0].localeCompare(b[0]);
  });

  for (const [servicio, pacientes] of ordenados) {
    const info = servicioInfo(servicio);
    html += `<div class="grupo-titulo">
        <span class="grupo-punto" style="background:${info.color}"></span>
        <span>${esc(servicio)}${info.nombre ? ' · ' + esc(info.nombre) : ''}</span>
        <span class="grupo-conteo">${pacientes.length} ${pacientes.length === 1 ? 'paciente' : 'pacientes'}</span>
      </div>`;
    html += pacientes.map(p => tarjeta(p, reg, info)).join('');
  }
  cont.innerHTML = html;

  cont.querySelectorAll('[data-rut]').forEach(el => {
    el.addEventListener('click', () => abrirSesion(el.dataset.rut));
  });

  // Egresos recuperables
  const bloque = document.getElementById('bloqueEgresos');
  if (estado.egresos.length && !estado.busqueda) {
    bloque.classList.remove('oculto');
    document.getElementById('egresosTexto').textContent = `Egresos recientes (${estado.egresos.length})`;
  } else {
    bloque.classList.add('oculto');
  }
}

function tarjeta(p, reg, info) {
  const hecho = reg.has(normRut(p.rut));
  const limite = diasSugeridos(p.categorizacion);
  const atrasado = !hecho && p.diasSinAtencion > limite;
  const esEgreso = !!p.motivoEgreso;

  const detalle = [p.diagnostico1, p.rem1 ? 'REM ' + p.rem1 : '', p.ges ? 'GES ' + p.ges : '']
    .filter(Boolean).join(' · ');

  return `<button class="tarjeta${atrasado ? ' alerta' : ''}${esEgreso ? ' egresado' : ''}" data-rut="${esc(p.rut)}">
      <span class="cama" style="background:${info.color}">${esc(p.cama)}</span>
      <span class="tarjeta-cuerpo">
        <span class="tarjeta-nombre">${esc(p.nombre)}</span>
        <span class="tarjeta-detalle">${esc(detalle)}</span>
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

  // Pide al navegador que no borre los datos por falta de espacio.
  if (navigator.storage && navigator.storage.persist) {
    try { await navigator.storage.persist(); } catch (e) { /* no crítico */ }
  }

  estado.config = await DB.get('config', 'app');
  estado.outbox = await DB.todos('outbox');
  estado.censo  = await DB.todos('censo');

  const guardado = await DB.get('config', 'cache');
  if (guardado) {
    estado.egresos     = guardado.egresos || [];
    estado.catalogos   = guardado.catalogos || estado.catalogos;
    estado.diagnostico = guardado.diagnostico || null;
    estado.diasCenso     = guardado.diasCenso || estado.diasCenso;
    estado.diasPorDefecto = guardado.diasPorDefecto || estado.diasPorDefecto;
  }

  const tema = await DB.get('config', 'tema');
  if (tema) document.documentElement.dataset.tema = tema;

  if (!estado.config || !estado.config.url || !estado.config.token) {
    mostrarConfiguracion();
    return;
  }

  mostrarApp();
  pintar();
  refrescarCenso({ silencioso: estado.censo.length > 0 });
}

window.addEventListener('online',  () => { estado.enLinea = true;  pintarEstadoSync(); Sync.intentar(); });
window.addEventListener('offline', () => { estado.enLinea = false; pintarEstadoSync(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) Sync.intentar(); });

window.addEventListener('DOMContentLoaded', () => {
  iniciar().catch(err => {
    document.body.innerHTML =
      `<div class="centrado"><h1>No se pudo iniciar</h1><p>${esc(err.message)}</p></div>`;
  });
});
