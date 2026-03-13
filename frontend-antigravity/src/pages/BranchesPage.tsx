import DashboardLayout from '../components/layout/DashboardLayout';
import BranchesList from '../features/branches/BranchesList';

const BranchesPage = () => {
    return (
        <div className="flex h-screen bg-slate-50 dark:bg-brand-dark overflow-hidden font-sans transition-colors duration-300">
            <DashboardLayout />
            <div className="flex-1 overflow-auto p-4 z-10 w-full">
                <BranchesList />
            </div>
        </div>
    );
};

export default BranchesPage;
