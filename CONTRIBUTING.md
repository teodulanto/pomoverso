# Cómo contribuir a Pomoverso

¡Gracias por querer sumar! Pomoverso es un Pomodoro en 3D donde cada pomodoro hace crecer un mundo. La forma más divertida de aportar es **crear un mundo nuevo**, pero también se agradecen correcciones, mejoras de rendimiento y traducciones.

## Puesta en marcha

```bash
npm install
npm run dev      # servidor local con recarga en caliente (http://localhost:5173)
npm run lint     # revisa errores
npm run build    # genera la versión de producción en dist/
```

Se necesita Node 20 o superior. Parámetros útiles en la URL durante el desarrollo:

- `?free` abre todos los mundos sin gastar monedas.
- `?debug` expone `window.__pw` en la consola (estado, mundos y control de cámara).
- `?hq` evita que el juego baje la calidad automáticamente en equipos lentos.

## Estructura

```
src/
  main.js            arranque
  styles.css         estilos de la interfaz
  core/              estado y guardado, motor 3D, cielo, bucle de render
  ui/                reloj y recompensas (timer), tienda de mundos (shop)
  lib/               piezas compartidas: ruido, texturas, isla, vegetación, objetos, personas
  worlds/            un archivo por mundo + index.js (registro)
    _plantilla.js    punto de partida para tu mundo
```

## Crear un mundo nuevo

1. Copia `src/worlds/_plantilla.js` a `src/worlds/<tu-mundo>.js` y cambia el `id`, la función `build...` y el contenido de `meta`.
2. Dibuja tu mundo con las piezas de `src/lib/` (isla, vegetación, rocas, personas, fogata...) o crea las tuyas.
3. Anima lo que ocurre durante el pomodoro en `update({ p, mode, night, t, dt })`:
   `p` va de 0 a 1 durante el enfoque; en el descanso (`mode === 'break'`) es de noche.
4. Registra tu mundo en `src/worlds/index.js` y añade su id a `counts` en `src/core/state.js`.
5. Prueba el ciclo completo con `?free&debug`, y asegúrate de que `npm run lint` y `npm run build` pasan.

El contrato exacto de un mundo (qué debe devolver `build...()`) está explicado al principio de `_plantilla.js`.

### Darle vida con personajes

Cada mundo cuenta una pequeña historia ligada al progreso `p` del pomodoro (por ejemplo: carga del barco, siembra y riego, cuenta atrás del cohete). Las piezas para hacerlo están en `src/lib/`:

- `people.js`: `makeActor({ shirt, pants, hat, scale... })` crea una persona; `walkTo(actor, x, z, dt, t, pose, [mirarX, mirarZ], { speed, ground })` la hace caminar y aplicar una pose: `carry`, `wave`, `cheer`, `bend`, `water`, `sit`, `lookUp`, `steer`. También `makeDog()`.
- `effects.js`: `makeConfetti(grupo)` (llámalo con `burst(x, y, z)` cuando termina el enfoque) y `makeWaterDrops(grupo)`.

Mira `forest.js` (función `story`) para un ejemplo corto y legible.

### Reglas del proyecto

- **Sin recursos externos:** nada de imágenes, modelos 3D, fuentes ni sonidos descargados. Todo se genera con código (texturas en canvas, geometría procedural). Así el proyecto es ligero y no hay problemas de derechos.
- **El tiempo manda:** lo que ocurre en el mundo debe depender del progreso `p` y no de un temporizador propio, para que pausar, reanudar y cambiar la duración funcionen siempre.
- **Rendimiento:** procura mantenerte por debajo de unas ~250 000 triángulos por mundo y usa mallas instanciadas para cosas repetidas (ver `makeGrass`).
- Comentarios y textos de la interfaz en español.

## Enviar cambios

1. Haz un fork y crea una rama (`git switch -c mundo-desierto`).
2. Un cambio por pull request, con una descripción corta y, si es visual, una captura.
3. La integración continua ejecuta `npm run lint` y `npm run build`.

## Licencia

Al contribuir aceptas que tu aporte se publique bajo la licencia [MIT](LICENSE) del proyecto.
