import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';

export interface BackupMetadata {
    id: string;
    filename: string;
    size_bytes: number;
    size_formatted: string;
    checksum_sha256: string;
    created_at: string;
    type: 'manual' | 'scheduled';
    triggered_by: string;
    schemas: string[];
    status: 'completed' | 'failed' | 'in_progress';
    error_message?: string;
}

export interface BackupStats {
    total_backups: number;
    total_size_bytes: number;
    total_size_formatted: string;
    last_backup: BackupMetadata | null;
    retention_days: number;
    scheduler_enabled: boolean;
    schemas: string[];
}

// Backup storage directory inside uploads/backups
const BACKUPS_DIR = path.join(process.cwd(), 'uploads', 'backups');

export const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const ensureBackupsDir = (): void => {
    if (!fs.existsSync(BACKUPS_DIR)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
};

/**
 * Executes a PostgreSQL database dump via pg_dump, gzipping on the fly and calculating checksum.
 */
export const createBackup = async (
    triggeredBy: string = 'superadmin',
    type: 'manual' | 'scheduled' = 'manual'
): Promise<BackupMetadata> => {
    ensureBackupsDir();

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const backupId = `backup_ultec_${timestamp}`;
    const filename = `${backupId}.sql.gz`;
    const metadataFilename = `${backupId}.json`;
    const filePath = path.join(BACKUPS_DIR, filename);
    const metadataPath = path.join(BACKUPS_DIR, metadataFilename);

    const dbHost = process.env.DB_HOST || 'supabase-db';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbName = process.env.DB_NAME || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'ULTECpostgres2026!Secure';

    return new Promise<BackupMetadata>((resolve, reject) => {
        const dumpArgs = [
            '-h', dbHost,
            '-p', dbPort,
            '-U', dbUser,
            '-d', dbName,
            '--schema=public',
            '--schema=auth',
            '--clean',
            '--if-exists',
            '--no-owner',
            '--no-privileges'
        ];

        const dumpEnv = {
            ...process.env,
            PGPASSWORD: dbPassword
        };

        const pgDump = spawn('pg_dump', dumpArgs, { env: dumpEnv });
        const gzip = zlib.createGzip({ level: 9 });
        const fileStream = fs.createWriteStream(filePath);
        const hash = crypto.createHash('sha256');

        let stderrData = '';

        pgDump.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        pgDump.on('error', (err) => {
            console.error('[BACKUP] Error spawning pg_dump process:', err);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch {}
            }
            reject(new Error(`No se pudo ejecutar pg_dump: ${err.message}`));
        });

        // Pipe stdout through hash and gzip to file
        pgDump.stdout.on('data', (chunk) => {
            hash.update(chunk);
        });

        pgDump.stdout.pipe(gzip).pipe(fileStream);

        fileStream.on('finish', () => {
            try {
                const stats = fs.statSync(filePath);
                const checksum = hash.digest('hex');

                const metadata: BackupMetadata = {
                    id: backupId,
                    filename,
                    size_bytes: stats.size,
                    size_formatted: formatBytes(stats.size),
                    checksum_sha256: checksum,
                    created_at: new Date().toISOString(),
                    type,
                    triggered_by: triggeredBy,
                    schemas: ['public', 'auth'],
                    status: 'completed'
                };

                fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

                // Rotate older scheduled backups to save disk space
                rotateOldBackups(7).catch(err => {
                    console.warn('[BACKUP] Warning during backup rotation:', err);
                });

                console.log(`[BACKUP] Successfully created ${filename} (${metadata.size_formatted})`);
                resolve(metadata);
            } catch (err: any) {
                console.error('[BACKUP] Error finalizing backup metadata:', err);
                reject(err);
            }
        });

        fileStream.on('error', (err) => {
            console.error('[BACKUP] File write stream error:', err);
            if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch {}
            }
            reject(err);
        });
    });
};

/**
 * Returns the list of all available backups ordered by creation date descending.
 */
export const listBackups = (): BackupMetadata[] => {
    ensureBackupsDir();

    try {
        const files = fs.readdirSync(BACKUPS_DIR);
        const gzFiles = files.filter(f => f.endsWith('.sql.gz') && f.startsWith('backup_ultec_'));

        const backups: BackupMetadata[] = [];

        for (const gzFile of gzFiles) {
            const filePath = path.join(BACKUPS_DIR, gzFile);
            const metaFile = gzFile.replace('.sql.gz', '.json');
            const metaPath = path.join(BACKUPS_DIR, metaFile);

            if (fs.existsSync(metaPath)) {
                try {
                    const content = fs.readFileSync(metaPath, 'utf-8');
                    const parsed = JSON.parse(content);
                    backups.push(parsed);
                    continue;
                } catch (e) {
                    // Fall back to reading file stats if JSON corrupted
                }
            }

            // Fallback metadata if JSON doesn't exist
            try {
                const stats = fs.statSync(filePath);
                backups.push({
                    id: gzFile.replace('.sql.gz', ''),
                    filename: gzFile,
                    size_bytes: stats.size,
                    size_formatted: formatBytes(stats.size),
                    checksum_sha256: 'n/a',
                    created_at: stats.mtime.toISOString(),
                    type: 'manual',
                    triggered_by: 'system',
                    schemas: ['public', 'auth'],
                    status: 'completed'
                });
            } catch {}
        }

        // Sort by creation date descending (newest first)
        return backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (err) {
        console.error('[BACKUP] Error listing backups:', err);
        return [];
    }
};

/**
 * Computes general backup statistics.
 */
export const getBackupStats = (): BackupStats => {
    const backups = listBackups();
    const totalBytes = backups.reduce((acc, curr) => acc + curr.size_bytes, 0);

    return {
        total_backups: backups.length,
        total_size_bytes: totalBytes,
        total_size_formatted: formatBytes(totalBytes),
        last_backup: backups[0] || null,
        retention_days: 7,
        scheduler_enabled: true,
        schemas: ['public', 'auth']
    };
};

/**
 * Validates filename and returns safe absolute path.
 */
export const getBackupFilePath = (filename: string): string => {
    ensureBackupsDir();

    // Prevent Path Traversal
    if (!/^[a-zA-Z0-9_-]+\.sql\.gz$/.test(filename)) {
        throw new Error('Nombre de archivo de respaldo inválido.');
    }

    const filePath = path.join(BACKUPS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        throw new Error('El archivo de respaldo solicitado no existe en el almacenamiento.');
    }

    return filePath;
};

/**
 * Deletes a backup and its metadata.
 */
export const deleteBackup = (filename: string): void => {
    const filePath = getBackupFilePath(filename);
    const metaPath = filePath.replace('.sql.gz', '.json');

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
    }

    console.log(`[BACKUP] Deleted backup file ${filename}`);
};

/**
 * Retains the latest N scheduled backups and removes older scheduled ones.
 * Keeps all manual backups to prevent accidental loss.
 */
export const rotateOldBackups = async (keepScheduled: number = 7): Promise<void> => {
    const backups = listBackups();
    const scheduledBackups = backups.filter(b => b.type === 'scheduled');

    if (scheduledBackups.length > keepScheduled) {
        const toDelete = scheduledBackups.slice(keepScheduled);
        for (const old of toDelete) {
            try {
                deleteBackup(old.filename);
                console.log(`[BACKUP ROTATION] Pruned old backup: ${old.filename}`);
            } catch (err) {
                console.warn(`[BACKUP ROTATION] Failed to prune ${old.filename}:`, err);
            }
        }
    }
};

/**
 * Scheduled background daemon: checks every hour if a backup was made in the last 24h.
 */
let schedulerInterval: NodeJS.Timeout | null = null;

export const initBackupScheduler = (): void => {
    ensureBackupsDir();

    if (schedulerInterval) return;

    console.log('[BACKUP SCHEDULER] Automated database backup scheduler initialized (24h retention check).');

    // Run check hourly
    schedulerInterval = setInterval(async () => {
        try {
            const backups = listBackups();
            const lastBackup = backups[0];

            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;

            const isDue = !lastBackup || (now - new Date(lastBackup.created_at).getTime()) > oneDayMs;

            if (isDue) {
                console.log('[BACKUP SCHEDULER] Daily backup is due. Starting automated backup...');
                await createBackup('system-scheduler', 'scheduled');
            }
        } catch (err) {
            console.error('[BACKUP SCHEDULER] Error during scheduled backup check:', err);
        }
    }, 60 * 60 * 1000); // 1 hour
};
