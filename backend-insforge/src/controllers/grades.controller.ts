import { Request, Response } from 'express';
import client from '../config/insforge';

export const getGrades = async (req: Request, res: Response) => {
    const { course_id, unit_name } = req.query;
    const branchId = req.currentUser?.branch_id;

    if (!course_id || !unit_name) {
        return res.status(400).json({ message: 'course_id and unit_name are required' });
    }

    try {
        // 1. Fetch all active enrolled students
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

        // 2. Fetch existing grades
        const { data: gradesData, error: gradesError } = await client.database
            .from('grades')
            .select('student_id, score, remarks')
            .eq('course_id', course_id)
            .eq('unit_name', unit_name);

        if (gradesError) throw gradesError;

        // Map for quick lookup
        const gradesMap = new Map();
        if (gradesData) {
            gradesData.forEach((record: any) => {
                gradesMap.set(record.student_id, record);
            });
        }

        // 3. Merge data
        const mergedData = enrollments?.map((enrollment: any) => {
            const studentId = enrollment.student_id;
            const existingRecord = gradesMap.get(studentId);

            return {
                student_id: studentId,
                student_name: enrollment.students.full_name,
                unit_name: unit_name,
                score: existingRecord ? existingRecord.score : '',
                remarks: existingRecord ? existingRecord.remarks : ''
            };
        }) || [];

        // Sort alphabetically
        mergedData.sort((a: any, b: any) => a.student_name.localeCompare(b.student_name));

        res.json(mergedData);
    } catch (error) {
        console.error('Error retrieving grades:', error);
        res.status(500).json({ message: 'Error retrieving grades' });
    }
};

export const saveGrades = async (req: Request, res: Response) => {
    const { course_id, unit_name, students } = req.body;
    const userId = req.currentUser?.id;

    if (!course_id || !unit_name || !students) {
        return res.status(400).json({ message: 'Missing required fields' });
    }

    try {
        const upsertData = students.map((s: any) => ({
            course_id,
            student_id: s.student_id,
            unit_name,
            score: Number(s.score) || 0,
            remarks: s.remarks,
            created_by: userId
        }));

        const { error } = await client.database
            .from('grades')
            .upsert(upsertData, { onConflict: 'course_id, student_id, unit_name' });

        if (error) throw error;

        res.json({ message: 'Grades saved successfully' });
    } catch (error) {
        console.error('Error saving grades:', error);
        res.status(500).json({ message: 'Error saving grades' });
    }
};

export const getStudentReportCard = async (req: Request, res: Response) => {
    const { student_id } = req.params;

    try {
        // Get Student info
        const { data: student, error: studentError } = await client.database
            .from('students')
            .select('full_name, id')
            .eq('id', student_id)
            .single();

        if (studentError) throw studentError;

        // Get all grades across courses
        const { data: gradesData, error: gradesError } = await client.database
            .from('grades')
            .select(`
                 score,
                 unit_name,
                 remarks,
                 courses (id, name)
             `)
            .eq('student_id', student_id);

        if (gradesError) throw gradesError;

        // Group grades by course
        const coursesMap = new Map();

        gradesData?.forEach((g: any) => {
            const courseId = g.courses.id;
            const courseName = g.courses.name;

            if (!coursesMap.has(courseId)) {
                coursesMap.set(courseId, {
                    course_name: courseName,
                    units: [],
                    average: 0
                });
            }

            coursesMap.get(courseId).units.push({
                unit_name: g.unit_name,
                score: g.score,
                remarks: g.remarks
            });
        });

        // Calculate averages
        const reportCard: any[] = [];
        let totalScoreSum = 0;
        let totalUnits = 0;

        coursesMap.forEach((course) => {
            const sum = course.units.reduce((acc: number, curr: any) => acc + curr.score, 0);
            course.average = course.units.length > 0 ? (sum / course.units.length).toFixed(2) : 0;

            totalScoreSum += sum;
            totalUnits += course.units.length;

            reportCard.push(course);
        });

        const generalAverage = totalUnits > 0 ? (totalScoreSum / totalUnits).toFixed(2) : 0;

        res.json({
            student: student,
            general_average: generalAverage,
            courses: reportCard
        });

    } catch (error) {
        console.error('Error retrieving report card:', error);
        res.status(500).json({ message: 'Error retrieving report card' });
    }
};

export const getCourseGradebook = async (req: Request, res: Response) => {
    const { course_id } = req.params;
    const branchId = req.currentUser?.branch_id;

    try {
        // 1. Fetch course details
        const { data: course, error: courseError } = await client.database
            .from('courses')
            .select('name')
            .eq('id', course_id)
            .single();

        if (courseError) throw courseError;

        // 2. Fetch all enrolled students
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

        // 3. Fetch all grades for this course
        const { data: gradesData, error: gradesError } = await client.database
            .from('grades')
            .select('student_id, unit_name, score, remarks')
            .eq('course_id', course_id);

        if (gradesError) throw gradesError;

        // 4. Organize grades by student
        const studentGradesMap = new Map();

        // Initialize map with enrolled students
        enrollments?.forEach((e: any) => {
            studentGradesMap.set(e.student_id, {
                student_id: e.student_id,
                student_name: e.students.full_name,
                units: {},
                average: 0
            });
        });

        // Populate grades
        const allUnitsSet = new Set<string>(); // Keep track of all units ever graded in this course

        gradesData?.forEach((g: any) => {
            if (studentGradesMap.has(g.student_id)) {
                const studentRecord = studentGradesMap.get(g.student_id);
                studentRecord.units[g.unit_name] = {
                    score: g.score,
                    remarks: g.remarks
                };
                allUnitsSet.add(g.unit_name);
            }
        });

        const allUnits = Array.from(allUnitsSet).sort();

        // Calculate averages for each student
        const gradebook: any[] = [];

        studentGradesMap.forEach((student) => {
            let sum = 0;
            let count = 0;

            Object.keys(student.units).forEach(unitName => {
                sum += student.units[unitName].score;
                count++;
            });

            student.average = count > 0 ? (sum / count).toFixed(2) : 0;
            gradebook.push(student);
        });

        // Sort alphabetically
        gradebook.sort((a, b) => a.student_name.localeCompare(b.student_name));

        res.json({
            course_name: course.name,
            units: allUnits,
            students: gradebook
        });

    } catch (error) {
        console.error('Error retrieving course gradebook:', error);
        res.status(500).json({ message: 'Error retrieving course gradebook' });
    }
};
