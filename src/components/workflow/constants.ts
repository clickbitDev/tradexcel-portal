import type { WorkflowStage } from '@/types/database';
import { WORKFLOW_STAGE_LABELS } from '@/types/database';

export { WORKFLOW_STAGE_LABELS };

export const WORKFLOW_STAGE_BADGE_CLASSES: Record<WorkflowStage, string> = {
    TRANSFERRED: 'bg-cyan-100 text-cyan-700 border-cyan-300 dark:bg-cyan-900/50 dark:text-cyan-300 dark:border-cyan-700',
    docs_review: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-700',
    enrolled: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700',
    evaluate: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700',
    accounts: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700',
    dispatch: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-700',
    completed: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-700',
};
