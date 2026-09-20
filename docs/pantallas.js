/* ══════════════════════════════════════════════════════════════
   PANTALLAS — configuración, sesión, ingreso, egresos
   ══════════════════════════════════════════════════════════════ */

'use strict';

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ── Utilidades de formulario ─────────────────────────────── */

function chips(nombre, opciones, { tipo = 'radio', valor = '', clase = '' } = {}) {
  return `<div class="chips">` + opciones.map(([v, etiqueta], i) => {
    const id = `${nombre}_${i}`;
    const marcado = tipo === 'radio'
      ? (String(valor) === String(v) ? 'checked' : '')
      : ((valor || []).includes(v) ? 'checked' : '');
    return `<span class="chip">
        <input type="${tipo}" id="${id}" name="${nombre}" value="${esc(v)}" ${marcado}>
        <label for="${id}" class="${clase}">${esc(etiqueta)}</label>
      </span>`;
  }).join('') + `</div>`;
}

function contador(nombre, etiqueta, valor = '') {
  return `<div class="contador">
      <span class="contador-nombre">${esc(etiqueta)}</span>
      <span class="contador-ctrl">
        <button type="button" data-paso="-1" data-campo="${nombre}">−</button>
        <input type="number" inputmode="numeric" id="c_${nombre}" value="${esc(valor)}">
        <button type="button" data-paso="1" data-campo="${nombre}">+</button>
      </span>
    </div>`;
}

function selectOpciones(lista, valor) {
  return `<option value="">Seleccione...</option>` + lista.map(v =>
    `<option value="${esc(v)}" ${String(v) === String(valor) ? 'selected' : ''}>${esc(v)}</option>`
  ).join('');
}

function leerRadio(nombre)  { const el = $(`input[name="${nombre}"]:checked`); return el ? el.value : ''; }
function leerChecks(nombre) { return $$(`input[name="${nombre}"]:checked`).map(e => e.value); }
function leerNum(campo)     { const el = $('#c_' + campo); return el && el.value !== '' ? Number(el.value) : 0; }

function conectarContadores(raiz) {
  raiz.querySelectorAll('[data-paso]').forEach(b => {
    b.addEventListener('click', () => {
      const input = $('#c_' + b.dataset.campo);
      const n = Math.max(0, (Number(input.value) || 0) + Number(b.dataset.paso));
      input.value = n;
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   CONFIGURACIÓN INICIAL
   ══════════════════════════════════════════════════════════════ */
function mostrarConfiguracion() {
  $('#app').classList.add('oculto');
  const c = $('#configuracion');
  c.classList.remove('oculto');

  const cfg = estado.config || {};
  c.innerHTML = `<div class="centrado">
      <h1>Configurar la app</h1>
      <p>Se hace una sola vez. Los datos quedan en este teléfono y no viajan a ninguna parte.</p>

      <div class="seccion">
        <div class="campo">
          <label for="cfgUrl">Dirección de la app web</label>
          <input type="url" id="cfgUrl" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(cfg.url || '')}">
          <div class="ayuda">En Apps Script: Implementar → Gestionar implementaciones → copiar la URL que termina en /exec</div>
        </div>
        <div class="campo">
          <label for="cfgToken">Clave de acceso</label>
          <input type="text" id="cfgToken" placeholder="Pega aquí la clave" value="${esc(cfg.token || '')}">
          <div class="ayuda">La entrega configurarToken() al ejecutarlo en el editor de Apps Script.</div>
        </div>
      </div>

      <div id="cfgPaso2" class="${cfg.fono ? '' : 'oculto'}">
        <div class="seccion">
          <div class="campo">
            <label for="cfgFono">Tu nombre en la planilla</label>
            <select id="cfgFono"></select>
            <div class="ayuda">La ronda mostrará solo tus pacientes.</div>
          </div>
        </div>
      </div>

      <div class="acciones">
        <button class="btn btn-primario" id="btnProbar">Conectar</button>
      </div>
      <div id="cfgAviso"></div>
    </div>`;

  $('#btnProbar').addEventListener('click', probarConexion);
}

async function probarConexion() {
  const url = $('#cfgUrl').value.trim();
  const token = $('#cfgToken').value.trim();
  const aviso = $('#cfgAviso');

  if (!url || !token) { aviso.innerHTML = `<div class="banda warn">Faltan la dirección y la clave.</div>`; return; }

  // La dirección de pruebas (/dev) exige sesión de Google y no envía cabeceras
  // entre dominios: el navegador bloquea la llamada antes de que salga.
  if (/\/dev\/?$/.test(url)) {
    aviso.innerHTML = `<div class="banda warn">
        <strong>Esa es la dirección de pruebas.</strong> Termina en <code>/dev</code> y no
        sirve para la app.
        <span class="meta">Necesitas la que termina en <code>/exec</code>:
        en Apps Script, Implementar → Gestionar implementaciones → URL de la aplicación web.</span>
      </div>`;
    return;
  }

  const btn = $('#btnProbar');
  btn.disabled = true;
  btn.textContent = 'Conectando…';
  aviso.innerHTML = '';

  try {
    const r = await API.ping(url, token);
    if (!r.ok) throw new Error(r.error || 'Respuesta inesperada.');

    // Con la conexión probada, se piden los nombres para elegir el tuyo.
    estado.config = { url, token, fono: '' };
    const censo = await API.censo();
    const fonos = (censo.catalogos && censo.catalogos.fonoaudiólogos) || [];

    $('#cfgPaso2').classList.remove('oculto');
    $('#cfgFono').innerHTML = selectOpciones(fonos, (estado.config || {}).fono);
    aviso.innerHTML = `<div class="banda ok">Conectado a la hoja <strong>${esc(r.hoja)}</strong>. Elige tu nombre y guarda.</div>`;

    btn.textContent = 'Guardar y empezar';
    btn.disabled = false;
    btn.onclick = async () => {
      const fono = $('#cfgFono').value;
      if (!fono) { aviso.innerHTML = `<div class="banda warn">Elige tu nombre.</div>`; return; }
      estado.config = { url, token, fono };
      await DB.guardar('config', estado.config, 'app');
      mostrarApp();
      await refrescarCenso();
    };

  } catch (err) {
    aviso.innerHTML = `<div class="banda warn">No se pudo conectar: ${esc(err.message)}</div>`;
    btn.textContent = 'Conectar';
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════
   ARMAZÓN DE LA APP
   ══════════════════════════════════════════════════════════════ */
function mostrarApp() {
  $('#configuracion').classList.add('oculto');
  $('#app').classList.remove('oculto');

  const d = new Date();
  const dias = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  $('#fechaHoy').textContent =
    `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`.replace(/^./, m => m.toUpperCase());

  conectarArmazon();
}

let armazonConectado = false;
function conectarArmazon() {
  if (armazonConectado) return;
  armazonConectado = true;

  $('#buscadorCerrado').addEventListener('click', () => alternarBuscador(true));
  $('#btnCerrarBuscar').addEventListener('click', () => alternarBuscador(false));
  $('#inputBuscar').addEventListener('input', (e) => { estado.busqueda = e.target.value; pintarRonda(); });

  $('#pillSync').addEventListener('click', () => Sync.intentar({ silencioso: false }));
  $('#btnRefrescar').addEventListener('click', () => refrescarCenso());
  $('#btnTema').addEventListener('click', alternarTema);
  $('#fab').addEventListener('click', () => pantallaIngreso());
  $('#bloqueEgresos').addEventListener('click', alternarEgresos);

  $$('.nav button').forEach(b => b.addEventListener('click', () => irA(b.dataset.vista)));
}

async function alternarTema() {
  const actual = document.documentElement.dataset.tema;
  const nuevo = actual === 'oscuro' ? 'claro' : 'oscuro';
  document.documentElement.dataset.tema = nuevo;
  await DB.guardar('config', nuevo, 'tema');
}

function irA(vista) {
  estado.vista = vista;
  $$('.nav button').forEach(b => b.classList.toggle('activo', b.dataset.vista === vista));
  $('#pantalla').classList.add('oculto');
  $('#pantalla').innerHTML = '';
  $('#ronda').classList.toggle('oculto', vista !== 'ronda');
  $('#dashboard').classList.toggle('oculto', vista !== 'dashboard');
  $('#informes').classList.toggle('oculto', vista !== 'informes');
  window.scrollTo(0, 0);

  if (vista === 'dashboard')     abrirDashboard();
  else if (vista === 'informes') abrirInformes();
  else pintar();
}

/** Abre una pantalla a pantalla completa por encima de la ronda. */
function abrirPantalla(html) {
  const p = $('#pantalla');
  p.innerHTML = html;
  p.classList.remove('oculto');
  $('#ronda').classList.add('oculto');
  // Dos pasadas: al cambiar qué elemento está visible el navegador conserva el
  // scroll de la lista, y un scrollTo inmediato se pierde en ese reajuste.
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  return p;
}

function cerrarPantalla() {
  $('#pantalla').classList.add('oculto');
  $('#pantalla').innerHTML = '';
  $('#ronda').classList.remove('oculto');
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  pintar();
}

/* ══════════════════════════════════════════════════════════════
   PANTALLA DE SESIÓN
   ══════════════════════════════════════════════════════════════ */
async function abrirSesion(rut) {
  const p = [...estado.censo, ...estado.egresos].find(x => x.rut === rut);
  if (!p) { toast('No se encontró el paciente.', 'error'); return; }
  estado.paciente = p;

  if (p.motivoEgreso) { pantallaEgresado(p); return; }

  const previa = await DB.get('config', 'ultima:' + normRut(rut));
  pantallaSesion(p, previa);
}

function pantallaSesion(p, previa) {
  const info = servicioInfo(p.servicio);
  const limite = diasSugeridos(p.categorizacion);
  const atrasado = p.diasSinAtencion > limite;

  const cont = abrirPantalla(`
    <div class="barra">
      <div class="barra-fila">
        <button class="icon-btn" id="btnAtras">${ICO.atras}</button>
        <div class="barra-titulo">
          <div class="eyebrow">${esc(p.servicio)} · Cama ${esc(p.cama)}</div>
          <h1>${esc(p.nombre)}</h1>
        </div>
        <button class="icon-btn" id="btnMenu">${ICO.menu}</button>
      </div>
    </div>

    <main style="padding-top:12px">
      <div class="banda info">
        ${esc(p.diagnostico1)}${p.rem1 ? ' · REM ' + esc(p.rem1) : ''}${p.ges ? ' · GES ' + esc(p.ges) : ''}
        <span class="meta">${esc(p.rut)} · ${esc(p.sexo)} · ${esc(p.edad)} años · ${p.atencionesPrevias} atenciones previas</span>
      </div>

      ${atrasado ? `<div class="banda warn">${p.diasSinAtencion} días sin atención. La categorización sugiere una cada ${limite} días.</div>` : ''}

      ${previa ? `<button class="btn-bloque" id="btnRepetir">${ICO.volver} Igual que la sesión anterior</button>` : ''}

      <div class="seccion" style="margin-top:12px">
        <div class="seccion-titulo">Atenciones</div>
        ${contador('atenciones', 'N° de atenciones', 1)}
        ${contador('brechas', 'Brechas', 0)}
        <div class="campo" style="margin-top:12px">
          <label for="suspendidas">Suspendidas · motivo</label>
          <input type="text" id="suspendidas" placeholder="Opcional">
        </div>
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Categorización</div>
        ${chips('categorizacion', CATEGORIZACIONES, { valor: p.categorizacion })}
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Evaluación</div>
        ${chips('tipoEval', [['Inicial','Inicial'],['Intermedia','Intermedia']])}
        <div style="height:12px"></div>
        ${chips('evaluaciones', EVALUACIONES.map(e => [e, e]), { tipo: 'checkbox', valor: [] })}
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Intervenciones</div>
        ${INTERVENCIONES.map(n => contador('int_' + n, n)).join('')}
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Disfunción</div>
        ${chips('disf', DISF)}
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Educación</div>
        ${chips('educacion', [['EG','EG'],['EF','EF']], { tipo: 'checkbox', valor: [] })}
      </div>

      <div class="acciones">
        <button class="btn btn-secundario" id="btnCancelar">Cancelar</button>
        <button class="btn btn-primario" id="btnGuardar">Guardar sesión</button>
      </div>
    </main>`);

  conectarContadores(cont);
  $('#btnAtras').addEventListener('click', cerrarPantalla);
  $('#btnCancelar').addEventListener('click', cerrarPantalla);
  $('#btnMenu').addEventListener('click', () => hojaAcciones(p));
  $('#btnGuardar').addEventListener('click', () => guardarSesion(p));

  if (previa) {
    $('#btnRepetir').addEventListener('click', () => {
      INTERVENCIONES.forEach(n => { $('#c_int_' + n).value = previa.intervenciones[n] || ''; });
      (previa.evaluaciones || []).forEach(v => {
        const el = $$(`input[name="evaluaciones"]`).find(x => x.value === v);
        if (el) el.checked = true;
      });
      if (previa.disf) {
        const el = $$(`input[name="disf"]`).find(x => x.value === previa.disf);
        if (el) el.checked = true;
      }
      $('#c_atenciones').value = previa.atencionesRealizadas || 1;
      toast('Copiado de la sesión anterior', 'ok');
    });
  }
}

async function guardarSesion(p) {
  const intervenciones = {};
  INTERVENCIONES.forEach(n => { intervenciones[n] = leerNum('int_' + n); });
  const disf = leerRadio('disf');
  intervenciones.DISF = disf;

  const educacion = leerChecks('educacion');

  const sesion = {
    uuid: uuid(),
    tipo: 'sesion',
    fecha: hoyISO(),
    servicio: p.servicio,
    'fonoaudiólogo': estado.config.fono,
    cama: p.cama,
    nombrePaciente: p.nombre,
    sexo: p.sexo,
    edad: String(p.edad),
    rut: p.rut,
    diagnosticos: [p.diagnostico1, p.diagnostico2 || ''],
    rems: [p.rem1, p.rem2 || ''],
    origen: p.origen,
    condicionHospitalizacion: [],
    categorizacion: leerRadio('categorizacion'),
    atencionesRealizadas: leerNum('atenciones'),
    brechas: leerNum('brechas'),
    suspendidas: $('#suspendidas').value.trim(),
    tipoEvaluacion: leerRadio('tipoEval'),
    evaluaciones: leerChecks('evaluaciones'),
    intervenciones,
    disf,
    eg: educacion.includes('EG') ? 1 : 0,
    ef: educacion.includes('EF') ? 1 : 0
  };

  // Se recuerda el patrón para el botón "igual que la sesión anterior".
  await DB.guardar('config', {
    intervenciones, disf,
    evaluaciones: sesion.evaluaciones,
    atencionesRealizadas: sesion.atencionesRealizadas
  }, 'ultima:' + normRut(p.rut));

  // El censo local refleja el registro de inmediato, aunque no haya red.
  p.ultimaFecha = sesion.fecha;
  p.diasSinAtencion = 0;
  p.atencionesPrevias = (p.atencionesPrevias || 0) + 1;
  if (sesion.categorizacion) p.categorizacion = sesion.categorizacion;
  await DB.guardar('censo', p);

  await encolar(sesion);
  cerrarPantalla();
  toast('Sesión guardada', 'ok');
}

/* ══════════════════════════════════════════════════════════════
   HOJA DE ACCIONES — cambiar cama, egreso
   ══════════════════════════════════════════════════════════════ */
function hojaAcciones(p) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja">
      <h2>${esc(p.nombre)}</h2>
      <div class="sub">${esc(p.servicio)} · Cama ${esc(p.cama)}</div>
      <button class="hoja-opcion" data-accion="cama">${ICO.cama} Cambiar de cama</button>
      <button class="hoja-opcion" data-accion="diagnostico">${ICO.doc} Cambiar diagnóstico o REM</button>
      <button class="hoja-opcion peligro" data-accion="egreso">${ICO.salida} Marcar salida</button>
      <button class="hoja-opcion" data-accion="cerrar" style="justify-content:center">Cancelar</button>
    </div>`;
  document.body.appendChild(velo);

  velo.addEventListener('click', (e) => {
    if (e.target === velo) velo.remove();
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (!accion) return;
    velo.remove();
    if (accion === 'cama')        hojaCambiarCama(p);
    if (accion === 'diagnostico') hojaDiagnostico(p);
    if (accion === 'egreso')      hojaEgreso(p);
  });
}

/**
 * Cambiar el diagnóstico o el código REM del episodio en curso.
 * Pasa poco, pero cuando pasa hay que poder corregirlo sin salir de la cama.
 * Como el cambio de cama, viaja con la siguiente sesión que registres.
 */
function hojaDiagnostico(p) {
  const rems = (estado.catalogos.rem && estado.catalogos.rem.length)
    ? estado.catalogos.rem
    : Array.from({ length: 27 }, (_, i) => String(i + 1));

  const opcionesRem = (valor) => `<option value="">Sin REM</option>` + rems.map(r => {
    const num = String(r).split('-')[0].trim();
    return `<option value="${esc(num)}" ${String(num) === String(valor) ? 'selected' : ''}>${esc(r)}</option>`;
  }).join('');

  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja">
      <h2>Diagnóstico y REM</h2>
      <div class="sub">${esc(p.nombre)} · el cambio se aplica desde la próxima sesión</div>

      <div class="campo">
        <label for="dxDiag1">Diagnóstico 1</label>
        <input type="text" id="dxDiag1" value="${esc(p.diagnostico1 || '')}">
      </div>
      <div class="campo">
        <label for="dxRem1">REM 1</label>
        <select id="dxRem1">${opcionesRem(p.rem1)}</select>
      </div>
      <div class="campo">
        <label for="dxDiag2">Diagnóstico 2 · opcional</label>
        <input type="text" id="dxDiag2" value="${esc(p.diagnostico2 || '')}">
      </div>
      <div class="campo">
        <label for="dxRem2">REM 2</label>
        <select id="dxRem2">${opcionesRem(p.rem2)}</select>
      </div>

      <div class="acciones">
        <button class="btn btn-secundario" data-accion="cerrar">Cancelar</button>
        <button class="btn btn-primario" data-accion="guardar">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(velo);

  velo.addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (e.target === velo || accion === 'cerrar') { velo.remove(); return; }
    if (accion !== 'guardar') return;

    const diag1 = $('#dxDiag1').value.trim();
    const rem1 = $('#dxRem1').value;
    if (!diag1) { toast('El diagnóstico 1 no puede quedar vacío.', 'error'); return; }
    if (!rem1)  { toast('El REM 1 es obligatorio.', 'error'); return; }

    p.diagnostico1 = diag1;
    p.rem1 = rem1;
    p.diagnostico2 = $('#dxDiag2').value.trim();
    p.rem2 = $('#dxRem2').value;
    await DB.guardar('censo', p);

    velo.remove();
    cerrarPantalla();
    toast('Diagnóstico actualizado', 'ok');
  });
}

function hojaCambiarCama(p) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja">
      <h2>Cambiar de cama</h2>
      <div class="sub">${esc(p.nombre)} · actualmente en ${esc(p.servicio)} cama ${esc(p.cama)}</div>
      <div class="campo">
        <label for="nuevoServicio">Servicio</label>
        <select id="nuevoServicio">${selectOpciones(estado.catalogos.servicios || [], p.servicio)}</select>
      </div>
      <div class="campo">
        <label for="nuevaCama">Nueva cama</label>
        <input type="text" id="nuevaCama" inputmode="numeric" value="${esc(p.cama)}">
      </div>
      <div class="acciones">
        <button class="btn btn-secundario" data-accion="cerrar">Cancelar</button>
        <button class="btn btn-primario" data-accion="guardar">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(velo);

  velo.addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    if (e.target === velo || accion === 'cerrar') { velo.remove(); return; }
    if (accion !== 'guardar') return;

    const cama = $('#nuevaCama').value.trim();
    if (!cama) { toast('Falta el número de cama.', 'error'); return; }

    // El cambio es local: la cama nueva viaja con la próxima sesión que registres.
    // El historial no se rompe porque el paciente se identifica por RUT.
    p.cama = cama;
    p.servicio = $('#nuevoServicio').value || p.servicio;
    await DB.guardar('censo', p);
    velo.remove();
    cerrarPantalla();
    toast('Cama actualizada', 'ok');
  });
}

function hojaEgreso(p) {
  const velo = document.createElement('div');
  velo.className = 'velo';
  velo.innerHTML = `<div class="hoja">
      <h2>Marcar egreso</h2>
      <div class="sub">${esc(p.nombre)} saldrá de la ronda. Puedes recuperarlo mientras esté en Egresos recientes.</div>
      ${EGRESOS.map(([v, t]) => `<button class="hoja-opcion${v === 'Fallecimiento' ? ' peligro' : ''}" data-egreso="${esc(v)}">${t}</button>`).join('')}
      <button class="hoja-opcion" data-accion="cerrar" style="justify-content:center">Cancelar</button>
    </div>`;
  document.body.appendChild(velo);

  velo.addEventListener('click', async (e) => {
    if (e.target === velo || e.target.closest('[data-accion="cerrar"]')) { velo.remove(); return; }
    const motivo = e.target.closest('[data-egreso]')?.dataset.egreso;
    if (!motivo) return;
    velo.remove();
    await registrarEgreso(p, motivo);
  });
}

async function registrarEgreso(p, motivo) {
  const sesion = {
    uuid: uuid(),
    tipo: 'egreso',
    fecha: hoyISO(),
    servicio: p.servicio,
    'fonoaudiólogo': estado.config.fono,
    cama: p.cama,
    nombrePaciente: p.nombre,
    sexo: p.sexo,
    edad: String(p.edad),
    rut: p.rut,
    diagnosticos: [p.diagnostico1, p.diagnostico2 || ''],
    rems: [p.rem1, p.rem2 || ''],
    origen: p.origen,
    condicionHospitalizacion: [motivo],
    categorizacion: p.categorizacion || '',
    atencionesRealizadas: 0,
    brechas: 0,
    suspendidas: '',
    tipoEvaluacion: '',
    evaluaciones: [],
    intervenciones: {},
    eg: 0, ef: 0
  };

  estado.censo = estado.censo.filter(x => x.rut !== p.rut);
  await DB.borrar('censo', p.rut);

  const egresado = { ...p, motivoEgreso: motivo, uuidEgreso: sesion.uuid };
  estado.egresos.unshift(egresado);

  await encolar(sesion);
  cerrarPantalla();
  toast(`${p.nombre} egresó por ${motivo.toLowerCase()}`, 'ok');
}

/* ══════════════════════════════════════════════════════════════
   EGRESOS RECIENTES
   ══════════════════════════════════════════════════════════════ */
let egresosAbiertos = false;
function alternarEgresos() {
  egresosAbiertos = !egresosAbiertos;
  $('#bloqueEgresos').classList.toggle('abierto', egresosAbiertos);
  const lista = $('#listaEgresos');
  lista.classList.toggle('oculto', !egresosAbiertos);
  if (!egresosAbiertos) return;

  lista.innerHTML = estado.egresos.map(p => {
    const info = servicioInfo(p.servicio);
    return `<button class="tarjeta egresado" data-restaurar="${esc(p.rut)}">
        <span class="cama" style="background:${info.color}">${esc(p.cama)}</span>
        <span class="tarjeta-cuerpo">
          <span class="tarjeta-nombre">${esc(p.nombre)}</span>
          <span class="tarjeta-detalle">${esc(p.motivoEgreso)} · toca para devolver a la ronda</span>
        </span>
        <span class="tarjeta-estado estado-pend">${ICO.volver}</span>
      </button>`;
  }).join('') || `<div class="vacio"><p>Sin egresos recientes.</p></div>`;

  lista.querySelectorAll('[data-restaurar]').forEach(el => {
    el.addEventListener('click', () => restaurarEgreso(el.dataset.restaurar));
  });
}

async function restaurarEgreso(rut) {
  const p = estado.egresos.find(x => x.rut === rut);
  if (!p) return;

  // Si el egreso sigue en la bandeja, basta con descartarlo: nunca llegó a la planilla.
  const pendiente = estado.outbox.find(s => s.uuid === p.uuidEgreso);
  if (pendiente) {
    await DB.borrar('outbox', pendiente.uuid);
    estado.outbox = estado.outbox.filter(s => s.uuid !== pendiente.uuid);
  } else if (p.uuidEgreso) {
    // Ya se escribió: se pide al servidor que limpie las marcas de egreso de esa fila.
    try {
      await API.anular(p.uuidEgreso);
    } catch (err) {
      toast('No se pudo anular en la planilla: ' + err.message, 'error');
      return;
    }
  } else {
    toast('Ese egreso no lo registró la app. Corrígelo en la planilla.', 'error');
    return;
  }

  delete p.motivoEgreso;
  delete p.uuidEgreso;
  estado.egresos = estado.egresos.filter(x => x.rut !== rut);
  estado.censo.push(p);
  await DB.guardar('censo', p);

  alternarEgresos();
  alternarEgresos();
  pintar();
  toast(`${p.nombre} volvió a la ronda`, 'ok');
}

/* ══════════════════════════════════════════════════════════════
   PANTALLA DE INGRESO
   ══════════════════════════════════════════════════════════════ */
function pantallaIngreso() {
  const cont = abrirPantalla(`
    <div class="barra">
      <div class="barra-fila">
        <button class="icon-btn" id="btnAtras">${ICO.atras}</button>
        <div class="barra-titulo"><div class="eyebrow">Paciente nuevo</div><h1>Ingreso</h1></div>
      </div>
    </div>

    <main style="padding-top:12px">
      <div class="seccion">
        <div class="seccion-titulo">Identificación</div>
        <div class="campo">
          <label for="inRut">RUT</label>
          <input type="text" id="inRut" placeholder="12345678-9" autocomplete="off">
          <div class="ayuda">Si ya estuvo antes, se rellenan nombre, sexo y edad.</div>
        </div>
        <div id="avisoRut"></div>
        <div class="campo">
          <label for="inNombre">Nombre completo</label>
          <input type="text" id="inNombre">
        </div>
        <div class="fila-2">
          <div class="campo">
            <label for="inEdad">Edad</label>
            <input type="text" id="inEdad" placeholder="65 o 7 meses">
          </div>
          <div class="campo">
            <label>Sexo</label>
            ${chips('inSexo', [['MASCULINO','M'],['FEMENINO','F']])}
          </div>
        </div>
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Ubicación</div>
        <div class="fila-2">
          <div class="campo">
            <label for="inServicio">Servicio</label>
            <select id="inServicio">${selectOpciones(estado.catalogos.servicios || [], '')}</select>
          </div>
          <div class="campo">
            <label for="inCama">Cama</label>
            <input type="text" id="inCama" inputmode="numeric">
          </div>
        </div>
      </div>

      <div class="seccion">
        <div class="seccion-titulo">Diagnóstico</div>
        <div class="campo">
          <label for="inDiag">Diagnóstico principal</label>
          <input type="text" id="inDiag">
        </div>
        <div class="campo">
          <label for="inRem">Código REM</label>
          <select id="inRem"><option value="">Seleccione...</option></select>
        </div>
        <div class="campo">
          <label for="inOrigen">Origen</label>
          <input type="text" id="inOrigen" inputmode="numeric" placeholder="N° de origen">
        </div>
      </div>

      <div class="acciones">
        <button class="btn btn-secundario" id="btnCancelar">Cancelar</button>
        <button class="btn btn-primario" id="btnCrear">Registrar ingreso</button>
      </div>
    </main>`);

  // Catálogo REM desde la hoja Tablas; si no llegó, se usa la numeración 1-27.
  const rems = (estado.catalogos.rem && estado.catalogos.rem.length)
    ? estado.catalogos.rem
    : Array.from({ length: 27 }, (_, i) => String(i + 1));
  $('#inRem').innerHTML += rems.map(r => {
    const num = String(r).split('-')[0].trim();
    return `<option value="${esc(num)}">${esc(r)}</option>`;
  }).join('');

  $('#btnAtras').addEventListener('click', cerrarPantalla);
  $('#btnCancelar').addEventListener('click', cerrarPantalla);
  $('#inRut').addEventListener('change', buscarConocido);
  $('#btnCrear').addEventListener('click', crearIngreso);
}

/** Busca el RUT en el censo local y en la bandeja, sin necesidad de conexión. */
function buscarConocido() {
  const rut = $('#inRut').value.trim().toUpperCase();
  $('#inRut').value = rut;
  const n = normRut(rut);
  const aviso = $('#avisoRut');

  if (n.length < 7) { aviso.innerHTML = ''; return; }

  const previo = [...estado.censo, ...estado.egresos].find(p => normRut(p.rut) === n);
  if (!previo) {
    aviso.innerHTML = `<div class="banda info">Paciente nuevo. Completa los datos.</div>`;
    return;
  }

  $('#inNombre').value = previo.nombre || '';
  $('#inEdad').value = previo.edad || '';
  const sexo = $$('input[name="inSexo"]').find(x => x.value === previo.sexo);
  if (sexo) sexo.checked = true;
  if (previo.diagnostico1) $('#inDiag').value = previo.diagnostico1;
  if (previo.rem1) $('#inRem').value = String(previo.rem1);
  if (previo.origen) $('#inOrigen').value = previo.origen;

  aviso.innerHTML = `<div class="banda ok">
      <strong>Paciente conocido.</strong> Nombre, sexo y edad ya están puestos.
      <span class="meta">${previo.atencionesPrevias || 0} atenciones previas · verifica la edad</span>
    </div>`;
}

async function crearIngreso() {
  const rut = $('#inRut').value.trim().toUpperCase();
  const nombre = $('#inNombre').value.trim();
  const edad = $('#inEdad').value.trim();
  const sexo = leerRadio('inSexo');
  const servicio = $('#inServicio').value;
  const cama = $('#inCama').value.trim();
  const diag = $('#inDiag').value.trim();
  const rem = $('#inRem').value;

  const faltan = [];
  if (normRut(rut).length < 7) faltan.push('RUT');
  if (!nombre) faltan.push('nombre');
  if (!edad) faltan.push('edad');
  if (!sexo) faltan.push('sexo');
  if (!servicio) faltan.push('servicio');
  if (!cama) faltan.push('cama');
  if (!diag) faltan.push('diagnóstico');
  if (!rem) faltan.push('REM');
  if (faltan.length) { toast('Falta: ' + faltan.join(', '), 'error'); return; }

  if (estado.censo.some(p => normRut(p.rut) === normRut(rut))) {
    toast('Ese paciente ya está en la ronda.', 'error');
    return;
  }

  const paciente = {
    rut, nombre, sexo, edad,
    servicio, cama,
    diagnostico1: diag, rem1: rem,
    diagnostico2: '', rem2: '',
    origen: $('#inOrigen').value.trim(),
    ges: '', categorizacion: '',
    ultimaFecha: hoyISO(),
    diasSinAtencion: 0,
    atencionesPrevias: 0
  };

  const ingreso = {
    uuid: uuid(),
    tipo: 'ingreso',
    fecha: hoyISO(),
    servicio, cama, rut,
    'fonoaudiólogo': estado.config.fono,
    nombrePaciente: nombre, sexo, edad,
    diagnosticos: [diag, ''],
    rems: [rem, ''],
    origen: paciente.origen,
    condicionHospitalizacion: ['Ingreso'],
    categorizacion: '',
    atencionesRealizadas: 0,
    brechas: 0,
    suspendidas: '',
    tipoEvaluacion: '',
    evaluaciones: [],
    intervenciones: {},
    eg: 0, ef: 0
  };

  estado.censo.push(paciente);
  await DB.guardar('censo', paciente);
  await encolar(ingreso);

  cerrarPantalla();
  toast(`${nombre} ingresó en ${servicio} cama ${cama}`, 'ok');
}

/* ── Paciente ya egresado: solo lectura ── */
function pantallaEgresado(p) {
  abrirPantalla(`
    <div class="barra">
      <div class="barra-fila">
        <button class="icon-btn" id="btnAtras">${ICO.atras}</button>
        <div class="barra-titulo">
          <div class="eyebrow">Egresado · ${esc(p.motivoEgreso)}</div>
          <h1>${esc(p.nombre)}</h1>
        </div>
      </div>
    </div>
    <main style="padding-top:12px">
      <div class="banda warn">
        Este paciente ya egresó. Para volver a atenderlo, devuélvelo a la ronda desde
        <strong>Egresos recientes</strong>.
      </div>
      <button class="btn-bloque" id="btnVolverRonda">${ICO.volver} Devolver a la ronda</button>
    </main>`);

  $('#btnAtras').addEventListener('click', cerrarPantalla);
  $('#btnVolverRonda').addEventListener('click', async () => {
    await restaurarEgreso(p.rut);
    cerrarPantalla();
  });
}
