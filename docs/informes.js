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
  nomina: null,
  resumen: '',
  incluirResumen: true,
  generando: false,
  cargando: false,
  error: null,
  secciones: { rem28: true, rem17: true, produccion: true, nomina: true }
};

const SECCIONES = [
  ['rem28',      'REM 28',              'Ingresos, egresos, evaluaciones y procedimientos'],
  ['rem17',      'REM 17',              'Prestaciones por código y tipo de atención'],
  ['produccion', 'Producción personal', 'Sesiones por servicio, brechas y su motivo'],
  ['nomina',     'Nómina de pacientes', 'Pacientes atendidos en el período']
];

API.nomina = async function (mes, fono) {
  const { url, token } = estado.config;
  const r = await fetch(`${url}?api=nomina&token=${encodeURIComponent(token)}` +
                        `&mes=${encodeURIComponent(mes)}&fono=${encodeURIComponent(fono || '')}`,
                        { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'No se pudo obtener la nómina.');
  return j;
};

API.resumen = async function (mes, fono, anterior) {
  const { url, token } = estado.config;
  const r = await fetch(`${url}?api=resumen&token=${encodeURIComponent(token)}` +
                        `&mes=${encodeURIComponent(mes)}&fono=${encodeURIComponent(fono || '')}` +
                        `&anterior=${encodeURIComponent(anterior || '')}`,
                        { redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'No se pudo generar el resumen.');
  return j;
};

/* ── Entrada ──────────────────────────────────────────────── */

async function abrirInformes() {
  if (!inf.mes) inf.mes = mesActual();
  pintarInformes();
  await cargarInformes();
}

async function cargarInformes() {
  if (!navigator.onLine) {
    inf.datos = null;
    inf.error = 'Sin conexión. Los informes se arman con los datos de la planilla.';
    pintarInformes();
    return;
  }
  inf.cargando = true;
  inf.error = null;
  pintarInformes();
  try {
    const [d, n] = await Promise.all([
      API.dashboard(inf.mes, estado.config.fono),
      API.nomina(inf.mes, estado.config.fono)
    ]);
    inf.datos = d;
    inf.nomina = n;
  } catch (err) {
    inf.datos = null;
    inf.error = 'No se pudo cargar: ' + err.message;
  }
  inf.cargando = false;
  pintarInformes();
}

/* ── Pintado ──────────────────────────────────────────────── */

function pintarInformes() {
  const cont = document.getElementById('informes');
  const seleccionadas = SECCIONES.filter(([k]) => inf.secciones[k]).length;

  const cabecera = `
    <div class="barra">
      <div class="barra-fila">
        <div class="barra-titulo">
          <div class="eyebrow">Fonoaudiología · hospitalario</div>
          <h1>Informes</h1>
        </div>
        <button class="icon-btn" id="infRefrescar">${ICO.volver}</button>
      </div>
      <div class="filtros">
        <label class="filtro">${ICO.cal}
          <select id="infMes">${mesesDisponibles().map(([v, t]) =>
            `<option value="${v}" ${v === inf.mes ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        </label>
        <span class="filtro" style="flex:0 0 auto;padding:0 14px">${ICO.persona}
          <span style="font-size:13px">${esc(estado.config.fono || 'Todos')}</span>
        </span>
      </div>
    </div>`;

  if (inf.error) {
    cont.innerHTML = cabecera + `<main style="padding-top:12px">
      <div class="vacio">${ICO.doc}<p>${esc(inf.error)}</p></div></main>`;
    conectarInformes();
    return;
  }
  if (inf.cargando || !inf.datos) {
    cont.innerHTML = cabecera + `<main style="padding-top:12px">
      <div class="cargando">Reuniendo los datos del mes…</div></main>`;
    conectarInformes();
    return;
  }

  cont.innerHTML = cabecera + `<main style="padding-top:12px">

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
          <button class="btn btn-secundario" id="infRegenerar">${ICO.volver} Regenerar</button>
          <button class="btn ${inf.incluirResumen ? 'btn-primario' : 'btn-secundario'}" id="infIncluir">
            ${inf.incluirResumen ? ICO.check : ICO.circulo} ${inf.incluirResumen ? 'Incluido' : 'Excluido'}
          </button>
        </div>`
      : `
        <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">
          Redacta el párrafo narrativo que acompaña al REM. A Gemini viajan solo cifras
          agregadas: nunca nombres, RUT ni camas.
        </p>
        <button class="btn-bloque" id="infGenerar">${ICO.chispa} Generar resumen</button>`}
      <div id="infAvisoIA"></div>
    </div>

    <div class="acciones">
      <button class="btn btn-primario" id="infPdf" ${seleccionadas ? '' : 'disabled'}>
        ${ICO.doc} Descargar PDF${seleccionadas ? ` · ${seleccionadas} ${seleccionadas === 1 ? 'sección' : 'secciones'}` : ''}
      </button>
    </div>

    <p style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:4px">
      Se abre la ventana de impresión. Elige <strong>Guardar como PDF</strong> como destino.
    </p>
  </main>`;

  conectarInformes();
}

function conectarInformes() {
  const sel = document.getElementById('infMes');
  if (sel) sel.addEventListener('change', (e) => {
    inf.mes = e.target.value; inf.resumen = ''; cargarInformes();
  });

  const ref = document.getElementById('infRefrescar');
  if (ref) ref.addEventListener('click', () => cargarInformes());

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
    inf.resumen = document.getElementById('infResumen').value;
    inf.incluirResumen = !inf.incluirResumen;
    pintarInformes();
  });

  const pdf = document.getElementById('infPdf');
  if (pdf) pdf.addEventListener('click', descargarPdf);
}

async function generarResumen() {
  const aviso = document.getElementById('infAvisoIA');
  const btn = document.getElementById('infGenerar') || document.getElementById('infRegenerar');
  if (btn) { btn.disabled = true; btn.textContent = 'Redactando…'; }
  aviso.innerHTML = '';

  // El mes anterior, para que el resumen pueda comparar.
  const [a, m] = inf.mes.split('-').map(Number);
  const prev = m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;

  try {
    const r = await API.resumen(inf.mes, estado.config.fono, prev);
    inf.resumen = r.resumen;
    inf.incluirResumen = true;
    pintarInformes();
    toast('Resumen generado. Revísalo antes de incluirlo.', 'ok');
  } catch (err) {
    aviso.innerHTML = `<div class="banda warn" style="margin-top:12px">${esc(err.message)}</div>`;
    if (btn) { btn.disabled = false; btn.innerHTML = ICO.chispa + ' Generar resumen'; }
  }
}

/* ══════════════════════════════════════════════════════════════
   GENERACIÓN DEL PDF
   ══════════════════════════════════════════════════════════════ */

function descargarPdf() {
  if (document.getElementById('infResumen')) {
    inf.resumen = document.getElementById('infResumen').value;
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
