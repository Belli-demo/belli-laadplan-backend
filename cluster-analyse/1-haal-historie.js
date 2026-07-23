/**
 * Stap 1: Haal Fluvius historische data op per gemeente per jaar.
 * Fluvius dataset heeft jaar_indienstname per record.
 * Cumulatieve stand per jaar = som van records waar jaar_indienstname <= jaar.
 *
 * Output: output/historie-per-gemeente.json
 * Structuur: { [gemeenteId]: { [jaar]: { fluvius_cumulatief: N } } }
 */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const config = require('./config');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function haalFluviusPerPostcode(postcode) {
  // Haal ALLE records voor postcode op, met jaar_indienstname
  const url = `${config.FLUVIUS_URL}?where=postcode%3D%22${postcode}%22&limit=100&select=jaar_indienstname`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fluvius API ${resp.status} voor postcode ${postcode}`);
  const json = await resp.json();
  return json.results || [];
}

async function haalHistorieGemeente(gem) {
  const cumulatief = {};
  for (let j = config.HISTORIE_VANAF; j <= config.HISTORIE_TOT; j++) {
    cumulatief[j] = { fluvius_cumulatief: 0 };
  }

  let totaal = 0;
  for (const postcode of gem.postcodes) {
    try {
      const records = await haalFluviusPerPostcode(postcode);
      for (const rec of records) {
        const jaar = rec.jaar_indienstname;
        if (jaar == null) continue;
        for (let j = Math.max(jaar, config.HISTORIE_VANAF); j <= config.HISTORIE_TOT; j++) {
          cumulatief[j].fluvius_cumulatief += 1;
        }
      }
      totaal += records.length;
    } catch (e) {
      console.warn(`  ${gem.naam} postcode ${postcode}: ${e.message}`);
    }
    await sleep(config.FLUVIUS_RATE_LIMIT_MS);
  }

  return { gem, cumulatief, totaalRecords: totaal };
}

async function main() {
  console.log(`Ophalen historie voor ${config.GEMEENTEN.length} gemeenten (${config.HISTORIE_VANAF}-${config.HISTORIE_TOT})...`);
  const alles = {};
  for (const gem of config.GEMEENTEN) {
    console.log(` ${gem.naam}...`);
    const res = await haalHistorieGemeente(gem);
    alles[gem.id] = { naam: gem.naam, cumulatief: res.cumulatief, totaal: res.totaalRecords };
    console.log(`  ${gem.naam}: ${res.totaalRecords} records, 2025 stand = ${res.cumulatief[2025].fluvius_cumulatief}`);
  }
  const uit = path.join(config.OUTPUT_DIR, 'historie-per-gemeente.json');
  fs.writeFileSync(uit, JSON.stringify(alles, null, 2));
  console.log(`Klaar: ${uit}`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
