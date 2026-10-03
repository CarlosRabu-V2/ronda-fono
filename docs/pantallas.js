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
   CONFIGURACIÓN
   ══════════════════════════════════════════════════════════════ */

/** Servicios de la hoja Tablas; sin ellos, los de la tabla de colores. */
function listaServicios() {
  const s = estado.catalogos && estado.catalogos.servicios;
  return (s && s.length) ? s : Object.keys(SERVICIOS);
}

function mostrarConfiguracion() {
  $('#app').classList.add('oculto');
  const c = $('#configuracion');
  c.classList.remove('oculto');

  const cfg = estado.config || {};
  const yaConfigurada = !!(cfg.url && cfg.token);
  const fonos = (estado.catalogos && estado.catalogos.fonoaudiólogos) || [];

  c.innerHTML = `<div class="centrado">
      <h1>${yaConfigurada ? 'Configuración' : 'Configurar la app'}</h1>
      <p>${yaConfigurada
        ? 'Si cambiaste la implementación en Apps Script, pega aquí la dirección nueva.'
        : 'Se hace una sola vez. Los datos quedan en este teléfono y no viajan a ninguna parte.'}</p>

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
            <select id="cfgFono">${cfg.fono
              ? selectOpciones(fonos.includes(cfg.fono) ? fonos : [cfg.fono, ...fonos], cfg.fono) : ''}</select>
            <div class="ayuda">La ronda mostrará solo tus pacientes.</div>
          </div>
          <div class="campo">
            <label>Servicios que también cubres</label>
            <div id="cfgServicios">${chipsServicios(cfg.servicios || SERVICIOS_INICIALES)}</div>
            <div class="ayuda">Sus pacientes aparecen en tu ronda aunque los haya registrado
              otra fonoaudióloga. Por ejemplo, UTI si vas algunos días a la semana. No marques
              tus servicios de todos los días: sus pacientes dejarían de contar en tu avance.</div>
          </div>
        </div>
      </div>

      <div class="seccion">
        <button class="btn-bloque" id="cfgTema" type="button">
          ${ICO.luna} <span id="cfgTemaTxt">${
            temaEfectivo() === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}</span>
        </button>
      </div>

      <div class="acciones">
        ${yaConfigurada ? '<button class="btn btn-secundario" id="btnCancelarCfg">Cancelar</button>' : ''}
        <button class="btn btn-primario" id="btnProbar">${cfg.fono ? 'Guardar' : 'Conectar'}</button>
      </div>
      <div id="cfgAviso"></div>
    </div>`;

  $('#btnProbar').addEventListener('click', guardarConfiguracion);
  $('#cfgTema').addEventListener('click', async () => {
    await alternarTema();
    $('#cfgTemaTxt').textContent = temaEfectivo() === 'oscuro'
      ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';
  });
  const cancelar = $('#btnCancelarCfg');
  if (cancelar) cancelar.addEventListener('click', () => { mostrarApp(); pintar(); });
}

/** Para una instalación nueva: la usuaria cubre UTI una o dos veces por semana. */
const SERVICIOS_INICIALES = ['UTI'];

function chipsServicios(marcados) {
  return chips('cfgServ', listaServicios().map(s => [s, s]), { tipo: 'checkbox', valor: marcados });
}

/** Dirección y clave ya probadas en esta pantalla, para no volver a probarlas al guardar. */
let conexionProbada = null;

/**
 * Un solo botón para todo. Si la dirección o la clave cambiaron, primero se
 * prueba la conexión y se traen los nombres; si no, se guarda directamente,
 * aunque no haya señal: cambiar los servicios cubiertos no necesita red.
 */
async function guardarConfiguracion() {
  const url = $('#cfgUrl').value.trim();
  const token = $('#cfgToken').value.trim();
  const aviso = $('#cfgAviso');
  const cfg = estado.config || {};

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

  const igual = (c) => c && c.url === url && c.token === token;
  const paso2Visible = !$('#cfgPaso2').classList.contains('oculto');
  if (!paso2Visible || !(igual(cfg) || igual(conexionProbada))) {
    await probarConexion(url, token, paso2Visible);
    return;
  }

  const fono = $('#cfgFono').value;
  if (!fono) { aviso.innerHTML = `<div class="banda warn">Elige tu nombre.</div>`; return; }
  const servicios = leerChecks('cfgServ');

  const cambioRonda = !igual(cfg) || fono !== cfg.fono ||
    JSON.stringify(servicios) !== JSON.stringify(cfg.servicios || []);
  estado.config = { url, token, fono, servicios };
  await DB.guardar('config', estado.config, 'app');
  conexionProbada = null;
  mostrarApp();
  pintar();
  // Otro nombre u otros servicios son otra ronda: se trae de inmediato. Si
  // ya había una actualización en curso, salió con la configuración de antes.
  if (cambioRonda || !estado.actualizado) actualizar({ config: true });
}

/** @param {boolean} paso2Visible Si ella ya estaba eligiendo nombre y servicios: se respeta lo elegido. */
async function probarConexion(url, token, paso2Visible) {
  const aviso = $('#cfgAviso');
  const btn = $('#btnProbar');
  btn.disabled = true;
  btn.textContent = 'Conectando…';
  aviso.innerHTML = '';

  const anterior = estado.config;
  // Lo que ya tenía elegido en pantalla, o lo guardado, para no obligar a elegirlo de nuevo.
  const fonoAnterior = (paso2Visible && $('#cfgFono').value) || (anterior && anterior.fono) || '';
  const marcados = paso2Visible ? leerChecks('cfgServ')
                                : ((anterior && anterior.servicios) || SERVICIOS_INICIALES);
  try {
    const r = await API.ping(url, token);

    // Con la conexión probada, se piden los nombres para elegir el tuyo. El
    // Apps Script nuevo los manda con el ping; el anterior solo con el censo,
    // pedido con esta configuración sin tocar la guardada (una actualización
    // en curso la estaría usando).
    const catalogos = r.catalogos ||
      (await API.censo(0, { url, token, fono: '', servicios: [] })).catalogos;
    if (catalogos) estado.catalogos = catalogos;
    const fonos = (catalogos && catalogos.fonoaudiólogos) || [];

    $('#cfgPaso2').classList.remove('oculto');
    $('#cfgFono').innerHTML = selectOpciones(fonos, fonoAnterior);
    $('#cfgServicios').innerHTML = chipsServicios(marcados);
    aviso.innerHTML = `<div class="banda ok">Conectado a la hoja <strong>${esc(r.hoja)}</strong>. Elige tu nombre y guarda.</div>`;
    conexionProbada = { url, token };
    btn.textContent = 'Guardar y empezar';

  } catch (err) {
    // "Failed to fetch" no dice nada útil. Casi siempre es que la dirección ya
    // no existe: Google responde con una página de error sin cabeceras de
    // permiso y el navegador lo informa como si fuera un problema de CORS.
    aviso.innerHTML = err.red
      ? `<div class="banda warn"><strong>No hubo respuesta de esa dirección.</strong>
           <span class="meta">Lo más probable es que la implementación haya cambiado.
           En Apps Script: Implementar → Gestionar implementaciones, y copia la URL de la
           que esté <em>activa</em>. Si solo quieres actualizar el código, usa el lápiz
           y "Nueva versión": así la dirección no cambia.</span></div>`
      : `<div class="banda warn">No se pudo conectar: ${esc(err.message)}</div>`;
    btn.textContent = 'Conectar';
  } finally {
    btn.disabled = false;
  }
}

/* ══════════════════════════════════════════════════════════════
   ARMAZÓN DE LA APP
   ══════════════════════════════════════════════════════════════ */
function mostrarApp() {
  $('#configuracion').classList.add('oculto');
  $('#app').classList.remove('oculto');
  pintarFecha();
  conectarArmazon();
}

let armazonConectado = false;
function conectarArmazon() {
  if (armazonConectado) return;
  armazonConectado = true;

  $('#buscadorCerrado').addEventListener('click', () => alternarBuscador(true));
  $('#btnCerrarBuscar').addEventListener('click', () => alternarBuscador(false));
  $('#inputBuscar').addEventListener('input', (e) => { estado.busqueda = e.target.value; pintarRonda(); });

  // La píldora y el botón hacen lo mismo: actualizar. Si hay registros que la
  // planilla rechazó, la píldora abre la bandeja para corregirlos.
  $('#pillSync').addEventListener('click', () => {
    if (estado.outbox.some(s => s.error)) abrirBandeja(); else actualizar();
  });
  $('#btnRefrescar').addEventListener('click', () => actualizar());
  $('#btnAjustes').addEventListener('click', mostrarConfiguracion);
  $('#fab').addEventListener('click', () => pantallaIngreso());
  $('#bloqueEgresos').addEventListener('click', alternarEgresos);

  $$('.nav button').forEach(b => b.addEventListener('click', () => irA(b.dataset.vista)));
}

/**
 * El tema que se ve de verdad. Sin elección manual, manda el del sistema; mirar
 * solo el atributo hacía que el primer toque no cambiara nada en un teléfono
 * que ya estaba en modo oscuro.
 */
function temaEfectivo() {
  const elegido = document.documentElement.dataset.tema;
  if (elegido === 'oscuro' || elegido === 'claro') return elegido;
  return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
}

async function alternarTema() {
  const nuevo = temaEfectivo() === 'oscuro' ? 'claro' : 'oscuro';
  document.documentElement.dataset.tema = nuevo;
  await DB.guardar('config', nuevo, 'tema');
}

function irA(vista) {
  estado.vista = vista;
  $$('.nav button').forEach(b => b.classList.toggle('activo', b.dataset.vista === vista));
  $('#pantalla').classList.add('oculto');
  $('#pantalla').innerHTML = '';
  $('#app').classList.remove('en-pantalla');
  $('#ronda').classList.toggle('oculto', vista !== 'ronda');
  $('#dashboard').classList.toggle('oculto', vista !== 'dashboard');
  $('#informes').classList.toggle('oculto', vista !== 'informes');
  window.scrollTo(0, 0);

  if (vista === 'dashboard')     abrirDashboard();
  else if (vista === 'informes') abrirInformes();
  else pintar();
}

/**
 * Abre una pantalla a pantalla completa por encima de la ronda.
 *
 * Mientras está abierta se esconde la barra inferior: tapaba el botón Guardar
 * y un toque en ella cambiaba de vista y perdía lo escrito. Y se deja una
 * entrada en el historial, para que el gesto "atrás" de Android cierre la
 * pantalla en vez de cerrar la app.
 */
function abrirPantalla(html) {
  const p = $('#pantalla');
  p.innerHTML = html;
  p.classList.remove('oculto');
  $('#ronda').classList.add('oculto');
  $('#app').classList.add('en-pantalla');
  if (!(history.state && history.state.pantalla)) history.pushState({ pantalla: true }, '');
  // Dos pasadas: al cambiar qué elemento está visible el navegador conserva el
  // scroll de la lista, y un scrollTo inmediato se pierde en ese reajuste.
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  return p;
}

/** Cierra consumiendo la entrada del historial; el cierre de verdad lo hace popstate. */
function cerrarPantalla() {
  if (history.state && history.state.pantalla) { history.back(); return; }
  ocultarPantalla();
}

function ocultarPantalla() {
  $('#pantalla').classList.add('oculto');
  $('#pantalla').innerHTML = '';
  $('#app').classList.remove('en-pantalla');
  $$('.velo').forEach(v => v.remove());
  if (estado.vista === 'ronda') $('#ronda').classList.remove('oculto');
  window.scrollTo(0, 0);
  requestAnimationFrame(() => window.scrollTo(0, 0));
  pintar();
}

window.addEventListener('popstate', () => {
  const abierta = !$('#pantalla').classList.contains('oculto');
  const velos = $$('.velo');
  if (abierta && velos.length) {
    // Con una hoja abierta encima, atrás cierra solo la hoja (como tocar
    // fuera de ella) y la sesión a medio llenar sigue ahí.
    velos[velos.length - 1].click();
    history.pushState({ pantalla: true }, '');
    return;
  }
  if (abierta) ocultarPantalla();
});

/**
 * El paciente tal como está ahora en la ronda. Si una actualización terminó
 * con la pantalla abierta, el objeto que se abrió ya no es el de la lista, y
 * lo guardado en él no se vería.
 */
function vigente(p) {
  return estado.censo.find(x => normRut(x.rut) === normRut(p.rut)) || p;
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
          <div class="eyebrow" id="sesUbicacion">${esc(p.servicio)} · Cama ${esc(p.cama)}</div>
          <h1>${esc(p.nombre)}</h1>
        </div>
        <button class="icon-btn" id="btnMenu">${ICO.menu}</button>
      </div>
    </div>

    <main style="padding-top:12px">
      <div class="banda info">
        <span id="sesDx">${textoDiagnostico(p)}</span>
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
  $('#btnMenu').addEventListener('click', () => hojaAcciones(vigente(p)));
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

const textoDiagnostico = (p) =>
  `${esc(p.diagnostico1)}${p.rem1 ? ' · REM ' + esc(p.rem1) : ''}${p.ges ? ' · GES ' + esc(p.ges) : ''}`;

/** Tras cambiar cama o diagnóstico desde el menú, la sesión a medio llenar sigue abierta. */
function refrescarCabeceraSesion(p) {
  const ubic = $('#sesUbicacion');
  if (ubic) ubic.textContent = `${p.servicio} · Cama ${p.cama}`;
  const dx = $('#sesDx');
  if (dx) dx.innerHTML = textoDiagnostico(p);
}

/** Después de registrar se vuelve a la lista completa: con la búsqueda puesta parecía que el resto se había borrado. */
function limpiarBusqueda() {
  if (estado.busqueda || estado.buscadorAbierto) alternarBuscador(false);
}

async function guardarSesion(p) {
  // Un segundo toque mientras se guarda crearía otra fila con la misma atención.
  const btn = $('#btnGuardar');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  let guardada = false;
  try {
    guardada = await guardarSesionYa(vigente(p));
  } finally {
    if (!guardada) btn.disabled = false;
  }
}

async function guardarSesionYa(p) {
  // Sin estos datos la planilla rechaza la fila y la sesión se quedaría en la
  // bandeja reintentándose para siempre. Mejor pedirlos ahora, al lado de la cama.
  if (!await completarSiFalta(p)) return false;

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
    edad: String(p.edad ?? ''),
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

  // Cómo estaba el paciente, por si la sesión termina descartada en la bandeja.
  sesion.previo = { ultimaFecha: p.ultimaFecha, ultimaFechaMia: ultimaMia(p), fono: p.fono,
                    diasSinAtencion: p.diasSinAtencion, atencionesPrevias: p.atencionesPrevias,
                    categorizacion: p.categorizacion };

  // El censo local refleja el registro de inmediato, aunque no haya red.
  p.ultimaFecha = sesion.fecha;
  p.ultimaFechaMia = sesion.fecha;
  p.fono = estado.config.fono;
  p.diasSinAtencion = 0;
  p.atencionesPrevias = (p.atencionesPrevias || 0) + 1;
  if (sesion.categorizacion) p.categorizacion = sesion.categorizacion;
  await DB.guardar('censo', p);

  await encolar(sesion);
  cerrarPantalla();
  limpiarBusqueda();
  toast('Sesión guardada', 'ok');
  return true;
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
/** Catálogo REM desde la hoja Tablas; si no llegó, la numeración 1-27. */
function opcionesRem(valor, vacio = 'Sin REM') {
  const rems = (estado.catalogos.rem && estado.catalogos.rem.length)
    ? estado.catalogos.rem
    : Array.from({ length: 27 }, (_, i) => String(i + 1));
  return `<option value="">${esc(vacio)}</option>` + rems.map(r => {
    const num = String(r).split('-')[0].trim();
    return `<option value="${esc(num)}" ${String(num) === String(valor) ? 'selected' : ''}>${esc(r)}</option>`;
  }).join('');
}

/**
 * Un cambio hecho en el teléfono (cama, diagnóstico, un dato que faltaba) vive
 * en el censo local hasta que una sesión lo lleve a la planilla. Se anota
 * aparte para que el botón Actualizar no lo pise con el valor antiguo.
 */
function anotarCambio(p, valores) {
  const previos = (p.cambios && p.cambios.valores) || {};
  p.cambios = { fecha: hoyISO(), valores: { ...previos, ...valores } };
}

function hojaDiagnostico(p) {
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
    anotarCambio(p, { diagnostico1: p.diagnostico1, rem1: p.rem1,
                      diagnostico2: p.diagnostico2, rem2: p.rem2 });
    await DB.guardar('censo', p);

    // Se queda en la sesión: cerrarla perdía lo que ya estaba anotado.
    velo.remove();
    refrescarCabeceraSesion(p);
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
        <select id="nuevoServicio">${selectOpciones(listaServicios(), p.servicio)}</select>
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
    anotarCambio(p, { cama: p.cama, servicio: p.servicio });
    await DB.guardar('censo', p);
    // Se queda en la sesión: cerrarla perdía lo que ya estaba anotado.
    velo.remove();
    refrescarCabeceraSesion(p);
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
  p = vigente(p);
  // La planilla exige los mismos datos para un egreso que para una sesión.
  if (!await completarSiFalta(p)) return;

  const sesion = {
    uuid: uuid(),
    tipo: 'egreso',
    fecha: hoyISO(),
    servicio: p.servicio,
    'fonoaudiólogo': estado.config.fono,
    cama: p.cama,
    nombrePaciente: p.nombre,
    sexo: p.sexo,
    edad: String(p.edad ?? ''),
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
  // Guardado ya: si la app se cierra antes de enviarlo, el egreso no puede
  // quedar solo en memoria, o el paciente desaparecería de las dos listas.
  await guardarCacheLocal();

  await encolar(sesion);
  cerrarPantalla();
  limpiarBusqueda();
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

/** RUT que se están devolviendo a la ronda: un segundo toque no lo duplica. */
const restaurando = new Set();

/** @returns {Promise<boolean>} Si volvió a la ronda. */
async function restaurarEgreso(rut) {
  if (restaurando.has(rut)) return false;
  restaurando.add(rut);
  try {
    return await restaurarEgresoYa(rut);
  } finally {
    restaurando.delete(rut);
  }
}

async function restaurarEgresoYa(rut) {
  // Una ronda que está bajando se leyó antes de deshacer, y volvería a dejar
  // al paciente como egresado: se espera a que termine.
  if (actualizacion) await actualizacion;
  // Con un envío en marcha no se sabe todavía si el egreso llegó a la planilla.
  do { await Sync.esperar(); } while (Sync.enCurso);
  const p = estado.egresos.find(x => x.rut === rut);
  if (!p) return false;

  let pendiente = estado.outbox.find(s => s.uuid === p.uuidEgreso);
  if (pendiente && pendiente.intentado) {
    // Ya se mandó una vez y no hubo respuesta: con mala señal la planilla
    // pudo escribirlo igual. Borrarlo solo del teléfono dejaría el egreso en la
    // planilla. Se termina de enviar y después se anula allá.
    toast('Confirmando con la planilla…', 'info');
    try { await Sync.enviar(); } catch (err) { /* se informa abajo */ }
    do { await Sync.esperar(); } while (Sync.enCurso);
    pendiente = estado.outbox.find(s => s.uuid === p.uuidEgreso);
    if (pendiente && !pendiente.error) {
      toast('Sin conexión con la planilla. Vuelve a intentarlo con señal.', 'error');
      return false;
    }
  }

  if (pendiente) {
    // Nunca se envió, o la planilla lo rechazó: no está escrito en ninguna parte.
    // Sale de la bandeja antes de cualquier espera, para que ningún envío lo tome.
    estado.outbox = estado.outbox.filter(s => s.uuid !== pendiente.uuid);
    await DB.borrar('outbox', pendiente.uuid);
  } else if (p.uuidEgreso) {
    // Ya se escribió: se pide al servidor que limpie las marcas de egreso de esa fila.
    try {
      await API.anular(p.uuidEgreso);
      marcarCambio(hoyISO().slice(0, 7));
    } catch (err) {
      toast('No se pudo anular en la planilla: ' + err.message, 'error');
      return false;
    }
  } else {
    toast('Ese egreso no lo registró la app. Corrígelo en la planilla.', 'error');
    return false;
  }

  delete p.motivoEgreso;
  delete p.uuidEgreso;
  estado.egresos = estado.egresos.filter(x => x.rut !== rut);
  if (!estado.censo.some(x => normRut(x.rut) === normRut(p.rut))) estado.censo.push(p);
  await DB.guardar('censo', p);
  await guardarCacheLocal();

  alternarEgresos();
  alternarEgresos();
  pintar();
  toast(`${p.nombre} volvió a la ronda`, 'ok');
  return true;
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
            <select id="inServicio">${selectOpciones(listaServicios(), '')}</select>
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

  $('#inRem').innerHTML = opcionesRem('', 'Seleccione...');

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
  // Un segundo toque mientras se guarda registraría el ingreso dos veces.
  const btn = $('#btnCrear');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  let creado = false;
  try {
    creado = await crearIngresoYa();
  } finally {
    if (!creado) btn.disabled = false;
  }
}

async function crearIngresoYa() {
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
    fono: estado.config.fono,
    ultimaFecha: hoyISO(),
    ultimaFechaMia: hoyISO(),
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
  limpiarBusqueda();
  toast(`${nombre} ingresó en ${servicio} cama ${cama}`, 'ok');
  return true;
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
  const btn = $('#btnVolverRonda');
  btn.addEventListener('click', async () => {
    // Con mala señal confirmar con la planilla tarda: el botón queda ocupado, y
    // al terminar solo se cierra esta pantalla si sigue abierta (no otra sesión
    // que ella haya empezado mientras tanto).
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = 'Confirmando con la planilla…';
    const ok = await restaurarEgreso(p.rut);
    if (!document.body.contains(btn)) return;
    if (ok) { cerrarPantalla(); return; }
    btn.disabled = false;
    btn.innerHTML = `${ICO.volver} Devolver a la ronda`;
  });
}

/* ══════════════════════════════════════════════════════════════
   DATOS FALTANTES
   La planilla rechaza una fila sin servicio, cama, nombre, edad, sexo,
   diagnóstico o REM (validarDatos_ en Codigo.gs). Algunos pacientes antiguos
   tienen alguno vacío; sin esta revisión, sus sesiones quedaban en la bandeja
   y cada actualización volvía a mostrar el mismo error.
   ══════════════════════════════════════════════════════════════ */

/** Lo mismo que exige validarDatos_, mirado sobre el paciente. */
function faltantesPaciente(p) {
  const vacio = (v) => !String(v ?? '').trim();
  const f = [];
  if (vacio(p.nombre))       f.push('nombre');
  if (vacio(p.servicio))     f.push('servicio');
  if (vacio(p.cama))         f.push('cama');
  if (vacio(p.edad))         f.push('edad');
  if (vacio(p.sexo))         f.push('sexo');
  if (vacio(p.diagnostico1)) f.push('diagnostico');
  if (!/^\s*\d/.test(String(p.rem1 ?? ''))) f.push('rem');
  return f;
}

/** Si al paciente le falta algo, lo pide antes de seguir. Devuelve false si ella cancela. */
async function completarSiFalta(p) {
  const faltan = faltantesPaciente(p);
  if (!faltan.length) return true;
  const valores = await hojaCompletar(p, faltan);
  if (!valores) return false;
  Object.assign(p, valores);
  anotarCambio(p, valores);
  if (estado.censo.includes(p)) await DB.guardar('censo', p);
  return true;
}

/**
 * Hoja con solo los campos que faltan.
 * @returns {Promise<object|null>} Los valores completados, o null si se cancela.
 */
function hojaCompletar(p, faltan) {
  const campos = {
    nombre:      () => `<div class="campo"><label for="cpNombre">Nombre completo</label>
                          <input type="text" id="cpNombre" value="${esc(p.nombre || '')}"></div>`,
    servicio:    () => `<div class="campo"><label for="cpServicio">Servicio</label>
                          <select id="cpServicio">${selectOpciones(listaServicios(), p.servicio)}</select></div>`,
    cama:        () => `<div class="campo"><label for="cpCama">Cama</label>
                          <input type="text" id="cpCama" inputmode="numeric" value="${esc(p.cama || '')}"></div>`,
    edad:        () => `<div class="campo"><label for="cpEdad">Edad</label>
                          <input type="text" id="cpEdad" placeholder="65 o 7 meses" value="${esc(p.edad ?? '')}"></div>`,
    sexo:        () => `<div class="campo"><label>Sexo</label>
                          ${chips('cpSexo', [['MASCULINO','M'],['FEMENINO','F']], { valor: p.sexo })}</div>`,
    diagnostico: () => `<div class="campo"><label for="cpDiag">Diagnóstico</label>
                          <input type="text" id="cpDiag" value="${esc(p.diagnostico1 || '')}"></div>`,
    rem:         () => `<div class="campo"><label for="cpRem">Código REM</label>
                          <select id="cpRem">${opcionesRem(p.rem1, 'Seleccione...')}</select></div>`
  };

  return new Promise((listo) => {
    const velo = document.createElement('div');
    velo.className = 'velo';
    velo.innerHTML = `<div class="hoja">
        <h2>Faltan datos</h2>
        <div class="sub">La planilla no acepta el registro de ${esc(p.nombre || 'este paciente')}
          sin estos datos. Quedan guardados para las próximas sesiones.</div>
        ${faltan.map(k => campos[k]()).join('')}
        <div class="acciones">
          <button class="btn btn-secundario" data-accion="cerrar">Cancelar</button>
          <button class="btn btn-primario" data-accion="guardar">Continuar</button>
        </div>
      </div>`;
    document.body.appendChild(velo);

    velo.addEventListener('click', (e) => {
      const accion = e.target.closest('[data-accion]')?.dataset.accion;
      if (e.target === velo || accion === 'cerrar') { velo.remove(); listo(null); return; }
      if (accion !== 'guardar') return;

      const leer = {
        nombre:      () => ['nombre', $('#cpNombre').value.trim().toUpperCase()],
        servicio:    () => ['servicio', $('#cpServicio').value],
        cama:        () => ['cama', $('#cpCama').value.trim()],
        edad:        () => ['edad', $('#cpEdad').value.trim()],
        sexo:        () => ['sexo', leerRadio('cpSexo')],
        diagnostico: () => ['diagnostico1', $('#cpDiag').value.trim()],
        rem:         () => ['rem1', $('#cpRem').value]
      };
      const valores = {};
      const vacios = [];
      faltan.forEach(k => {
        const [campo, v] = leer[k]();
        if (!v) vacios.push(k === 'diagnostico' ? 'diagnóstico' : k === 'rem' ? 'REM' : k);
        valores[campo] = v;
      });
      if (vacios.length) { toast('Falta: ' + vacios.join(', '), 'error'); return; }
      velo.remove();
      listo(valores);
    });
  });
}

/* ══════════════════════════════════════════════════════════════
   BANDEJA — lo que todavía no está en la planilla
   Antes, una sesión rechazada quedaba guardada con su motivo pero sin
   ningún lugar donde verlo: solo se notaba en el contador de la píldora.
   ══════════════════════════════════════════════════════════════ */
const TIPO_REGISTRO = { sesion: 'Sesión', ingreso: 'Ingreso', egreso: 'Egreso' };

/** La sesión con los nombres de campo del paciente, para revisarla con las mismas reglas. */
const sesionComoPaciente = (s) => ({
  nombre: s.nombrePaciente, servicio: s.servicio, cama: s.cama, edad: s.edad, sexo: s.sexo,
  diagnostico1: (s.diagnosticos || [])[0], rem1: (s.rems || [])[0]
});

function abrirBandeja() {
  const velo = document.createElement('div');
  velo.className = 'velo';
  document.body.appendChild(velo);

  let porDescartar = null;
  const pintarBandeja = () => {
    porDescartar = null;   // cualquier repintado desarma la confirmación pendiente
    if (!estado.outbox.length) { velo.remove(); pintar(); return; }
    velo.innerHTML = `<div class="hoja">
        <h2>Sin enviar a la planilla</h2>
        <div class="sub">Siguen guardados en este teléfono. Los que tienen error no se
          reenvían hasta que los corrijas.</div>
        ${estado.outbox.map(s => `
          <div class="bandeja-item${s.error ? ' con-error' : ''}">
            <div class="bandeja-cab">
              <strong>${esc(s.nombrePaciente || s.rut)}</strong>
              <span>${esc(TIPO_REGISTRO[s.tipo] || 'Registro')} · ${esc(fechaCorta(s.fecha))}</span>
            </div>
            ${s.error ? `<div class="bandeja-error">${ICO.alerta} ${esc(s.error)}</div>` : ''}
            <div class="bandeja-acciones">
              ${s.error ? `<button class="btn btn-secundario" data-corregir="${esc(s.uuid)}">Corregir</button>` : ''}
              <button class="btn btn-secundario" data-descartar="${esc(s.uuid)}">Descartar</button>
            </div>
          </div>`).join('')}
        <div class="acciones">
          <button class="btn btn-secundario" data-accion="cerrar">Cerrar</button>
          <button class="btn btn-primario" data-accion="enviar">${ICO.volver} Actualizar</button>
        </div>
      </div>`;
  };
  pintarBandeja();

  velo.addEventListener('click', async (e) => {
    const accion = e.target.closest('[data-accion]')?.dataset.accion;
    // Al cerrar se repinta la ronda: descartar o corregir pudo cambiarla.
    if (e.target === velo || accion === 'cerrar') { velo.remove(); pintar(); return; }
    if (accion === 'enviar') { velo.remove(); actualizar(); return; }

    const corregir = e.target.closest('[data-corregir]')?.dataset.corregir;
    if (corregir) { await corregirRegistro(corregir); pintarBandeja(); pintarEstadoSync(); return; }

    const btn = e.target.closest('[data-descartar]');
    if (!btn) return;
    const reg = estado.outbox.find(x => x.uuid === btn.dataset.descartar);
    if (reg && reg.intentado && !reg.error) {
      // Ya se mandó y no hubo respuesta: puede estar escrito en la planilla.
      toast('Se está confirmando con la planilla. Toca Actualizar con señal antes de descartarlo.', 'info');
      return;
    }
    // Descartar borra un registro que no está en ninguna otra parte: pide un segundo toque.
    if (porDescartar !== btn.dataset.descartar) {
      porDescartar = btn.dataset.descartar;
      btn.textContent = '¿Seguro? Toca otra vez';
      btn.classList.add('btn-peligro');
      return;
    }
    await descartarRegistro(porDescartar);
    porDescartar = null;
    pintarBandeja();
    pintarEstadoSync();
  });
}

/** Completa lo que la planilla pidió y deja el registro listo para reenviarse. */
async function corregirRegistro(id) {
  const s = estado.outbox.find(x => x.uuid === id);
  if (!s) return;
  const datos = sesionComoPaciente(s);
  const faltan = faltantesPaciente(datos);
  if (faltan.length) {
    const valores = await hojaCompletar(datos, faltan);
    if (!valores) return;
    if ('nombre' in valores)       s.nombrePaciente = valores.nombre;
    if ('servicio' in valores)     s.servicio = valores.servicio;
    if ('cama' in valores)         s.cama = valores.cama;
    if ('edad' in valores)         s.edad = valores.edad;
    if ('sexo' in valores)         s.sexo = valores.sexo;
    if ('diagnostico1' in valores) s.diagnosticos = [valores.diagnostico1, (s.diagnosticos || [])[1] || ''];
    if ('rem1' in valores)         s.rems = [valores.rem1, (s.rems || [])[1] || ''];

    // El paciente de la ronda se corrige igual, para que la próxima sesión salga completa.
    const p = estado.censo.find(x => normRut(x.rut) === normRut(s.rut));
    if (p) {
      Object.assign(p, valores);
      anotarCambio(p, valores);
      await DB.guardar('censo', p);
    }
  }
  // Sin nada que completar, el error vino de otra parte: se reintenta tal cual.
  delete s.error;
  await DB.guardar('outbox', s);
  toast('Corregido. Se enviará al actualizar.', 'ok');
  Sync.enSegundoPlano();
}

async function descartarRegistro(id) {
  do { await Sync.esperar(); } while (Sync.enCurso);
  const s = estado.outbox.find(x => x.uuid === id);
  if (!s) { toast('Ya llegó a la planilla: no se puede descartar.', 'info'); return; }
  if (s.intentado && !s.error) {
    toast('Se está confirmando con la planilla. Toca Actualizar con señal antes de descartarlo.', 'info');
    return;
  }
  // Sale de la bandeja antes de cualquier espera, para que ningún envío lo tome.
  estado.outbox = estado.outbox.filter(x => x.uuid !== id);
  await DB.borrar('outbox', id);

  // Una sesión descartada no cuenta como atención: el paciente vuelve a como
  // estaba antes de registrarla, salvo que haya otra sesión suya igual o más
  // reciente esperando, que es la que manda.
  if (s.tipo === 'sesion' && s.previo &&
      !estado.outbox.some(x => x.tipo === 'sesion' && x.fecha >= s.fecha && normRut(x.rut) === normRut(s.rut))) {
    const p = estado.censo.find(x => normRut(x.rut) === normRut(s.rut));
    if (p) {
      Object.assign(p, s.previo);
      await DB.guardar('censo', p);
    }
  }

  // Un egreso descartado devuelve al paciente a la ronda; un ingreso
  // descartado lo saca, porque la planilla nunca supo de él.
  if (s.tipo === 'egreso') {
    const p = estado.egresos.find(x => x.uuidEgreso === id);
    if (p) {
      delete p.motivoEgreso;
      delete p.uuidEgreso;
      estado.egresos = estado.egresos.filter(x => x !== p);
      estado.censo.push(p);
      await DB.guardar('censo', p);
    }
  } else if (s.tipo === 'ingreso' && !estado.outbox.some(x => normRut(x.rut) === normRut(s.rut))) {
    const p = estado.censo.find(x => normRut(x.rut) === normRut(s.rut));
    if (p && !p.atencionesPrevias) {
      estado.censo = estado.censo.filter(x => x !== p);
      await DB.borrar('censo', p.rut);
    }
  }
  await guardarCacheLocal();
  toast('Registro descartado', 'info');
}
