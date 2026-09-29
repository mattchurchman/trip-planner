// Pure: two-letter airline codes -> names, for showing "Alaska 581" instead of
// just "AS 581" on flight cards (§7.7). Unknown codes are shown as the code
// alone; nothing breaks when a carrier is missing from this list.

const AIRLINES = {
  "2K": "Avianca Ecuador", "3K": "Jetstar Asia", "4O": "Interjet", "5J": "Cebu Pacific", "6E": "IndiGo",
  AA: "American", AC: "Air Canada", AD: "Azul", AF: "Air France", AI: "Air India", AM: "Aeroméxico",
  AR: "Aerolíneas Argentinas", AS: "Alaska", AT: "Royal Air Maroc", AV: "Avianca", AY: "Finnair",
  AZ: "ITA Airways", B6: "JetBlue", BA: "British Airways", BR: "EVA Air", BW: "Caribbean Airlines",
  CA: "Air China", CI: "China Airlines", CM: "Copa", CX: "Cathay Pacific", CZ: "China Southern",
  DE: "Condor", DL: "Delta", DY: "Norwegian", EI: "Aer Lingus", EK: "Emirates", ET: "Ethiopian",
  EW: "Eurowings", EY: "Etihad", F9: "Frontier", FI: "Icelandair", FJ: "Fiji Airways", FR: "Ryanair",
  G3: "GOL", G4: "Allegiant", GA: "Garuda Indonesia", HA: "Hawaiian", HU: "Hainan", IB: "Iberia",
  JL: "Japan Airlines", JQ: "Jetstar", KE: "Korean Air", KL: "KLM", LA: "LATAM", LH: "Lufthansa",
  LO: "LOT", LX: "SWISS", LY: "El Al", MH: "Malaysia Airlines", MS: "EgyptAir", MU: "China Eastern",
  MX: "Breeze", NH: "ANA", NK: "Spirit", NZ: "Air New Zealand", OS: "Austrian", OZ: "Asiana",
  PD: "Porter", PR: "Philippine Airlines", QF: "Qantas", QR: "Qatar Airways", SA: "South African",
  SK: "SAS", SN: "Brussels Airlines", SQ: "Singapore Airlines", SU: "Aeroflot", SY: "Sun Country",
  TG: "Thai Airways", TK: "Turkish Airlines", TP: "TAP Air Portugal", U2: "easyJet", UA: "United",
  UX: "Air Europa", VA: "Virgin Australia", VN: "Vietnam Airlines", VS: "Virgin Atlantic",
  VY: "Vueling", W6: "Wizz Air", WN: "Southwest", WS: "WestJet", XY: "flynas", Y4: "Volaris",
};

/** "AS" -> "Alaska"; unknown or blank -> null. */
export function airlineName(code) {
  if (!code) return null;
  return AIRLINES[String(code).toUpperCase()] || null;
}
