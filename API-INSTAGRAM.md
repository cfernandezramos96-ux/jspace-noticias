# Conectar @jspaceco_ a la API oficial de Instagram

Una sola vez, unos 15 minutos. Es gratis y es la vía oficial de Meta (no arriesga la cuenta).
No hace falta Página de Facebook. La app se queda en «modo desarrollo»: así sirve para publicar en tu
propia cuenta sin pasar la revisión de Meta.

## 1. La cuenta de JSpace tiene que ser profesional
En la app de Instagram, con @jspaceco_: **Configuración → Tipo de cuenta y herramientas → Cambiar a cuenta
profesional** (Creador o Empresa, cualquiera sirve). Si ya lo es, sigue.

## 2. Cuenta de desarrollador de Meta
Entra en **developers.facebook.com** con tu Facebook y regístrate como desarrollador (pide verificar el
teléfono o el correo).

## 3. Crear la app
1. **Mis apps → Crear app.**
2. Caso de uso: **«Administrar mensajes y contenido en Instagram»** (*Manage messaging & content on Instagram*).
3. Nombre: `JSpace Publicador` (el que quieras). Si pregunta por un portafolio comercial, puedes saltarlo.

## 4. Generar el token
1. En la app: **Instagram → Configuración de la API con inicio de sesión de Instagram**
   (*API setup with Instagram login*).
2. En **«Generar tokens de acceso»** pulsa **Agregar cuenta** e inicia sesión con **@jspaceco_**.
   - Si pide aceptar una invitación de tester: en Instagram (web o app) → **Configuración → Apps y sitios
     web → Invitaciones de tester** → Aceptar. Luego vuelve a pulsar Agregar cuenta.
3. Revisa que los permisos incluyan **instagram_business_basic** e **instagram_business_content_publish**.
4. Pulsa **Generar token** junto a @jspaceco_ y cópialo.

## 5. Guardar el token (sin pasarlo por el chat)
1. En `E:\Claudio\jspace-noticias`, copia `.env.example` y renómbrala `.env`.
2. Ábrela con el Bloc de notas y pega el token después de `IG_TOKEN=`. Guarda.
3. Avísame con un «listo». Yo compruebo la conexión (`node scripts/publicar.mjs --cuenta`), que no muestra el
   token, y dejo montada la tarea de Windows que publica la cola.

El token dura 60 días; el script lo renueva solo (`--renovar`) antes de que caduque.
