# Playas & Camperos 🏖️🥪

App para 4 amigos que cada martes y domingo prueban una playa distinta de la
provincia de Málaga (entre Málaga capital y Coín), y los martes además un
campero en un sitio nuevo cada vez.

- **Playas**: un único mapa con chinchetas azules para las playas (rating con
  estrellas) y los sitios de campero (rating por categorías: global, el
  sitio, el pan, el tostado), cada uno con sus comentarios.
- **Camperos**: lista alternativa de los mismos sitios de campero, para
  añadir uno nuevo o verlos sin depender del mapa.
- **Experiencia**: ya no es una pestaña aparte — al tocar la chincheta de
  una playa o un campero, dentro aparece una sección "Experiencia" con lo
  que cada uno vivió ese día (un mismo comentario puede enlazar la playa Y
  el campero de un mismo martes, y aparece en ambos sitios).

Cada persona entra tocando su foto en una rejilla de perfiles fijos (sin
contraseñas, solo para identificar quién ha votado qué).

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
  profile.js           Rejilla de perfiles fijos (Dani/Carmen/Jacinto/Ernesto/Guest)
  avatar.js             Helper para pintar fotos de perfil con fallback
  stars.js              Widget de estrellas reutilizable
  modal.js              Helper de modales genérico
  map.js                 Mapa unificado (playas + camperos) + buscador
  camperos.js             Detalle de campero (ratings por categoría) + lista
  diary.js                 Comentarios de "experiencia" ligados a playa/campero
  main.js                   Arranque y navegación por pestañas
firestore.rules       Reglas de seguridad para copiar en Firebase
```

## Notas

- Las fotos de perfil son fijas (una por persona, en `assets/avatars/`), no
  hay que subir nada al entrar.
- Los camperos se geolocalizan automáticamente a partir de la dirección que
  escribes (vía OpenStreetMap Nominatim). Si la dirección es muy vaga y no
  se encuentra, el campero se guarda igualmente pero sin chincheta en el
  mapa — sigue siendo votable desde la pestaña Camperos.
- Cada persona solo puede editar su propio voto/comentario (controlado por
  las reglas de Firestore), pero todos podéis ver los de los demás.
