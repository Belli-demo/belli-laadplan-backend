// geo.js — Geografische data: statistische sectoren via Geopunt OGC API
// NIS-code lookup via statische tabel (geen externe afhankelijkheid)
const { pool } = require('./db');
const { findNisCode } = require('./nis-lookup');

// ── Schema ───────────────────────────────────────────────────────────
async function initGeoSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS geo_sectoren (
        id          SERIAL PRIMARY KEY,
        gemeente_id TEXT NOT NULL REFERENCES gemeenten(id) ON DELETE CASCADE,
        nis_code    TEXT NOT NULL,
        naam        TEXT,
        geojson     JSONB NOT NULL,
        aangemaakt  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(gemeente_id, nis_code)
      );
      CREATE INDEX IF NOT EXISTS idx_geo_gem ON geo_sectoren(gemeente_id);
    `);
    console.log('✓ Geo schema gereed');
  } finally {
    client.release();
  }
}

// ── Sectoren ophalen via Geopunt OGC API Features ───────────────────
async function fetchSectorenGeopunt(nisGem) {
  const url = [
    'https://geo.api.vlaanderen.be/StatistischeSectoren/ogc/features/v1',
    '/collections/statistischesector/items',
    `?f=json&limit=200&NISGEM=${nisGem}`
  ].join('');

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Belli-Laadkaart/1.0 (info@belli.eu)',
      'Accept':     'application/geo+json',
      'Referer':    'https://belli-laadplan-frontend-production.up.railway.app',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!resp.ok) throw new Error(`Geopunt ${resp.status} voor NIS ${nisGem}`);
  const data = await resp.json();
  return data.features || [];
}

// ── Sectoren ophalen via Overpass API (fallback voor NL of fout) ────
async function fetchSectorenOverpass(bbox) {
  const [s, w, n, e] = bbox;
  const query = `[out:json][timeout:30];
(
  relation["place"~"suburb|neighbourhood|quarter|district"]
          ["name"]["boundary"="administrative"](${s},${w},${n},${e});
  relation["admin_level"~"9|10"]["name"](${s},${w},${n},${e});
);
out geom;`;

  const resp = await fetch('https://overpass-api.de/api/interpreter', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Belli/1.0' },
    body:    'data=' + encodeURIComponent(query),
    signal:  AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error(`Overpass ${resp.status}`);
  const data = await resp.json();

  return data.elements
    .filter(el => el.tags?.name && (el.members || el.geometry))
    .map((el, i) => ({
      type: 'Feature',
      properties: {
        NAAM:    el.tags.name,
        NISCODE: `OSM_${el.id}`,
        SOURCE:  'overpass',
      },
      geometry: osmElementToGeoJSON(el),
    }))
    .filter(f => f.geometry);
}

function osmElementToGeoJSON(el) {
  if (el.type === 'way' && el.geometry) {
    return { type:'Polygon', coordinates:[el.geometry.map(p=>[p.lon,p.lat])] };
  }
  if (el.type === 'relation' && el.members) {
    const outer = el.members.filter(m => m.role==='outer' && m.geometry);
    if (outer.length) {
      return { type:'MultiPolygon', coordinates:outer.map(m=>[m.geometry.map(p=>[p.lon,p.lat])]) };
    }
  }
  return null;
}

// ── Sectoren opslaan ─────────────────────────────────────────────────
async function saveSectoren(gemeenteId, features) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM geo_sectoren WHERE gemeente_id=$1', [gemeenteId]);
    let n = 0;
    for (const f of features) {
      if (!f.geometry) continue;
      const p = f.properties || {};
      await client.query(
        `INSERT INTO geo_sectoren (gemeente_id,nis_code,naam,geojson)
         VALUES ($1,$2,$3,$4) ON CONFLICT (gemeente_id,nis_code) DO UPDATE SET naam=$3,geojson=$4`,
        [gemeenteId, p.NISCODE||`SEC_${n}`, p.NAAM||p.LGSTATTXT||`Sector ${n+1}`, JSON.stringify(f)]
      );
      n++;
    }
    await client.query('COMMIT');
    return n;
  } catch(e) {
    await client.query('ROLLBACK'); throw e;
  } finally {
    client.release();
  }
}

// ── Sectoren ophalen uit DB ──────────────────────────────────────────
async function getSectorenFromDb(gemeenteId) {
  const { rows } = await pool.query(
    'SELECT nis_code, naam, geojson FROM geo_sectoren WHERE gemeente_id=$1',
    [gemeenteId]
  );
  return rows.map(r => ({
    ...r.geojson,
    properties: { ...(r.geojson?.properties||{}), NAAM: r.naam, NISCODE: r.nis_code }
  }));
}

// ── Hoofd-functie: onboard geo voor één gemeente ─────────────────────
async function onboardGemeenteGeo(gemeenteId, gemeenteNaam, land, nisOverride = null) {
  console.log(`  Geo: ${gemeenteNaam} (${land})`);

  // Stap 1: NIS-code bepalen
  const nisGem = nisOverride || findNisCode(gemeenteNaam);
  if (nisGem) console.log(`  NIS-code: ${nisGem} (statische tabel)`);

  let features = [];
  let source = 'none';

  // Stap 2a: Geopunt voor Belgische gemeenten
  if (nisGem && land !== 'Nederland') {
    try {
      features = await fetchSectorenGeopunt(nisGem);
      source   = 'geopunt';
      console.log(`  ${features.length} sectoren via Geopunt`);
    } catch(e) {
      console.warn(`  Geopunt fout: ${e.message}`);
    }
  }

  // Stap 2b: Overpass fallback
  if (features.length === 0) {
    try {
      // Haal bbox op uit gemeenten tabel
      const { rows } = await pool.query(
        'SELECT bbox, center_lat, center_lng FROM gemeenten WHERE id=$1', [gemeenteId]
      );
      if (rows[0]?.bbox) {
        features = await fetchSectorenOverpass(rows[0].bbox);
        source   = 'overpass';
        console.log(`  ${features.length} sectoren via Overpass`);
      }
    } catch(e) {
      console.warn(`  Overpass fout: ${e.message}`);
    }
  }

  if (features.length === 0) {
    console.warn(`  Geen sectoren voor ${gemeenteNaam}`);
    return { saved:0, source:'none', nisGem };
  }

  const saved = await saveSectoren(gemeenteId, features);
  console.log(`  ✓ ${saved} sectoren opgeslagen (${source})`);
  return { saved, source, nisGem };
}

module.exports = { initGeoSchema, onboardGemeenteGeo, getSectorenFromDb };
