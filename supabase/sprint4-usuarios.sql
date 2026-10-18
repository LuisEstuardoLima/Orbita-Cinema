-- ============================================================================
-- Órbita Cinema · SCRUM-134 (Gestión de usuarios del panel admin)
-- Ejecutar en Supabase > SQL Editor. Es idempotente.
--
-- Crea una función RPC autorizada que el panel de administración usa para
-- listar todos los usuarios con nombre, correo electrónico y rol.
-- La función ejecuta con privilegios del dueño (security definer) para poder
-- leer auth.users.email (tabla del sistema de Auth) que las filas normales
-- no pueden leer. Posteriormente se REVOCAN todos los permisos y solo se
-- otorga EXECUTE a service_role, así el navegador nunca puede llamarla.
-- ============================================================================

create or replace function public.admin_listar_usuarios()
returns table (
  id_usuario uuid,
  nombre text,
  apellido text,
  email text,
  rol text,
  confirmado boolean
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id_usuario,
    u.nombre,
    u.apellido,
    coalesce(au.email, '') as email,
    r.nombre as rol,
    (au.email_confirmed_at is not null) as confirmado
  from public.usuarios u
  join auth.users au on au.id = u.id_usuario
  join public.rol r on r.id_rol = u.id_rol
  order by u.nombre, u.apellido;
$$;

-- Por defecto PostgreSQL otorga EXECUTE a PUBLIC. Lo revocamos todo y se lo
-- damos solo a service_role (la llave secreta del servidor, nunca al navegador).
revoke execute on function public.admin_listar_usuarios() from public, anon, authenticated;
grant execute on function public.admin_listar_usuarios() to service_role;