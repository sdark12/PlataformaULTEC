import { useState } from 'react';
import { getCurrentUser } from '../../features/auth/authService';
import { FileBadge, FileText } from 'lucide-react';
import ReportCard from './ReportCard';
import Certificates from './Certificates';

const DocumentCenter = () => {
    const user = getCurrentUser();
    const role = user?.role;
    const canSeeCertificates = ['admin', 'superadmin', 'secretary'].includes(role || '');
    const [activeTab, setActiveTab] = useState<'boletas' | 'constancias'>('boletas');

    // If student, they only see Boletas
    if (!canSeeCertificates) {
        return <ReportCard />;
    }

    return (
        <div className="max-w-7xl mx-auto pb-12 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 mb-8 px-4 sm:px-0 print:hidden">
                <div className="p-3 bg-brand-blue/10 rounded-2xl">
                    <FileBadge className="h-7 w-7 text-brand-blue" />
                </div>
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Centro de Documentos</h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5">Gestión de boletas de calificaciones y constancias oficiales.</p>
                </div>
            </div>

            <div className="flex space-x-2 border-b border-slate-200 dark:border-white/10 mb-8 px-4 sm:px-0 print:hidden">
                <button
                    onClick={() => setActiveTab('boletas')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${
                        activeTab === 'boletas'
                            ? 'border-brand-blue text-brand-blue'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Boletas de Calificaciones
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('constancias')}
                    className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors ${
                        activeTab === 'constancias'
                            ? 'border-brand-blue text-brand-blue'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <FileBadge className="w-4 h-4" />
                        Emisión de Constancias
                    </div>
                </button>
            </div>

            <div className={activeTab === 'boletas' ? 'block' : 'hidden'}>
                <ReportCard isEmbedded={true} />
            </div>
            
            <div className={activeTab === 'constancias' ? 'block' : 'hidden'}>
                <Certificates isEmbedded={true} />
            </div>
        </div>
    );
};

export default DocumentCenter;
