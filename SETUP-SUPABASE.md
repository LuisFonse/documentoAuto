# Setup rapido Supabase

## 1) Crear proyecto en Supabase
- Crea un proyecto en https://supabase.com
- Ve a SQL Editor y ejecuta el contenido de `supabase-schema.sql`
- Luego ejecuta `supabase-migracion-usuarios.sql` (permisos por usuario, admin, ficha pública)

## 2) Crear usuario admin
- En Authentication > Users, crea un usuario con email y password
- Su email debe estar en la tabla `admins` (la migración agrega luisfonsecasantana@gmail.com).
  Para otro admin: `insert into public.admins (email) values ('otro@correo.com');`

## 3) Configurar llaves del frontend
Edita supabase-config.js y completa:

- url: Project URL
- anonKey: Project API anon public
- bucket: deja documentos-vehiculo (o tu nombre de bucket)

## 4) Configurar correos (crear clave / recuperar clave)
En Authentication > URL Configuration:

- Site URL: `https://luisfonse.github.io/documentoAuto/mi-auto.html`
- Redirect URLs: agrega `https://luisfonse.github.io/documentoAuto/mi-auto.html`

En Authentication > Sign In / Providers:

- "Allow new users to sign up": activado (solo pueden crear clave los emails que registró el admin)
- "Confirm email": activado

Nota: el correo gratuito de Supabase permite pocos envíos por hora. Si se usa mucho,
configura un SMTP propio en Authentication > Emails > SMTP Settings.

## 5) Flujo
- Admin (`admin.html`): crea usuarios con nombre, email, teléfono y código NFC. Puede editarlos y bloquearlos.
- Usuario (`mi-auto.html`):
  - Primera vez: "Crea tu clave" con el email registrado y confirma el correo.
  - Completa patente, modelo y foto (opcional) de su vehículo.
  - Sube, reemplaza o quita sus 3 documentos: Permiso de Circulación, SOAP y Padrón.
  - "¿Olvidaste tu clave?" envía un enlace al correo para crear una nueva.
- Ficha pública: `index.html?card=CODIGO_NFC`

## 6) Publicar
- Haz commit y push
- Espera despliegue en GitHub Pages

Nota:
Si cambias style.css o script.js y no se refleja en iPhone, recarga en modo privado o cambia la version del archivo en index.html.
