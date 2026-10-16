// Cópias de segurança do banco: pasta local data/backups e, se configurada, uma pasta
// sincronizada na nuvem (por exemplo, a pasta do Google Drive) em BACKUP_DIR.
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";
import { rootDir } from "./db.js";

const keepDays = 30;

function copyTo(db, dir, label) {
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `caderno-${label}.db`);
  rmSync(target, { force: true });
  db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  return target;
}

function prune(dir) {
  const files = readdirSync(dir).filter((f) => /^caderno-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const file of files.slice(0, Math.max(0, files.length - keepDays))) rmSync(join(dir, file), { force: true });
}

export function runBackup(db) {
  const day = new Date().toLocaleDateString("sv-SE");
  const dirs = [resolve(rootDir, "data", "backups")];
  // BACKUP_DIR aceita "~" para a pasta do usuário, ex.: ~/My Drive/Caderno de Estudos.
  if (process.env.BACKUP_DIR) dirs.push(resolve(process.env.BACKUP_DIR.replace(/^~(?=$|[\\/])/, homedir())));
  const done = [];
  for (const dir of dirs) {
    try {
      copyTo(db, dir, "atual");
      copyTo(db, dir, day);
      prune(dir);
      done.push(dir);
    } catch (error) {
      console.error(`Backup falhou em ${dir}:`, error.message);
    }
  }
  return done;
}

// Agenda um backup alguns segundos depois da última alteração.
export function createBackupScheduler(db, delayMs = 5000) {
  let timer = null;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => runBackup(db), delayMs);
  };
}
