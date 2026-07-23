/**
 * Stap 4: per cluster de privePct-tijdreeks fitten (lineaire regressie).
 * Elke gemeente in het cluster levert een pctPerJaar. Middelen over gemeenten
 * en dan fitten geeft de cluster-curve.
 *
 * Output: output/curves-per-cluster.json
 * Structuur: { [clusterId]: { intercept, slope, r2, ledenAantal } }
 */
const fs = require('fs');
const path = require('path');
const ss = require('simple-statistics');
const config = require('./config');

async function main() {
  const features = JSON.parse(fs.readFileSync(path.join(config.OUTPUT_DIR, 'features-per-gemeente.json')));
  const clusters = JSON.parse(fs.readFileSync(path.join(config.OUTPUT_DIR, 'clusters.json')));

  // Groepeer per cluster
  const perCluster = {};
  for (const [id, c] of Object.entries(clusters)) {
    if (!perCluster[c.cluster]) perCluster[c.cluster] = [];
    perCluster[c.cluster].push(features[id]);
  }

  const curves = {};
  for (const [clusterId, leden] of Object.entries(perCluster)) {
    // Gemiddelde privePct per jaar over leden
    const jaren = [];
    const waardes = [];
    for (let j = config.HISTORIE_VANAF; j <= config.HISTORIE_TOT; j++) {
      const vals = leden.map(l => l.pctPerJaar[j]).filter(v => v != null);
      if (vals.length === 0) continue;
      jaren.push(j);
      waardes.push(vals.reduce((s,v)=>s+v,0) / vals.length);
    }
    if (jaren.length < 2) {
      curves[clusterId] = { intercept: 0, slope: 0, r2: 0, ledenAantal: leden.length, jaren, waardes };
      continue;
    }
    const points = jaren.map((j, i) => [j, waardes[i]]);
    const lr = ss.linearRegression(points);
    const line = ss.linearRegressionLine(lr);
    const r2 = ss.rSquared(points, line);
    curves[clusterId] = {
      intercept: lr.b,
      slope: lr.m,  // privePct verandering per jaar
      r2,
      ledenAantal: leden.length,
      jaren,
      waardes,
    };
    console.log(`Cluster ${clusterId} (${leden.length} gemeenten): slope=${(lr.m*100).toFixed(2)}%/jaar, r2=${r2.toFixed(3)}`);
  }

  const uit = path.join(config.OUTPUT_DIR, 'curves-per-cluster.json');
  fs.writeFileSync(uit, JSON.stringify(curves, null, 2));
  console.log(`Klaar: ${uit}`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
