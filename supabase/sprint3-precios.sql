-- =====================================================================
-- Órbita Cinema · Sprint 3 · SCRUM-121 Precios por tipo de sala y de comprador
-- Ejecutar en Supabase > SQL Editor después de los scripts del Sprint 2.
-- Es idempotente: se puede correr más de una vez sin duplicar nada.
-- =====================================================================

-- 1) Precio por tipo de entrada (quetzales) -------------------------------
--    Uno por cada tipo de `src/lib/entradas.ts`: adulto, tercera (3ra. Edad)
--    y ninos (Niños). Quedan nullables a propósito: una sala con un tipo_sala
--    antiguo (fuera de la lista de abajo) se queda sin precio hasta que el
--    Administrador lo capture en /admin/salas -> "Precios". Las salas nuevas
--    siempre nacen con precio: lo asigna la Server Action `crearSala`.
alter table sala
  add column if not exists precio_adulto       numeric(8,2),
  add column if not exists precio_tercera_edad numeric(8,2),
  add column if not exists precio_nino         numeric(8,2);

-- 2) Regla: los precios deben ser mayores que 0 ----------------------------
--    (El límite de Q999.99 y los 2 decimales se validan en la Server Action.)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sala_precio_adulto_chk') then
    alter table sala add constraint sala_precio_adulto_chk check (precio_adulto > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sala_precio_tercera_edad_chk') then
    alter table sala add constraint sala_precio_tercera_edad_chk check (precio_tercera_edad > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sala_precio_nino_chk') then
    alter table sala add constraint sala_precio_nino_chk check (precio_nino > 0);
  end if;
end $$;

-- 3) Precios sugeridos según el tipo de sala -------------------------------
--    Solo llena los precios vacíos: no pisa lo que el Administrador ya haya
--    capturado. Son los mismos valores que usa `crearSala` (PRECIOS_SUGERIDOS
--    en src/app/admin/salas/actions.ts): si cambian, cambiar los dos lugares.
update sala s set
  precio_adulto       = coalesce(s.precio_adulto, v.adulto),
  precio_tercera_edad = coalesce(s.precio_tercera_edad, v.tercera),
  precio_nino         = coalesce(s.precio_nino, v.nino)
from (values
  ('TRADICIONAL 2D', 35, 30, 25),
  ('TRADICIONAL 3D', 45, 40, 35),
  ('MACRO XE 2D',    50, 45, 40),
  ('MACRO XE 3D',    60, 55, 50),
  ('IMAX 2D',        55, 50, 45),
  ('IMAX 3D',        65, 60, 55),
  ('VIP 2D',         75, 70, 65),
  ('VIP 3D',         85, 80, 75)
) as v(tipo, adulto, tercera, nino)
where upper(trim(s.tipo_sala)) = v.tipo
  and (s.precio_adulto is null or s.precio_tercera_edad is null or s.precio_nino is null);

-- Para revisar salas que quedaron sin precio (tipo_sala fuera de la lista):
--   select id, nombre, tipo_sala from sala
--   where precio_adulto is null or precio_tercera_edad is null or precio_nino is null;
