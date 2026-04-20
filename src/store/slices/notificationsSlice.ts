'use client';

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface NotificationsState {
    unreadCount: number;
    panelOpen: boolean;
}

const initialState: NotificationsState = {
    unreadCount: 0,
    panelOpen: false,
};

const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        setUnreadCount(state, action: PayloadAction<number>) {
            state.unreadCount = Math.max(0, action.payload);
        },
        setNotificationPanelOpen(state, action: PayloadAction<boolean>) {
            state.panelOpen = action.payload;
        },
    },
});

export const {
    setUnreadCount,
    setNotificationPanelOpen,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
