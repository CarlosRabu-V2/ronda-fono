/* ══════════════════════════════════════════════════════════════
   VISTA 2 — DASHBOARD REM
   Todo se calcula en el servidor; aquí solo viajan números.
   ══════════════════════════════════════════════════════════════ */

'use strict';

const MESES_ES = ['enero','febrero','marzo','abril','mayo','junio','julio',
                  'agosto','septiembre','octubre','noviembre','diciembre'];

const dash = {
  mes: null,
  datos: null,
  cargando: false,
  abierta: null   // categoría del REM 28 con el desglose desplegado
};

const fmt = (n) => Number(n || 0).toLocaleString('es-CL');

/* En 375 px no caben los nombres oficiales junto a cuatro columnas de números.
   La tabla muestra la versión corta; el nombre completo queda en el desglose. */
const CORTO = {
  'Ataque cerebro vascular (ACV)': 'ACV',
  'Traumatismo encéfalo craneano (TEC)': 'TEC',
  'Lesión medular': 'Lesión medular',
  'Neuromusculares agudas': 'Neuromusc. agudas',
  'Neuromusculares crónicas': 'Neuromusc. crónicas',
  'Disrafias espinales': 'Disrafias espinales',
  'Otras neurológicas': 'Otras neurológicas',
  'Trastornos del Neurodesarrollo': 'Neurodesarrollo',
  'Parálisis cerebral': 'Parálisis cerebral',
  'Recién nacido de alto riesgo': 'RN alto riesgo',
  'Síndrome POST-UCI': 'Síndrome post-UCI',
  'COVID-19': 'COVID-19',
  'Enfermedades respiratorias': 'Enf. respiratorias',
  'Enfermedades cardíacas': 'Enf. cardíacas',
  'Dolor musculoesquelético crónico': 'Dolor musculoesq.',
  'Artritis reumatoidea': 'Artritis reumat.',
  'Otras reumatológicas': 'Otras reumatol.',
  'Traumatológicos': 'Traumatológicos',
  'Otros pre y post quirúrgicos': 'Pre/post quirúrg.',
  'Oncológicos': 'Oncológicos',
  'Genitourinarias': 'Genitourinarias',
  'Amputación': 'Amputación',
  'Quemados': 'Quemados',
  'Sensoriales auditivos': 'Sens. auditivos',
  'Sensoriales visuales': 'Sens. visuales',
  'Trastorno espectro autista': 'Espectro autista',
  'Otros': 'Otros'
};
const corto = (c) => CORTO[c] || c;

const CORTO_17 = {
  'Evaluación de la deglución': 'Ev. deglución',
  'Rehabilitación de la deglución': 'Rehab. deglución',
  'Evaluación de funciones cognitivas': 'Ev. fx cognitivas',
  'Rehabilitación de funciones cognitivas': 'Rehab. fx cognitivas',
  'Evaluación de voz': 'Ev. voz',
  'Evaluación de habla': 'Ev. habla',
  'Evaluación del lenguaje': 'Ev. lenguaje',
  'Rehabilitación de la voz': 'Rehab. voz',
  'Rehabilitación del habla y/o lenguaje': 'Rehab. habla/lenguaje'
};

function mesActual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Los últimos 12 meses, para el selector. */
function mesesDisponibles() {
  const hoy = new Date();
  const lista = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    lista.push([v, `${MESES_ES[d.getMonth()]} ${d.getFullYear()}`.replace(/^./, c => c.toUpperCase())]);
  }
  return lista;
}

API.dashboard = async function (mes, fono) {
  const { url, token } = estado.config;
  const q = `${url}?api=dashboard&token=${encodeURIComponent(token)}` +
            `&mes=${encodeURIComponent(mes)}&fono=${encodeURIComponent(fono || '')}`;
  const r = await fetch(q, { method: 'GET', redirect: 'follow' });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'El servidor rechazó la petición.');
  return j;
};

/* ── Entrada ──────────────────────────────────────────────── */

async function abrirDashboard() {
  if (!dash.mes) dash.mes = mesActual();
  pintarDashboard();
  await cargarDashboard();
}

async function cargarDashboard() {
  if (!navigator.onLine) {
    dash.datos = null;
    pintarDashboard('Sin conexión. El dashboard necesita red porque los cálculos ocurren en la planilla.');
    return;
  }
  dash.cargando = true;
  pintarDashboard();
  try {
    dash.datos = await API.dashboard(dash.mes, estado.config.fono);
  } catch (err) {
    dash.datos = null;
    pintarDashboard('No se pudo cargar: ' + err.message);
    dash.cargando = false;
    return;
  }
  dash.cargando = false;
  pintarDashboard();
}

/* ── Pintado ──────────────────────────────────────────────── */

function pintarDashboard(mensaje) {
  const cont = document.getElementById('dashboard');

  const filtros = `
    <div class="barra">
      <div class="barra-fila">
        <div class="barra-titulo">
          <div class="eyebrow">Estadísticas mensuales</div>
          <h1>Dashboard</h1>
        </div>
        <button class="icon-btn" id="dashRefrescar">${ICO.volver}</button>
      </div>
      <div class="filtros">
        <label class="filtro">${ICO.cal}
          <select id="dashMes">${mesesDisponibles().map(([v, t]) =>
            `<option value="${v}" ${v === dash.mes ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        </label>
        <span class="filtro" style="flex:0 0 auto;padding:0 14px">${ICO.persona}
          <span style="font-size:13px">${esc(estado.config.fono || 'Todos')}</span>
        </span>
      </div>
    </div>`;

  if (mensaje) {
    cont.innerHTML = filtros + `<main style="padding-top:12px"><div class="vacio">${ICO.grafico}<p>${esc(mensaje)}</p></div></main>`;
    conectarFiltros();
    return;
  }
  if (dash.cargando || !dash.datos) {
    cont.innerHTML = filtros + `<main style="padding-top:12px"><div class="cargando">Calculando el REM del mes…</div></main>`;
    conectarFiltros();
    return;
  }

  const d = dash.datos;
  const r = d.resumen;

  cont.innerHTML = filtros + `<main style="padding-top:12px">

    <div class="metricas">
      ${metrica('Ingresos', r.ingresos, ICO.entrada)}
      ${metrica('Egresos', r.egresos, ICO.salida)}
      ${metrica('Ev. iniciales', r.iniciales, ICO.check)}
      ${metrica('Sesiones', r.sesiones, ICO.lista)}
    </div>

    <div class="bloque-cab">
      <span class="badge">REM 28</span>
      <h2>B.1 Ingresos</h2>
      <span class="nota">Total ${fmt(d.ingresos.total.total)}</span>
    </div>
    ${tablaIngresos(d.ingresos)}

    <div class="bloque-cab">
      <span class="badge">REM 28</span>
      <h2>B.1 Egresos</h2>
      <span class="nota">Total ${fmt(d.egresos.total.total)}</span>
    </div>
    ${tablaEgresos(d.egresos)}

    <div class="bloque-cab">
      <span class="badge">REM 28</span>
      <h2>B.2 a B.4 · Profesional</h2>
    </div>
    ${tablaProfesional(d.profesional)}

    <div class="bloque-cab">
      <span class="badge">REM 28</span>
      <h2>B.6 Procedimientos</h2>
    </div>
    ${tablaSimple(d.procedimientos)}

    <div class="bloque-cab">
      <span class="badge verde">REM 17</span>
      <h2>Prestaciones</h2>
    </div>
    ${tablaRem17(d.rem17)}

    ${d.sinAsignar.length ? `
      <div class="banda warn" style="margin-top:12px">
        <strong>Sin destino asignado en el REM.</strong>
        ${d.sinAsignar.map(s => `<span class="meta">${esc(s.etiqueta)}: <strong>${fmt(s.total)}</strong></span>`).join('')}
        <span class="meta">Estas cantidades quedan fuera del informe hasta definir a qué prestación van.</span>
      </div>` : ''}

    ${tarjetaValidacion(d.validacion)}

    ${d.alertas.length ? `
      <div class="bloque-cab"><h2>Alertas</h2><span class="nota">${d.alertas.length}</span></div>
      ${d.alertas.map(a => `
        <div class="alerta-fila ${a.tipo}">
          <span class="alerta-icono">${ICO.alerta}</span>
          <span class="alerta-cuerpo"><strong>${esc(a.titulo)}</strong><span>${esc(a.detalle)}</span></span>
        </div>`).join('')}` : ''}

    <p style="font-size:12px;color:var(--text-muted);margin-top:20px;text-align:center">
      ${fmt(d.filas)} filas de ${esc(d.nombreMes.toLowerCase())} · ${fmt(r.pacientes)} pacientes distintos
    </p>
  </main>`;

  conectarFiltros();
  conectarDesgloses();
}

function metrica(etiqueta, valor, icono) {
  return `<div class="metrica">
      <div class="metrica-cab"><span class="metrica-et">${esc(etiqueta)}</span>${icono}</div>
      <div class="metrica-val">${fmt(valor)}</div>
    </div>`;
}

function n_(v) { return v ? fmt(v) : '<span class="cero">0</span>'; }

/** B.1 Ingresos: una fila por categoría REM, desplegable al desglose por edad. */
function tablaIngresos(ing) {
  const filas = ing.orden.filter(c => ing.categorias[c]).map(c => {
    const x = ing.categorias[c];
    return `<button class="tabla-fila" data-cat="${esc(c)}">
        <span class="celda-nombre">${ICO.flecha}<span class="txt">${esc(corto(c))}</span></span>
        <span>${fmt(x.total)}</span><span>${n_(x.abierta)}</span>
        <span>${n_(x.upc)}</span><span>${n_(x.medios)}</span>
      </button>
      <div class="desglose oculto" data-desglose="${esc(c)}"></div>`;
  }).join('');

  const t = ing.total;
  return `<div class="tabla">
      <div class="tabla-cab"><span>Categoría</span><span>Tot.</span><span>Ab.</span><span>UPC</span><span>C.Med</span></div>
      ${filas || '<div class="cargando">Sin ingresos este mes.</div>'}
      <div class="tabla-fila total">
        <span class="celda-nombre"><span class="txt">Total</span></span>
        <span>${fmt(t.total)}</span><span>${n_(t.abierta)}</span>
        <span>${n_(t.upc)}</span><span>${n_(t.medios)}</span>
      </div>
    </div>
    ${ing.sinRem ? `<p style="font-size:12px;color:var(--text-danger);margin-top:6px">
      ${ing.sinRem} ingresos quedaron fuera por no tener código REM válido.</p>` : ''}`;
}

function tablaEgresos(eg) {
  const filas = eg.orden.map(m => {
    const x = eg.motivos[m];
    if (!x || !x.total) return '';
    return `<div class="tabla-fila">
        <span class="celda-nombre"><span class="txt">${esc(m.replace('Egresos por ', '').replace('Egresos ', ''))}</span></span>
        <span>${fmt(x.total)}</span><span>${n_(x.abierta)}</span>
        <span>${n_(x.upc)}</span><span>${n_(x.medios)}</span>
      </div>`;
  }).join('');
  const t = eg.total;
  return `<div class="tabla">
      <div class="tabla-cab"><span>Motivo</span><span>Tot.</span><span>Ab.</span><span>UPC</span><span>C.Med</span></div>
      ${filas || '<div class="cargando">Sin egresos este mes.</div>'}
      <div class="tabla-fila total">
        <span class="celda-nombre"><span class="txt">Total</span></span>
        <span>${fmt(t.total)}</span><span>${n_(t.abierta)}</span>
        <span>${n_(t.upc)}</span><span>${n_(t.medios)}</span>
      </div>
    </div>`;
}

function tablaProfesional(p) {
  const filas = [
    ['B.2 Evaluación inicial', p.inicial],
    ['B.3 Evaluación intermedia', p.intermedia],
    ['B.4 Sesiones de rehabilitación', p.sesiones]
  ].map(([nombre, x]) => `<div class="tabla-fila">
      <span class="celda-nombre"><span class="txt">${esc(nombre)}</span></span>
      <span>${fmt(x.total)}</span><span>${n_(x.abierta)}</span>
      <span>${n_(x.upc)}</span><span>${n_(x.medios)}</span>
    </div>`).join('');
  return `<div class="tabla">
      <div class="tabla-cab"><span>Sección</span><span>Tot.</span><span>Ab.</span><span>UPC</span><span>C.Med</span></div>
      ${filas}
    </div>`;
}

function tablaSimple(obj) {
  const filas = Object.keys(obj).map(k => `<div class="tabla-fila" style="grid-template-columns:1fr 64px">
      <span class="celda-nombre"><span class="txt">${esc(k)}</span></span>
      <span>${n_(obj[k])}</span>
    </div>`).join('');
  return `<div class="tabla">${filas}</div>`;
}

function tablaRem17(lista) {
  const filas = lista.map(p => `<div class="tabla-fila">
      <span class="celda-nombre"><span class="txt" title="${esc(p.codigo + ' · ' + p.nombre)}">${esc(CORTO_17[p.nombre] || p.nombre)}</span></span>
      <span>${n_(p.cerrada)}</span><span>${n_(p.abierta)}</span><span>${n_(p.urgencia)}</span>
    </div>`).join('');
  return `<div class="tabla rem17">
      <div class="tabla-cab"><span>Prestación</span><span>Cerrada</span><span>Abierta</span><span>Urg.</span></div>
      ${filas}
    </div>`;
}

function tarjetaValidacion(v) {
  if (!v) return '';
  if (v.ok) {
    return `<div class="tarjeta-estado-rem ok">${ICO.check}
        <div><h3>Validación conforme</h3>
        <p>La suma por rango etario coincide con la suma por tipo de atención en todas las secciones.</p></div>
      </div>`;
  }
  return `<div class="tarjeta-estado-rem mal">${ICO.alerta}
      <div><h3>La validación no cuadra</h3>
      <p>${v.problemas.map(p =>
        `${esc(p.seccion)}: total ${p.total}, por rango ${p.porRango}, por tipo ${p.porTipo}.`).join('<br>')}
      <br>Suele ser por filas sin rango etario o sin servicio.</p></div>
    </div>`;
}

/* ── Interacción ──────────────────────────────────────────── */

function conectarFiltros() {
  const sel = document.getElementById('dashMes');
  if (sel) sel.addEventListener('change', (e) => { dash.mes = e.target.value; dash.abierta = null; cargarDashboard(); });
  const btn = document.getElementById('dashRefrescar');
  if (btn) btn.addEventListener('click', () => cargarDashboard());
}

/** Al tocar una categoría se abre su desglose por rango etario y sexo. */
function conectarDesgloses() {
  document.querySelectorAll('#dashboard [data-cat]').forEach(fila => {
    fila.addEventListener('click', () => {
      const cat = fila.dataset.cat;
      const panel = document.querySelector(`#dashboard [data-desglose="${CSS.escape(cat)}"]`);
      const abierto = !panel.classList.contains('oculto');

      document.querySelectorAll('#dashboard [data-desglose]').forEach(p => p.classList.add('oculto'));
      document.querySelectorAll('#dashboard [data-cat]').forEach(f => f.classList.remove('abierta'));

      if (abierto) { dash.abierta = null; return; }

      panel.innerHTML = desgloseHTML(dash.datos.ingresos.categorias[cat], cat);
      panel.classList.remove('oculto');
      fila.classList.add('abierta');
      dash.abierta = cat;
    });
  });
}

function desgloseHTML(celda, cat) {
  const rangos = Object.keys(celda.rangos).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  if (!rangos.length) return `<div class="desglose-tit">Sin rango etario registrado</div>`;

  const max = Math.max(...rangos.map(r => celda.rangos[r]));
  const barras = rangos.map(r => {
    const n = celda.rangos[r];
    const h = celda.rangoSexo[r + '|H'] || 0;
    const m = celda.rangoSexo[r + '|M'] || 0;
    return `<div class="barra-fila-dato">
        <span class="et">${esc(r)}</span>
        <span class="pista"><span class="relleno" style="width:${Math.round(n * 100 / max)}%"></span></span>
        <span class="n" title="${h} hombres, ${m} mujeres">${n} · ${h}H ${m}M</span>
      </div>`;
  }).join('');

  return `<div class="desglose-tit">${esc(cat)} · ${celda.total} casos · ${celda.hombres}H ${celda.mujeres}M</div>${barras}`;
}
