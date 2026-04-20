// Script to generate SQL for importing Agents, Sub-Agents, and Providers into partners table
import * as fs from 'fs';

interface Partner {
    companyName: string;
    type: 'agent' | 'subagent' | 'provider';
    contactName: string | null;
    phone: string | null;
    email: string | null;
    deliveryMethod: string | null;
}

function escapeSQL(str: string): string {
    if (!str) return '';
    return str.replace(/'/g, "''");
}

function parseCSV(content: string, type: 'agent' | 'subagent' | 'provider'): Partner[] {
    const lines = content.split('\n');
    const partners: Partner[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const fields: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        fields.push(current.trim());

        if (fields.length < 1) continue;

        // Name,Type,Contact Name,Phone,Email,Delivery Method,Created By
        const companyName = fields[0]?.replace(/"/g, '') || '';
        if (!companyName) continue;

        const contactName = fields[2]?.replace(/"/g, '') || null;
        const phone = fields[3]?.replace(/"/g, '') || null;
        const email = fields[4]?.replace(/"/g, '') || null;
        const deliveryMethod = fields[5]?.replace(/"/g, '') || null;

        partners.push({
            companyName,
            type,
            contactName,
            phone,
            email: email && email.includes('@') ? email : null, // Validate email
            deliveryMethod,
        });
    }

    return partners;
}

function generateSQL(partners: Partner[]): string {
    // Group by email to handle potential duplicates
    const emailToPartner = new Map<string, Partner>();
    const noEmailPartners: Partner[] = [];

    for (const p of partners) {
        if (p.email) {
            // Keep the first occurrence if duplicate emails
            if (!emailToPartner.has(p.email)) {
                emailToPartner.set(p.email, p);
            }
        } else {
            noEmailPartners.push(p);
        }
    }

    // Combine back - those with unique emails + those without emails
    const uniquePartners = [...emailToPartner.values(), ...noEmailPartners];

    let sql = `-- Partners Import (Agents, Sub-Agents, Providers)
-- Generated at ${new Date().toISOString()}
-- Total partners: ${uniquePartners.length}

`;

    // Insert each one separately to handle ON CONFLICT properly
    for (const p of uniquePartners) {
        const contactName = p.contactName ? `'${escapeSQL(p.contactName)}'` : 'NULL';
        const phone = p.phone ? `'${escapeSQL(p.phone)}'` : 'NULL';
        const email = p.email ? `'${escapeSQL(p.email)}'` : 'NULL';
        const deliveryMethod = p.deliveryMethod ? `'${escapeSQL(p.deliveryMethod)}'` : 'NULL';

        if (p.email) {
            // Has email - use ON CONFLICT
            sql += `INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('${escapeSQL(p.companyName)}', '${p.type}', ${contactName}, ${phone}, ${email}, ${deliveryMethod}, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

`;
        } else {
            // No email - just insert (may fail if duplicate)
            sql += `INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT '${escapeSQL(p.companyName)}', '${p.type}', ${contactName}, ${phone}, ${email}, ${deliveryMethod}, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = '${escapeSQL(p.companyName)}' AND type = '${p.type}');

`;
        }
    }

    sql += `-- Verify import
SELECT type, COUNT(*) as count FROM partners GROUP BY type ORDER BY type;
SELECT 'Total Partners' as summary, COUNT(*) as count FROM partners;
`;

    return sql;
}

// Main
console.log('Parsing CSV files...');

const agentsCsv = fs.readFileSync('/home/clickbit/Export Files/agents_2026-01-16_21-12-35.csv', 'utf-8');
const subAgentsCsv = fs.readFileSync('/home/clickbit/Export Files/sub_agents_2026-01-16_21-12-40.csv', 'utf-8');
const providersCsv = fs.readFileSync('/home/clickbit/Export Files/providers_2026-01-16_21-12-44.csv', 'utf-8');

const agents = parseCSV(agentsCsv, 'agent');
const subAgents = parseCSV(subAgentsCsv, 'subagent');
const providers = parseCSV(providersCsv, 'provider');

console.log(`Parsed ${agents.length} agents`);
console.log(`Parsed ${subAgents.length} sub-agents`);
console.log(`Parsed ${providers.length} providers`);

const allPartners = [...agents, ...subAgents, ...providers];
console.log(`Total: ${allPartners.length} partners`);

const sql = generateSQL(allPartners);
const outputPath = '/home/clickbit/lumiere-portal/scripts/import-partners.sql';
fs.writeFileSync(outputPath, sql);

console.log(`SQL file generated: ${outputPath}`);
