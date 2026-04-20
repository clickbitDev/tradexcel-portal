'use client';

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { WorkflowStage } from '@/types/database';

type PersonSummary = {
    id: string;
    full_name: string | null;
    role?: string | null;
};

export interface AssignableStaffUser {
    id: string;
    full_name: string | null;
    role: string;
}

export interface CreateApplicationRequest {
    student_first_name: string;
    student_last_name: string;
    offering_id?: string | null;
    qualification_id?: string | null;
    partner_id?: string | null;
    student_email?: string | null;
    student_phone?: string | null;
    student_dob?: string | null;
    student_usi?: string | null;
    student_passport_number?: string | null;
    student_nationality?: string | null;
    student_visa_number?: string | null;
    student_visa_expiry?: string | null;
    student_gender?: string | null;
    student_country_of_birth?: string | null;
    application_from?: string | null;
    student_street_no?: string | null;
    student_suburb?: string | null;
    student_state?: string | null;
    student_postcode?: string | null;
    quoted_tuition?: number | null;
    quoted_materials?: number | null;
    notes?: string | null;
    appointment_date?: string | null;
    appointment_time?: string | null;
    received_at?: string;
}

export interface CreateApplicationResponse {
    data: {
        id: string;
        student_uid: string;
        application_number: string;
        workflow_stage: WorkflowStage;
        updated_at: string;
    };
    meta?: {
        agentPartnerProvisioned?: boolean;
    };
}

export interface TransitionApplicationRequest {
    applicationId: string;
    toStage: WorkflowStage;
    notes?: string;
    expectedUpdatedAt?: string;
    notifyUserIds?: string[];
    approvalId?: string;
}

export interface TransitionApplicationResponse {
    data: {
        id: string;
        fromStage: WorkflowStage;
        toStage: WorkflowStage;
        updatedAt: string;
        approvalId?: string | null;
    };
}

export interface WorkflowTransitionOption {
    transitionId: string;
    toStage: WorkflowStage;
    requiresApproval: boolean;
    requiredRole: string | null;
    allowedRoles?: string[] | null;
    canExecute: boolean;
    canRequestApproval: boolean;
    approvalStatus: 'pending' | 'approved' | null;
    approvalId: string | null;
    blockedReason?: string | null;
}

export interface GetTransitionOptionsResponse {
    data: {
        applicationId: string;
        currentStage: WorkflowStage;
        updatedAt: string;
        options: WorkflowTransitionOption[];
    };
}

export interface WorkflowTransitionApproval {
    id: string;
    application_id: string;
    from_stage: WorkflowStage;
    to_stage: WorkflowStage;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'executed';
    required_role: string | null;
    requested_by: string;
    requested_at: string;
    reviewed_by: string | null;
    reviewed_at: string | null;
    transition_notes: string | null;
    review_notes: string | null;
    executed_at: string | null;
    metadata: Record<string, unknown>;
    canReview?: boolean;
}

export interface WorkflowAssignment {
    id: string;
    application_id: string;
    stage: WorkflowStage;
    assignee_id: string;
    assigned_by: string | null;
    is_active: boolean;
    assigned_at: string;
    unassigned_at: string | null;
    metadata: Record<string, unknown>;
    assignee?: PersonSummary | null;
    assigned_by_profile?: PersonSummary | null;
}

export interface WorkflowAlert {
    id: string;
    application_id: string;
    alert_type: string;
    severity: 'low' | 'normal' | 'high' | 'urgent';
    title: string;
    message: string | null;
    status: 'open' | 'resolved';
    raised_by: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    raised_by_profile?: PersonSummary | null;
    resolved_by_profile?: PersonSummary | null;
}

export interface WorkflowTimelineEntry {
    id: string;
    type: 'transition' | 'assignment' | 'alert' | 'activity';
    title: string;
    description: string;
    createdAt: string;
    metadata: Record<string, unknown>;
}

export interface CreateWorkflowAssignmentRequest {
    applicationId: string;
    stage: WorkflowStage;
    assigneeId: string;
    notes?: string;
}

export interface UpdateWorkflowAssignmentRequest {
    applicationId: string;
    assignmentId: string;
    isActive: boolean;
}

export interface CreateWorkflowAlertRequest {
    applicationId: string;
    alertType: string;
    severity: 'low' | 'normal' | 'high' | 'urgent';
    title: string;
    message?: string;
}

export interface UpdateWorkflowAlertRequest {
    applicationId: string;
    alertId: string;
    status: 'open' | 'resolved';
}

export interface RequestTransitionApprovalRequest {
    applicationId: string;
    toStage: WorkflowStage;
    notes?: string;
}

export interface ReviewTransitionApprovalRequest {
    applicationId: string;
    approvalId: string;
    status: 'approved' | 'rejected' | 'cancelled';
    notes?: string;
}

export const workflowApi = createApi({
    reducerPath: 'workflowApi',
    baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
    tagTypes: ['ApplicationWorkflow', 'WorkflowAssignments', 'WorkflowAlerts', 'WorkflowTimeline', 'WorkflowApprovals'],
    endpoints: (builder) => ({
        getAssignableStaff: builder.query<{ data: AssignableStaffUser[] }, void>({
            query: () => ({
                url: '/staff/assignable',
            }),
        }),
        createApplication: builder.mutation<
            CreateApplicationResponse,
            CreateApplicationRequest
        >({
            query: (body) => ({
                url: '/applications',
                method: 'POST',
                body,
            }),
        }),
        transitionApplication: builder.mutation<
            TransitionApplicationResponse,
            TransitionApplicationRequest
        >({
            query: ({ applicationId, ...body }) => ({
                url: `/applications/${applicationId}/transition`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_result, _error, args) => [
                { type: 'ApplicationWorkflow', id: args.applicationId },
                { type: 'WorkflowTimeline', id: args.applicationId },
                { type: 'WorkflowApprovals', id: args.applicationId },
            ],
        }),
        getTransitionOptions: builder.query<
            GetTransitionOptionsResponse,
            { applicationId: string }
        >({
            query: ({ applicationId }) => ({
                url: `/applications/${applicationId}/transition`,
            }),
            providesTags: (_result, _error, args) => [
                { type: 'ApplicationWorkflow', id: args.applicationId },
                { type: 'WorkflowApprovals', id: args.applicationId },
            ],
        }),
        getTransitionApprovals: builder.query<
            { data: WorkflowTransitionApproval[] },
            { applicationId: string }
        >({
            query: ({ applicationId }) => ({
                url: `/applications/${applicationId}/transition-approvals`,
            }),
            providesTags: (_result, _error, args) => [
                { type: 'WorkflowApprovals', id: args.applicationId },
            ],
        }),
        requestTransitionApproval: builder.mutation<
            { data: WorkflowTransitionApproval },
            RequestTransitionApprovalRequest
        >({
            query: ({ applicationId, ...body }) => ({
                url: `/applications/${applicationId}/transition-approvals`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, args) => [
                { type: 'WorkflowApprovals', id: args.applicationId },
                { type: 'ApplicationWorkflow', id: args.applicationId },
                { type: 'WorkflowTimeline', id: args.applicationId },
            ],
        }),
        reviewTransitionApproval: builder.mutation<
            { data: WorkflowTransitionApproval; transition?: TransitionApplicationResponse['data'] },
            ReviewTransitionApprovalRequest
        >({
            query: ({ applicationId, approvalId, ...body }) => ({
                url: `/applications/${applicationId}/transition-approvals/${approvalId}`,
                method: 'PATCH',
                body,
            }),
            invalidatesTags: (_result, _error, args) => [
                { type: 'WorkflowApprovals', id: args.applicationId },
                { type: 'ApplicationWorkflow', id: args.applicationId },
                { type: 'WorkflowTimeline', id: args.applicationId },
            ],
        }),
        getWorkflowAssignments: builder.query<
            { data: WorkflowAssignment[] },
            { applicationId: string; includeInactive?: boolean }
        >({
            query: ({ applicationId, includeInactive }) => ({
                url: `/applications/${applicationId}/assignments`,
                params: includeInactive ? { includeInactive: 'true' } : undefined,
            }),
            providesTags: (_result, _error, args) => [
                { type: 'WorkflowAssignments', id: args.applicationId },
            ],
        }),
        createWorkflowAssignment: builder.mutation<
            { data: WorkflowAssignment },
            CreateWorkflowAssignmentRequest
        >({
            query: ({ applicationId, ...body }) => ({
                url: `/applications/${applicationId}/assignments`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, args) => [
                { type: 'WorkflowAssignments', id: args.applicationId },
                { type: 'WorkflowTimeline', id: args.applicationId },
            ],
        }),
        updateWorkflowAssignment: builder.mutation<
            { data: WorkflowAssignment },
            UpdateWorkflowAssignmentRequest
        >({
            query: ({ applicationId, assignmentId, isActive }) => ({
                url: `/applications/${applicationId}/assignments/${assignmentId}`,
                method: 'PATCH',
                body: { isActive },
            }),
            invalidatesTags: (_result, _error, args) => [
                { type: 'WorkflowAssignments', id: args.applicationId },
                { type: 'WorkflowTimeline', id: args.applicationId },
            ],
        }),
        getWorkflowAlerts: builder.query<
            { data: WorkflowAlert[] },
            { applicationId: string; status?: 'open' | 'resolved' }
        >({
            query: ({ applicationId, status }) => ({
                url: `/applications/${applicationId}/alerts`,
                params: status ? { status } : undefined,
            }),
            providesTags: (_result, _error, args) => [
                { type: 'WorkflowAlerts', id: args.applicationId },
            ],
        }),
        createWorkflowAlert: builder.mutation<
            { data: WorkflowAlert },
            CreateWorkflowAlertRequest
        >({
            query: ({ applicationId, ...body }) => ({
                url: `/applications/${applicationId}/alerts`,
                method: 'POST',
                body,
            }),
            invalidatesTags: (_result, _error, args) => [
                { type: 'WorkflowAlerts', id: args.applicationId },
                { type: 'WorkflowTimeline', id: args.applicationId },
            ],
        }),
        updateWorkflowAlert: builder.mutation<
            { data: WorkflowAlert },
            UpdateWorkflowAlertRequest
        >({
            query: ({ applicationId, alertId, status }) => ({
                url: `/applications/${applicationId}/alerts/${alertId}`,
                method: 'PATCH',
                body: { status },
            }),
            invalidatesTags: (_result, _error, args) => [
                { type: 'WorkflowAlerts', id: args.applicationId },
                { type: 'WorkflowTimeline', id: args.applicationId },
            ],
        }),
        getWorkflowTimeline: builder.query<
            { data: WorkflowTimelineEntry[] },
            { applicationId: string }
        >({
            query: ({ applicationId }) => ({
                url: `/applications/${applicationId}/timeline`,
            }),
            providesTags: (_result, _error, args) => [
                { type: 'WorkflowTimeline', id: args.applicationId },
            ],
        }),
    }),
});

export const {
    useGetAssignableStaffQuery,
    useCreateApplicationMutation,
    useTransitionApplicationMutation,
    useGetTransitionOptionsQuery,
    useGetTransitionApprovalsQuery,
    useRequestTransitionApprovalMutation,
    useReviewTransitionApprovalMutation,
    useGetWorkflowAssignmentsQuery,
    useCreateWorkflowAssignmentMutation,
    useUpdateWorkflowAssignmentMutation,
    useGetWorkflowAlertsQuery,
    useCreateWorkflowAlertMutation,
    useUpdateWorkflowAlertMutation,
    useGetWorkflowTimelineQuery,
} = workflowApi;
