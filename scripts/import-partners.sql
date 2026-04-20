-- Partners Import (Agents, Sub-Agents, Providers)
-- Generated at 2026-01-16T10:20:17.984Z
-- Total partners: 129

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('7 Star Education', 'agent', 'Ms. Sue', '0413 862 886', 'admin@7-stars.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('AAT Rabbi', 'agent', 'Fazle Rabbi', NULL, 'fazlerabbi@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('ABM Intekabul Hoq', 'agent', 'Mr. Intekabul Hoque', NULL, 'ihoq1@hotmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Active Pro', 'agent', 'Ms. Sumiya Afrin', '+880 1685-526926', 'admin@activeproconsultancy.com.au', 'Hand Delivery', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Advanced Studies Australia', 'agent', 'Mr. Syed Rahman Mithu', '0401 846 871', 'advancedstudiesaustralia@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Aeliz Arif', 'agent', NULL, '0480280213', 'a.sarkar@aelizgroup.com', 'Hand Delivery', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Ananya Kashyapi', 'agent', 'Ms. Ananya Kashyapi', '0431 325 629', 'info@lumieresolutions.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('ASA Marina', 'agent', 'Ms. Marina Khoury', '0412 694 090', 'ceo@australianskillsacademy.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('ATSR', 'agent', 'XYZ', '0415 210 981', 'admin@atsrpl.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Barega Group Gofur', 'agent', NULL, '0435 939 293', 'baregalf@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Buzy Beez Tawfiq', 'agent', 'Tawfiq Madi', '0401 754 434', 'buzybeezfdc@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Casey Hope Daniel', 'agent', NULL, '0402 930 268', 'noemail_daniel@fake.com', 'Posting', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Chaf Security', 'agent', 'Chaf Zantout', '0404 722 000', 'hasanz.office@gmail.com', 'Hand Delivery', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Combined Edu Care', 'agent', 'Mr. Riyad', '0401 422 200', 'combinededucare@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Credium', 'agent', 'Ms Arifa Ferdous Mittu', '0406 843 890', 'enquiry@credium.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Digital Life Sumir', 'agent', 'Mr. Sumir', '0430 883 433', 'digitalization.inlife@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Dreamfly edu', 'agent', 'Vivian', NULL, 'info@dreamflyedu.org', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Educube', 'agent', 'Saif Siddique', '0485 840 516', 'admin@educube.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Edumaima Zak', 'agent', NULL, '0483 853 227', 'application@edumaima.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('EduStep Consultancy', 'agent', 'Ms. Devinder Gill', '0272 278 373', 'rhonda@edustep.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Eulogia Education', 'agent', 'Mr. Sourav Pddar', '0451 019 213', 'info@eulogiaedu.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Everest Education & Visa Services', 'agent', 'Mr. Ashok', '0401 162 344', 'info@eevsgroup.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Fast RPL', 'agent', 'Mr. John', '0433 435 899', 'john@fastrpl.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Gaurav Amit', 'agent', NULL, '0451 433 376', 'gauravwalecha03@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Glenmore Ventures', 'agent', 'Mr. Sukhwinder Singh Aitken', '0416 439 554', 'arvinderkssingh@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Guri Punjab', 'agent', 'Harry SINGH', NULL, 'singhofpunjab096@gmail.com', 'Hand Delivery', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Harbour Education', 'agent', 'Mr. Tahmidul Islam TAMIM', '0449 626 304', 'admin@harbouredu.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('HBD Hira', 'agent', 'Hira Laraib', NULL, 'hiralaraib22@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('HBD Rumana', 'agent', 'Ms. Rumana Samreen Nizam', NULL, 'samreenizam15@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Holo Education Services', 'agent', NULL, '0451 008 088', 'admin@holoedu.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Holy Park Campsie', 'agent', 'Ms. Sisi', '0422179859', 'info.holypark@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('IMES', 'agent', 'Soyab Ahmad', '0420 653 636', 'nomail@xyz.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('InfoContact', 'agent', NULL, '493 429 015', 'info.contact4172@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Insta Education and Visa Services', 'agent', 'Mr. Krishna Kharel', '0416 949 802', 'admission@instaedu.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Intellectual Aspirations', 'agent', 'Mr. Manu', NULL, 'iaconsultantsoz@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Janix', 'agent', 'Ms. Janvi', '0413514841', 'sjanvi2006@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Lumiere Hasan', 'agent', 'HZI', NULL, 'zahidul5476@gmail.com', 'No Print – No Post', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Max Education', 'agent', 'Mr. Nazim', '0451 080 025', 'admin@max-edu.com.edu', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('MI Edu Perth', 'agent', 'Mr. Ejaz', '04 7894 3041', 'prakash@mymavenedu.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('MI Education Sydney', 'agent', 'Ms. Arifa Ferdous', '0406 843 890', 'rpl@mieducation.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Mission 400', 'agent', 'Ms. Shanjida Sabrin', '0403 990 583', '400@campusconnectnswrpl.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('MRR Edu Consultancy', 'agent', 'Mr. Mohsin', NULL, 'mohsin.hossain2008@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Nazia Sharif', 'agent', 'Ms. Nazia', NULL, 'nazia0212@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Nazmul Modhumoti', 'agent', 'Ms Sabina Yeasmin', NULL, 'r.sabina85@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('NCA Sakib', 'agent', 'Mr. Sakib', NULL, 'admin@nationalcertifyau.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('NH Education', 'agent', 'Mr Naeem', NULL, 'rpl.nheducation.au@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Oceania Services', 'agent', NULL, '0451 877 056', 'info@oceaniaservices.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Parish Patience Bitel Immigration Lawyers', 'agent', 'Mr. Golam Mostafa', '0292 868 700', 'gm@ppilaw.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Pleasant Education', 'agent', NULL, '0424 852 345', 'info@pleasantedu.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Qualify First', 'agent', NULL, '0420 918 783', 'info@qualifyfirst.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RecogniSkill', 'agent', 'Mr. Mashroor', '0472 668 070', 'apply@recogniskill.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Referral Frank', 'agent', 'Mr. Frank', '0000700000', 'xyz@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Referral Ghazwan', 'agent', 'Mr. Ghazwan', NULL, 'ghazwanalrawi@hotmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Referral Haider Rajjak', 'agent', 'Mr. Rajjakul Haider', '0481 095 598', 'ahmsazam@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Referral Sadaf', 'agent', 'Ms. Sadaf', NULL, 'sadaf.tamizkar@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RinZin Agent', 'agent', 'RinZin', '+61450638244', 'rinzinit19@gmail.com', 'Posting', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RJ Global Investment', 'agent', 'Mr. Jinto Mani', '0426 053 447', 'jinto.mani@acmcollege.edu.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RPL Expert', 'agent', 'Ms. Nisat Sultana Zilin', '0405 050 627', 'nisatsultana.zilin@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RPL Express', 'agent', 'Mr. Mihad', '+880 1824-176861', 'contact@rplexpress.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RPL Genius Saifu', 'agent', 'Saif Russell', '0404 908 826', 'russell@rplgenius.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RPL Qualifications', 'agent', 'Mr Bikash', '0424 383 457', 'certification@rplqualifications.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RTA Edu Syed', 'agent', 'Mr. Syed', '0413 110 722', 'info@rtaeducation.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Saciid Chesterhill', 'agent', 'Saciid', '0477 552 512', 'dodgy_somali@abc.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Sagor Melb', 'agent', 'Mr. Kamruzzaman', NULL, 'k_shagor@yahoo.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('SEACA', 'agent', 'Mr. Mahmud', '0485 840 516', 'admin@seaca.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Shamol', 'agent', 'Mr. Emran Hossain', '0425 383 099', 'emran786@yahoo.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('SHUBHKARMANJIT SINGH', 'agent', 'SHUBHKARMANJIT SINGH', '0406101363', 'shubhkarman94@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Sikna Zein', 'agent', 'Ms. Sikna Jain', '0449 590 152', 'Sikna.Zein12@hotmail.com', 'No Print – No Post', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Skill Spot Australia', 'agent', 'NA', '0477 608 883', 'info@skillspot.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Skill Sync', 'agent', 'Ms. Shaila', '1300 993 590', 'application@skillsync.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Skill World', 'agent', 'Mr. Moinuddin', '0423 356 061', 'info@skillworld.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Skills Certified', 'agent', 'Mr. Scott', '0422 678 966', 'scott.roberts@skillscertified.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Skillup Education', 'agent', 'Mr Mohammad Eram Mollah', '0423 264 591', 'admin@skillupeducation.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('STA Mahmoud', 'agent', 'Mr. Mahmud', NULL, 'mahm_ag@yahoo.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('StepUp', 'agent', 'Mr. Rizwan K Muzammil', '0404 871 234', 'rizwan@stepupprofession.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Study Verse', 'agent', 'Mr. Monir Hossain', '0403 797 897', 'm.studyverse@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('StudyIN', 'agent', 'Mr Asif', '0483 943 219', 'submission@studyin.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Studyleap', 'agent', 'Mr. Mithun Saha', '0470 296 647', 'rpl@studyleap.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Suman Kharel', 'agent', 'Mr. Suman Kharel', NULL, 'kharel.easy@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Swiss Academy', 'agent', 'Dipendra Sharma Poudel', '0423 862 885', 'ceo@cacademic.edu.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Test Agent Tanvir', 'agent', 'Test Tanvir', NULL, 'tanvir+testagent@lumieresolutions.com.au', 'Posting', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('TI_Bspoke Infotech', 'agent', 'Md Tanvirul Islam', '+61401959717', 'tanvir@sunriseskillpathways.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Ultimate Developer', 'agent', 'Ultimate Developer', '0412140574', 'developer@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Ultimate Developer 7', 'agent', 'Ultimate Developer 7', '0412140100', 'developerultimatetest7@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('VCTD', 'agent', 'Mr. Sager Ahmad', '0410 551 541', 'creditfe@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Vidi Melb', 'agent', NULL, '0452 296 842', 'vidhikansagra123@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Vita Step', 'agent', 'Ms Anahara Kelly', '0493 987 097', 'lizp@vitastep.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Walid Osman', 'agent', 'Mr. Osman', '0438 484 475', 'pcc.au.nsw@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('ZM Edu', 'agent', 'Mr. Imtiaz Moin', '+880 1798-797220', 'zmeducation.aus@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('AK_Training Certified Meesha', 'subagent', 'Meesha Nguyen', '0405 837 390', 'info.trainingskillscertified@gmail.com', 'Posting', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('AK_Visa Alliance Pty Ltd', 'subagent', 'Naina', NULL, 'admissions@visaalliance.com', 'Posting', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Test Subagent Tanvir', 'subagent', 'Test Subagent Tanvir', '041231456', 'tanvir+subagent@lumieresolutions.com.au', 'Posting', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('RinZin Provider', 'provider', 'RinZin', '+61450638244', 'ferdous@rinzinit.com.au', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Test Provider Tanvir', 'provider', 'Test Provider Tanvir', NULL, 'tanvir+provider@lumieresolutions.com.au', 'Posting', 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
VALUES ('Ultimate Developer', 'provider', 'Ultimate Developer', '0412140574', 'developerultima@gmail.com', NULL, 'active')
ON CONFLICT (email) DO UPDATE SET
    company_name = EXCLUDED.company_name,
    type = EXCLUDED.type,
    contact_name = COALESCE(EXCLUDED.contact_name, partners.contact_name),
    phone = COALESCE(EXCLUDED.phone, partners.phone),
    delivery_method = COALESCE(EXCLUDED.delivery_method, partners.delivery_method),
    updated_at = NOW();

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'AES Kahtan', 'agent', 'Mr. Kahtan', '0433 684 439', NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'AES Kahtan' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Ash Nazmul', 'agent', 'Asish Ranga', '0403 437 149', NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Ash Nazmul' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'BCS Reda', 'agent', 'Reda', '0411 335 377', NULL, 'Hand Delivery', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'BCS Reda' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Buzz QC', 'agent', 'Mr. Buzz', '0451 262 144', NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Buzz QC' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Campus Connect', 'agent', 'Sanjida', NULL, NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Campus Connect' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Certified Australia', 'agent', 'xyz', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Certified Australia' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'EduXpert', 'agent', 'Mr. Anand KARUPPIAH', '0419 270 566', NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'EduXpert' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Fun4 Family Day Care', 'agent', 'Mr. Ali YABAROW', '0413 226 666', NULL, 'No Print – No Post', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Fun4 Family Day Care' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Get Recognised Au', 'agent', 'Mr. James', '0468 350 570', NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Get Recognised Au' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Igenius', 'agent', 'Mr. Saiful Islam', '0404 908 826', NULL, 'Agent will Collect', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Igenius' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Jinia Arnov', 'agent', 'Jinia', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Jinia Arnov' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'LAS Israt_Launchpad', 'agent', 'Israt', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'LAS Israt_Launchpad' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Lumiere Israt', 'agent', 'Ms. Israt Jakia Sultana', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Lumiere Israt' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Osman Fairfield', 'agent', 'Osman', '0401 035 154', NULL, 'No Print – No Post', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Osman Fairfield' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Referral Dayo', 'agent', 'Dayo', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Referral Dayo' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Referral Diana ACT', 'agent', 'Ms. Diana', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Referral Diana ACT' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Referral Doni', 'agent', NULL, NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Referral Doni' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Referral Fanta', 'agent', 'Mr. Fanta', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Referral Fanta' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Referral Issac', 'agent', 'Mr. Issac', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Referral Issac' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Referral Sarian', 'agent', 'Sarian Savage', '0 413 387 751', NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Referral Sarian' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Richard Somalia', 'agent', 'Richard', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Richard Somalia' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'RPA Zakaria', 'agent', 'Mr. Rafid Hossain', '+880 1715-668561', NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'RPA Zakaria' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'RPL Qualifications', 'agent', NULL, NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'RPL Qualifications' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Tareq', 'agent', 'Ms. Abu Haroon', '0466 915 464', NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Tareq' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'TI_Skill Recruit', 'agent', 'Mr. Ram', NULL, NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'TI_Skill Recruit' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Upright Solutionz', 'agent', 'Mr. hared Ali', '0423 623 987', NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Upright Solutionz' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'WorkInAUS Surinder', 'agent', 'Mr. Surinder Singh', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'WorkInAUS Surinder' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Xpress Qualify', 'agent', 'Haider', '0420 607 948', NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Xpress Qualify' AND type = 'agent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'AK_Accredify Penny', 'subagent', 'Ms. Penny', NULL, NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'AK_Accredify Penny' AND type = 'subagent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'AK_Junaid', 'subagent', 'Ananya', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'AK_Junaid' AND type = 'subagent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'AK_OZ Links', 'subagent', 'Ms. Lisa', NULL, NULL, 'Posting', 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'AK_OZ Links' AND type = 'subagent');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Barega Group', 'provider', 'Gofur', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Barega Group' AND type = 'provider');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Campus Connect', 'provider', 'Ms. Sanjida', NULL, NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Campus Connect' AND type = 'provider');

INSERT INTO partners (company_name, type, contact_name, phone, email, delivery_method, status)
SELECT 'Shamol Emran Hossain', 'provider', 'Shamol Emran Hossain', '0425 383 099', NULL, NULL, 'active'
WHERE NOT EXISTS (SELECT 1 FROM partners WHERE company_name = 'Shamol Emran Hossain' AND type = 'provider');

-- Verify import
SELECT type, COUNT(*) as count FROM partners GROUP BY type ORDER BY type;
SELECT 'Total Partners' as summary, COUNT(*) as count FROM partners;
