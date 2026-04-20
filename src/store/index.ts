'use client';

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import workflowReducer from '@/store/slices/workflowSlice';
import notificationsReducer from '@/store/slices/notificationsSlice';
import { workflowApi } from '@/store/services/workflowApi';

export const store = configureStore({
    reducer: {
        workflow: workflowReducer,
        notifications: notificationsReducer,
        [workflowApi.reducerPath]: workflowApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(workflowApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
