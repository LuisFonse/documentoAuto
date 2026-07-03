# Setup rapido Supabase

## 1) Crear proyecto en Supabase
- Crea un proyecto en https://supabase.com
- Ve a SQL Editor y ejecuta el contenido de supabase-schema.sql

## 2) Crear usuario admin
- En Authentication > Users, crea un usuario con email y password

## 3) Configurar llaves del frontend
Edita supabase-config.js y completa:

- url: Project URL
- anonKey: Project API anon public
- adminEmails: agrega el email admin creado
- bucket: deja documentos-vehiculo (o tu nombre de bucket)

## 4) Uso de la pagina cliente
- URL normal: index.html (modo local)
- URL con cliente NFC: index.html?card=CODIGO_NFC

## 5) Uso del panel admin
- Abre admin.html
- Inicia sesion con email y password admin
- Crea cliente, agrega vehiculo y sube documentos PDF

## 6) Publicar
- Haz commit y push
- Espera despliegue en GitHub Pages

Nota:
Si cambias style.css o script.js y no se refleja en iPhone, recarga en modo privado o cambia la version del archivo en index.html.
