/**
 * Convierte un título en la parte de la URL de la película.
 *
 * "Los Cuatro Fantásticos: Primeros Pasos" -> "los-cuatro-fantasticos-primeros-pasos"
 *
 * El resultado se guarda en `pelicula.slug` y es lo que hace que la página de la película
 * viva en `/pelicula/<slug>`. Es el identificador público de la película, así que:
 *
 * - Nunca se repite: hay un índice único en la base (`pelicula_slug_key`) que lo garantiza.
 * - Si dos películas comparten título, la segunda recibe un sufijo: `el-senor-de-los-anillos-2`.
 * - Se genera SOLO al crear la película. Si más adelante se permite editar el título
 *   (Sprint 7, SCRUM-67), hay que decidir si el slug se recalcula: hacerlo sin más rompe
 *   los enlaces ya compartidos.
 *
 * Se eliminan los acentos (NFD normaliza "á" en "a" + tilde, y la tilde se quita) y todo lo
 * que no sea letra o número se convierte en guion.
 */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
