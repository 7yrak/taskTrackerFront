# TaskTracker (frontend)

Angular 21 (componentes standalone, signals) + Angular Material. Aplicación de uso personal.

## Acceso

Login local contra el backend (`taskTrackerBack`): usuario y contraseña del propietario, sesión por cookie
`HttpOnly` y token CSRF en cada escritura. El guard (`core/auth.ts`) valida la sesión con `GET auth/session`;
ante un `401` de la API el usuario vuelve a `/acceso` y, tras ingresar, regresa a la pantalla donde estaba.

## Desarrollo

```bash
npm ci --no-audit --no-fund
npm start                 # http://127.0.0.1:4200, proxy a http://127.0.0.1:8081 (proxy.conf.json)
npm run build -- --base-href=/tasktracker/
node --test tests/*.test.cjs
```

Para usar el backend en desarrollo sin https define `TASKTRACKER_COOKIE_SECURE=false` (ver README del backend).

## Diseño

Todos los colores, radios y sombras viven como variables CSS en `src/styles.scss` (tema claro y oscuro).
Para cambiar la identidad visual basta con editar los bloques `body` y `body.dark-theme`; los componentes leen
esas variables (`--accent`, `--bg-card`, `--green-soft`, …). El tema prebuilt de Angular Material se alinea
con ellas en la sección "Material" del mismo archivo.
