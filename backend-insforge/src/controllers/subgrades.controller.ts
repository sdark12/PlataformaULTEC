import { Request, Response } from 'express';
import client from '../config/insforge';

export const getSubgradeCategories = async (req: Request, res: Response) => {
    const { course_id, unit_name } = req.query;

    if (!course_id || !unit_name) {
        return res.status(400).json({ message: 'course_id and unit_name are required' });
    }

    try {
        const { data: categories, error } = await client.database
            .from('subgrade_categories')
            .select('*')
            .eq('course_id', course_id)
            .eq('unit_name', unit_name)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(categories);
    } catch (error) {
        console.error('Error retrieving subgrade categories:', error);
        res.status(500).json({ message: 'Error retrieving subgrade categories' });
    }
};

export const saveSubgradeCategories = async (req: Request, res: Response) => {
    const { course_id, unit_name, categories } = req.body;
    const userId = req.currentUser?.id;

    if (!course_id || !unit_name || !Array.isArray(categories)) {
        return res.status(400).json({ message: 'Invalid payload' });
    }

    try {
        // Upsert categories
        const upsertData = categories.map((c: any) => ({
            ...(c.id ? { id: c.id } : {}),
            course_id,
            unit_name,
            name: c.name,
            max_score: Number(c.max_score) || 100,
            created_by: userId
        }));

        const { data, error } = await client.database
            .from('subgrade_categories')
            .upsert(upsertData, { onConflict: 'id' })
            .select();

        if (error) throw error;

        res.json({ message: 'Categories saved successfully', categories: data });
    } catch (error) {
        console.error('Error saving subgrade categories:', error);
        res.status(500).json({ message: 'Error saving subgrade categories' });
    }
};

export const deleteSubgradeCategory = async (req: Request, res: Response) => {
    const { category_id } = req.params;

    try {
        const { error } = await client.database
            .from('subgrade_categories')
            .delete()
            .eq('id', category_id);

        if (error) throw error;
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Error deleting subgrade category:', error);
        res.status(500).json({ message: 'Error deleting subgrade category' });
    }
};

export const getSubgrades = async (req: Request, res: Response) => {
    const { course_id, unit_name } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id || !unit_name) {
        return res.status(400).json({ message: 'course_id and unit_name are required' });
    }

    try {
        // 1. Fetch Categories
        const { data: categories, error: catError } = await client.database
            .from('subgrade_categories')
            .select('id, name, max_score')
            .eq('course_id', course_id)
            .eq('unit_name', unit_name);

        if (catError) throw catError;

        // 2. Fetch Enrolled Students
        const { data: enrollments, error: enrollError } = await client.database
            .from('enrollments')
            .select(`
                student_id,
                students!inner (
                    id,
                    full_name,
                    branch_id
                )
            `)
            .eq('course_id', course_id)
            .eq('is_active', true)
            .eq('students.branch_id', branchId);

        if (enrollError) throw enrollError;

        // 3. Fetch Subgrades for these categories
        let subgradesData: any[] = [];
        if (categories && categories.length > 0) {
            const categoryIds = categories.map((c: any) => c.id);
            const { data: sgData, error: sgError } = await client.database
                .from('subgrades')
                .select('category_id, student_id, score, remarks')
                .in('category_id', categoryIds);

            if (sgError) throw sgError;
            subgradesData = sgData || [];
        }

        // 4. Merge into tabular format
        const responseData = enrollments?.map((enrollment: any) => {
            const studentId = enrollment.student_id;
            const studentName = enrollment.students.full_name;
            const scores: any = {};

            // Initialize empty scores for all categories
            categories?.forEach((cat: any) => {
                scores[cat.id] = { score: '', remarks: '' };
            });

            // Fill actual scores
            subgradesData.forEach((sg: any) => {
                if (sg.student_id === studentId && scores[sg.category_id]) {
                    scores[sg.category_id] = { score: sg.score, remarks: sg.remarks };
                }
            });

            return {
                student_id: studentId,
                student_name: studentName,
                scores
            };
        }) || [];

        responseData.sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));

        res.json({ categories, students: responseData });
    } catch (error) {
        console.error('Error retrieving subgrades:', error);
        res.status(500).json({ message: 'Error retrieving subgrades' });
    }
};

export const saveSubgrades = async (req: Request, res: Response) => {
    // Array of { category_id, student_id, score, remarks }
    const { subgrades } = req.body;
    const userId = req.currentUser?.id;

    if (!Array.isArray(subgrades)) {
        return res.status(400).json({ message: 'subgrades array is required' });
    }

    try {
        const payload = subgrades.map(sg => ({
            category_id: sg.category_id,
            student_id: sg.student_id,
            score: Number(sg.score) || 0,
            remarks: sg.remarks,
            created_by: userId
        }));

        const { error } = await client.database
            .from('subgrades')
            .upsert(payload, { onConflict: 'category_id, student_id' });

        if (error) throw error;

        res.json({ message: 'Subgrades saved successfully' });
    } catch (error) {
        console.error('Error saving subgrades:', error);
        res.status(500).json({ message: 'Error saving subgrades' });
    }
};
