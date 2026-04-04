import { Request, Response } from 'express';
import { adminClient } from '../config/insforge';

// Get all incidents (filtered by branch)
export const getIncidents = async (req: Request, res: Response) => {
    const branchId = req.currentUser?.branch_id;
    const { student_id, incident_type, resolved } = req.query;

    try {
        let query = adminClient.database
            .from('discipline_incidents')
            .select(`
                *,
                students ( id, full_name, personal_code ),
                courses ( id, name ),
                reporter:profiles!reported_by ( full_name ),
                resolver:profiles!resolved_by ( full_name )
            `)
            .order('incident_date', { ascending: false });

        if (branchId) {
            query = query.eq('branch_id', branchId);
        }

        if (student_id) {
            query = query.eq('student_id', student_id);
        }

        if (incident_type) {
            query = query.eq('incident_type', incident_type);
        }

        if (resolved !== undefined && resolved !== '') {
            query = query.eq('resolved', resolved === 'true');
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json(data || []);
    } catch (error: any) {
        console.error('Error fetching discipline incidents:', error);
        res.status(500).json({ message: 'Error retrieving incidents', error: error?.message });
    }
};

// Create a new incident
export const createIncident = async (req: Request, res: Response) => {
    const userId = req.currentUser?.id;
    const branchId = req.currentUser?.branch_id;
    const {
        student_id,
        course_id,
        incident_type,
        severity,
        title,
        description,
        action_taken,
        incident_date,
        parent_notified
    } = req.body;

    if (!student_id || !title) {
        return res.status(400).json({ message: 'student_id y title son requeridos' });
    }

    try {
        const { data, error } = await adminClient.database
            .from('discipline_incidents')
            .insert([{
                student_id,
                course_id: course_id || null,
                branch_id: branchId || null,
                incident_type: incident_type || 'warning',
                severity: severity || 'low',
                title,
                description: description || null,
                action_taken: action_taken || null,
                incident_date: incident_date || new Date().toISOString().split('T')[0],
                reported_by: userId,
                parent_notified: parent_notified || false
            }])
            .select(`
                *,
                students ( id, full_name, personal_code ),
                courses ( id, name ),
                reporter:profiles!reported_by ( full_name )
            `)
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        console.error('Error creating discipline incident:', error);
        res.status(500).json({ message: 'Error creating incident', error: error?.message });
    }
};

// Update an incident
export const updateIncident = async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
        incident_type,
        severity,
        title,
        description,
        action_taken,
        incident_date,
        parent_notified,
        course_id
    } = req.body;

    try {
        const updateData: any = { updated_at: new Date().toISOString() };
        if (incident_type !== undefined) updateData.incident_type = incident_type;
        if (severity !== undefined) updateData.severity = severity;
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (action_taken !== undefined) updateData.action_taken = action_taken;
        if (incident_date !== undefined) updateData.incident_date = incident_date;
        if (parent_notified !== undefined) updateData.parent_notified = parent_notified;
        if (course_id !== undefined) updateData.course_id = course_id || null;

        const { data, error } = await adminClient.database
            .from('discipline_incidents')
            .update(updateData)
            .eq('id', id)
            .select(`
                *,
                students ( id, full_name, personal_code ),
                courses ( id, name ),
                reporter:profiles!reported_by ( full_name ),
                resolver:profiles!resolved_by ( full_name )
            `)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        console.error('Error updating discipline incident:', error);
        res.status(500).json({ message: 'Error updating incident', error: error?.message });
    }
};

// Resolve an incident
export const resolveIncident = async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.currentUser?.id;
    const { resolution_notes } = req.body;

    try {
        const { data, error } = await adminClient.database
            .from('discipline_incidents')
            .update({
                resolved: true,
                resolved_at: new Date().toISOString(),
                resolved_by: userId,
                resolution_notes: resolution_notes || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        console.error('Error resolving incident:', error);
        res.status(500).json({ message: 'Error resolving incident', error: error?.message });
    }
};

// Delete an incident
export const deleteIncident = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const { error } = await adminClient.database
            .from('discipline_incidents')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Incident deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting discipline incident:', error);
        res.status(500).json({ message: 'Error deleting incident', error: error?.message });
    }
};
