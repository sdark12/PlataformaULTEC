import { Request, Response } from 'express';
import client from '../config/insforge';

export const getBranches = async (req: Request, res: Response) => {
    const db = req.dbUserClient || client;

    try {
        const { data, error } = await db.database
            .from('branches')
            .select('*')
            .order('name');

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error('CRITICAL ERROR in getBranches:', error);
        res.status(500).json({
            message: 'Error retrieving branches',
            error: error?.message || 'Unknown error'
        });
    }
};

export const createBranch = async (req: Request, res: Response) => {
    const { name, address, phone, email } = req.body;
    const db = req.dbUserClient || client;

    try {
        const { data, error } = await db.database
            .from('branches')
            .insert([{ name, address, phone, email }])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error: any) {
        console.error("Error creating branch:", error);

        let errorMessage = 'Error creating branch';
        if (error.message && error.message.includes('Could not find the \'email\' column')) {
            errorMessage = 'Falta la columna "email" en la base de datos. Por favor, ejecute: ALTER TABLE branches ADD COLUMN email VARCHAR(150);';
        }

        res.status(500).json({ message: errorMessage, error: error.message });
    }
};

export const updateBranch = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, address, phone, email } = req.body;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { data, error } = await db
            .from('branches')
            .update({ name, address, phone, email })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json(data);
    } catch (error: any) {
        console.error("Error updating branch:", error);
        
        let errorMessage = 'Error updating branch';
        if (error.message && error.message.includes('Could not find the \'email\' column')) {
            errorMessage = 'Falta la columna "email" en la base de datos. Por favor, ejecute: ALTER TABLE branches ADD COLUMN email VARCHAR(150);';
        }
        res.status(500).json({ message: errorMessage, error: error.message });
    }
};

export const deleteBranch = async (req: Request, res: Response) => {
    const { id } = req.params;
    const db = req.dbUserClient ? req.dbUserClient.database : client.database;

    try {
        const { error } = await db
            .from('branches')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Branch deleted successfully' });
    } catch (error: any) {
        console.error("Error deleting branch:", error);
        res.status(500).json({ message: 'Error deleting branch', error: error.message });
    }
};
