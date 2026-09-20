# Ronda Fonoaudiología

Registro de atenciones fonoaudiológicas hospitalarias al lado de la cama, **sin conexión**,
con cálculo automático del REM 28 y del REM 17.

Sustituye la libreta de papel y la digitación nocturna: la ronda se registra en el teléfono
durante el turno y se sincroniza sola contra una planilla de Google Sheets.

## Qué hace

- **Ronda** — lista de pacientes activos agrupados por servicio, ordenados por cama.
  Funciona al 100% sin señal. Cada sesión queda en el teléfono hasta que el servidor
  confirma que la escribió.
- **Dashboard** — REM 28 secciones B.1 a B.6 y REM 17, con desglose por rango etario y
  sexo, validación de cuadratura y alertas por reglas.
- **Informes** — cuatro informes en un PDF que se genera en el propio teléfono, con un
  resumen narrativo opcional redactado por Gemini sobre cifras sin identificar.

## Estructura

```
docs/          La aplicación. GitHub Pages sirve esta carpeta.
apps-script/   El código que va en el proyecto de Apps Script de la planilla.
```

## Instalación

1. Pega los cuatro archivos `.gs` y `Formulario.html` en el Apps Script de tu planilla.
2. Ejecuta `configurarToken()` una vez y copia la clave que aparece en el registro.
3. Implementa como aplicación web: *ejecutar como yo*, *acceso: cualquier usuario*.
4. Activa GitHub Pages sobre la carpeta `docs/`.
5. Abre la dirección resultante en Chrome y usa **Añadir a pantalla de inicio**.
6. En la app, pega la dirección `/exec` y la clave, y elige tu nombre.

## Privacidad

Datos de salud bajo la Ley 21.719 y la Ley 20.584.

- Los datos identificables viven en la planilla y en el teléfono. No pasan por terceros.
- Al resumen con IA solo se le envían cifras agregadas: totales, códigos REM, rangos
  etarios y conteos. **Nunca nombres, RUT ni camas.** La función
  `payloadSinIdentificar_` en `apps-script/Informes.gs` es la única puerta de salida.
- Este repositorio no contiene ningún dato de pacientes. El `.gitignore` bloquea `.csv` y
  `.xlsx` a propósito: **no subas la planilla acá.**
- Las claves de acceso y de Gemini viven en las propiedades del proyecto de Apps Script,
  nunca en este código.

## Sin dependencias

Ni librerías, ni empaquetadores, ni CDN. HTML, CSS y JavaScript planos, para que la app
arranque sin conexión y siga siendo legible dentro de unos años.
