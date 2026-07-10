-- Programados recurrentes: frecuencia con la que se repite el programado.
-- 'unico' = se borra al confirmar (comportamiento previo)
-- 'mensual' | 'semanal' = queda en la lista para confirmarlo cada período.
alter table scheduled
  add column if not exists frequency text not null default 'mensual';
