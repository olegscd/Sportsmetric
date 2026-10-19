import type { IntlAthlete } from "./international";

type AthletePhoto = {
  photoUrl: string;
  photoCredit: string;
  photoLicense: string;
  photoSourceUrl: string;
};

/**
 * Portraits bundled with the site so international profiles show a face even
 * before photo attribution is stored on the athlete row.
 *
 * Every image is public domain or openly licensed. The Commons file page in
 * `photoSourceUrl` records the author and license, and the same credit is
 * displayed under the portrait. A photo saved in the database always wins over
 * the bundled entry, so once the rows are seeded (scripts/seed-intl-photos.ts)
 * this map can be removed.
 */
export const BUNDLED_ATHLETE_PHOTOS: Record<string, AthletePhoto> = {
  "carlos-yulo": {
    photoUrl: "/athletes/carlos-yulo.jpg",
    photoCredit: "Japanese Embassy in Manila / Wikimedia Commons",
    photoLicense: "CC BY 4.0",
    photoSourceUrl: "https://commons.wikimedia.org/wiki/File:Carlos_Yulo_Oct.1.24.jpg",
  },
  "hidilyn-diaz": {
    photoUrl: "/athletes/hidilyn-diaz.jpg",
    photoCredit: "PTV News / Wikimedia Commons",
    photoLicense: "Public domain",
    photoSourceUrl: "https://commons.wikimedia.org/wiki/File:Hidilyn_Diaz_with_her_gold_medal_2021_(1-44_screenshot).jpg",
  },
  "nesthy-petecio": {
    photoUrl: "/athletes/nesthy-petecio.jpg",
    photoCredit: "King Rodriguez / PCOO / Wikimedia Commons",
    photoLicense: "Public domain",
    photoSourceUrl: "https://commons.wikimedia.org/wiki/File:Nesthy_Petecio_October_16,_2019._3_(cropped).jpg",
  },
  "ej-obiena": {
    photoUrl: "/athletes/ej-obiena.jpg",
    photoCredit: "Athletics Federation of India / Wikimedia Commons",
    photoLicense: "CC BY-SA 4.0",
    photoSourceUrl: "https://commons.wikimedia.org/wiki/File:Ernest_John_Obiena.jpg",
  },
  "aira-villegas": {
    photoUrl: "/athletes/aira-villegas.jpg",
    photoCredit: "PIA Leyte / Wikimedia Commons",
    photoLicense: "Public domain",
    photoSourceUrl: "https://commons.wikimedia.org/wiki/File:PIA_Leyte_-_Aira_Villegas_interview_(cropped).jpg",
  },
};

/** Fill in a bundled portrait only when the athlete row has no photo at all. */
export function withBundledAthletePhoto(athlete: IntlAthlete): IntlAthlete {
  if (athlete.photoUrl) return athlete;
  const photo = BUNDLED_ATHLETE_PHOTOS[athlete.id];
  return photo ? { ...athlete, ...photo } : athlete;
}
