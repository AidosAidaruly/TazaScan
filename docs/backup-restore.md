# TazaScan Backup and Restore Runbook

This runbook covers the two pieces of state a TazaScan backend owns and that cannot be rebuilt from Git:

| What | Where | Contains |
| --- | --- | --- |
| PostgreSQL database | `DATABASE_URL` (one database, schema `public`) | products, product families, halal certifications, product submissions, admin users (bcrypt hashes), and `_prisma_migrations` (migration history and checksums) |
| Uploaded files | `UPLOAD_ROOT` (default `backend/api/uploads`, absolute path in production) | `products/` (public product images) and `submissions/` (submission evidence photos, admin-only, may contain personal data) |

Everything else is rebuilt from the repository: code, `node_modules`, the generated Prisma client (`npx prisma generate`), the OCR language data (`backend/api/eng.traineddata`, `rus.traineddata`), and the Admin and mobile builds. Secrets (`.env`, `JWT_SECRET`, `ADMIN_PASSWORD`, database credentials) are **not** part of these backups; keep them in the hosting provider's secret store or a password manager.

If the production database is a managed PostgreSQL service with automated backups or point-in-time recovery, enable that first; the `pg_dump` procedure below is then the portable second copy and the tool for restore drills. Uploads are never covered by a database provider's backups.

## 1. Rules

- **Never restore into the active database.** Always restore into a new, empty database with a unique name, verify it, and only then point the API at it.
- **Never overwrite or delete an existing backup** when taking a new one; every backup gets a new timestamped name, and retention removes old ones only after newer verified ones exist (section 7).
- **Backups contain personal data** (submission photos, admin email addresses, password hashes). Store them outside the repository, outside synced folders (OneDrive, Dropbox), encrypted at rest, readable only by the operator or backup account. Never commit them.
- **Never put a password on a command line or in a connection URL inside a script.** Command lines are visible in process lists and shell history; URLs end up in logs. Use a password file (section 2).
- Restore and migration commands against a database are only run after confirming the target with `SELECT current_database()`.

## 2. Credentials without exposure

PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`, `createdb`, `dropdb`) read the connection from the standard `PG*` environment variables and the password from a password file, so no secret appears in commands or logs.

Linux (backup account):

```bash
# ~/.pgpass, one line per server: host:port:database:user:password
install -m 600 /dev/null ~/.pgpass
printf '%s\n' 'db.example.internal:5432:*:tazascan_backup:REPLACE_ME' >> ~/.pgpass   # edit, never commit
export PGHOST=db.example.internal PGPORT=5432 PGUSER=tazascan_backup
```

Windows (PowerShell, the user that runs the backup):

```powershell
# %APPDATA%\postgresql\pgpass.conf, same format as .pgpass; keep the file private to this user
$passFile = Join-Path $env:APPDATA 'postgresql\pgpass.conf'
New-Item -ItemType Directory -Force (Split-Path $passFile) | Out-Null
# Add the line host:port:*:user:password with an editor; do not echo it to the console.
$env:PGHOST = 'localhost'; $env:PGPORT = '5432'; $env:PGUSER = 'postgres'
```

For a one-off interactive session you may instead set `PGPASSWORD` from a prompt and remove it afterwards:

```powershell
$secure = Read-Host 'PostgreSQL password' -AsSecureString
$env:PGPASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
# ... run the commands ...
Remove-Item Env:PGPASSWORD
```

Use a dedicated backup role with read access where the provider allows it. Prisma (`npx prisma migrate status`) cannot use a password file; it needs `DATABASE_URL`. Set that only as an environment variable inside the session, never print it, and clear it afterwards (section 6).

## 3. Keeping database and files consistent

The database stores file references as relative URLs:

- `products."imageUrl"` → `/uploads/products/<uuid>.jpg` (or an external `https://` URL, e.g. Open Food Facts)
- `product_submissions` `"frontImageUrl"`, `"ingredientsImageUrl"`, `"nutritionImageUrl"`, `"barcodeImageUrl"` → `/product-submissions/uploads/<uuid>.jpg`

The backend keeps one invariant: **a file is written before any row references it, and deleted only after no row references it** (submission and product image uploads save the file first; image replacement and product deletion remove the file after the database update). Files are never modified in place; every upload gets a new random name.

Consequences for backups:

- A file without a referencing row (an "orphan") is harmless.
- A row whose file is missing (a "dangling reference") shows as a missing image and must be avoided.

Two ways to take a consistent pair:

1. **Short maintenance window (exact, recommended for a single small instance).** Stop the API (it shuts down gracefully within 8 seconds), take the database dump, archive `UPLOAD_ROOT`, start the API again. Nothing changes between the two copies.
2. **Online.** Archive `UPLOAD_ROOT`, then dump the database, then copy any files created in between into the backup *without deleting anything* (a second, additive pass). A dangling reference is only possible for a file that was both uploaded and deleted during those few minutes. Run the consistency check (section 5.3) on every restore drill.

Store the database dump and the uploads archive of one run together under the same timestamp.

## 4. Taking a backup

### 4.1 Linux (production host or backup job)

```bash
#!/usr/bin/env bash
set -euo pipefail
umask 077                                   # backups readable by this user only

BACKUP_DIR=/var/backups/tazascan            # outside the repository, on a different disk than the database
UPLOAD_ROOT=/var/lib/tazascan/uploads       # same value as the API's UPLOAD_ROOT
DB_NAME=tazascan                            # PGHOST/PGPORT/PGUSER from the environment, password from ~/.pgpass

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
RUN_DIR="$BACKUP_DIR/$STAMP"
mkdir "$RUN_DIR"                            # fails if this run already exists: nothing is overwritten
touch "$RUN_DIR/.started"                   # reference time for step 3

# 1) uploads (first pass)
tar -C "$UPLOAD_ROOT" -czf "$RUN_DIR/uploads.tar.gz" .

# 2) database, custom format (compressed, selective restore, verifiable table of contents)
pg_dump --format=custom --no-password --dbname="$DB_NAME" --file="$RUN_DIR/database.dump"

# 3) uploads created since step 1 started (additive, never deletes)
(cd "$UPLOAD_ROOT" && find . -type f -newer "$RUN_DIR/.started") > "$RUN_DIR/uploads-late.list"
tar -C "$UPLOAD_ROOT" -czf "$RUN_DIR/uploads-late.tar.gz" -T "$RUN_DIR/uploads-late.list"

# 4) checksums and quick integrity checks
pg_restore --list "$RUN_DIR/database.dump" > "$RUN_DIR/database.toc"
grep -c 'TABLE DATA' "$RUN_DIR/database.toc"           # expect 6 (5 app tables + _prisma_migrations)
pg_restore --file=/dev/null "$RUN_DIR/database.dump"   # reads every entry; non-zero exit means a damaged dump
tar -tzf "$RUN_DIR/uploads.tar.gz" > /dev/null
(cd "$RUN_DIR" && sha256sum database.dump uploads.tar.gz uploads-late.tar.gz > SHA256SUMS)
echo "backup ok: $RUN_DIR"
```

Use the same `pg_dump`/`pg_restore` major version as the server, or newer. Skip step 3 when the API is stopped (maintenance window).

### 4.2 Windows PowerShell (local development or a Windows host)

```powershell
$ErrorActionPreference = 'Stop'
$BackupDir  = 'C:\Backups\tazascan'                     # outside the repository and outside OneDrive
$UploadRoot = 'C:\path\to\Startap_Project\backend\api\uploads'
$DbName     = 'tazascan'                                # PGHOST/PGPORT/PGUSER set, password from pgpass.conf

$stamp  = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$runDir = Join-Path $BackupDir $stamp
if (Test-Path $runDir) { throw "Backup $runDir already exists" }   # never overwrite
New-Item -ItemType Directory -Path $runDir | Out-Null
$started = Get-Date

# 1) uploads (tar is built into Windows 10 and later)
tar -C $UploadRoot -czf (Join-Path $runDir 'uploads.tar.gz') .
if ($LASTEXITCODE) { throw 'uploads archive failed' }

# 2) database (build paths in variables first: PowerShell splits --file=(expression) into two arguments)
$dumpFile = Join-Path $runDir 'database.dump'
pg_dump --format=custom --no-password --dbname=$DbName --file=$dumpFile
if ($LASTEXITCODE) { throw 'pg_dump failed' }

# 2b) uploads created since step 1 started (online backups; additive, never deletes)
$late = Get-ChildItem $UploadRoot -Recurse -File | Where-Object LastWriteTime -ge $started |
  ForEach-Object { '.' + $_.FullName.Substring((Resolve-Path $UploadRoot).Path.Length).Replace('\', '/') }
if ($late) {
  $late | Set-Content (Join-Path $runDir 'uploads-late.list') -Encoding ascii
  tar -C $UploadRoot -czf (Join-Path $runDir 'uploads-late.tar.gz') -T (Join-Path $runDir 'uploads-late.list')
  if ($LASTEXITCODE) { throw 'late uploads archive failed' }
}

# 3) integrity checks and checksums
$toc = pg_restore --list $dumpFile; if ($LASTEXITCODE) { throw 'unreadable dump' }
$toc | Set-Content (Join-Path $runDir 'database.toc')
"TABLE DATA entries: $(@($toc | Select-String 'TABLE DATA').Count)"   # expect 6
pg_restore --file=NUL $dumpFile; if ($LASTEXITCODE) { throw 'damaged dump' }
tar -tzf (Join-Path $runDir 'uploads.tar.gz') | Out-Null; if ($LASTEXITCODE) { throw 'damaged archive' }
$sums = Get-ChildItem $runDir -File | Where-Object Extension -in '.dump', '.gz' |
  ForEach-Object { "{0}  {1}" -f (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(), $_.Name }
# LF line endings, so `sha256sum -c SHA256SUMS` also works on Linux
[System.IO.File]::WriteAllText((Join-Path $runDir 'SHA256SUMS'), (($sums -join "`n") + "`n"))
"backup ok: $runDir"
```

Never use mirroring options (`robocopy /MIR` or `/PURGE`, `rsync --delete`) for upload backups: a backup must only ever add files.

Both scripts write `SHA256SUMS` as their last step. A run directory without `SHA256SUMS` is an interrupted, incomplete backup: do not restore from it, and remove it only after a later run has completed successfully.

## 5. Verifying a backup

### 5.1 Every backup (automatic, cheap)

- `pg_restore --list` succeeds and shows `TABLE DATA` for all 6 tables: `_prisma_migrations`, `canonical_product_families`, `product_halal_certifications`, `product_submissions`, `products`, `users`.
- `pg_restore --file=/dev/null` (`NUL` on Windows) reads the whole archive with exit code 0.
- `tar -tzf` lists the uploads archive.
- `SHA256SUMS` is written; re-check it before any restore (`sha256sum -c SHA256SUMS`, or compare `Get-FileHash` output).

### 5.2 Restore drill (at least monthly, and before relying on a new backup setup)

Restore the latest backup into a disposable database and a scratch directory (section 6, steps 1–5), compare it with the source, then drop the drill database. A backup that has never been restored is not a verified backup.

### 5.3 Consistency check (database ↔ files)

Lists every locally stored file the restored database references and reports any that is missing from the restored uploads.

```bash
# Capture first: a failed query must stop the check instead of looking like "nothing missing".
refs=$(psql --no-password --dbname="$RESTORE_DB" -At -v ON_ERROR_STOP=1 -c "
  SELECT v FROM (
    SELECT \"imageUrl\" v FROM products
    UNION ALL SELECT unnest(ARRAY[\"frontImageUrl\",\"ingredientsImageUrl\",\"nutritionImageUrl\",\"barcodeImageUrl\"])
    FROM product_submissions) s
  WHERE v LIKE '/uploads/products/%' OR v LIKE '/product-submissions/uploads/%'") || { echo 'CHECK FAILED: query error'; exit 1; }
echo "referenced files: $(printf '%s' "$refs" | grep -c .)"
printf '%s\n' "$refs" | tr -d '\r' |      # tr: harmless on Linux; needed when Windows psql runs under Git Bash
while read -r url; do
  [ -n "$url" ] || continue
  case "$url" in
    /uploads/products/*)             file="$RESTORE_UPLOADS/products/${url##*/}" ;;
    /product-submissions/uploads/*)  file="$RESTORE_UPLOADS/submissions/${url##*/}" ;;
  esac
  [ -f "$file" ] || echo "MISSING $url"
done
```

```powershell
# The SQL goes through stdin: Windows PowerShell strips embedded double quotes from native arguments.
$sql = @'
SELECT v FROM (
  SELECT "imageUrl" v FROM products
  UNION ALL SELECT unnest(ARRAY["frontImageUrl","ingredientsImageUrl","nutritionImageUrl","barcodeImageUrl"])
  FROM product_submissions) s
WHERE v LIKE '/uploads/products/%' OR v LIKE '/product-submissions/uploads/%';
'@
$refs = @($sql | psql --no-password --dbname=$RestoreDb -At -v ON_ERROR_STOP=1 -f -)
if ($LASTEXITCODE) { throw 'CHECK FAILED: query error' }   # never report "0 missing" for a failed query
$missing = foreach ($url in $refs) {
  $scope = if ($url -like '/uploads/products/*') { 'products' } else { 'submissions' }
  $file = Join-Path (Join-Path $RestoreUploads $scope) ($url -split '/')[-1]
  if (-not (Test-Path $file)) { $url }
}
"referenced files: $(@($refs).Count), missing: $(@($missing).Count)"; $missing
```

Zero missing files is the expected result.

## 6. Restoring

Use this both for drills and for real recovery. Steps 1–5 never touch the running system.

1. **Pick a unique target name** and make sure it does not exist yet, e.g. `tazascan_restore_20261101T120000Z`.

   ```bash
   RESTORE_DB=tazascan_restore_$(date -u +%Y%m%dT%H%M%SZ)
   psql --no-password -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '$RESTORE_DB'"   # must print nothing
   createdb --no-password "$RESTORE_DB"
   ```

2. **Confirm the target**, then restore into it:

   ```bash
   psql --no-password -d "$RESTORE_DB" -Atc "SELECT current_database()"   # must print the new name
   pg_restore --no-password --exit-on-error --no-owner --no-privileges --dbname="$RESTORE_DB" "$RUN_DIR/database.dump"
   ```

   `--no-owner --no-privileges` makes the restore work under a different database role (a new host or provider).

3. **Restore the uploads** into a new empty directory (never over the live `UPLOAD_ROOT`):

   ```bash
   RESTORE_UPLOADS=/var/lib/tazascan/uploads-restore-$(date -u +%Y%m%dT%H%M%SZ)
   mkdir "$RESTORE_UPLOADS"
   tar -C "$RESTORE_UPLOADS" -xzf "$RUN_DIR/uploads.tar.gz"
   [ -f "$RUN_DIR/uploads-late.tar.gz" ] && tar -C "$RESTORE_UPLOADS" -xzf "$RUN_DIR/uploads-late.tar.gz"
   ```

4. **Check the migration state** (read-only) from `backend/api` with `DATABASE_URL` pointing at the restored database, set only in this shell:

   ```bash
   read -rs DB_PASSWORD   # not echoed
   DATABASE_URL="postgresql://$PGUSER:$DB_PASSWORD@$PGHOST:$PGPORT/$RESTORE_DB" npx prisma migrate status
   unset DB_PASSWORD
   ```

   Expect `Database schema is up to date!` for the code version that produced the backup. If the restored database is older than the code you are about to run, apply only `npm run prisma:migrate:deploy` (never `migrate dev` or `migrate reset`), after confirming the target name in the command output. A database built with the old migration history may first need the one-row checksum reconciliation described in the migration repair notes before `migrate dev` is used locally.

5. **Verify the data**: row counts per table against the source (or against the counts recorded at backup time), the consistency check (section 5.3), and spot-check a few products and submissions in the Admin panel of a test instance.

6. **Switch over (real recovery only).** Stop the API, set `DATABASE_URL` to the restored database and `UPLOAD_ROOT` to the restored directory (or move the restored directory into place), start the API, and confirm `GET /health/ready` returns `{"status":"ready",...,"checks":{"database":"ok"}}`. Keep the previous database and upload directory untouched until the restored system has been verified, then archive them like any other backup.

7. **Re-apply deletions.** If personal data was deleted on request after the backup was taken (see `docs/data-deletion.md`), delete it again in the restored system before reopening it. Keep a dated log of deletion requests for this purpose.

8. **Clean up a drill**: `dropdb --no-password "$RESTORE_DB"` and remove the scratch upload directory — only after double-checking that the name is the drill database and not the live one.

## 7. Scheduling and retention

| When | What |
| --- | --- |
| Daily | Database dump and uploads archive (section 4), off-peak, with the integrity checks of section 5.1 |
| Before every deployment that runs migrations, and before any data repair script | An extra on-demand backup |
| Monthly | Restore drill (section 5.2) |

Retention recommendation (balance recovery needs with the privacy commitment that deleted submissions eventually disappear from backups too):

- keep the last 7 daily backups and 4 weekly backups (about one month in total);
- keep at least one copy off the database host (another region, object storage, or an encrypted external drive);
- delete expired backups only after a newer backup has passed its integrity checks;
- record the retention period in the privacy policy once it is final.

Alert the operator when a scheduled backup fails or produces a file much smaller than the previous one.

## 8. What this runbook does not cover

- Managed object storage: `STORAGE_DRIVER=s3` is not implemented; uploads live on the local disk at `UPLOAD_ROOT`.
- Several API instances: the current deployment model is a single instance with a persistent disk.
- Mobile-device data: scan history and favorites live only on users' devices and are not backed up by the backend.
