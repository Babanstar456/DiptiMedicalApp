// Imports a "Fast & Slow Moving Analysis" stock report PDF into the products collection.
// Usage: npm run import-report -- path/to/report.pdf [--dry-run]
// Needs `pdftotext` (poppler-utils). Safe to re-run: products are matched by name, and prices,
// photos, categories and types you have edited in the app are never overwritten.
require('dotenv').config();
const { execFileSync } = require('child_process');
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const ProductType = require('../src/models/ProductType');
const { escapeRegex } = require('../src/utils/crud');

const file = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
const outFile = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6); // optional: save parsed items as JSON
if (!file) {
  console.error('Usage: npm run import-report -- path/to/report.pdf [--dry-run]');
  process.exit(1);
}

/* ---------------- 1. Read words with their positions ---------------- */
// The report is printed in a fixed-width font, so every column starts at the same x position (in points) on every page.
const COL = { name: 58, company: 198, rack: 312, salt: 371, supplier: 609 };
const decode = (s) => s.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const bbox = execFileSync('pdftotext', ['-bbox', file, '-'], { maxBuffer: 200 * 1024 * 1024 }).toString();
const rows = [];
let section = '';
for (const page of bbox.split('<page ').slice(1)) {
  const words = [...page.matchAll(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="[\d.]+" yMax="[\d.]+">([^<]*)<\/word>/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    t: decode(m[3]),
  }));
  const lines = new Map();
  for (const w of words) {
    const key = [...lines.keys()].find((y) => Math.abs(y - w.y) < 1) ?? w.y;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push(w);
  }
  for (const line of [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, ws]) => ws.sort((a, b) => a.x - b.x))) {
    const text = line.map((w) => w.t).join(' ');
    const sec = /==> (.+?) <==/.exec(text);
    if (sec) {
      section = sec[1].replace(' ITEMS', '');
      continue;
    }
    if (!section || !/^\d+\.$/.test(line[0].t) || line[0].x >= COL.name) continue;

    const moving = section !== 'NON MOVING';
    const isNum = (w) => (moving ? /^-?\d+(\.\d{3})?$/ : /^-?\d+\.\d{3}$/).test(w.t) && w.x >= 440 && w.x < COL.supplier;
    const firstNum = line.find(isNum);
    const numStart = firstNum ? firstNum.x : COL.supplier;
    const pick = (from, to) => line.filter((w) => w.x >= from && w.x < to).map((w) => w.t).join(' ').trim();
    const nums = line.filter(isNum).map((w) => Number(w.t));

    rows.push({
      section,
      name: pick(COL.name, COL.company),
      company: pick(COL.company, COL.rack),
      rack: pick(COL.rack, COL.salt),
      salt: pick(COL.salt, numStart),
      closingStock: nums.length ? nums[nums.length - 1] : 0,
      supplier: pick(COL.supplier, 9999),
    });
  }
}

/* ---------------- 2. Clean up and classify ---------------- */
// Moving sections cut salt names at 10 letters ("PARACETAMO"); expand them using full names seen elsewhere.
const fullSalts = new Map();
for (const r of rows) if (r.salt.length > 10) fullSalts.set(r.salt, (fullSalts.get(r.salt) || 0) + 1);
function expandSalt(s) {
  if (s.length !== 10) return s;
  const best = [...fullSalts.entries()].filter(([full]) => full.startsWith(s)).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : s;
}
const JUNK_SALT = /^(CLEANSING( LOTION)?|OTHER PREP(ARATIONS)?)$/;
const JUNK_COMPANY = /^ZZZZZZ/;

const TYPES = [
  ['Injection', /\b(INJ|INJECTION|INJECTIO|VIAL)\b/],
  ['Inhaler', /\b(INHALER|INHALAR|INHALLER|ROTACAPS?|ROTACAP|RESPULES?|RESPUL|TRANSCAPS?|RESPICAPS|TRANSHALER|SYNCHOBRETHE)\b/],
  ['Drops', /\b(DROPS?|EYE|EAR|E\/D)\b/],
  ['Spray', /\bSPRAY\b/],
  ['Syrup / Liquid', /\b(SYP|SYRUP|SYRU|SUSP|SUSPENSION|SUSPENSIO|LIQ|LIQUID|ELIXIR|EXPECTORANT|SOLUTION|SOLU|GARGLE|MOUTH ?WASH|M\/W|SUS)\b/],
  ['Cream / Ointment', /\b(CREAM|CRE|CREEM|CRM|OINT|OINTMENT|OINMENT|GEL|JELLY|LOTION|LOT|BALM|EMULGEL)\b/],
  ['Powder / Sachet', /\b(POWDER|POW|SACHET|SACHETS|SACH|GRANULES)\b/],
  ['Capsule', /(\d|\b)CAPS?\b|\bCAPSULES?\b|\d+CAPS\b|\bCPAS\b/],
  ['Tablet', /(\d|\b)TABS?\b|\bTABLETS?\b|\b\d+TA\b|\bTABL\b|\d+TABL\b|\bTA\b|\bLOGENCE|LOZENGES?|LOZENS/],
];
const CATEGORIES = [
  ['Surgical & devices', /^(?!.*(STAYFREE|WHISPER|SOFY|CAREFREE|THERMOSEAL))(.*(SYRINGE|SYRIYGE|SYR\.|NEEDLE|GLOVES|BANDAGE|\bCOTTON\b|GAUGE|GAUZE|PLASTER|MICROPORE|LEUKOPLAST|LEUCOPLAST|HANSA ?PLUS|\bMASK\b|THERMOM|DIGITAL THERMO|OXIMETER|NEBULIZER|\bBPM\b|HOT ?WATER ?BAG|HOT BAG|HEAT BELT|KNEECAP|ANKLET|URINPOT|SUSPENSORY|CREPE|JELONET|HEAD CAP|TYNOR|COVISELF|PREGA[- ]?NEWS|NOVOPEN|DISPOVAN|NIPRO|SPIRIT|H2O2|\bPHENOL\b|STERILE WATER|^NS (\d|IV)|SODIUM CHLORIDE 0\.9))/],
  ['Baby care', /CERELAC|NAN ?PRO|NANGROW|LACTOGEN|LACTODEX|DEXOLAC|SIMILAC|ENFAMIL|NESTUM|HUGGIES|PAMPERS|MAMY ?P|JOHNSON BABY|JOHNS BABY|\bJB\b|H BABY|BABY|GRIPE WATER|FEED(ING|INF) BOTTLE|NIPPLE|EASUM/],
  ['Health drinks & nutrition', /HORLICKS|COMPLAN|ENSURE|PEDIASURE|PROHANCE|NEPRO|GLUCON|ELECTRAL|\bORS\b|WALYTE|CHYAWAN|SUGAR ?FREE|HONEY|PROTEIN|BOOST/],
  ['Personal care', /SOAP|SHAMPOO|SHAMPO|FACE ?WASH|SERUM|TOOTH ?PASTE|TOOTHBRUS|BRUSH|SENSODYNE|SENSODENT|VANTEJ|LISTERIN|DETTOL|SAVLON|SANITI[ZSG]ER|VASELINE|VESLINE|NIVEA|PONDS|BOROLINE|CETAPHIL|VEET|WHISPER|STAYFREE|\bSF DM\b|CAREFREE|SOFY|CONDOM|MANFORCE|KAMA ?SUTRA|KOHINOOR|SKORE|\bMFC\b|MOOV|VICKS|ODOMOS|BODY LOT|BODY OIL|LIP BAM|ADULT DIAPER|COLD CREAM|\bDEO\b|HAIR OIL|BUDS|WIPES|PHENYL|BLEACHING|ZEOLINE|MASSAGE OIL|VITAMIN OIL|PEARS|SUTHOL|CALAMINE|SURFACE|ZM |LACTACYD|V ?WASH|EMOFORM|THERMOSEAL|HEXIDINE|CLOHEX|REXIDIN|ORAHEX/],
  ['Ayurvedic & herbal', /HAJMOLA|PUDIN ?HARA|ISABGOL|ZANDU|LIV\.?52|SEPTILIN|AMRUTANJAN|AMRITANJAN|KAYAM|PILEX|EVECARE|RUMALAYA|DABUR|BAIDYANATH|NAVARATNA|MRITASANJIBINI|PET ?SAFA|KABZ|JANMA GHUNTI|LAL TAIL|NATUROLAX/],
];
const firstMatch = (name, list) => list.find(([, re]) => re.test(name))?.[0];
const categoryOf = (name, salt) => firstMatch(name, CATEGORIES) || (/AYU(I)?RVEDIC|HERBAL/.test(salt) ? 'Ayurvedic & herbal' : 'Medicines');
// Medicines sold as "15'S" / "10 S" (strip counts) are tablets in this shop's naming.
const typeOf = (name, category) =>
  firstMatch(name, TYPES) || (category === 'Medicines' && /\b\d+ ?'?S\b/.test(name) ? 'Tablet' : 'Other');

const byName = new Map();
for (const r of rows) {
  const key = r.name.toUpperCase();
  const salt = expandSalt(r.salt);
  const item = {
    name: r.name,
    manufacturer: JUNK_COMPANY.test(r.company) ? '' : r.company,
    rackLocation: r.rack,
    composition: JUNK_SALT.test(salt) ? '' : salt,
    supplier: r.supplier,
    inStock: r.closingStock > 0,
    featured: r.section === 'FAST MOVING', // shop Bestsellers
    category: categoryOf(key, salt),
    type: typeOf(key, categoryOf(key, salt)),
  };
  const prev = byName.get(key);
  // Same item listed twice: in stock if either line has stock; keep the first non-empty details.
  if (prev) {
    prev.inStock = prev.inStock || item.inStock;
    prev.featured = prev.featured || item.featured;
    for (const k of ['manufacturer', 'rackLocation', 'composition', 'supplier']) prev[k] = prev[k] || item[k];
  } else byName.set(key, item);
}
const items = [...byName.values()].filter((i) => i.name);

/* ---------------- 3. Report & write ---------------- */
const count = (k) => Object.entries(items.reduce((m, i) => ((m[i[k]] = (m[i[k]] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
const sections = rows.reduce((m, r) => ((m[r.section] = (m[r.section] || 0) + 1), m), {});
console.log(`Rows read: ${rows.length}`, sections);
console.log(`Unique products: ${items.length} (in stock ${items.filter((i) => i.inStock).length}, out of stock ${items.filter((i) => !i.inStock).length})`);
console.log('Categories:', Object.fromEntries(count('category')));
console.log('Types:', Object.fromEntries(count('type')));

(async () => {
  if (outFile) require('fs').writeFileSync(outFile, JSON.stringify(items, null, 1));
  if (dryRun) {
    console.log('\nSample:', items.slice(0, 3), '\nDry run: nothing written.');
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`\nWriting to database "${mongoose.connection.name}"…`);

  const idFor = {};
  for (const [Model, names] of [
    [Category, new Set(items.map((i) => i.category))],
    [ProductType, new Set(items.map((i) => i.type))],
  ]) {
    for (const n of names) {
      const doc = (await Model.findOne({ name: new RegExp(`^${escapeRegex(n)}$`, 'i') })) || (await Model.create({ name: n }));
      idFor[`${Model.modelName}:${n}`] = doc._id;
    }
  }

  const ops = items.map((i) => ({
    updateOne: {
      filter: { name: new RegExp(`^${escapeRegex(i.name)}$`, 'i') },
      update: {
        $set: { inStock: i.inStock, manufacturer: i.manufacturer, rackLocation: i.rackLocation, composition: i.composition, supplier: i.supplier },
        // Only for new products: never overwrite what was edited in the app
        $setOnInsert: { name: i.name, category: idFor[`Category:${i.category}`], type: idFor[`ProductType:${i.type}`], isActive: true, featured: i.featured },
      },
      upsert: true,
    },
  }));
  let created = 0;
  let updated = 0;
  for (let n = 0; n < ops.length; n += 500) {
    const r = await Product.bulkWrite(ops.slice(n, n + 500), { ordered: false });
    created += r.upsertedCount;
    updated += r.modifiedCount;
  }
  console.log(`Done: ${created} products created, ${updated} updated.`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error('Import failed:', err.message);
  process.exit(1);
});
