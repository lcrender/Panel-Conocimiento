# Panel de agentes

Panel administrativo multi-tenant para la base de conocimiento de futuros agentes de WhatsApp. Una sola instalación sirve a varios clientes. Cada cliente ve únicamente sus proyectos y su contenido.

Esta etapa incluye clientes, proyectos, usuarios, roles, categorías, conocimiento, un buscador de prueba y un registro de actividad. WhatsApp, OpenAI, audio y reservas quedan preparados como contratos y tablas, sin integración.

## Estructura

```text
src/app/                      pantallas y rutas
src/components/               interfaz reutilizable
src/server/actions/           mutaciones
src/lib/supabase/             clientes de Supabase
src/lib/auth/                 sesión y proyecto activo
src/lib/data/                 lecturas a la base
src/lib/validation/           validación de formularios
src/domain/                   permisos, navegación y reglas puras
src/modules/knowledge/        búsqueda intercambiable
src/modules/reservations/     contrato ReservationProvider
src/modules/whatsapp/         tipos de la integración futura
src/modules/ai/               tipos de la respuesta futura
src/modules/audio/            tipos de la transcripción futura
supabase/migrations/          esquema, RLS y búsqueda
```

La interfaz no decide el aislamiento. Las pantallas piden datos con la sesión del usuario y PostgreSQL aplica Row Level Security.

## Modelo de acceso

Los permisos viven en tablas, no en condicionales sueltos.

| Alcance | Ejemplo | Qué cubre |
| --- | --- | --- |
| `platform` | Super admin | Toda la plataforma |
| `client` | Administrador de cliente | Todos los proyectos de un cliente |
| `project` | Editor, operador, solo lectura | Un proyecto |

Un editor puede recibir, además, el permiso `categories.write`. Ese ajuste se guarda en `membership_permission_overrides` y solo está habilitado para roles de proyecto que lo admiten.

El super admin conserva sus permisos fijos para que la plataforma no se quede sin administración. El resto de los roles se puede ajustar desde Roles.

## Aislamiento

Hay cuatro controles, y todos tienen que pasar:

1. La aplicación usa la clave anónima más la sesión del usuario. La service role solo crea o invita cuentas en Auth.
2. El proyecto activo sale de `my_access()`, que mira `auth.uid()`. Una cookie con el id de otro cliente se ignora.
3. Las políticas RLS filtran clientes, proyectos, membresías, categorías, conocimiento, actividad y embeddings.
4. Los triggers copian `client_id` desde el proyecto y rechazan una categoría de otro proyecto.

Un usuario no puede leer ni escribir registros de otro cliente cambiando una URL o llamando la API con su propio token.

## Puesta en marcha

1. Creá un proyecto en [Supabase](https://supabase.com).
2. En el editor SQL, ejecutá `supabase/migrations/20261002120000_init.sql`.
3. En Authentication, desactivá el registro público.
4. Copiá el entorno:

```bash
cp .env.example .env.local
```

Completá:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

La service role no debe llegar al navegador. El archivo `src/lib/supabase/admin.ts` está marcado como código de servidor.

5. Instalá y levantá el panel:

```bash
npm install
npm run dev
```

6. Creá el primer usuario en Authentication → Users.
7. En el editor SQL, con el rol de base (no como usuario de la app):

```sql
select public.bootstrap_super_admin('admin@empresa.com');
```

Esa función se puede usar una sola vez y un usuario autenticado no puede ejecutarla.

8. Entrá a `http://localhost:3000` con ese usuario.

Para invitar por email, configurá el SMTP de Supabase y agregá `http://localhost:3000/auth/callback` a las URLs de redirección. Sin SMTP, el alta con contraseña inicial alcanza para entrar.

## Búsqueda de prueba

`Probar conocimiento` llama a `search_knowledge`. Compara el texto normalizado contra título, pregunta, palabras relacionadas y respuesta, y prioriza un poco los registros altos o críticos. Solo devuelve contenido activo del proyecto elegido.

La pantalla usa `src/modules/knowledge/search.ts`. Para pasar a embeddings, se reemplaza esa exportación por un proveedor que lea `knowledge_item_embeddings` (pgvector, 1536 dimensiones) y se mantiene la misma interfaz.

## Qué queda preparado

| Módulo | Dónde está |
| --- | --- |
| WhatsApp por proyecto | `project_whatsapp_settings` y `src/modules/whatsapp/types.ts` |
| Reservas | `project_reservation_settings` y `ReservationProvider` |
| Respuesta con modelo | `src/modules/ai/types.ts` |
| Audio a texto | `src/modules/audio/types.ts` |
| Embeddings | `knowledge_item_embeddings` |

`allow_ai_rewrite` en false indica que una respuesta futura debe conservar el texto oficial. El token de WhatsApp no se guarda en la tabla: `access_token_ref` es una referencia a un secreto.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm test
```

Para revisar el aislamiento con dos clientes reales: creá dos empresas, un usuario en cada una, y confirmá que la API de Supabase con el token del primero no devuelve conocimiento del segundo.
