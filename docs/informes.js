/* ══════════════════════════════════════════════════════════════
   VISTA 3 — INFORMES
   El PDF lo genera el propio teléfono con la función de impresión del
   navegador. Sin librerías, sin servidor y sin que los datos salgan del
   dispositivo. El único que sale es el resumen, y va sin identificar.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const inf = {
  mes: null,
  datos: null,      // dashboard del mes
  cuando: 0,
  error: null,
  enviando: false,
  nomina: null,     // se pide solo al generar el PDF; nunca se guarda
  resumen: '',
  incluirResumen: true,
  generando: false,
  secciones: { rem28: true, rem17: true, produccion: true, nomina: true }
};

const SECCIONES = [
  ['rem28',      'REM 28',              'Ingresos, egresos, evaluaciones y procedimientos'],
  ['rem17',      'REM 17',              'Prestaciones por código y tipo de atención'],
  ['produccion', 'Producción personal', 'Sesiones por servicio, brechas y su motivo'],
  ['nomina',     'Nómina de pacientes', 'Pacientes atendidos en el período']
];

API.nomina = function (mes, fono) {
  const { url, token } = estado.config;
  return pedirJSON(`${url}?api=nomina&token=${encodeURIComponent(token)}` +
                   `&mes=${encodeURIComponent(mes)}&fono=${encodeURIComponent(fono || '')}`,
                   { method: 'GET' });
};

API.resumen = function (mes, fono, anterior) {
  const { url, token } = estado.config;
  // Un solo intento: reintentar llamaría dos veces a Gemini por un mismo resumen.
  return pedirJSON(`${url}?api=resumen&token=${encodeURIComponent(token)}` +
                   `&mes=${encodeURIComponent(mes)}&fono=${encodeURIComponent(fono || '')}` +
                   `&anterior=${encodeURIComponent(anterior || '')}`,
                   { method: 'GET' }, { intentos: 1, espera: 90000 });
};

/* ── Entrada ──────────────────────────────────────────────── */

/** Igual que el dashboard: la cabecera con el selector de mes se arma una vez por visita. */
function abrirInformes() {
  if (!inf.mes) inf.mes = mesActual();
  const cont = document.getElementById('informes');

  cont.innerHTML = `
    <div class="barra">
      <div class="barra-fila">
        <div class="barra-titulo">
          <div class="eyebrow">Fonoaudiología · hospitalario</div>
          <h1>Informes</h1>
        </div>
        <button class="icon-btn" id="infRefrescar" aria-label="Actualizar">${ICO.volver}</button>
      </div>
      <div class="frescura oculto" id="infFrescura"></div>
      <div class="filtros">
        <label class="filtro">${ICO.cal}
          <select id="infMes" aria-label="Mes">${mesesDisponibles().map(([v, t]) =>
            `<option value="${v}" ${v === inf.mes ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        </label>
        <span class="filtro" style="flex:0 0 auto;padding:0 14px">${ICO.persona}
          <span style="font-size:13px">${esc(estado.config.fono || 'Todos')}</span>
        </span>
      </div>
    </div>
    <main style="padding-top:12px" id="infCuerpo"></main>`;

  document.getElementById('infMes').addEventListener('change', (e) => {
    inf.mes = e.target.value;
    inf.resumen = '';
    inf.nomina = null;
    mostrarMesInformes();
  });
  document.getElementById('infRefrescar').addEventListener('click', actualizarInformes);

  mostrarMesInformes();
}

/** Comparte lo guardado con el dashboard: son el mismo cálculo. */
function mostrarMesInformes() {
  const c = cacheDelMes(inf.mes);
  inf.datos  = c ? c.datos  : null;
  inf.cuando = c ? c.cuando : 0;
  inf.error  = null;
  pintarInformes();
  if (!c) cargarInformes();
}

async function actualizarInformes() {
  if (inf.enviando || Meses.cargando(inf.mes)) return;
  if (estado.outbox.some(s => !s.error)) {
    inf.enviando = true;
    pintarInformes();
    try { await Sync.enviar(); } catch (e) { /* sin red: la consulta lo dirá */ }
    inf.enviando = false;
  }
  inf.nomina = null;   // la nómina también puede haber cambiado
  cargarInformes();
}

async function cargarInformes() {
  const mes = inf.mes;
  const peticion = Meses.pedir(mes);
  inf.error = null;
  pintarInformes();
  try {
    const r = await peticion;
    if (inf.mes !== mes) return;
    inf.datos = r.datos;
    inf.cuando = r.cuando;
  } catch (err) {
    if (inf.mes !== mes) return;
    inf.error = err.message;
  }
  pintarInformes();
}

/* ── Pintado ──────────────────────────────────────────────── */

function pintarInformes() {
  const cuerpo = document.getElementById('infCuerpo');
  if (!cuerpo) return;

  const ocupado = inf.enviando || Meses.cargando(inf.mes);
  const btn = document.getElementById('infRefrescar');
  btn.classList.toggle('girando', ocupado);
  btn.setAttribute('aria-busy', ocupado ? 'true' : 'false');

  const fr = document.getElementById('infFrescura');
  if (!inf.datos) {
    fr.className = 'frescura oculto';
  } else if (ocupado) {
    fr.textContent = inf.enviando ? 'Enviando lo registrado…' : 'Actualizando…';
    fr.className = 'frescura';
  } else if (inf.error) {
    fr.textContent = `No se pudo actualizar: ${inf.error} Cifras de ${fechaHora(inf.cuando)}.`;
    fr.className = 'frescura alerta';
  } else {
    const f = frescuraMes(inf.mes, inf.cuando);
    fr.textContent = f.texto;
    fr.className = 'frescura' + (f.viejo ? ' alerta' : '');
  }

  if (!inf.datos) {
    cuerpo.innerHTML = inf.error
      ? `<div class="vacio">${ICO.doc}<p>No se pudo cargar ${esc(nombreMes(inf.mes))}: ${esc(inf.error)}</p>
           <p class="meta">Los informes se arman con los datos de la planilla. Toca ↻ para intentarlo de nuevo.</p></div>`
      : `<div class="cargando">Reuniendo los datos de ${esc(nombreMes(inf.mes))}…</div>`;
    return;
  }

  const seleccionadas = SECCIONES.filter(([k]) => inf.secciones[k]).length;

  cuerpo.innerHTML = `
    <div class="bloque-cab">
      <h2>Secciones del informe</h2>
      <span class="nota">${seleccionadas} de 4</span>
    </div>

    ${SECCIONES.map(([k, titulo, desc]) => `
      <button class="tarjeta-informe ${inf.secciones[k] ? 'activa' : ''}" data-seccion="${k}">
        <span class="ti-icono">${ICO.doc}</span>
        <span class="ti-cuerpo">
          <span class="ti-titulo">${esc(titulo)}</span>
          <span class="ti-desc">${esc(desc)}</span>
        </span>
        <span class="ti-check">${inf.secciones[k] ? ICO.check : ICO.circulo}</span>
      </button>`).join('')}

    <div class="seccion" style="margin-top:20px">
      <div class="seccion-titulo" style="display:flex;align-items:center;gap:6px">
        ${ICO.chispa} Resumen del mes
        <span style="margin-left:auto;font-size:10px;background:var(--primary-soft);color:var(--primary);padding:2px 8px;border-radius:999px">Asistente IA</span>
      </div>

      ${inf.resumen ? `
        <textarea id="infResumen" rows="8">${esc(inf.resumen)}</textarea>
        <div class="ayuda" style="display:flex;align-items:center;gap:5px;margin-top:8px">
          ${ICO.escudo} Generado con datos sin identificar
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-secundario" id="infRegenerar" ${inf.generando ? 'disabled' : ''}>${
            inf.generando ? 'Redactando…' : ICO.volver + ' Regenerar'}</button>
          <button class="btn ${inf.incluirResumen ? 'btn-primario' : 'btn-secundario'}" id="infIncluir">
            ${inf.incluirResumen ? ICO.check : ICO.circulo} ${inf.incluirResumen ? 'Incluido' : 'Excluido'}
          </button>
        </div>`
      : `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
          Redacta el párrafo narrativo que acompaña al REM. A Gemini viajan solo cifras
          agregadas: nunca nombres, RUT ni camas.
        </p>
        <button class="btn-bloque" id="infGenerar" ${inf.generando ? 'disabled' : ''}>${
          inf.generando ? 'Redactando…' : ICO.chispa + ' Generar resumen'}</button>`}
      <div id="infAvisoIA"></div>
    </div>

    <div class="acciones">
      <button class="btn btn-primario" id="infPdf" ${seleccionadas ? '' : 'disabled'}>
        ${ICO.doc} Descargar PDF${seleccionadas ? ` · ${seleccionadas} ${seleccionadas === 1 ? 'sección' : 'secciones'}` : ''}
      </button>
    </div>

    <p style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:4px">
      Se abre la ventana de impresión. Elige <strong>Guardar como PDF</strong> como destino.
    </p>`;

  conectarInformes();
}

function conectarInformes() {
  // El resumen se puede editar a mano: cada cambio queda en el estado, así
  // repintar por cualquier otro motivo no lo devuelve al texto original.
  const ta = document.getElementById('infResumen');
  if (ta) ta.addEventListener('input', () => { inf.resumen = ta.value; });

  document.querySelectorAll('#informes [data-seccion]').forEach(b => {
    b.addEventListener('click', () => {
      inf.secciones[b.dataset.seccion] = !inf.secciones[b.dataset.seccion];
      pintarInformes();
    });
  });

  const gen = document.getElementById('infGenerar');
  if (gen) gen.addEventListener('click', generarResumen);
  const regen = document.getElementById('infRegenerar');
  if (regen) regen.addEventListener('click', generarResumen);

  const incl = document.getElementById('infIncluir');
  if (incl) incl.addEventListener('click', () => {
    inf.incluirResumen = !inf.incluirResumen;
    pintarInformes();
  });

  const pdf = document.getElementById('infPdf');
  if (pdf) pdf.addEventListener('click', descargarPdf);
}

async function generarResumen() {
  if (inf.generando) return;
  const mes = inf.mes;
  inf.generando = true;
  pintarInformes();

  // El mes anterior, para que el resumen pueda comparar.
  const [a, m] = mes.split('-').map(Number);
  const prev = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;

  let error = null;
  try {
    const r = await API.resumen(mes, estado.config.fono, prev);
    // Si mientras redactaba eligió otro mes, este resumen ya no corresponde.
    if (inf.mes === mes) {
      inf.resumen = r.resumen;
      inf.incluirResumen = true;
    }
  } catch (err) {
    error = err.message;
  }
  inf.generando = false;
  // Se repinta igual si cambió de mes: el botón quedaría en "Redactando…".
  pintarInformes();
  if (inf.mes !== mes) return;
  if (error) {
    const aviso = document.getElementById('infAvisoIA');
    if (aviso) aviso.innerHTML = `<div class="banda warn" style="margin-top:12px">${esc(error)}</div>`;
  } else {
    toast('Resumen generado. Revísalo antes de incluirlo.', 'ok');
  }
}

/* ══════════════════════════════════════════════════════════════
   GENERACIÓN DEL PDF
   ══════════════════════════════════════════════════════════════ */

async function descargarPdf() {
  if (document.getElementById('infResumen')) {
    inf.resumen = document.getElementById('infResumen').value;
  }
  const mes = inf.mes;

  // La nómina lleva nombres y RUT, así que se pide en este momento y solo si
  // va incluida. No se guarda en el teléfono: vive lo que dura el PDF.
  if (inf.secciones.nomina && !inf.nomina) {
    const btn = document.getElementById('infPdf');
    if (btn) { btn.disabled = true; btn.textContent = 'Reuniendo la nómina…'; }
    try {
      const n = await API.nomina(mes, estado.config.fono);
      if (inf.mes !== mes) return;     // cambió de mes mientras esperaba
      inf.nomina = n;
    } catch (err) {
      pintarInformes();
      toast('No se pudo obtener la nómina: ' + err.message, 'error');
      return;
    }
    pintarInformes();
  }

  document.getElementById('impresion').innerHTML = armarInforme();
  // El navegador necesita un instante para maquetar antes de medir las páginas.
  requestAnimationFrame(() => setTimeout(() => window.print(), 60));
}

function armarInforme() {
  const d = inf.datos;
  const hoy = new Date();
  const fecha = `${hoy.getDate()} de ${MESES_ES[hoy.getMonth()]} de ${hoy.getFullYear()}`;
  const periodo = mesesDisponibles().find(([v]) => v === inf.mes);

  let html = `
    <div class="pr-cab">
      <h1>Informe de actividad fonoaudiológica</h1>
      <p>${esc(periodo ? periodo[1] : inf.mes)} · ${esc(estado.config.fono || 'Todos los profesionales')}</p>
      <p class="pr-meta">Generado el ${esc(fecha)} · ${fmt(d.filas)} registros · ${fmt(d.resumen.pacientes)} pacientes distintos</p>
    </div>`;

  if (inf.resumen && inf.incluirResumen) {
    html += `<div class="pr-bloque pr-resumen">
        <h2>Resumen del período</h2>
        <p>${esc(inf.resumen).replace(/\n+/g, '</p><p>')}</p>
        <p class="pr-nota">Redactado con asistencia de IA sobre cifras agregadas sin identificar, y revisado por el profesional.</p>
      </div>`;
  }

  if (inf.secciones.rem28)      html += seccionRem28(d);
  if (inf.secciones.rem17)      html += seccionRem17(d);
  if (inf.secciones.produccion) html += seccionProduccion(d);
  if (inf.secciones.nomina)     html += seccionNomina(inf.nomina);

  return html;
}

/**
 * @param {number[]} [numericas] Índices de las columnas que llevan cifras y van
 *   alineadas a la derecha. Sin este parámetro se asume que todas menos la
 *   primera lo son, que es lo habitual; la nómina sí lo necesita porque mezcla
 *   varias columnas de texto.
 */
function tablaPr(titulo, cabeceras, filas, anchos, numericas) {
  if (!filas.length) return '';
  const esNum = (i) => numericas ? numericas.indexOf(i) !== -1 : i > 0;
  const cols = anchos ? `<colgroup>${anchos.map(w => `<col style="width:${w}">`).join('')}</colgroup>` : '';
  return `<h3>${esc(titulo)}</h3>
    <table class="pr-tabla">${cols}
      <thead><tr>${cabeceras.map((h, i) =>
        `<th${esNum(i) ? ' class="num"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${filas.map(f => `<tr${f.total ? ' class="tot"' : ''}>${
        f.celdas.map((c, i) => `<td${esNum(i) ? ' class="num"' : ''}>${
          (c === 0 && esNum(i)) ? '—' : esc(String(c))}</td>`).join('')
      }</tr>`).join('')}</tbody>
    </table>`;
}

function seccionRem28(d) {
  const ing = d.ingresos;
  const filasIng = ing.orden.filter(c => ing.categorias[c]).map(c => {
    const x = ing.categorias[c];
    return { celdas: [c, x.total, x.hombres, x.mujeres, x.abierta, x.upc, x.medios] };
  });
  const t = ing.total;
  filasIng.push({ total: true, celdas: ['Total', t.total, t.hombres, t.mujeres, t.abierta, t.upc, t.medios] });

  const filasEg = d.egresos.orden.filter(m => d.egresos.motivos[m] && d.egresos.motivos[m].total)
    .map(m => {
      const x = d.egresos.motivos[m];
      return { celdas: [m, x.total, x.hombres, x.mujeres, x.abierta, x.upc, x.medios] };
    });
  const te = d.egresos.total;
  if (filasEg.length) filasEg.push({ total: true, celdas: ['Total', te.total, te.hombres, te.mujeres, te.abierta, te.upc, te.medios] });

  const p = d.profesional;
  const filasProf = [
    ['B.2 Evaluación inicial', p.inicial],
    ['B.3 Evaluación intermedia', p.intermedia],
    ['B.4 Sesiones de rehabilitación', p.sesiones]
  ].map(([n, x]) => ({ celdas: [n, x.total, x.abierta, x.upc, x.medios] }));

  const filasDeriv = Object.keys(d.derivaciones)
    .filter(k => d.derivaciones[k])
    .map(k => ({ celdas: [k, d.derivaciones[k]] }));

  const filasProc = Object.keys(d.procedimientos)
    .map(k => ({ celdas: [k, d.procedimientos[k]] }));

  const anchoAmplio = ['34%','11%','11%','11%','11%','11%','11%'];

  return `<div class="pr-bloque">
      <h2>REM 28 · Rehabilitación integral</h2>
      ${tablaPr('B.1 Ingresos por categoría diagnóstica',
        ['Categoría','Total','Hombres','Mujeres','Abierta','UPC','C. medios'], filasIng, anchoAmplio)}
      ${ing.sinRem ? `<p class="pr-alerta">${ing.sinRem} ingresos quedaron fuera por no tener código REM válido.</p>` : ''}
      ${tablaPr('B.1 Egresos por motivo',
        ['Motivo','Total','Hombres','Mujeres','Abierta','UPC','C. medios'], filasEg, anchoAmplio)}
      ${tablaPr('B.2 a B.4 · Actividad del profesional',
        ['Sección','Total','Abierta','UPC','C. medios'], filasProf, ['44%','14%','14%','14%','14%'])}
      ${tablaPr('B.5 Derivaciones', ['Destino','Total'], filasDeriv, ['70%','30%'])}
      ${tablaPr('B.6 Procedimientos y actividades', ['Tipo','Total'], filasProc, ['70%','30%'])}
    </div>`;
}

function seccionRem17(d) {
  const filas = d.rem17.map(p => ({
    celdas: [p.codigo, p.nombre, p.total, p.cerrada, p.abierta, p.urgencia]
  }));
  let html = `<div class="pr-bloque">
      <h2>REM 17 · Prestaciones</h2>
      ${tablaPr('Prestaciones del período',
        ['Código','Prestación','Total','Cerrada','Abierta','Urgencia'], filas,
        ['13%','37%','12.5%','12.5%','12.5%','12.5%'])}`;

  if (d.sinAsignar.length) {
    html += `<p class="pr-alerta"><strong>Sin destino asignado en el REM:</strong> ` +
      d.sinAsignar.map(s => `${esc(s.etiqueta)} (${fmt(s.total)})`).join('; ') +
      `. Estas cantidades no están incluidas en la tabla anterior.</p>`;
  }
  return html + `</div>`;
}

function seccionProduccion(d) {
  const r = d.resumen;
  const filasResumen = [
    ['Pacientes distintos atendidos', r.pacientes],
    ['Ingresos', r.ingresos],
    ['Egresos', r.egresos],
    ['Evaluaciones iniciales', r.iniciales],
    ['Evaluaciones intermedias', r.intermedias],
    ['Sesiones de rehabilitación', r.sesiones],
    ['Brechas', r.brechas],
    ['Atenciones suspendidas', r.suspendidas]
  ].map(([n, v]) => ({ celdas: [n, v] }));

  const filasServicio = Object.keys(d.servicios).sort().map(s => ({
    celdas: [s, d.servicios[s].tipo, d.servicios[s].sesiones, d.servicios[s].filas]
  }));

  return `<div class="pr-bloque">
      <h2>Producción personal</h2>
      ${tablaPr('Totales del período', ['Concepto','Cantidad'], filasResumen, ['70%','30%'])}
      ${tablaPr('Carga por servicio', ['Servicio','Tipo de atención','Sesiones','Registros'],
        filasServicio, ['34%','30%','18%','18%'])}
      ${d.alertas.length ? `<h3>Observaciones</h3><ul class="pr-lista">${
        d.alertas.map(a => `<li><strong>${esc(a.titulo)}:</strong> ${esc(a.detalle)}</li>`).join('')
      }</ul>` : ''}
    </div>`;
}

function seccionNomina(n) {
  if (!n || !n.pacientes.length) return '';
  const filas = n.pacientes.map(p => ({
    celdas: [p.servicio, p.cama, p.nombre, p.rut, p.edad, p.diagnostico,
             p.rem, p.atenciones, p.egreso || (p.ingreso ? 'Ingreso' : '')]
  }));
  return `<div class="pr-bloque">
      <h2>Nómina de pacientes</h2>
      ${tablaPr(`${n.pacientes.length} pacientes atendidos`,
        ['Servicio','Cama','Nombre','RUT','Edad','Diagnóstico','REM','At.','Estado'], filas,
        ['12%','7%','20%','11%','7%','21%','6%','7%','9%'], [4, 6, 7])}
      <p class="pr-nota">Documento con datos personales de salud. Ley 21.719 y Ley 20.584.</p>
    </div>`;
}
