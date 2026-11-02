// Disputed and unsettled territories. The country map (Eurostat GISCO) keeps
// these areas out of every country and gives them their own codes, so without
// an entry here they could never be marked. The codes are the GISCO `CNTR_ID`
// values; they are not ISO 3166-1 codes.
//
// Territories are tracked separately from countries: they appear on the
// visited-countries map and can be marked like any country, but they are not
// counted as countries in statistics. Listing one here does not express a
// position on its sovereignty.

export interface Territory {
  code: string;
  name: string;
  continent: string;
  /** ISO 3166-1 alpha-2 codes of the countries that claim or hold the area. */
  claimants: string[];
}

export const TERRITORIES: Territory[] = [
  {
    code: 'XA',
    name: 'Paracel Islands',
    continent: 'Asia',
    claimants: ['CN', 'VN', 'TW'],
  },
  {
    code: 'XB',
    name: 'Spratly Islands',
    continent: 'Asia',
    claimants: ['CN', 'VN', 'PH', 'MY', 'BN', 'TW'],
  },
  {
    code: 'XC',
    name: 'Aksai Chin',
    continent: 'Asia',
    claimants: ['IN', 'CN'],
  },
  {
    code: 'XD',
    name: 'Arunachal Pradesh',
    continent: 'Asia',
    claimants: ['IN', 'CN'],
  },
  {
    code: 'XE',
    name: 'China–India border areas',
    continent: 'Asia',
    claimants: ['IN', 'CN'],
  },
  {
    code: 'XF',
    name: 'Halaib Triangle',
    continent: 'Africa',
    claimants: ['EG', 'SD'],
  },
  {
    code: 'XG',
    name: 'Ilemi Triangle',
    continent: 'Africa',
    claimants: ['KE', 'SS'],
  },
  {
    code: 'XH',
    name: 'Jammu and Kashmir',
    continent: 'Asia',
    claimants: ['IN', 'PK'],
  },
  {
    code: 'XI',
    name: 'Southern Kuril Islands',
    continent: 'Asia',
    claimants: ['RU', 'JP'],
  },
  {
    code: 'XJ',
    name: 'Liancourt Rocks',
    continent: 'Asia',
    claimants: ['KR', 'JP'],
  },
  {
    code: 'XJL',
    name: 'Latrun no man’s land',
    continent: 'Asia',
    claimants: ['IL', 'PS'],
  },
  {
    code: 'XL',
    name: 'Navassa Island',
    continent: 'North America',
    claimants: ['US', 'HT'],
  },
  {
    code: 'XM',
    name: 'Scarborough Shoal',
    continent: 'Asia',
    claimants: ['CN', 'PH', 'TW'],
  },
  {
    code: 'XN',
    name: 'Senkaku Islands',
    continent: 'Asia',
    claimants: ['JP', 'CN', 'TW'],
  },
  {
    code: 'XO',
    name: 'Scattered Islands',
    continent: 'Africa',
    claimants: ['FR', 'MG', 'MU'],
  },
  {
    code: 'XU',
    name: 'Abyei',
    continent: 'Africa',
    claimants: ['SD', 'SS'],
  },
  {
    code: 'XV',
    name: 'Bir Tawil',
    continent: 'Africa',
    claimants: [],
  },
  {
    code: 'XXR',
    name: 'Equatorial Guinea–Gabon border area',
    continent: 'Africa',
    claimants: ['GQ', 'GA'],
  },
  {
    code: 'XXS',
    name: 'Chagos Islands',
    continent: 'Asia',
    claimants: ['GB', 'MU'],
  },
  {
    code: 'XXT',
    name: 'Sapodilla Cayes',
    continent: 'North America',
    claimants: ['BZ', 'GT', 'HN'],
  },
  {
    code: 'XXW',
    name: 'Belize–Guatemala territorial claim',
    continent: 'North America',
    claimants: ['BZ', 'GT'],
  },
  {
    code: 'XXY',
    name: 'Essequibo',
    continent: 'South America',
    claimants: ['GY', 'VE'],
  },
];
