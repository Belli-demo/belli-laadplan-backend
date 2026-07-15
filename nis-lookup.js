// nis-lookup.js — Statische NIS-code tabel voor Belgische gemeenten
// Bron: Statbel, toestand 2024
// Formaat: { 'gemeentenaam_lowercase': nisCode }

const NIS_CODES = {
  // Antwerpen provincie
  'antwerpen': '11002', 'mechelen': '12025', 'turnhout': '13040',
  'lier': '12021', 'mol': '13025', 'olen': '13025',
  'geel': '13008', 'herentals': '13011', 'mortsel': '11029',
  'boom': '11005', 'lint': '11024', 'kontich': '11022',
  'aartselaar': '11001', 'edegem': '11013', 'hove': '11021',
  'zandhoven': '11054', 'brasschaat': '11007', 'schoten': '11040',
  'wijnegem': '11050', 'wommelgem': '11052', 'borsbeek': '11004',
  'beringen': '71004', 'tessenderlo': '71057',

  // Vlaams-Brabant
  'leuven': '24062', 'halle': '23032', 'vilvoorde': '23088',
  'aarschot': '24001', 'diest': '24020', 'tienen': '24107',
  'haacht': '24033', 'tremelo': '24109', 'boortmeerbeek': '24014',
  'zemst': '23094', 'kampenhout': '23038', 'steenokkerzeel': '23081',
  'zaventem': '23093', 'machelen': '23047', 'grimbergen': '23025',
  'meise': '23052', 'londerzeel': '23044', 'kapelle-op-den-bos': '23038',
  'overijse': '23060', 'hoeilaart': '23033', 'tervuren': '23084',
  'kraainem': '23039', 'wezembeek-oppem': '23103', 'sint-pieters-leeuw': '23077',
  'dilbeek': '23016', 'asse': '23003', 'roosdaal': '23063',
  
  // Oost-Vlaanderen
  'gent': '44021', 'aalst': '41002', 'sint-niklaas': '46021',
  'dendermonde': '42006', 'lokeren': '46013', 'beveren': '46003',
  'maldegem': '43010', 'eeklo': '43005', 'zottegem': '41082',
  'ninove': '41048', 'geraardsbergen': '41018', 'ronse': '45041',
  'wetteren': '42025', 'wichelen': '42026', 'laarne': '42010',
  'destelbergen': '44013', 'melle': '44040', 'merelbeke': '44043',
  'de pinte': '44012', 'gavere': '44020', 'nazareth': '44048',
  'kruisem': '45068', 'oudenaarde': '45035',

  // West-Vlaanderen  
  'brugge': '31005', 'kortrijk': '34022', 'roeselare': '36015',
  'oostende': '35013', 'ieper': '33011', 'veurne': '38025',
  'diksmuide': '32003', 'tielt': '37010', 'torhout': '31033',
  'izegem': '36008', 'waregem': '34040', 'zwevegem': '34042',
  'kuurne': '34023', 'harelbeke': '34013', 'deerlijk': '34009',
  'ledegem': '36010', 'moorslede': '36012', 'menen': '34027',
  'wevelgem': '34041', 'knokke-heist': '31043', 'blankenberge': '31004',
  'de haan': '35029', 'bredene': '35002', 'middelkerke': '35011',
  'gistel': '35005', 'torhout': '31033', 'jabbeke': '31012',
  
  // Limburg
  'hasselt': '71022', 'genk': '71016', 'tongeren': '73083',
  'maaseik': '72025', 'beringen': '71004', 'lommel': '72020',
  'heusden-zolder': '71024', 'diepenbeek': '71011', 'bilzen': '73006',
  'lanaken': '73042', 'maasmechelen': '73107', 'as': '71002',
  'gingelom': '73028', 'sint-truiden': '71053', 'herk-de-stad': '71023',
  'halen': '71020', 'leopoldsburg': '71034', 'peer': '72030',
  'bree': '72004', 'kinrooi': '72018',

  // Brussel
  'brussel': '21004', 'anderlecht': '21001', 'elsene': '21009',
  'etterbeek': '21005', 'evere': '21006', 'ganshoren': '21008',
  'jette': '21010', 'koekelberg': '21011', 'molenbeek': '21012',
  'schaarbeek': '21015', 'sint-agatha-berchem': '21002',
  'sint-gillis': '21013', 'sint-joost-ten-node': '21014',
  'sint-lambrechts-woluwe': '21018', 'sint-pieters-woluwe': '21019',
  'ukkel': '21016', 'vorst': '21007', 'watermaal-bosvoorde': '21017',

  // Wallonië (grote steden)
  'luik': '62063', 'charleroi': '52011', 'namen': '92094',
  'mons': '53053', 'la louvière': '53046', 'moeskroen': '57064',
  'doornik': '57081', 'waver': '25112', 'nijvel': '25072',
};

// Zoek NIS-code voor een gemeentenaam (fuzzy match)
function findNisCode(naam) {
  const key = naam.toLowerCase().trim();
  
  // Directe match
  if (NIS_CODES[key]) return NIS_CODES[key];
  
  // Gedeeltelijke match (naam begint met zoekterm)
  const partial = Object.keys(NIS_CODES).find(k => 
    k.startsWith(key) || key.startsWith(k)
  );
  if (partial) return NIS_CODES[partial];
  
  // Bevat match
  const contains = Object.keys(NIS_CODES).find(k =>
    k.includes(key) || key.includes(k)
  );
  if (contains) return NIS_CODES[contains];
  
  return null;
}

module.exports = { NIS_CODES, findNisCode };
