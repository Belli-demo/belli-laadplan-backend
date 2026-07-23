/**
 * Stap 2: bereken feature-vector per gemeente uit historie + statische data.
 * Voor nu: alleen features gebaseerd op Fluvius-historie.
 * Later uit te breiden met MOW, Statbel, DIV.
 *
 * Output: output/features-per-gemeente.json
 * Structuur: { [gemeenteId]: { privePctHuidig, privePctGroei, ... } }
 */
const fs = require('fs');
const path = require('path');
const config = require('./config');

// Statische feature-data per gemeente (welvaartsindex, dichtheid) —
// in productie te laden uit een centraal bestand of database.
const STATISCH = {
  'antwerpen':    { welvaartsindex: 102, bevolkingsdichtheid: 2600, mow_gewogen_2025: 2100 },
  'gent':         { welvaartsindex: 98,  bevolkingsdichtheid: 1700, mow_gewogen_2025: 1750 },
  'leuven':       { welvaartsindex: 115, bevolkingsdichtheid: 1750, mow_gewogen_2025: 1450 },
  'brugge':       { welvaartsindex: 108, bevolkingsdichtheid: 900,  mow_gewogen_2025: 850 },
  'mechelen':     { welvaartsindex: 106, bevolkingsdichtheid: 1300, mow_gewogen_2025: 750 },
  'wemmel':       { welvaartsindex: 132, bevolkingsdichtheid: 1400, mow_gewogen_2025: 120 },
  'meise':        { welvaartsindex: 118, bevolkingsdichtheid: 660,  mow_gewogen_2025: 95 },
  'brasschaat':   { welvaartsindex: 124, bevolkingsdichtheid: 660,  mow_gewogen_2025: 180 },
  'kraainem':     { welvaartsindex: 141, bevolkingsdichtheid: 2000, mow_gewogen_2025: 80 },
  'oud-heverlee': { welvaartsindex: 129, bevolkingsdichtheid: 320,  mow_gewogen_2025: 45 },
  'zaventem':     { welvaartsindex: 110, bevolkingsdichtheid: 1450, mow_gewogen_2025: 220 },
  'machelen':     { welvaartsindex: 96,  bevolkingsdichtheid: 1400, mow_gewogen_2025: 130 },
  'vilvoorde':    { welvaartsindex: 92,  bevolkingsdichtheid: 1650, mow_gewogen_2025: 180 },
  'genk':         { welvaartsindex: 93,  bevolkingsdichtheid: 780,  mow_gewogen_2025: 340 },
  'olen':         { welvaartsindex: 107, bevolkingsdichtheid: 400,  mow_gewogen_2025: 65 },
  'geel':         { welvaartsindex: 105, bevolkingsdichtheid: 350,  mow_gewogen_2025: 150 },
  'diest':        { welvaartsindex: 100, bevolkingsdichtheid: 340,  mow_gewogen_2025: 90 },
  'hasselt':      { welvaartsindex: 104, bevolkingsdichtheid: 720,  mow_gewogen_2025: 520 },
  'oostende':     { welvaartsindex: 95,  bevolkingsdichtheid: 1900, mow_gewogen_2025: 340 },
  'knokke-heist': { welvaartsindex: 141, bevolkingsdichtheid: 850,  mow_gewogen_2025: 280 },
};

const KAPPA = 1 / 0.65; // moet identiek zijn aan gemeenteData.js FLUVIUS_KAPPA

function berekenPrivePct(fluviusCumul, mowGewogen) {
  const P = fluviusCumul * KAPPA;
  const Q = mowGewogen;
  if (P + Q === 0) return null;
  return P / (P + Q);
}

async function main() {
  const historie = JSON.parse(fs.readFileSync(path.join(config.OUTPUT_DIR, 'historie-per-gemeente.json')));
  const features = {};

  for (const [id, hist] of Object.entries(historie)) {
    const stat = STATISCH[id];
    if (!stat) {
      console.warn(`Geen statische data voor ${id}, overgeslagen`);
      continue;
    }
    // Bereken privePct per jaar (aannemend MOW ongeveer stabiel, wat vereenvoudiging is)
    const pctPerJaar = {};
    for (let j = config.HISTORIE_VANAF; j <= config.HISTORIE_TOT; j++) {
      pctPerJaar[j] = berekenPrivePct(hist.cumulatief[j].fluvius_cumulatief, stat.mow_gewogen_2025);
    }
    // Groei: lineaire trend over 2020-2025
    const jaren = [2020,2021,2022,2023,2024,2025].filter(j => pctPerJaar[j] != null);
    const meanX = jaren.reduce((s,x)=>s+x,0) / jaren.length;
    const meanY = jaren.reduce((s,j)=>s+pctPerJaar[j],0) / jaren.length;
    const num = jaren.reduce((s,j)=>s+(j-meanX)*(pctPerJaar[j]-meanY),0);
    const den = jaren.reduce((s,j)=>s+Math.pow(j-meanX,2),0);
    const groei = den > 0 ? num / den : 0;

    features[id] = {
      naam: hist.naam,
      privePctHuidig: pctPerJaar[2025],
      privePctGroei: groei,
      bevolkingsdichtheid: stat.bevolkingsdichtheid,
      welvaartsindex: stat.welvaartsindex,
      pctPerJaar,
    };
  }

  const uit = path.join(config.OUTPUT_DIR, 'features-per-gemeente.json');
  fs.writeFileSync(uit, JSON.stringify(features, null, 2));
  console.log(`Klaar: ${uit} (${Object.keys(features).length} gemeenten)`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
