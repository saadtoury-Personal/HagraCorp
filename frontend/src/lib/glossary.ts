// Plain-language definitions, written for someone who has never heard of a lunar lander. Shown wherever the word appears (components/Term)
// and listed in full on the Method page.
export type Entry = { term: string; match: string[]; def: string }

export const GLOSSARY: Entry[] = [
  { term: 'Landing site', match: ['site', 'planned site', 'region'], def: 'A spot near the Moon’s south pole where a lander could touch down. NASA and other agencies are studying about 30 of them, because that area may hold water ice.' },
  { term: 'Sunlight', match: ['sunlight', 'minimum sunlight', 'sun up'], def: 'The share of the stay when the Sun is above the local horizon. Solar panels only work in sunlight. Near the pole the Sun skims the horizon, so hills often block it.' },
  { term: 'Earth link', match: ['earth link', 'minimum earth link', 'earth link (dte)', 'earth in view', 'dte'], def: 'The share of the stay when Earth is above the local horizon. Then the lander can talk directly to Earth by radio (“direct to Earth”, DTE) with no relay satellite.' },
  { term: 'Longest night', match: ['longest night', 'longest dark spell'], def: 'The longest stretch with no sunlight at all. The batteries have to keep the lander alive and warm for that long.' },
  { term: 'Battery lasts', match: ['battery lasts'], def: 'How many hours the lander can survive on its batteries without sunlight. A site whose nights are longer than this is ruled out.' },
  { term: 'Mast height', match: ['mast height', 'mast'], def: 'How high the solar panel or antenna sits above the ground. A taller mast sees over small rises, so it gets more Sun and more Earth. The data exists for 2 m and 10 m; values in between are blended.' },
  { term: 'Assessment', match: ['assessment'], def: 'Our verdict for this site and these dates. Viable: both sunlight and Earth link reach your minimums. Marginal: close. Not viable: one of them falls short.' },
  { term: 'Duration', match: ['duration', 'stay on the surface'], def: 'How many days the lander stays on the surface. NASA’s 2023 white paper suggests a first landing site should be sunlit for about 6 to 6.5 days.' },
  { term: 'Launch slip', match: ['launch slips by', 'slip', 'planned landing'], def: 'A delay of the launch. The Sun, Earth and Moon keep moving, so each day of delay changes the lighting at every site. The slip navigator shows what still works.' },
  { term: 'Horizon', match: ['horizon', 'panorama'], def: 'The skyline made by hills and crater rims around the site, measured by NASA’s laser altimeter (LOLA) on the Lunar Reconnaissance Orbiter. Anything below it is hidden from the lander.' },
  { term: 'Elevation', match: ['elevation'], def: 'How high a body is above the flat horizon, in degrees: 0° is on the horizon, 90° is straight overhead. At the pole the Sun never climbs more than a few degrees.' },
  { term: 'Lunar day', match: ['lunar day'], def: 'Days since New Moon. A full cycle of phases takes 29.5 days.' },
  { term: 'Libration', match: ['earth libration', 'libration'], def: 'A slow rocking of the Moon that lets us see a little past its edges. It moves Earth up and down in the lunar sky.' },
  { term: 'Sun over the Moon', match: ['sun over the moon'], def: 'The longitude on the Moon where the Sun is straight overhead right now. It sweeps around the Moon once per lunar day.' },
  { term: 'Power index', match: ['power index'], def: 'A number from 0 to 1: how much of full sunlight a solar panel that follows the Sun would receive. 0 means dark, 1 means the whole Sun at its best angle.' },
]

const byMatch = new Map(GLOSSARY.flatMap((e) => e.match.map((m) => [m, e] as const)))

/** The definition for a label such as "Earth link" or "Minimum sunlight", or undefined when there is none. */
export const entryFor = (label: string) => byMatch.get(label.trim().toLowerCase())
