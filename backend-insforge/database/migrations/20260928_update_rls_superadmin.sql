-- Update RLS policies to allow superadmin full administrative access across branches and tables

ALTER POLICY "Admins can read all profiles" ON profiles USING (get_user_role() IN ('admin', 'superadmin'));
ALTER POLICY "Admins can update profiles" ON profiles USING (get_user_role() IN ('admin', 'superadmin'));
ALTER POLICY "Enable all access for admins" ON branches USING (get_user_role() IN ('admin', 'superadmin'));
ALTER POLICY "Manage courses in same branch" ON courses USING ((branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin')));
ALTER POLICY "View courses in same branch" ON courses USING ((branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin')));
ALTER POLICY "Manage enrollments" ON enrollments USING ((branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin')));
ALTER POLICY "View enrollments in domestic branch" ON enrollments USING ((branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin')));
ALTER POLICY "Manage students in same branch" ON students USING ((branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin')));
ALTER POLICY "View students in same branch" ON students USING ((branch_id = get_user_branch_id()) OR (get_user_role() IN ('admin', 'superadmin')));
