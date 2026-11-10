/* =========================================================
   data.js — CONTENIDO DE LA WEB
   ---------------------------------------------------------
   Aquí se edita TODO el contenido (análisis, eventos,
   alianzas, convocatoria). No hace falta tocar el HTML.
   Regla: cada elemento va entre llaves { } y separado por coma.
   Fechas siempre en formato AAAA-MM-DD (ej: 2026-11-09).
   ========================================================= */

const SITIO = {
  nombre: "CERI",
  nombreCompleto: "Círculo de Estudios de Relaciones Internacionales",
  universidad: "Universidad Nacional de Trujillo",
  facultad: "Facultad de Derecho y Ciencias Políticas",
  lema: "Investigación y análisis imparcial de la política nacional e internacional.",
  fundacion: "2024-11-06",
  reconocimiento: "Resolución de Decanato N.° 317-2026",
  correo: "correo@ceri-unt.org",            // TODO: poner el correo real
  instagram: "https://www.instagram.com/ceri_unt/",
  facebook: "#",                             // TODO: poner el link real de Facebook
  linkBio: "https://www.atom.bio/ceri"
};

/* ---------------------------------------------------------
   ANÁLISIS E INFORMES
   tipo: "Informe" | "Análisis" | "Nota de coyuntura" | "Explicador"
   ambito: "Nacional" | "América Latina" | "Internacional"
   Estructura imparcial obligatoria: hechos -> posturas -> escenarios -> fuentes
   --------------------------------------------------------- */
const PUBLICACIONES = [
  {
    id: "brasil-futuro-politico-america-latina",
    titulo: "Brasil y el futuro político de América Latina",
    subtitulo: "Escenarios e implicancias de un eventual gobierno de Flávio Bolsonaro",
    tipo: "Análisis",
    ambito: "América Latina",
    temas: ["Elecciones", "Brasil", "Integración regional"],
    autor: "Equipo CERI",                    // TODO: nombre real del autor
    fecha: "2026-10-13",
    actualizado: "2026-10-13",
    resumen: "TODO: Resumen de 2 o 3 líneas con los hechos principales, sin adjetivos ni valoraciones.",
    hechos: [
      "TODO: Hecho verificable 1 (con fuente abajo).",
      "TODO: Hecho verificable 2."
    ],
    posturas: [
      { actor: "TODO: Actor o sector A", postura: "TODO: Qué plantea, citado de forma fiel." },
      { actor: "TODO: Actor o sector B", postura: "TODO: Qué plantea la posición contraria." }
    ],
    escenarios: [
      "TODO: Escenario posible 1 y de qué depende.",
      "TODO: Escenario posible 2."
    ],
    fuentes: [
      { nombre: "TODO: Nombre de la fuente", url: "#" }
    ]
  },
  {
    id: "plantilla-ejemplo",
    titulo: "[PLANTILLA] Título del informe",
    subtitulo: "Copiar este bloque para crear una nueva publicación",
    tipo: "Informe",
    ambito: "Nacional",
    temas: ["Congreso", "Política peruana"],
    autor: "Nombre del autor",
    fecha: "2026-11-01",
    actualizado: "2026-11-01",
    resumen: "Resumen breve y neutral.",
    hechos: ["Hecho 1", "Hecho 2"],
    posturas: [
      { actor: "Postura A", postura: "Descripción fiel." },
      { actor: "Postura B", postura: "Descripción fiel." }
    ],
    escenarios: ["Escenario 1"],
    fuentes: [{ nombre: "Fuente oficial", url: "#" }]
  }
];

/* ---------------------------------------------------------
   EVENTOS
   modalidad: "Presencial" | "Virtual"
   Los eventos con fecha futura aparecen como "Próximos" solos.
   --------------------------------------------------------- */
const EVENTOS = [
  {
    titulo: "Tómbola CERI",
    tipo: "Actividad",
    fecha: "2026-09-23",
    hora: "10:00",
    modalidad: "Presencial",
    lugar: "Frontis de la Facultad de Derecho y Ciencias Políticas",
    descripcion: "Actividad de recaudación de fondos del círculo."
  },
  {
    titulo: "Conversatorio: Conoce las especialidades de Ciencia Política y Gobernabilidad",
    tipo: "Conversatorio",
    fecha: "2026-07-25",
    hora: "15:50",
    modalidad: "Virtual",
    lugar: "Google Meet",
    descripcion: "Ponentes: Mg. Luis Enrique Ríos Alba y Mg. Luis Enrique Hurtado Encomenderos."
  },
  {
    titulo: "Ciclo de conferencias sobre geopolítica",
    tipo: "Conferencia",
    fecha: "2025-09-01",                       // TODO: fecha real
    hora: "",
    modalidad: "Presencial",
    lugar: "UNT",
    descripcion: "Temas: la problemática entre Colombia y Perú; la expansión de las políticas de Donald Trump."
  }
];

/* ---------------------------------------------------------
   PARTICIPACIÓN (actividades fuera del círculo)
   --------------------------------------------------------- */
const PARTICIPACION = [
  {
    titulo: "I Reunión de articulación de Organizaciones Juveniles – La Libertad",
    fecha: "2025-06-04",
    descripcion: "Participación en la Plataforma Regional de Juventudes de La Libertad."
  },
  {
    titulo: "Reunión con los círculos de estudio de la Escuela de Ciencia Política",
    fecha: "2025-06-07",
    descripcion: "Presentación de la propuesta de plan de trabajo conjunto con CECIP."
  },
  {
    titulo: "Evento virtual con Leviatán Sociales",
    fecha: "2025-08-17",
    descripcion: "Exposiciones sobre democracia, partidos políticos y líneas de estudio."
  }
];

/* ---------------------------------------------------------
   ALIANZAS / ORGANIZACIONES CON LAS QUE ARTICULAMOS
   TODO: confirmar con la directiva cuáles son alianzas formales.
   --------------------------------------------------------- */
const ALIANZAS = [
  { nombre: "CECIP – Centro de Estudiantes de Ciencia Política", area: "Ciencia política", instagram: "cecip.unt" },
  { nombre: "Leviatán", area: "Ciencias sociales", instagram: "leviatan.sociales" },
  { nombre: "CIDEPAC", area: "Democracia, partidos y cultura política", instagram: "cidepac.unt" },
  { nombre: "CECOMPOL", area: "Comunicación política", instagram: "cecompol" },
  { nombre: "AIESEC en Trujillo", area: "Juventud y liderazgo", instagram: "sharkietru" },
  { nombre: "Rotaract Club Trujillo", area: "Voluntariado", instagram: "rotaract_clubtrujillo" },
  { nombre: "UNEC Trujillo", area: "Participación ciudadana", instagram: "unec.trujillo" },
  { nombre: "Uni2 Voluntariado", area: "Voluntariado", instagram: "uni2_voluntariado" },
  { nombre: "Plataforma Regional de Juventudes – La Libertad", area: "Articulación juvenil", instagram: "" }
];

/* ---------------------------------------------------------
   CONVOCATORIA
   abierta: true  -> muestra el botón para postular
   abierta: false -> muestra "convocatoria cerrada"
   --------------------------------------------------------- */
const CONVOCATORIA = {
  periodo: "2026-II",
  abierta: false,
  inicio: "2026-08-29",
  cierre: "2026-09-11",
  formulario: "#",                           // TODO: link del Google Form
  requisitos: [
    "Ser estudiante universitario/a.",
    "Tener interés por las Relaciones Internacionales.",
    "Contar con disponibilidad de tiempo para participar en las actividades del CERI.",
    "Demostrar compromiso y responsabilidad con el trabajo del círculo."
  ]
};
