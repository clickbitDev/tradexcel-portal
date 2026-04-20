export interface TransferDocumentPayload {
    sourceDocumentId: string;
    fileName: string;
    documentType: string;
    fileUrl: string;
    fileSize: number | null;
    mimeType: string | null;
    notes: string | null;
    storageProvider: string | null;
    storageBucket: string | null;
    storageKey: string | null;
    remoteUrlExpiresAt: string;
}

export interface ApplicationTransferPayload {
    rtoId: string;
    sourceApplicationId: string;
    transferredAt: string;
    application: {
        studentUid: string;
        applicationNumber: string | null;
        qualificationId: string | null;
        qualificationCode: string | null;
        offeringId: string | null;
        partnerId: string | null;
        studentFirstName: string;
        studentLastName: string;
        studentEmail: string | null;
        studentPhone: string | null;
        studentDob: string | null;
        studentPassportNumber: string | null;
        studentNationality: string | null;
        studentUsi: string | null;
        studentVisaNumber: string | null;
        studentVisaExpiry: string | null;
        studentGender: string | null;
        studentCountryOfBirth: string | null;
        applicationFrom: string | null;
        studentStreetNo: string | null;
        studentSuburb: string | null;
        studentState: string | null;
        studentPostcode: string | null;
        quotedTuition: number | null;
        quotedMaterials: number | null;
        notes: string | null;
        intakeDate: string | null;
        paymentStatus: string | null;
    };
    documents: TransferDocumentPayload[];
}

export interface ApplicationHistorySyncEvent {
    rtoId: string;
    eventId: string;
    eventType: 'application.history.created';
    occurredAt: string;
    sourceApplicationId: string;
    remoteApplicationId: string | null;
    workflowStage: string | null;
    historyEntry: {
        action: string | null;
        fieldChanged: string | null;
        oldValue: string | null;
        newValue: string | null;
        fromStage: string | null;
        toStage: string | null;
        notes: string | null;
        userId: string | null;
        metadata: Record<string, unknown> | null;
    };
}
