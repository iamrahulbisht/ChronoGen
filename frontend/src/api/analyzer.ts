import api from './client';

export interface ChangeRequest {
    class_id: string;
    subject_id?: string;
    day: number;
    period: number;
    new_day: number;
    new_period: number;
    new_room_id?: string;
    new_teacher_id?: string;
}

export interface RippleEffectNode {
    type: string;
    id: string;
    day: number;
    period: number;
    clashed_with_class?: string;
}

export interface Suggestion {
    day: number;
    period: number;
    type: string;
    swap_with_class_id: string | null;
    penalty: number;
    penalty_delta: number;
    reasons?: string[];
    modified_chromosome: any[];
}

export interface AnalyzeChangeResponse {
    penalty_before: number;
    penalty_after: number;
    penalty_delta: number;
    penalty_details?: any;
    penalty_details_before?: any;
    ripple_effect: {
        direct_conflicts: RippleEffectNode[];
        indirect_impacts: RippleEffectNode[];
    };
    suggestions: Suggestion[];
    modified_chromosome: any[];
    hill_climbed_chromosome: any[] | null;
    hill_climb_improved: boolean;
}

export interface ConstraintDetail {
    constraint: string;
    before: number;
    after: number;
    delta: number;
    is_hard: boolean;
    status: 'worsened' | 'improved';
}

export interface SubstituteTeacher {
    teacher_id: string;
    teacher_name: string;
    penalty_delta: number;
    conflicts: string[];
    constraint_details?: ConstraintDetail[];
    is_qualified: boolean;
    is_free: boolean;
    modified_chromosome: any[];
}

export interface SubstituteResponse {
    substitutes: SubstituteTeacher[];
}

export async function analyzeChange(jobId: string, changes: ChangeRequest[]): Promise<AnalyzeChangeResponse> {
    const res = await api.post(`/api/v1/analyzer/analyze-change`, { job_id: jobId, changes });
    return res.data;
}

export async function getSubstitutes(jobId: string, classId: string, day: number, period: number): Promise<SubstituteResponse> {
    const res = await api.get(`/api/v1/analyzer/substitutes`, { 
        params: { job_id: jobId, class_id: classId, day, period } 
    });
    return res.data;
}


export async function commitChange(jobId: string, newChromosome: any[]) {
    const res = await api.post(`/api/v1/analyzer/commit-change`, { job_id: jobId, new_chromosome: newChromosome });
    return res.data;
}

export async function undoChange(jobId: string) {
    const res = await api.post(`/api/v1/analyzer/undo`, { job_id: jobId });
    return res.data;
}

export async function redoChange(jobId: string) {
    const res = await api.post(`/api/v1/analyzer/redo`, { job_id: jobId });
    return res.data;
}
