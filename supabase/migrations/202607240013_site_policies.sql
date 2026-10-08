-- khetE marketplace: bilingual public policies, controlled publishing and revision history.
-- Run after the initial marketplace and role migrations.

create schema if not exists private;

create table if not exists public.site_policy_documents (
  id uuid primary key default gen_random_uuid(),
  policy_key text not null unique
    check (policy_key in ('terms', 'privacy', 'returns', 'delivery', 'payment')),
  title_en text not null,
  title_ne text,
  summary_en text,
  summary_ne text,
  body_en text not null,
  body_ne text,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_policy_title_en_length check (char_length(trim(title_en)) between 2 and 160),
  constraint site_policy_title_ne_length check (title_ne is null or char_length(trim(title_ne)) between 2 and 160),
  constraint site_policy_summary_en_length check (summary_en is null or char_length(summary_en) <= 500),
  constraint site_policy_summary_ne_length check (summary_ne is null or char_length(summary_ne) <= 500),
  constraint site_policy_body_en_length check (char_length(trim(body_en)) between 20 and 50000),
  constraint site_policy_body_ne_length check (body_ne is null or char_length(trim(body_ne)) between 20 and 50000),
  constraint site_policy_publish_shape check (
    status = 'draft'
    or (
      published_at is not null
      and title_ne is not null
      and body_ne is not null
    )
  )
);

create table if not exists public.site_policy_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.site_policy_documents(id) on delete cascade,
  version integer not null check (version > 0),
  title_en text not null,
  title_ne text,
  summary_en text,
  summary_ne text,
  body_en text not null,
  body_ne text,
  status text not null check (status in ('draft', 'published')),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null,
  unique (document_id, version)
);

create index if not exists site_policy_documents_status_idx
  on public.site_policy_documents (status, policy_key);
create index if not exists site_policy_revisions_document_idx
  on public.site_policy_revisions (document_id, version desc);

create or replace function private.can_manage_site_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role::text in ('super_admin', 'content_promotion_manager')
  );
$$;

grant execute on function private.can_manage_site_content() to anon, authenticated;

create or replace function public.prepare_site_policy_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  if new.status = 'published' then
    new.published_at := now();
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.record_site_policy_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.site_policy_revisions (
    document_id,
    version,
    title_en,
    title_ne,
    summary_en,
    summary_ne,
    body_en,
    body_ne,
    status,
    changed_at,
    changed_by
  )
  values (
    new.id,
    new.version,
    new.title_en,
    new.title_ne,
    new.summary_en,
    new.summary_ne,
    new.body_en,
    new.body_ne,
    new.status,
    new.updated_at,
    new.updated_by
  )
  on conflict (document_id, version) do nothing;
  return new;
end;
$$;

drop trigger if exists site_policy_prepare_update on public.site_policy_documents;
create trigger site_policy_prepare_update
before update on public.site_policy_documents
for each row execute function public.prepare_site_policy_update();

drop trigger if exists site_policy_record_revision on public.site_policy_documents;
create trigger site_policy_record_revision
after insert or update on public.site_policy_documents
for each row execute function public.record_site_policy_revision();

alter table public.site_policy_documents enable row level security;
alter table public.site_policy_revisions enable row level security;

drop policy if exists "site_policy_public_read" on public.site_policy_documents;
create policy "site_policy_public_read"
on public.site_policy_documents for select
to anon, authenticated
using (status = 'published');

drop policy if exists "site_policy_manager_read" on public.site_policy_documents;
create policy "site_policy_manager_read"
on public.site_policy_documents for select
to authenticated
using (private.can_manage_site_content());

drop policy if exists "site_policy_manager_insert" on public.site_policy_documents;
create policy "site_policy_manager_insert"
on public.site_policy_documents for insert
to authenticated
with check (private.can_manage_site_content());

drop policy if exists "site_policy_manager_update" on public.site_policy_documents;
create policy "site_policy_manager_update"
on public.site_policy_documents for update
to authenticated
using (private.can_manage_site_content())
with check (private.can_manage_site_content());

drop policy if exists "site_policy_manager_delete" on public.site_policy_documents;
create policy "site_policy_manager_delete"
on public.site_policy_documents for delete
to authenticated
using (private.can_manage_site_content());

drop policy if exists "site_policy_revision_manager_read" on public.site_policy_revisions;
create policy "site_policy_revision_manager_read"
on public.site_policy_revisions for select
to authenticated
using (private.can_manage_site_content());

grant select on public.site_policy_documents to anon, authenticated;
grant insert, update, delete on public.site_policy_documents to authenticated;
grant select on public.site_policy_revisions to authenticated;

insert into public.site_policy_documents (
  policy_key,
  title_en,
  title_ne,
  summary_en,
  summary_ne,
  body_en,
  body_ne,
  status,
  published_at
)
values
(
  'terms',
  'Terms & Conditions',
  'नियम तथा सर्तहरू',
  'The basic rules for accounts, listings, orders, services and acceptable use of the khetE marketplace.',
  'khetE बजारका खाता, सूची, अर्डर, सेवा र उचित प्रयोगसम्बन्धी आधारभूत नियमहरू।',
  $policy$
## About the marketplace

khetE connects customers with agricultural products, equipment, services and approved professional profiles. The seller or service provider remains responsible for the accuracy, quality and lawful supply of what they offer. khetE manages the marketplace experience, support and records described on the website.

## Accounts and information

- Provide accurate registration, delivery and contact information.
- Keep your account credentials private and tell Support promptly if you suspect unauthorised access.
- Do not create accounts or place orders using another person’s identity without permission.

## Listings, prices and availability

Product and service information may be updated when stock, seasonal availability, provider schedules or delivery coverage changes. The price and availability confirmed during checkout or service acceptance are the values used for that request.

## Orders and service requests

Submitting a request does not guarantee acceptance. An order or booking is confirmed only when khetE or the responsible provider records its acceptance. Customers should review quantities, variants, addresses, schedules and contact details before submitting.

## Payments and communication

Use only payment methods shown by khetE. Do not send money or private payment details through unofficial messages. Customer, seller and professional communication relating to a transaction should remain within khetE Support and the recorded workflow.

## Fair use

- Do not misuse the website, interfere with its security or attempt to access another user’s records.
- Do not upload unlawful, deceptive, abusive or harmful content.
- Do not use khetE to avoid applicable product, tax, consumer or professional requirements.

## Changes and support

khetE may update these terms as the marketplace, delivery coverage and payment methods change. The currently published version and date appear on this page. Contact Support before ordering if any term is unclear.
$policy$,
  $policy$
## बजारको बारेमा

khetE ले ग्राहकलाई कृषि उत्पादन, उपकरण, सेवा तथा स्वीकृत पेशेवर प्रोफाइलसँग जोड्छ। विक्रेता वा सेवा प्रदायकले आफ्नो प्रस्तावको सही विवरण, गुणस्तर र कानुनी आपूर्तिको जिम्मेवारी लिन्छ। वेबसाइटमा उल्लेख भएअनुसार khetE ले बजार अनुभव, सहायता र अभिलेख व्यवस्थापन गर्छ।

## खाता र जानकारी

- दर्ता, डेलिभरी र सम्पर्क विवरण सही दिनुहोस्।
- आफ्नो खाताको गोपनीयता सुरक्षित राख्नुहोस् र अनधिकृत पहुँचको शंका भए तुरुन्त सहायता टोलीलाई जानकारी दिनुहोस्।
- अनुमति बिना अरू व्यक्तिको पहिचान प्रयोग गरी खाता वा अर्डर नबनाउनुहोस्।

## सूची, मूल्य र उपलब्धता

मौज्दात, मौसम, प्रदायकको समय वा डेलिभरी क्षेत्र परिवर्तन हुँदा उत्पादन र सेवाको विवरण अद्यावधिक हुन सक्छ। चेकआउट वा सेवा स्वीकृतिको समयमा पुष्टि भएको मूल्य र उपलब्धता नै अनुरोधमा लागू हुन्छ।

## अर्डर र सेवा अनुरोध

अनुरोध पठाउँदैमा स्वीकृति निश्चित हुँदैन। khetE वा सम्बन्धित प्रदायकले स्वीकृति अभिलेख गरेपछि मात्र अर्डर वा बुकिङ पुष्टि हुन्छ। पठाउनुअघि मात्रा, विकल्प, ठेगाना, समय र सम्पर्क विवरण जाँच गर्नुहोस्।

## भुक्तानी र सञ्चार

khetE मा देखाइएका माध्यमबाट मात्र भुक्तानी गर्नुहोस्। अनौपचारिक सन्देशमार्फत रकम वा निजी भुक्तानी विवरण नपठाउनुहोस्। कारोबारसम्बन्धी सञ्चार khetE सहायता र अभिलेखित प्रणालीभित्र राख्नुहोस्।

## उचित प्रयोग

- वेबसाइटको दुरुपयोग, सुरक्षामा हस्तक्षेप वा अरू प्रयोगकर्ताको अभिलेखमा पहुँच गर्ने प्रयास नगर्नुहोस्।
- गैरकानुनी, भ्रामक, अपमानजनक वा हानिकारक सामग्री नपठाउनुहोस्।
- लागू हुने उत्पादन, कर, उपभोक्ता वा पेशागत आवश्यकताबाट बच्न khetE प्रयोग नगर्नुहोस्।

## परिवर्तन र सहायता

बजार, डेलिभरी क्षेत्र र भुक्तानी माध्यम परिवर्तन हुँदा khetE ले यी सर्तहरू अद्यावधिक गर्न सक्छ। हाल प्रकाशित संस्करण र मिति यही पृष्ठमा देखिन्छ। कुनै कुरा अस्पष्ट भए अर्डर गर्नुअघि सहायता टोलीलाई सम्पर्क गर्नुहोस्।
$policy$,
  'published',
  now()
),
(
  'privacy',
  'Privacy Policy',
  'गोपनीयता नीति',
  'How khetE collects, uses, shares and protects customer, professional and administrative information.',
  'khetE ले ग्राहक, पेशेवर र प्रशासनिक जानकारी कसरी सङ्कलन, प्रयोग, साझेदारी र सुरक्षित गर्छ।',
  $policy$
## Information we collect

khetE may collect account details, contact information, delivery addresses, order and service records, payment status, support messages, uploaded documents and technical information needed to operate and protect the marketplace.

## How information is used

- Create and secure accounts.
- Process orders, delivery, service requests, support and professional applications.
- Maintain invoices, confirmations, financial records and audit history.
- Prevent misuse, resolve disputes and improve marketplace performance.
- Send operational updates when notification services are enabled.

## When information is shared

Information is shared only as needed with authorised khetE staff, the seller or professional responsible for a request, delivery and payment providers that the customer chooses, and authorities when disclosure is legally required. A provider receives only the information reasonably needed to fulfil the relevant request.

## Storage and security

khetE uses access controls and separate customer, professional and staff permissions. No internet service can guarantee absolute security. Users should protect their passwords and avoid sending confidential payment details through ordinary support messages.

## Your choices

Customers can update saved delivery profiles and contact Support to correct account or transaction information. Some records may need to be retained for orders, payments, tax, fraud prevention, disputes or other lawful business requirements.

## Retention and changes

Information is kept only for as long as reasonably needed for the purposes described above and applicable record-keeping needs. Material changes to this policy will be published here with a new version and date.

## Contact

Use khetE Support for privacy questions, corrections or concerns. Include enough information to identify the relevant account or request, but do not send passwords or full payment credentials.
$policy$,
  $policy$
## हामीले सङ्कलन गर्ने जानकारी

khetE ले बजार सञ्चालन र सुरक्षा गर्न आवश्यक खाता विवरण, सम्पर्क जानकारी, डेलिभरी ठेगाना, अर्डर तथा सेवा अभिलेख, भुक्तानी स्थिति, सहायता सन्देश, अपलोड गरिएका कागजात र प्राविधिक जानकारी सङ्कलन गर्न सक्छ।

## जानकारीको प्रयोग

- खाता बनाउन र सुरक्षित राख्न।
- अर्डर, डेलिभरी, सेवा अनुरोध, सहायता र पेशेवर आवेदन सञ्चालन गर्न।
- बीजक, पुष्टि, वित्तीय अभिलेख र अडिट इतिहास राख्न।
- दुरुपयोग रोक्न, विवाद समाधान गर्न र बजारको कार्यसम्पादन सुधार गर्न।
- सूचना सेवा सक्रिय भएपछि सञ्चालनसम्बन्धी अद्यावधिक पठाउन।

## जानकारी साझेदारी

आवश्यकताअनुसार मात्र अधिकृत khetE कर्मचारी, सम्बन्धित विक्रेता वा पेशेवर, ग्राहकले रोजेका डेलिभरी तथा भुक्तानी प्रदायक र कानुनी रूपमा आवश्यक अधिकारीसँग जानकारी साझेदारी गरिन्छ। प्रदायकले सम्बन्धित अनुरोध पूरा गर्न आवश्यक जानकारी मात्र पाउँछ।

## भण्डारण र सुरक्षा

khetE ले पहुँच नियन्त्रण र ग्राहक, पेशेवर तथा कर्मचारीका छुट्टाछुट्टै अनुमति प्रयोग गर्छ। कुनै पनि इन्टरनेट सेवाले पूर्ण सुरक्षा सुनिश्चित गर्न सक्दैन। पासवर्ड सुरक्षित राख्नुहोस् र सामान्य सहायता सन्देशमा गोप्य भुक्तानी विवरण नपठाउनुहोस्।

## तपाईंका विकल्प

ग्राहकले सुरक्षित डेलिभरी प्रोफाइल अद्यावधिक गर्न र खाता वा कारोबार जानकारी सच्याउन सहायता टोलीलाई सम्पर्क गर्न सक्छन्। अर्डर, भुक्तानी, कर, ठगी रोकथाम, विवाद वा अन्य वैध व्यावसायिक आवश्यकताका लागि केही अभिलेख राख्नुपर्ने हुन सक्छ।

## अवधारण र परिवर्तन

माथि उल्लेखित उद्देश्य र लागू अभिलेख आवश्यकताका लागि आवश्यक समयसम्म मात्र जानकारी राखिन्छ। यस नीतिमा महत्वपूर्ण परिवर्तन हुँदा नयाँ संस्करण र मितिसहित यहीँ प्रकाशित गरिन्छ।

## सम्पर्क

गोपनीयता प्रश्न, सुधार वा चिन्ताका लागि khetE सहायता प्रयोग गर्नुहोस्। सम्बन्धित खाता वा अनुरोध पहिचान गर्न पुग्ने जानकारी दिनुहोस्, तर पासवर्ड वा पूर्ण भुक्तानी विवरण नपठाउनुहोस्।
$policy$,
  'published',
  now()
),
(
  'returns',
  'Returns & Refunds',
  'फिर्ता तथा रकम फिर्ता नीति',
  'The request, inspection and decision process for cancellations, returns, replacements and refunds.',
  'रद्द, फिर्ता, प्रतिस्थापन र रकम फिर्ताको अनुरोध, निरीक्षण र निर्णय प्रक्रिया।',
  $policy$
## Check the listing first

Return eligibility and the request deadline may differ by product type. The applicable window should appear on the product or order detail. Perishable produce, live goods, opened agricultural inputs, customised items and completed services may have special restrictions where health, safety, quality or irreversible work is involved.

## Eligible problems

- A materially different item or variant was delivered.
- The item arrived damaged, defective or incomplete.
- A verified quantity is missing.
- A service was not delivered as accepted.
- Another reason is specifically allowed on the listing or confirmed order.

## Request process

Open the order in your account and use its Support shortcut before the displayed deadline. Keep the item, packaging, batch or serial details and clear supporting images where relevant. Do not use, alter or dispose of the item while the request is being reviewed unless safety requires it.

## Inspection and decision

khetE may ask the customer, seller, delivery team or professional for additional evidence. A return, replacement or refund is approved only after the request is checked against the listing, delivery record, item condition and applicable window.

## Refund timing

Approved refunds are recorded against the original order. The actual transfer method and timing depend on the payment method enabled for that order. Delivery or service charges are refunded only when the approved decision includes them.

## Support

Use the Returns & Replacements topic in Support. Keep the ticket number and order reference for all follow-up communication.
$policy$,
  $policy$
## पहिले सूची जाँच गर्नुहोस्

उत्पादनको प्रकारअनुसार फिर्ता योग्यताको नियम र अनुरोध समय फरक हुन सक्छ। लागू समय उत्पादन वा अर्डर विवरणमा देखिनुपर्छ। स्वास्थ्य, सुरक्षा, गुणस्तर वा फिर्ता गर्न नसकिने कामसँग सम्बन्धित नाशवान उत्पादन, जीवित वस्तु, खोलिएका कृषि सामग्री, विशेष रूपमा बनाइएका वस्तु र पूरा भएका सेवामा विशेष प्रतिबन्ध हुन सक्छ।

## योग्य समस्या

- अर्डरभन्दा उल्लेखनीय रूपमा फरक वस्तु वा विकल्प डेलिभर भयो।
- वस्तु क्षतिग्रस्त, बिग्रिएको वा अपूर्ण अवस्थामा आयो।
- पुष्टि गरिएको मात्रा कम छ।
- स्वीकृत सेवा प्रदान भएन।
- सूची वा पुष्टि भएको अर्डरमा विशेष रूपमा अनुमति दिइएको अन्य कारण।

## अनुरोध प्रक्रिया

आफ्नो खातामा अर्डर खोलेर देखाइएको समयसीमाभित्र सहायता लिंक प्रयोग गर्नुहोस्। आवश्यक भए वस्तु, प्याकेजिङ, ब्याच वा सिरियल विवरण र स्पष्ट तस्बिर सुरक्षित राख्नुहोस्। सुरक्षा कारण नभएसम्म समीक्षा भइरहेका बेला वस्तु प्रयोग, परिवर्तन वा नष्ट नगर्नुहोस्।

## निरीक्षण र निर्णय

khetE ले ग्राहक, विक्रेता, डेलिभरी टोली वा पेशेवरसँग थप प्रमाण माग्न सक्छ। सूची, डेलिभरी अभिलेख, वस्तुको अवस्था र लागू समय जाँच गरेपछि मात्र फिर्ता, प्रतिस्थापन वा रकम फिर्ता स्वीकृत हुन्छ।

## रकम फिर्ताको समय

स्वीकृत रकम फिर्ता मूल अर्डरसँग अभिलेख गरिन्छ। वास्तविक माध्यम र समय उक्त अर्डरमा सक्रिय भुक्तानी विधिमा निर्भर हुन्छ। निर्णयमा समावेश भएमा मात्र डेलिभरी वा सेवा शुल्क फिर्ता हुन्छ।

## सहायता

सहायतामा “Returns & Replacements” विषय प्रयोग गर्नुहोस्। सबै पछिल्लो सञ्चारका लागि टिकट नम्बर र अर्डर सन्दर्भ सुरक्षित राख्नुहोस्।
$policy$,
  'published',
  now()
),
(
  'delivery',
  'Delivery Policy',
  'डेलिभरी नीति',
  'Delivery coverage, fees, estimates, receipt checks and unsuccessful-delivery handling.',
  'डेलिभरी क्षेत्र, शुल्क, अनुमानित समय, प्राप्ति जाँच र असफल डेलिभरी व्यवस्थापन।',
  $policy$
## Coverage and address

khetE delivers only to areas supported by the products in the cart and the available delivery partner. Enter a complete, reachable address and phone number. Checkout prevents selection of a saved address outside the supported district when that restriction is known.

## Fees and estimates

Any delivery fee recorded for the order appears in the order total or later fulfilment update. Estimated dates are planning estimates, not guarantees. Weather, road access, seasonal demand, live or perishable goods and seller readiness may affect timing.

## Customer availability

The customer or an authorised receiver should be available at the confirmed location. Additional delivery attempts, storage or return transport may require approval and may create an extra charge where the customer-provided details were incomplete or no receiver was available.

## Checking a delivery

Check the item, variant, visible condition and quantity as soon as reasonably possible. Record a delivery problem through the order Support shortcut and preserve useful evidence. Confirm delivery in the order centre only after receiving the order.

## Delays and unsuccessful delivery

Tracking and delivery updates appear in the customer order centre. If a delay becomes material, khetE Support can review the seller, carrier and customer records and explain the available next step.
$policy$,
  $policy$
## क्षेत्र र ठेगाना

khetE ले कार्टका उत्पादन र उपलब्ध डेलिभरी साझेदारले समर्थन गर्ने क्षेत्रमा मात्र डेलिभरी गर्छ। पूरा र पहुँचयोग्य ठेगाना तथा फोन नम्बर दिनुहोस्। प्रतिबन्ध थाहा भएको अवस्थामा चेकआउटले असमर्थित जिल्लाको सुरक्षित ठेगाना चयन गर्न दिँदैन।

## शुल्क र अनुमान

अर्डरमा अभिलेख गरिएको डेलिभरी शुल्क कुल रकम वा पछिल्लो पूर्ति अद्यावधिकमा देखिन्छ। अनुमानित मिति योजना मात्र हो, सुनिश्चितता होइन। मौसम, सडक पहुँच, मौसमी माग, जीवित वा नाशवान वस्तु र विक्रेताको तयारीले समयलाई असर गर्न सक्छ।

## ग्राहकको उपलब्धता

पुष्टि भएको स्थानमा ग्राहक वा अधिकृत प्राप्तकर्ता उपलब्ध हुनुपर्छ। ग्राहकले दिएको विवरण अपूर्ण भए वा प्राप्तकर्ता उपलब्ध नभए थप डेलिभरी प्रयास, भण्डारण वा फिर्ता ढुवानीका लागि स्वीकृति र अतिरिक्त शुल्क लाग्न सक्छ।

## डेलिभरी जाँच

सम्भव भएसम्म चाँडै वस्तु, विकल्प, देखिने अवस्था र मात्रा जाँच गर्नुहोस्। अर्डर सहायता लिंकबाट समस्या अभिलेख गरी उपयोगी प्रमाण सुरक्षित राख्नुहोस्। अर्डर प्राप्त भएपछि मात्र अर्डर केन्द्रमा डेलिभरी पुष्टि गर्नुहोस्।

## ढिलाइ र असफल डेलिभरी

ट्र्याकिङ र डेलिभरी अद्यावधिक ग्राहक अर्डर केन्द्रमा देखिन्छ। उल्लेखनीय ढिलाइ भए khetE सहायता टोलीले विक्रेता, ढुवानीकर्ता र ग्राहक अभिलेख जाँच गरी उपलब्ध अर्को चरण बताउन सक्छ।
$policy$,
  'published',
  now()
),
(
  'payment',
  'Payment Policy',
  'भुक्तानी नीति',
  'How enabled payment methods, payment status, invoices and marketplace payouts are recorded.',
  'सक्रिय भुक्तानी माध्यम, भुक्तानी स्थिति, बीजक र बजार भुक्तानी कसरी अभिलेख गरिन्छ।',
  $policy$
## Enabled payment methods

Use only a payment method displayed during khetE checkout or in an authorised order update. A method that is not shown is not enabled for that order. Cash on delivery and online gateways may remain unavailable until khetE activates and verifies them.

## Payment status

Submitting an order does not by itself mean payment has been received. The order centre shows the recorded payment status. Keep any authorised reference or receipt until the order, delivery and return window are complete.

## Safe payment practice

- Do not send money to a personal account or link received outside the authorised khetE flow.
- Do not share passwords, one-time codes, PINs or complete card details with Support, sellers or professionals.
- Report a suspicious request through Support before paying.

## Prices, fees and adjustments

The confirmed order records item prices, quantities, discounts, delivery fees and total. Any later authorised adjustment should appear in the order history. Professional earnings and seller payouts are separate internal records and do not change the customer total without an order adjustment.

## Invoices

An order confirmation records the submitted transaction. A payment invoice is available only after Finance records payment as paid. A statutory tax invoice is issued only when the responsible registered business and required transaction conditions are confirmed.

## Payment problems and refunds

Use the Payment topic in Support and include the order reference, payment method, date and safe transaction reference. Approved refunds follow the Returns & Refunds Policy and the capabilities of the original enabled payment method.
$policy$,
  $policy$
## सक्रिय भुक्तानी माध्यम

khetE चेकआउट वा अधिकृत अर्डर अद्यावधिकमा देखाइएको माध्यमबाट मात्र भुक्तानी गर्नुहोस्। नदेखिएको माध्यम उक्त अर्डरका लागि सक्रिय छैन। khetE ले सक्रिय र प्रमाणित नगरेसम्म क्यास अन डेलिभरी वा अनलाइन गेटवे उपलब्ध नहुन सक्छ।

## भुक्तानी स्थिति

अर्डर पठाउँदैमा भुक्तानी प्राप्त भएको मानिँदैन। अर्डर केन्द्रमा अभिलेखित भुक्तानी स्थिति देखिन्छ। अर्डर, डेलिभरी र फिर्ता समय पूरा नभएसम्म अधिकृत सन्दर्भ वा रसिद सुरक्षित राख्नुहोस्।

## सुरक्षित भुक्तानी अभ्यास

- अधिकृत khetE प्रणालीबाहिर प्राप्त व्यक्तिगत खाता वा लिंकमा रकम नपठाउनुहोस्।
- पासवर्ड, एकपटक प्रयोग हुने कोड, PIN वा पूर्ण कार्ड विवरण सहायता टोली, विक्रेता वा पेशेवरलाई नदिनुहोस्।
- शंकास्पद अनुरोध पाए भुक्तानीअघि सहायता टोलीलाई जानकारी दिनुहोस्।

## मूल्य, शुल्क र समायोजन

पुष्टि भएको अर्डरमा वस्तुको मूल्य, मात्रा, छुट, डेलिभरी शुल्क र कुल रकम अभिलेख हुन्छ। पछिको अधिकृत समायोजन अर्डर इतिहासमा देखिनुपर्छ। पेशेवर आम्दानी र विक्रेता भुक्तानी छुट्टै आन्तरिक अभिलेख हुन् र अर्डर समायोजन बिना ग्राहकको कुल रकम परिवर्तन गर्दैनन्।

## बीजक

अर्डर पुष्टिले पठाइएको कारोबार अभिलेख गर्छ। Finance ले भुक्तानी “paid” अभिलेख गरेपछि मात्र भुक्तानी बीजक उपलब्ध हुन्छ। जिम्मेवार दर्ता व्यवसाय र आवश्यक कारोबार अवस्था पुष्टि भएपछि मात्र वैधानिक कर बीजक जारी हुन्छ।

## भुक्तानी समस्या र रकम फिर्ता

सहायतामा “Payment” विषय प्रयोग गरी अर्डर सन्दर्भ, भुक्तानी माध्यम, मिति र सुरक्षित कारोबार सन्दर्भ दिनुहोस्। स्वीकृत रकम फिर्ता “Returns & Refunds Policy” र मूल सक्रिय भुक्तानी माध्यमको क्षमताअनुसार हुन्छ।
$policy$,
  'published',
  now()
)
on conflict (policy_key) do nothing;
