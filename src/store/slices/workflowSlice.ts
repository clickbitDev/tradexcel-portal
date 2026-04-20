'use client';

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { WorkflowStage } from '@/types/database';

interface WorkflowState {
    selectedApplicationId: string | null;
    selectedStage: WorkflowStage | null;
    transitionInProgress: boolean;
    transitionError: string | null;
}

const initialState: WorkflowState = {
    selectedApplicationId: null,
    selectedStage: null,
    transitionInProgress: false,
    transitionError: null,
};

const workflowSlice = createSlice({
    name: 'workflow',
    initialState,
    reducers: {
        setWorkflowSelection(
            state,
            action: PayloadAction<{ applicationId: string; stage: WorkflowStage }>
        ) {
            state.selectedApplicationId = action.payload.applicationId;
            state.selectedStage = action.payload.stage;
        },
        setTransitionInProgress(state, action: PayloadAction<boolean>) {
            state.transitionInProgress = action.payload;
            if (action.payload) {
                state.transitionError = null;
            }
        },
        setTransitionError(state, action: PayloadAction<string | null>) {
            state.transitionError = action.payload;
            if (action.payload) {
                state.transitionInProgress = false;
            }
        },
        clearWorkflowState(state) {
            state.selectedApplicationId = null;
            state.selectedStage = null;
            state.transitionInProgress = false;
            state.transitionError = null;
        },
    },
});

export const {
    setWorkflowSelection,
    setTransitionInProgress,
    setTransitionError,
    clearWorkflowState,
} = workflowSlice.actions;

export default workflowSlice.reducer;
