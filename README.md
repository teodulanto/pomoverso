# Pomoverso

Un temporizador Pomodoro gamificado en 3D. Cada pomodoro que completas hace crecer un mundo: un bosque, una granja, un puerto en alta mar o una base espacial. Con las monedas que ganas desbloqueas nuevos mundos.

## Cómo usarlo

Online: https://pomo-verso.vercel.app

O en local: `npm install && npm run dev`.

- Elige el tiempo con los botones (5, 15, 25, 45 o 60 min) o en Ajustes.
- **Iniciar** / **Espacio**: empieza o pausa. Durante el pomodoro el reloj pasa a la esquina para ver el mundo.
- Arrastra para girar la cámara, rueda del ratón para acercar.
- Al terminar el enfoque llega el descanso nocturno.

## Mundos y monedas

| Mundo | Costo |
|---|---|
| Bosque | gratis |
| Granja | 30 monedas |
| Mar abierto | 70 monedas |
| Cosmos | 120 monedas |

Ganas ~10 monedas por pomodoro de 25 min, +10 por el primero del día y +15 al subir de nivel (cada 4 pomodoros en un mundo).

## Progreso

Se guarda en el navegador (`localStorage`), por equipo. Desde **Mundos** puedes exportarlo a un archivo, importarlo en otro equipo o reiniciarlo.

## Desarrollo y colaboración

```bash
npm install
npm run dev
```

El código está dividido en módulos (`src/core`, `src/ui`, `src/lib`, `src/worlds`) y **crear un mundo nuevo** es tan simple como copiar `src/worlds/_plantilla.js`. Lee [CONTRIBUTING.md](CONTRIBUTING.md) para la guía completa.

Detalles técnicos: Vite + Three.js 0.170, sin imágenes ni modelos externos (todo se genera con código). En la URL, `?free` abre todos los mundos y `?debug` expone `window.__pw` para pruebas.

## Licencia

[MIT](LICENSE). Úsalo, modifícalo y compártelo libremente; solo conserva el aviso de copyright.
