import { Request, Response } from 'express';
import client, { adminClient } from '../config/insforge';

export const getSubgradeCategories = async (req: Request, res: Response) => {
    const { course_id, unit_name } = req.query;

    if (!course_id || !unit_name) {
        return res.status(400).json({ message: 'course_id and unit_name are required' });
    }

    try {
        const db = (req as any).dbUserClient || adminClient || client;
        const { data: categories, error } = await db
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
        const db = (req as any).dbUserClient || adminClient || client;
        const results: any[] = [];

        for (const c of categories) {
            if (c.id) {
                // UPDATE existing category
                const { data, error } = await db
                    .from('subgrade_categories')
                    .update({
                        name: c.name,
                        max_score: Number(c.max_score) || 100
                    })
                    .eq('id', c.id)
                    .select()
                    .single();

                if (error) throw error;
                results.push(data);
            } else {
                // INSERT new category
                const { data, error } = await db
                    .from('subgrade_categories')
                    .insert({
                        course_id,
                        unit_name,
                        name: c.name,
                        max_score: Number(c.max_score) || 100,
                        created_by: userId
                    })
                    .select()
                    .single();

                if (error) throw error;
                results.push(data);
            }
        }

        res.json({ message: 'Categories saved successfully', categories: results });
    } catch (error) {
        console.error('Error saving subgrade categories:', error);
        res.status(500).json({ message: 'Error saving subgrade categories' });
    }
};

export const deleteSubgradeCategory = async (req: Request, res: Response) => {
    const { category_id } = req.params;

    try {
        const db = (req as any).dbUserClient || adminClient || client;
        const { error } = await db
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

export const copySubgradeCategories = async (req: Request, res: Response) => {
    const { course_id, source_unit_name, target_unit_name, replace_existing = true } = req.body;
    const userId = req.currentUser?.id;

    if (!course_id || !source_unit_name || !target_unit_name) {
        return res.status(400).json({ message: 'course_id, source_unit_name y target_unit_name son requeridos' });
    }

    if (source_unit_name === target_unit_name) {
        return res.status(400).json({ message: 'La unidad de origen y de destino no pueden ser iguales' });
    }

    try {
        const db = (req as any).dbUserClient || adminClient || client;

        // 1. Obtener las categorías de la unidad origen
        const { data: sourceCats, error: srcError } = await db
            .from('subgrade_categories')
            .select('name, max_score')
            .eq('course_id', course_id)
            .eq('unit_name', source_unit_name)
            .order('created_at', { ascending: true });

        if (srcError) throw srcError;

        if (!sourceCats || sourceCats.length === 0) {
            return res.status(400).json({ 
                message: `No hay categorías configuradas en "${source_unit_name}" para copiar.` 
            });
        }

        // 2. Si replace_existing es true, eliminar las categorías existentes de la unidad destino
        if (replace_existing) {
            const { error: delError } = await db
                .from('subgrade_categories')
                .delete()
                .eq('course_id', course_id)
                .eq('unit_name', target_unit_name);

            if (delError) throw delError;
        }

        // 3. Insertar las nuevas categorías copiadas en la unidad destino
        const toInsert = sourceCats.map((c: any) => ({
            course_id,
            unit_name: target_unit_name,
            name: c.name,
            max_score: Number(c.max_score) || 100,
            created_by: userId
        }));

        const { data: inserted, error: insError } = await db
            .from('subgrade_categories')
            .insert(toInsert)
            .select();

        if (insError) throw insError;

        res.json({
            message: `¡Se copiaron ${inserted?.length || toInsert.length} categorías exitosamente desde "${source_unit_name}" a "${target_unit_name}"!`,
            categories: inserted
        });
    } catch (error) {
        console.error('Error copying subgrade categories:', error);
        res.status(500).json({ message: 'Error al copiar las categorías de evaluación' });
    }
};

export const getSubgrades = async (req: Request, res: Response) => {
    const { course_id, unit_name } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id || !unit_name) {
        return res.status(400).json({ message: 'course_id and unit_name are required' });
    }

    try {
        const db = (req as any).dbUserClient || adminClient || client;

        // 1. Fetch Categories
        const { data: categories, error: catError } = await db
            .from('subgrade_categories')
            .select('id, name, max_score')
            .eq('course_id', course_id)
            .eq('unit_name', unit_name);

        if (catError) throw catError;

        // 2. Fetch Enrolled Students
        let enrollmentsQuery = db
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
            .eq('is_active', true);
            
        if (branchId) {
            enrollmentsQuery = enrollmentsQuery.eq('students.branch_id', branchId);
        }

        const { data: enrollments, error: enrollError } = await enrollmentsQuery;

        if (enrollError) throw enrollError;

        // 3. Fetch Subgrades for these categories
        let subgradesData: any[] = [];
        if (categories && categories.length > 0) {
            const categoryIds = categories.map((c: any) => c.id);
            const { data: sgData, error: sgError } = await db
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
    const { course_id, unit_name, subgrades } = req.body;
    const userId = req.currentUser?.id;

    if (!Array.isArray(subgrades)) {
        return res.status(400).json({ message: 'subgrades array is required' });
    }

    try {
        const db = (req as any).dbUserClient || adminClient || client;
        const payload = subgrades.map(sg => ({
            category_id: sg.category_id,
            student_id: sg.student_id,
            score: Number(sg.score) || 0,
            remarks: sg.remarks,
            created_by: userId
        }));

        const { error } = await db
            .from('subgrades')
            .upsert(payload, { onConflict: 'category_id, student_id' });

        if (error) throw error;

        // Auto-sincronizar calificación bimestral en la tabla 'grades'
        let targetCourseId = course_id;
        let targetUnitName = unit_name;

        if (!targetCourseId || !targetUnitName) {
            const firstCatId = subgrades[0]?.category_id;
            if (firstCatId) {
                const { data: cat } = await db
                    .from('subgrade_categories')
                    .select('course_id, unit_name')
                    .eq('id', firstCatId)
                    .single();
                if (cat) {
                    targetCourseId = cat.course_id;
                    targetUnitName = cat.unit_name;
                }
            }
        }

        if (targetCourseId && targetUnitName) {
            // Consultar todas las categorías asociadas a este curso y unidad
            const { data: allCategories } = await db
                .from('subgrade_categories')
                .select('id, name, max_score')
                .eq('course_id', targetCourseId)
                .eq('unit_name', targetUnitName);

            if (allCategories && allCategories.length > 0) {
                const catIds = allCategories.map((c: any) => c.id);
                const uniqueStudentIds = Array.from(new Set(subgrades.map((s: any) => s.student_id)));

                // Consultar todas las subcalificaciones de estos alumnos en todas las categorías de esta unidad
                const { data: allStudentSubgrades } = await db
                    .from('subgrades')
                    .select('student_id, score')
                    .in('category_id', catIds)
                    .in('student_id', uniqueStudentIds);

                // Sumar punteos por cada estudiante
                const studentSums = new Map<string, number>();
                uniqueStudentIds.forEach((sId: any) => studentSums.set(sId, 0));

                allStudentSubgrades?.forEach((sg: any) => {
                    const current = studentSums.get(sg.student_id) || 0;
                    studentSums.set(sg.student_id, current + (Number(sg.score) || 0));
                });

                // Upsert a la tabla 'grades'
                const gradesPayload = Array.from(studentSums.entries()).map(([student_id, sumScore]) => ({
                    course_id: targetCourseId,
                    unit_name: targetUnitName,
                    student_id,
                    score: Math.min(100, Math.max(0, Math.round(sumScore))),
                    remarks: `Sincronizado de ${allCategories.length} subcalificaciones`,
                    created_by: userId
                }));

                if (gradesPayload.length > 0) {
                    await db
                        .from('grades')
                        .upsert(gradesPayload, { onConflict: 'student_id, course_id, unit_name' });
                }
            }
        }

        res.json({ message: 'Subgrades saved successfully and bimestral grade synchronized' });
    } catch (error) {
        console.error('Error saving subgrades:', error);
        res.status(500).json({ message: 'Error saving subgrades' });
    }
};
