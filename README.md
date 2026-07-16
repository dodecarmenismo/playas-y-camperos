# Playas & Camperos 🏖️🥪

App para 4 amigos que cada martes y domingo prueban una playa distinta de la
provincia de Málaga (entre Málaga capital y Coín), y los martes además un
campero en un sitio nuevo cada vez.

- **Playas**: mapa donde marcáis las playas probadas y las valoráis con estrellas.
- **Camperos**: lista de sitios de campero con valoración por categorías
  (campero global, el sitio, el pan, el tostado) y comentarios.
- **Experiencia**: diario por días con lo que cada uno vivió esa jornada.

Cada persona elige un nombre y una foto de perfil la primera vez que abre la
app (sin contraseñas, solo para identificar quién ha votado qué).

No hay servidor propio: es una web estática que guarda los datos en
**Firebase Firestore** (plan gratuito), así que los 4 veis los mismos datos
en tiempo real desde vuestros móviles.

## 1. Crear el proyecto de Firebase (una sola vez)

1. Ve a https://console.firebase.google.com/ e inicia sesión con una cuenta
   de Google (puede ser la tuya, no hace falta que los 4 tengáis cuenta).
2. "Crear proyecto" → dale un nombre (ej. `playas-camperos`) → puedes
   desactivar Google Analytics, no hace falta.
3. Dentro del proyecto, en el menú lateral: **Compilación → Authentication**
   → "Comenzar" → pestaña "Sign-in method" → habilita el proveedor
   **Anónimo**.
4. **Compilación → Firestore Database** → "Crear base de datos" → modo
   **producción** → región `eur3 (europe-west)` (o la que te sugiera más
   cercana).
5. Dentro de Firestore, pestaña **Reglas**: pega el contenido del archivo
   [`firestore.rules`](firestore.rules) de este repo y publica.
6. **Configuración del proyecto** (icono de engranaje, arriba a la
   izquierda) → pestaña "General" → baja hasta "Tus apps" → icono `</>`
   (Web) → dale un nombre a la app → "Registrar app". Te mostrará un objeto
   `firebaseConfig`.
7. Copia esos valores dentro de [`js/firebase-config.js`](js/firebase-config.js)
   en este repo, sustituyendo los `TU_...`.

No hace falta tarjeta de crédito: todo esto entra sobradamente en el plan
gratuito (Spark) para 4 personas.

## 2. Probarlo en local

Como la app usa módulos de JavaScript (`type="module"`), no puedes abrir
`index.html` haciendo doble clic (protocolo `file://`); necesita un
servidor local simple:

```bash
cd playas-y-camperos
python3 -m http.server 8080
```

Y abre http://localhost:8080 en el navegador.

## 3. Compartirla con tus amigos (deploy)

La forma más simple es **GitHub Pages**, gratis:

1. Sube este repo a GitHub (público o privado).
2. En GitHub: Settings → Pages → Source: rama `main`, carpeta `/root`.
3. Te dará una URL tipo `https://tuusuario.github.io/playas-y-camperos/`.
   Compártela con el grupo.

Cada vez que hagáis `git push` a `main`, la web se actualiza sola.

## Estructura

```
index.html        Shell de la app y navegación por pestañas
style.css          Estilos (mobile-first)
js/
  firebase-config.js  Claves de tu proyecto Firebase (rellenar)
  firebase.js         Inicialización de Firebase + login anónimo
  profile.js           Selección de nombre/foto de cada persona
  stars.js              Widget de estrellas reutilizable
  modal.js              Helper de modales genérico
  map.js                 Vista "Playas" (Leaflet + Firestore)
  camperos.js             Vista "Camperos"
  diary.js                 Vista "Experiencia"
  main.js                   Arranque y navegación por pestañas
firestore.rules       Reglas de seguridad para copiar en Firebase
```

## Notas

- Las fotos de perfil se guardan como imagen comprimida directamente en
  Firestore (no se usa Firebase Storage), así que todo cabe en el plan
  gratuito sin necesitar tarjeta de crédito.
- Cada persona solo puede editar su propio voto/comentario (controlado por
  las reglas de Firestore), pero todos podéis ver los de los demás.
