/**
 * Stap 3: hiërarchische clustering (Ward linkage) op feature-vectoren.
 * Snijdt de dendrogram op MAX_CLUSTERS clusters.
 *
 * Output: output/clusters.json
 * Structuur: { [gemeenteId]: { cluster: N, naam } }
 */
const fs = require('fs');
const path = require('path');
const { agnes } = require('ml-hclust');
const config = require('./config');

function normaliseer(waardes) {
  const min = Math.min(...waardes);
  const max = Math.max(...waardes);
  return waardes.map(w => (max-min) > 0 ? (w-min)/(max-min) : 0);
}

async function main() {
  const features = JSON.parse(fs.readFileSync(path.join(config.OUTPUT_DIR, 'features-per-gemeente.json')));
  const ids = Object.keys(features);
  // Bouw feature-matrix
  const raw = config.FEATURES.map(f => ids.map(id => features[id][f] ?? 0));
  // Normaliseer per feature (min-max)
  const genormaliseerd = raw.map(normaliseer);
  // Transponeer terug: rijen zijn gemeenten
  const matrix = ids.map((_, i) => genormaliseerd.map(kol => kol[i]));

  const tree = agnes(matrix, { method: config.CLUSTER_METHODE });
  const groepen = tree.group(config.MAX_CLUSTERS).children.map(c => c.indices());

  const clusters = {};
  groepen.forEach((indices, clusterIdx) => {
    indices.forEach(i => {
      clusters[ids[i]] = { cluster: clusterIdx, naam: features[ids[i]].naam };
    });
  });

  // Samenvatting per cluster
  const samenvatting = {};
  for (const [id, c] of Object.entries(clusters)) {
    if (!samenvatting[c.cluster]) samenvatting[c.cluster] = [];
    samenvatting[c.cluster].push(c.naam);
  }
  console.log('Clusters:');
  for (const [k, leden] of Object.entries(samenvatting)) {
    console.log(`  Cluster ${k}: ${leden.join(', ')}`);
  }

  const uit = path.join(config.OUTPUT_DIR, 'clusters.json');
  fs.writeFileSync(uit, JSON.stringify(clusters, null, 2));
  console.log(`Klaar: ${uit}`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
