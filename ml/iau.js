// Build the IAU-88 comparison layer (benchmark only, never used by the pipeline).
const fs = require('fs');
const z = JSON.parse(fs.readFileSync('public/zames.json', 'utf8'));
const name2id = new Map(z.stars.map(s => [s.name, s.id]));

const FIG = {
 'Orion': [['Betelgeuse','Bellatrix'],['Bellatrix','Alnilam'],['Alnilam','Mintaka'],['Mintaka','Saiph'],['Saiph','Rigel'],['Rigel','Alnitak'],['Alnitak','Alnilam'],['Betelgeuse','Alnitak'],['Bellatrix','Mintaka'],['Rigel','Mintaka'],['Betelgeuse','Hatysa']],
 'Ursa Major': [['Dubhe','Merak'],['Merak','Phecda'],['Phecda','Alioth'],['Alioth','Mizar'],['Mizar','Alkaid'],['Alioth','Dubhe'],['Mizar','Psi UMa']],
 'Cassiopeia': [['Caph','Schedar'],['Schedar','Ruchbah'],['Ruchbah','Eps Per']],
 'Cygnus': [['Deneb','Sadr'],['Sadr','Gienah'],['Sadr','Fawaris'],['Gienah','Fawaris']],
 'Leo': [['Regulus','Algieba'],['Algieba','Zosma'],['Zosma','Denebola'],['Regulus','Zosma'],['Zosma','Algieba'],['Denebola','Zosma']],
 'Scorpius': [['Antares','Alniyat'],['Antares','Shaula'],['Shaula','Lesath'],['Antares','Dschubba'],['Dschubba','Acrab'],['Antares','Sargas'],['Antares','Kap Sco']],
 'Crux': [['Acrux','Mimosa'],['Mimosa','Gacrux'],['Gacrux','Imai'],['Acrux','Imai']],
 'Gemini': [['Castor','Pollux'],['Castor','Tejat'],['Pollux','Alhena'],['Tejat','Alhena'],['Castor','Alhena']],
 'Taurus': [['Aldebaran','Elnath'],['Aldebaran','Alcyone'],['Elnath','Alcyone']],
 'Canis Major': [['Sirius','Mirzam'],['Sirius','Wezen'],['Wezen','Adhara'],['Adhara','Aludra']],
 'Lyra': [['Vega','Sheliak']],
 'Aquila': [['Altair','Tarazed']],
 'Bootes': [['Arcturus','Izar'],['Arcturus','Kornephoros'],['Izar','Kornephoros'],['Arcturus','Muphrid']],
 'Pegasus': [['Markab','Scheat'],['Scheat','Alpheratz'],['Alpheratz','Algenib'],['Algenib','Markab'],['Markab','Enif']],
 'Canis Minor': [['Procyon','Gomeisa']],
 'Auriga': [['Capella','Menkalinan'],['Capella','Mahasim'],['Menkalinan','Elnath'],['Mahasim','Elnath']],
 'Perseus': [['Mirfak','Algol'],['Mirfak','Gam Per'],['Algol','Gam Per']],
 'Centaurus': [['Rigil Kentaurus','Hadar'],['Hadar','Menkent'],['Hadar','Eps Cen'],['Eps Cen','Gam Cen'],['Gam Cen','Zet Cen'],['Gam Cen','Iot Cen']],
 'Carina': [['Canopus','Miaplacidus'],['Miaplacidus','Aspidiske'],['Aspidiske','Avior'],['Avior','The Car'],['The Car','Ups Car']],
 'Grus': [],
};

const out = [];
for (const [con, pairs] of Object.entries(FIG)) {
 const edges = [];
 for (const [a, b] of pairs) {
 const ia = name2id.get(a), ib = name2id.get(b);
 if (ia == null || ib == null) continue;
 edges.push([ia, ib]);
 }
 if (edges.length) out.push({ con, edges });
}
fs.writeFileSync('public/iau88.json', JSON.stringify({ figures: out }));
const missing = [];
for (const pairs of Object.values(FIG)) for (const [a, b] of pairs) {
 if (!name2id.has(a)) missing.push(a);
 if (!name2id.has(b)) missing.push(b);
}
console.log('figures', out.length, 'edges', out.reduce((s, f) => s + f.edges.length, 0));
console.log('missing', [...new Set(missing)].join(', '));
