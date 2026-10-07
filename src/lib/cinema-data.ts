const posterBatman = "/posters/poster-batman.webp";
const posterLilo = "/posters/poster-lilo.jpg";
const posterToy = "/posters/poster-toystory.webp";
const posterSuperman = "/posters/poster-superman.webp";
const posterOdisea = "/posters/poster-odisea.jpg";
const posterPotter = "/posters/poster-potter.jpg";

export type Movie = {
  id: string;
  slug: string;
  title: string;
  rating: string;
  genre: string;
  poster: string;
  times: string[];
  synopsis: string;
  director: string;
  actor: string;
  studio: string;
  languages: string[];
};

export const MOVIES: Movie[] = [
  {
    id: "01",
    slug: "batman",
    title: "Batman",
    rating: "B12",
    genre: "Super-héroes",
    poster: posterBatman,
    times: ["12:00", "15:00", "18:00"],
    synopsis:
      "Tras presenciar el asesinato de sus padres, el millonario Bruce Wayne viaja por el mundo para aprender a combatir el crimen. Al regresar a una Ciudad Gótica sumida en la corrupción, decide canalizar sus propios miedos para convertirse en Batman, un justiciero enmascarado que luchará en las sombras para salvar a su ciudad de la destrucción.",
    director: "Christopher Nolan",
    actor: "Christian Bale",
    studio: "Warner Bros.",
    languages: ["Español", "Inglés"],
  },
  {
    id: "05",
    slug: "lilo-stich",
    title: "Lilo & Stich",
    rating: "A",
    genre: "Infantil",
    poster: posterLilo,
    times: ["11:00", "14:00", "20:00"],
    synopsis:
      "Una niña solitaria de una isla del Pacífico adopta a una criatura peculiar que resulta ser un experimento fugitivo. Juntos descubren el significado de la familia.",
    director: "Dean DeBlois",
    actor: "Daveigh Chase",
    studio: "Walt Disney Pictures",
    languages: ["Español"],
  },
  {
    id: "02",
    slug: "toy-story-ii",
    title: "Toy Story II",
    rating: "A",
    genre: "Infantil",
    poster: posterToy,
    times: ["14:00", "17:00", "20:00"],
    synopsis:
      "Un grupo de juguetes emprende una aventura para rescatar a uno de los suyos, descubriendo el valor de la amistad y la lealtad.",
    director: "John Lasseter",
    actor: "Tom Hanks",
    studio: "Pixar Animation",
    languages: ["Español"],
  },
  {
    id: "06",
    slug: "super-man",
    title: "Super-Man",
    rating: "B12",
    genre: "Super-héroes",
    poster: posterSuperman,
    times: ["15:00", "17:00", "23:00"],
    synopsis:
      "El último hijo de un planeta desaparecido debe elegir entre ocultar sus poderes o convertirse en el símbolo de esperanza que el mundo necesita.",
    director: "Richard Donner",
    actor: "Christopher Reeve",
    studio: "Warner Bros.",
    languages: ["Inglés", "Español"],
  },
  {
    id: "03",
    slug: "la-odisea",
    title: "La Odisea",
    rating: "B12",
    genre: "Histórica",
    poster: posterOdisea,
    times: ["18:00", "20:00", "21:00"],
    synopsis:
      "El largo regreso a casa de un guerrero legendario, entre tormentas, dioses y criaturas que ponen a prueba su astucia y su voluntad.",
    director: "Andréi Konchalovski",
    actor: "Armand Assante",
    studio: "Hallmark Entertainment",
    languages: ["Inglés"],
  },
  {
    id: "04",
    slug: "harry-potter",
    title: "Harry Potter",
    rating: "A",
    genre: "Infantil",
    poster: posterPotter,
    times: ["12:00", "15:00", "18:00"],
    synopsis:
      "Un joven descubre que pertenece a un mundo de magia y comienza su primer año en una escuela de hechicería llena de secretos.",
    director: "Chris Columbus",
    actor: "Daniel Radcliffe",
    studio: "Warner Bros.",
    languages: ["Español", "Inglés"],
  },
];

export const getMovie = (slug: string): Movie =>
  (MOVIES.find((m) => m.slug === slug) ?? MOVIES[0]) as Movie;

export const FUNCTION_LABEL = "Sala 1 regular - 2D - Horario: 18:00 - Doblada / Esp";

export const buildFunctionLabel = (hall?: string, time?: string, format?: string) =>
  hall && time ? `${hall} - Horario: ${time} - ${format ?? ""}`.trim() : FUNCTION_LABEL;

export const TICKET_TYPES = [
  { id: "adulto", label: "Adulto", note: "(Mayores de 18 años)", price: 35 },
  { id: "tercera", label: "3ra. Edad", note: "(Mayores de 60 años)", price: 30 },
  { id: "ninos", label: "Niños", note: "(Menores de 18 años)", price: 25 },
];

export const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
export const COLS = Array.from({ length: 20 }, (_, i) => i + 1);
export const RESERVED = ["F5", "F6", "F7", "F12", "G9", "J15", "C3", "C4", "H18"];
export const PRESELECTED = ["J8", "J9", "J10"];

/** Asientos ocupados por película (estáticos y deterministas). */
export const getReserved = (slug: string): string[] => {
  if (slug === "batman") return RESERVED;
  let seed = 0;
  for (let i = 0; i < slug.length; i++) seed = (seed * 31 + slug.charCodeAt(i)) % 9973;
  const seats: string[] = [];
  for (let i = 0; i < 9; i++) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const row = ROWS[seed % ROWS.length] as string;
    const col = COLS[Math.floor(seed / 7) % COLS.length] as number;
    const seat = `${row}${col}`;
    if (!seats.includes(seat)) seats.push(seat);
  }
  return seats;
};

export const getPreselected = (slug: string): string[] =>
  slug === "batman" ? PRESELECTED : [];

