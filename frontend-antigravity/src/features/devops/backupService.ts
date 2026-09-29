import apiClient from '../../services/apiClient';

export interface BackupItem {
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
    last_backup: BackupItem | null;
    retention_days: number;
    scheduler_enabled: boolean;
    schemas: string[];
}

export const getBackups = async (): Promise<BackupItem[]> => {
    const response = await apiClient.get<BackupItem[]>('/api/devops/backups');
    return response.data;
};

export const getBackupStats = async (): Promise<BackupStats> => {
    const response = await apiClient.get<BackupStats>('/api/devops/backups/stats');
    return response.data;
};

export const createDatabaseBackup = async (): Promise<{ message: string; backup: BackupItem }> => {
    const response = await apiClient.post<{ message: string; backup: BackupItem }>('/api/devops/backups/create');
    return response.data;
};

export const deleteDatabaseBackup = async (filename: string): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`/api/devops/backups/${encodeURIComponent(filename)}`);
    return response.data;
};

export const downloadDatabaseBackup = async (filename: string): Promise<void> => {
    const response = await apiClient.get(`/api/devops/backups/${encodeURIComponent(filename)}/download`, {
        responseType: 'blob'
    });

    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/gzip' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};
