export const COUNTRY_NAMES: Record<string, string> = {
  AF:'Afghanistan',AL:'Albania',DZ:'Algeria',AR:'Argentina',AU:'Australia',
  AT:'Austria',AZ:'Azerbaijan',BH:'Bahrain',BD:'Bangladesh',BY:'Belarus',
  BE:'Belgium',BR:'Brazil',BG:'Bulgaria',KH:'Cambodia',CA:'Canada',
  CL:'Chile',CN:'China',CO:'Colombia',HR:'Croatia',CZ:'Czech Republic',
  DK:'Denmark',EG:'Egypt',EE:'Estonia',FI:'Finland',FR:'France',
  DE:'Germany',GH:'Ghana',GR:'Greece',HK:'Hong Kong',HU:'Hungary',
  IN:'India',ID:'Indonesia',IR:'Iran',IQ:'Iraq',IE:'Ireland',
  IL:'Israel',IT:'Italy',JP:'Japan',JO:'Jordan',KZ:'Kazakhstan',
  KE:'Kenya',KR:'South Korea',KW:'Kuwait',LV:'Latvia',LB:'Lebanon',
  LT:'Lithuania',MY:'Malaysia',MX:'Mexico',MA:'Morocco',MM:'Myanmar',
  NL:'Netherlands',NZ:'New Zealand',NG:'Nigeria',NO:'Norway',OM:'Oman',
  PK:'Pakistan',PE:'Peru',PH:'Philippines',PL:'Poland',PT:'Portugal',
  QA:'Qatar',RO:'Romania',RU:'Russia',SA:'Saudi Arabia',SG:'Singapore',
  ZA:'South Africa',ES:'Spain',LK:'Sri Lanka',SE:'Sweden',CH:'Switzerland',
  TW:'Taiwan',TH:'Thailand',TR:'Turkey',UA:'Ukraine',AE:'UAE',
  GB:'United Kingdom',US:'United States',UZ:'Uzbekistan',VN:'Vietnam',
  YE:'Yemen',ZW:'Zimbabwe',
}

export function getCountryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] || code.toUpperCase()
}

export function getCountryFlag(countryCode: string): string {
  const codePoints = countryCode.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0))
  return String.fromCodePoint(...codePoints)
}
