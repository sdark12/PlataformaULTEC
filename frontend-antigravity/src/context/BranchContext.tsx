import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBranches, type Branch } from '../features/branches/branchesService';
import { getCurrentUser } from '../features/auth/authService';

interface BranchContextType {
    branches: Branch[];
    selectedBranchId: string;
    selectedBranch: Branch | null;
    selectedBranchName: string;
    isAllBranches: boolean;
    canSwitchBranch: boolean;
    isLoadingBranches: boolean;
    setSelectedBranchId: (branchId: string) => void;
    refreshBranches: () => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const queryClient = useQueryClient();
    const currentUser = getCurrentUser();
    const isSuperAdmin = currentUser?.role === 'superadmin';
    const userBranchId = currentUser?.branch_id || null;

    // Fetch branches list
    const { 
        data: branches = [], 
        isLoading: isLoadingBranches, 
        refetch: refreshBranches 
    } = useQuery({
        queryKey: ['branches-global-list'],
        queryFn: getBranches,
        staleTime: 5 * 60 * 1000, // 5 min cache
    });

    // Initial branch determination
    const [selectedBranchId, setSelectedBranchIdState] = useState<string>(() => {
        if (isSuperAdmin) {
            return localStorage.getItem('selected_branch_id') || 'all';
        }
        return userBranchId || 'all';
    });

    // Synchronize if user changes role or branch
    useEffect(() => {
        if (!isSuperAdmin) {
            const forcedBranch = userBranchId || 'all';
            setSelectedBranchIdState(forcedBranch);
            localStorage.setItem('selected_branch_id', forcedBranch);
        }
    }, [isSuperAdmin, userBranchId]);

    const setSelectedBranchId = useCallback((newId: string) => {
        if (!isSuperAdmin) {
            console.warn('[BranchContext] Switch denied: Only SuperAdmin can switch branches.');
            return;
        }

        const validId = newId || 'all';
        setSelectedBranchIdState(validId);
        localStorage.setItem('selected_branch_id', validId);

        // Invalidate queries so that all dashboard & table modules immediately re-fetch with new X-Branch-Id
        queryClient.invalidateQueries({ queryKey: ['students'] });
        queryClient.invalidateQueries({ queryKey: ['students-list'] });
        queryClient.invalidateQueries({ queryKey: ['courses'] });
        queryClient.invalidateQueries({ queryKey: ['enrollments'] });
        queryClient.invalidateQueries({ queryKey: ['payments'] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
        queryClient.invalidateQueries({ queryKey: ['reports'] });
        queryClient.invalidateQueries({ queryKey: ['grades'] });
        queryClient.invalidateQueries({ queryKey: ['attendance'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['branches'] });
    }, [isSuperAdmin, queryClient]);

    const selectedBranch = useMemo(() => {
        if (selectedBranchId === 'all') return null;
        return branches.find(b => b.id === selectedBranchId) || null;
    }, [branches, selectedBranchId]);

    const selectedBranchName = useMemo(() => {
        if (selectedBranchId === 'all') {
            return isSuperAdmin ? 'Todas las Sedes' : 'Sede Central';
        }
        return selectedBranch?.name || 'Sede';
    }, [selectedBranchId, isSuperAdmin, selectedBranch]);

    const isAllBranches = selectedBranchId === 'all';
    const canSwitchBranch = isSuperAdmin;

    const value = useMemo(() => ({
        branches,
        selectedBranchId,
        selectedBranch,
        selectedBranchName,
        isAllBranches,
        canSwitchBranch,
        isLoadingBranches,
        setSelectedBranchId,
        refreshBranches
    }), [
        branches,
        selectedBranchId,
        selectedBranch,
        selectedBranchName,
        isAllBranches,
        canSwitchBranch,
        isLoadingBranches,
        setSelectedBranchId,
        refreshBranches
    ]);

    return (
        <BranchContext.Provider value={value}>
            {children}
        </BranchContext.Provider>
    );
};

export const useBranch = (): BranchContextType => {
    const context = useContext(BranchContext);
    if (!context) {
        throw new Error('useBranch must be used within a BranchProvider');
    }
    return context;
};
