-- SCRUM-124: Agregar columna `eliminada` a la tabla `sala` para el botón Eliminar.
-- Nunca es un DELETE real: se usa baja lógica para conservar auditoría y no
-- invalidar reservas/boletos ya emitidos. Las funciones de la sala se desactivan
-- en cascada (`funcion.activa = false`) al marcar la sala como eliminada.
alter table public.sala
  add column if not exists eliminada boolean default false not null;

-- Comentario para documentar la columna
comment on column public.sala.eliminada is
  'true = oculta del panel admin (botón Eliminar); nunca se borra la fila';

-- Índice para consultas rápidas del listado del panel (filtra eliminada = false)
create index if not exists idx_sala_eliminada on public.sala (eliminada);