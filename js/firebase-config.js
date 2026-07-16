// 1. Ve a https://console.firebase.google.com/ y crea un proyecto gratis (Spark plan).
// 2. Dentro del proyecto: "Compilación" -> "Firestore Database" -> crear base de datos
//    (modo producción, región europe-west, ej. eur3).
// 3. "Compilación" -> "Authentication" -> "Comenzar" -> habilita el proveedor "Anónimo".
// 4. "Configuración del proyecto" (icono engranaje) -> pestaña "General" -> "Tus apps"
//    -> añade una app web (icono </>) -> copia el objeto firebaseConfig que te da aquí abajo.
// 5. Sube después firestore.rules desde la consola (Firestore -> Reglas) tal cual está en
//    este repo, para que solo cada persona pueda editar sus propios votos.
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};
