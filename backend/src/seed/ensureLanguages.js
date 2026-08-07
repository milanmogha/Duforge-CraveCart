// Seed the Language collection from v1's real packs (english/hindi/gujarati
// fully translated; arabic was a near-stub in v1 → seeded inactive, useful for
// the RTL demo). Runs at boot; no-op once languages exist.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Language } from '../models/Misc.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const META = {
  en: { name: 'English', nativeName: 'English', rtl: false, active: true, sortOrder: 0 },
  hi: { name: 'Hindi', nativeName: 'हिन्दी', rtl: false, active: true, sortOrder: 1 },
  gu: { name: 'Gujarati', nativeName: 'ગુજરાતી', rtl: false, active: true, sortOrder: 2 },
  ar: { name: 'Arabic', nativeName: 'العربية', rtl: true, active: false, sortOrder: 3 },
};

export async function ensureLanguages() {
  const count = await Language.countDocuments();
  if (count > 0) return;
  const packs = JSON.parse(fs.readFileSync(path.join(__dirname, 'v1-languages.json'), 'utf8'));
  for (const [code, strings] of Object.entries(packs)) {
    await Language.create({ code, ...META[code], strings });
  }
  console.log(`[i18n] seeded ${Object.keys(packs).length} languages from v1 packs`);
}
