type ApplicationRelationBase = {
    id: string;
    qualification_id?: string | null;
    offering_id?: string | null;
    partner_id?: string | null;
};

type QualificationLookup = {
    id: string;
    code: string | null;
    name: string | null;
};

type PartnerLookup = {
    id: string;
    company_name: string;
    type: string | null;
    email?: string | null;
    user_id?: string | null;
    parent_partner_id?: string | null;
};

type OfferingLookup = {
    id: string;
    qualification_id: string | null;
    rto_id: string | null;
    tuition_fee_onshore: number | null;
    tuition_fee_miscellaneous: number | null;
    material_fee: number | null;
    application_fee: number | null;
    agent_fee: number | null;
    assessor_fee: number | null;
};

type RtoLookup = {
    id: string;
    code: string | null;
    name: string | null;
};

type HydratedOffering = {
    qualification?: QualificationLookup | null;
    rto?: RtoLookup | null;
    tuition_fee_onshore: number | null;
    tuition_fee_miscellaneous: number | null;
    material_fee: number | null;
    application_fee: number | null;
    agent_fee: number | null;
    assessor_fee: number | null;
};

type RelationSupabaseClient = {
    from: (table: string) => {
        select: (query: string) => {
            in: (column: string, values: string[]) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
        };
    };
};

export type HydratedApplicationRelations = {
    qualification?: QualificationLookup | null;
    offering?: HydratedOffering | null;
    partner?: PartnerLookup | null;
};

export async function hydrateApplicationRelations<T extends ApplicationRelationBase>(
    applications: T[],
    supabase: RelationSupabaseClient
): Promise<Array<T & HydratedApplicationRelations>> {
    if (applications.length === 0) {
        return [];
    }

    const qualificationIds = Array.from(new Set(
        applications
            .map((application) => application.qualification_id)
            .filter((value): value is string => Boolean(value))
    ));

    const partnerIds = Array.from(new Set(
        applications
            .map((application) => application.partner_id)
            .filter((value): value is string => Boolean(value))
    ));

    const offeringIds = Array.from(new Set(
        applications
            .map((application) => application.offering_id)
            .filter((value): value is string => Boolean(value))
    ));

    const qualificationMap = new Map<string, QualificationLookup>();
    if (qualificationIds.length > 0) {
        const { data, error } = await supabase
            .from('qualifications')
            .select('id, code, name')
            .in('id', qualificationIds);

        if (error) {
            throw new Error(`Unable to load qualifications: ${error.message}`);
        }

        for (const row of (data || []) as QualificationLookup[]) {
            qualificationMap.set(row.id, row);
        }
    }

    const partnerMap = new Map<string, PartnerLookup>();
    if (partnerIds.length > 0) {
        const { data, error } = await supabase
            .from('partners')
            .select('id, company_name, type, email, user_id, parent_partner_id')
            .in('id', partnerIds);

        if (error) {
            throw new Error(`Unable to load partners: ${error.message}`);
        }

        for (const row of (data || []) as PartnerLookup[]) {
            partnerMap.set(row.id, row);
        }
    }

    const offeringMap = new Map<string, OfferingLookup>();
    if (offeringIds.length > 0) {
        const { data, error } = await supabase
            .from('rto_offerings')
            .select('id, qualification_id, rto_id, tuition_fee_onshore, tuition_fee_miscellaneous, material_fee, application_fee, agent_fee, assessor_fee')
            .in('id', offeringIds);

        if (error) {
            throw new Error(`Unable to load RTO offerings: ${error.message}`);
        }

        for (const row of (data || []) as OfferingLookup[]) {
            offeringMap.set(row.id, row);
        }
    }

    const rtoIds = Array.from(new Set(
        Array.from(offeringMap.values())
            .map((offering) => offering.rto_id)
            .filter((value): value is string => Boolean(value))
    ));

    const rtoMap = new Map<string, RtoLookup>();
    if (rtoIds.length > 0) {
        const { data, error } = await supabase
            .from('rtos')
            .select('id, code, name')
            .in('id', rtoIds);

        if (error) {
            throw new Error(`Unable to load RTOs: ${error.message}`);
        }

        for (const row of (data || []) as RtoLookup[]) {
            rtoMap.set(row.id, row);
        }
    }

    return applications.map((application) => {
        const offering = application.offering_id ? offeringMap.get(application.offering_id) || null : null;
        const offeringQualificationId = offering?.qualification_id || null;
        const qualificationId = offeringQualificationId || application.qualification_id || null;

        return {
            ...application,
            qualification: qualificationId ? qualificationMap.get(qualificationId) || null : null,
            offering: offering ? {
                qualification: offeringQualificationId ? qualificationMap.get(offeringQualificationId) || null : null,
                rto: offering.rto_id ? rtoMap.get(offering.rto_id) || null : null,
                tuition_fee_onshore: offering.tuition_fee_onshore,
                tuition_fee_miscellaneous: offering.tuition_fee_miscellaneous,
                material_fee: offering.material_fee,
                application_fee: offering.application_fee,
                agent_fee: offering.agent_fee,
                assessor_fee: offering.assessor_fee,
            } : null,
            partner: application.partner_id ? partnerMap.get(application.partner_id) || null : null,
        };
    });
}
