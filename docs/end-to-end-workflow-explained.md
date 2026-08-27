# End-to-End System Workflow Explained

## Purpose of this document

I wanted to understand what actually happens behind the scenes when the system receives a customer enquiry and turns it into a lead, quotation, follow-up, and tracked conversation.

The workflow is:

> Customer enquiry arrives through WhatsApp or Gmail -> system reads and organizes it -> AI understands the request -> system asks for missing information -> customer and lead are recorded -> price is estimated -> employee approves the quotation -> quotation is sent -> follow-up is scheduled -> dashboard tracks the result.

This document explains that process in plain English, including the main technologies, API calls, data movement, controls, and failure handling.

## The simplest way to picture the system

The system has six main parts:

1. **Communication channels** - WhatsApp and Gmail, where customer messages arrive and replies are sent.
2. **Backend** - the central coordinator that decides what should happen next.
3. **AI service** - reads unstructured language and returns organized information or a draft response.
4. **Database and file storage** - stores customers, conversations, leads, jobs, quotations, attachments, and activity history.
5. **Employee dashboard** - lets staff review enquiries, edit quotations, approve replies, and see follow-ups.
6. **Background worker and scheduler** - handles work that should happen later or may need to be retried.

The backend is the most important part. It is the manager of the workflow. WhatsApp, Gmail, and the AI do not directly control the business process.

```text
WhatsApp ----\
              -> Backend -> Database -> Dashboard
Gmail -------/       |
                     +-> AI service
                     +-> Pricing and quotation logic
                     +-> Follow-up scheduler
                     +-> WhatsApp or Gmail reply
```

## An important distinction: AI work and normal software work

The AI should handle tasks where human language is messy, such as:

- understanding what the customer wants
- extracting names, dates, locations, vehicle details, or service details
- recognizing missing information
- suggesting a service category
- detecting likely urgency or buying intent
- drafting a reply or quotation description

Normal software should handle tasks that must be exact, such as:

- saving records
- checking whether a message was already processed
- calculating prices, discounts, taxes, and totals
- deciding which employee can approve a quote
- sending an approved message
- scheduling follow-ups
- recording delivery status
- enforcing permissions

This separation matters because an AI response is probabilistic. It can misunderstand a message. The database, pricing rules, and approval process need predictable behavior.

## Recommended first-version technology stack

This is a practical example, not the only possible stack.

> **What this project actually ended up using** (updated after building it): Next.js
> with shadcn/ui end to end (dashboard and backend together, not separate services),
> PostgreSQL via Prisma, hosted on Neon, deployed on Vercel. **Anthropic Claude**
> (tool-use for structured extraction), not OpenAI. Gmail only — WhatsApp was scoped
> but never built. No n8n — the workflow automation was written directly into the
> Next.js app instead of a separate no-code layer. Details below.

| Part | Suggested technology | What it does |
|---|---|---|
| Dashboard | React or Next.js with shadcn/ui | Employee-facing screens |
| Backend | Next.js server routes or a Node.js/TypeScript service | Runs the workflow and business rules |
| Database | PostgreSQL, commonly through Supabase | Stores structured business data |
| File storage | Supabase Storage or another object store | Stores quote PDFs and customer attachments |
| AI | OpenAI Responses API with Structured Outputs | Extracts fields, classifies requests, and drafts text |
| WhatsApp | Meta WhatsApp Cloud API | Receives and sends WhatsApp messages |
| Email | Gmail API | Reads and sends email |
| Workflow automation | n8n for the first pilot, or backend jobs later | Connects services and runs background steps |
| Queue and scheduling | A managed job queue or scheduled database jobs | Retries work and runs follow-ups later |
| PDF generation | Server-side HTML-to-PDF library | Produces the formal quotation document |
| Hosting | A managed web host plus managed database | Keeps the system available online |

For a validation prototype, n8n can visibly connect the steps and reduce development time. As the system becomes a product, important rules should move into the backend so they are tested, versioned, and easier to control.

> **What actually happened:** the no-code (n8n) validation phase above was planned but
> skipped — the AI intake logic was built directly into the Next.js app instead
> (`src/lib/actions/email-intake.ts`, `src/lib/gmail/`), reusing the same database and
> dashboard rather than a separate automation layer. The database is PostgreSQL via
> Prisma (hosted on Neon), not Supabase. The AI is Anthropic Claude, called with
> tool-use to get structured JSON back — not OpenAI's Structured Outputs, though the
> underlying idea (force the model to return a fixed shape) is the same. PDF
> generation uses `@react-pdf/renderer` (React components render to a PDF), which is a
> server-side HTML-to-PDF approach in spirit but React-specific rather than a generic
> HTML template. Hosting is Vercel for the app and Neon for the database. WhatsApp was
> never built — only Gmail.

## What an API is in this system

An API is a controlled way for two systems to exchange information.

For example, our system does not open WhatsApp and imitate a person clicking buttons. It sends a secure internet request to Meta's WhatsApp API. That request says, in effect:

> Send this approved message from this business number to this customer number.

The request contains structured data, normally JSON. JSON is simply labeled information that computers can exchange reliably.

```json
{
  "to": "+971500000000",
  "type": "text",
  "text": {
    "body": "Your quotation is ready."
  }
}
```

The real WhatsApp request also includes the WhatsApp product name, the correct Graph API version, a phone-number ID, and a secret access token. Secrets must stay on the server and must never be placed in the browser or dashboard code.

## Detailed workflow

### 1. A customer sends an enquiry

Example:

> Hi, I need an AC service for my two-bedroom apartment in JVC tomorrow. It is not cooling properly. Can you give me a price?

At this point the message belongs to WhatsApp or Gmail. Our system has not processed it yet.

### 2A. WhatsApp notifies the system

The business connects a WhatsApp Business Account and phone number to the Meta WhatsApp Cloud API.

Our backend exposes a secure public address called a **webhook**, for example:

```text
POST https://app.example.com/webhooks/whatsapp
```

A webhook is similar to a doorbell. Instead of our system repeatedly asking WhatsApp whether a new message has arrived, Meta calls this address when an event occurs.

The incoming notification includes information such as:

- WhatsApp Business Account
- business phone number ID
- customer phone number
- WhatsApp message ID
- time received
- message type
- text or reference to an attachment

WhatsApp can also send later webhooks showing that an outgoing message was sent, delivered, read, or failed.

> **What actually happened:** this section was never built. The project implemented
> Gmail intake only; WhatsApp stayed at the planning stage throughout.

### 2B. Gmail notifies the system

The business owner authorizes Gmail access using Google OAuth. OAuth is the screen where Google asks the user to approve specific access. The system receives tokens that let it perform only the approved actions. The user's Google password is never given to our application.

For near-real-time updates, the system registers a Gmail `watch`. Gmail publishes mailbox-change notifications through Google Cloud Pub/Sub, which then calls our backend.

The notification does not normally contain the whole email. It tells the backend that the mailbox changed and supplies a history position. The backend then calls Gmail to identify and retrieve the new message.

Typical Gmail calls are conceptually:

```text
POST /gmail/v1/users/me/watch
GET  /gmail/v1/users/me/history
GET  /gmail/v1/users/me/messages/{messageId}
POST /gmail/v1/users/me/messages/send
```

The Gmail watch expires and must be renewed. The system should also run a periodic check because push notifications can occasionally be delayed or missed.

> **What actually happened:** this whole section describes Gmail's *push* model
> (OAuth + `watch()` + Pub/Sub), which needs a Google Cloud project and a consent
> screen. That was never set up. Instead, the actual build reads Gmail over **IMAP**,
> using a Gmail **App Password** (a 16-character code from Google Account settings,
> not OAuth) — the same credential already used to *send* mail. There is no
> "notification" at all in the real system: it's a *pull*, not a push. Something has
> to ask Gmail "anything new?" — either a person clicking "Check Gmail now" in the
> dashboard, or (once actually deployed) a scheduled check every 15 minutes via
> Vercel's cron feature. Nothing calls the backend on its own the way this section
> describes. Simpler to set up, at the cost of not being instant — worth revisiting if
> real-time delivery ever matters more than setup simplicity.

### 3. The incoming message is verified and acknowledged

Before doing AI work, the backend performs basic safety checks:

- Did the request really come from the expected provider?
- Is the business account connected to a valid tenant in our system?
- Is this message ID already stored?
- Is the message type supported?
- Is the request small enough and safe to process?

The backend quickly returns a success response to the provider, then processes the heavier work in the background. This avoids the provider assuming the webhook failed and repeatedly sending the same event.

The unique external message ID is stored. This makes the operation **idempotent**, meaning that receiving the same notification twice does not create two leads or send two replies.

### 4. Both channels are converted into one internal format

WhatsApp and Gmail provide different data. The backend converts both into a common internal message shape.

```json
{
  "business_id": "business_123",
  "channel": "whatsapp",
  "external_message_id": "wamid_456",
  "sender": "+971500000000",
  "subject": null,
  "text": "I need an AC service in JVC tomorrow",
  "attachments": [],
  "received_at": "2026-08-25T10:15:00+04:00"
}
```

This normalization is valuable because the remaining workflow does not need separate logic for every channel. It works with a standard conversation record.

### 5. The customer and conversation are matched

The system searches the database for an existing customer using verified identifiers:

- normalized phone number for WhatsApp
- normalized email address for Gmail
- channel-specific customer ID when available

If a matching customer exists, the message is attached to that customer. If not, a provisional customer record is created.

A provisional record may contain only a phone number or email. The name, address, and other details can be added later. The system should not invent missing customer information.

The system also decides whether this message belongs to an existing open conversation or starts a new one. This prevents every reply from becoming a separate lead.

### 6. Attachments are prepared

If the customer sends a voice note, image, or document, the system first retrieves the file and stores it securely.

Depending on the file type:

- voice notes can be transcribed into text
- images can be inspected for visible information
- PDFs can have their text extracted
- unsupported or unclear files can be flagged for an employee

The original file remains linked to the conversation. AI-generated interpretations should be stored separately from the original evidence.

### 7. AI turns the message into structured information

The backend sends the message, limited relevant conversation history, and an extraction instruction to the AI API.

The request asks for a fixed structure rather than a paragraph. Conceptually, the required output could be:

```json
{
  "language": "en",
  "customer_name": null,
  "service_category": "air_conditioning",
  "service_problem": "AC not cooling",
  "location": "JVC",
  "property_type": "two-bedroom apartment",
  "preferred_date": "2026-08-26",
  "urgency": "high",
  "missing_fields": ["customer_name", "exact_address", "number_of_ac_units"],
  "confidence": 0.91
}
```

Structured Outputs uses a schema to constrain the shape and allowed values returned by the model. This makes the AI result easier for ordinary software to validate and store.

The AI should receive only the information needed for the current task. API keys, unrelated customer records, and internal secrets should never be placed in its prompt.

### 8. The backend validates the AI result

The system does not automatically trust the result because it came back in the correct format.

It checks:

- Is the service category in the business's allowed list?
- Is the date valid and not impossible?
- Does the quoted customer detail actually appear in the message or existing customer record?
- Is the confidence below the threshold for automation?
- Are required fields still missing?

Low-confidence or contradictory results are sent to an employee review queue.

### 9. Missing information is collected

Required fields are defined by business rules for each service category.

For example, an AC service might require:

- exact location
- type of property
- number of units
- description of the problem
- preferred visit date

The backend compares the extracted information against this list. It then asks the AI to draft one concise question covering the most important missing fields.

Example draft:

> Thanks. Could you share your name, exact building and apartment location, and how many AC units need inspection?

For the initial version, an employee can approve this draft. Later, low-risk information-gathering questions can be sent automatically if the business chooses that setting.

When the customer replies, the workflow runs again. The new information is merged into the existing lead; it does not create a new customer or lead.

### 10. The service is classified

Classification routes the enquiry to the correct process. A maintenance company might use categories such as:

- air conditioning
- plumbing
- electrical
- cleaning
- general maintenance
- unknown or manual review

The AI can suggest the category, but business rules decide what happens next. If the result is uncertain, the system uses `manual_review` instead of forcing a choice.

The category can determine:

- which team receives the lead
- which questions are required
- which price list applies
- which quotation template is used
- the expected follow-up timing

### 11. The customer and lead are recorded

The database is the system's permanent memory. A practical structure includes:

| Record | What it stores |
|---|---|
| Customer | Name, phone, email, language, consent and contact details |
| Conversation | Channel, status, assigned employee and last activity |
| Message | Original content, sender, timestamps and delivery status |
| Lead | Requested service, location, urgency, source and stage |
| Job | Confirmed work, assigned team, schedule and completion status |
| Quote | Line items, prices, version, approval status and expiry |
| Follow-up | Due time, reason, owner and completion status |
| Activity log | Who or what changed each record and when |

A **lead** is a possible piece of work. A **job** should normally be created only after the customer accepts, books, or otherwise confirms the work. Before confirmation, the system can create a draft job or job request, but it should be clearly marked as unconfirmed.

> **What actually happened:** there's no separate Job record. The Lead itself carries
> a stage instead — New, Qualified, Quote Sent, Scheduled, Won, or Lost — and moving a
> lead to "Scheduled" (with a booked time) or "Won" (service actually completed) is
> what stands in for a confirmed job here. Simpler than a second table, at the cost of
> not being a distinct concept if this ever needs to track work that isn't 1:1 with a
> single lead (e.g. multiple visits for one job).

### 12. The estimate and quotation are prepared

The AI should not invent prices. Prices come from approved business data, such as:

- service catalogue
- standard call-out fee
- labor rates
- material prices
- location or urgency surcharge rules
- discount permissions
- configured tax rules

The pricing engine selects applicable items and performs the calculation with normal code. The AI can convert the customer's description into a suggested list of items and write clear descriptions, but it cannot silently create or change official prices.

If the information is insufficient for a reliable fixed quote, the system should produce one of these instead:

- an estimated range
- an inspection fee
- a request for photos or additional details
- a site-visit requirement

Each quote has a version. If an employee changes the scope or price, the earlier version remains in the history.

Example calculation:

```text
Inspection and diagnosis       AED 150
Estimated service labor        AED 250
Configured tax                 calculated by system
Total                          calculated by system
```

The backend can then generate a branded PDF using an HTML quotation template. The PDF is saved in file storage and linked to the quote record.

### 13. An employee reviews and approves

The dashboard shows the employee:

- original customer message
- extracted information
- missing or uncertain fields
- suggested service category
- suggested quote line items
- prices and total
- draft customer message
- warnings or confidence indicators

The employee can edit, reject, or approve. Approval is recorded with the employee ID, time, quote version, and final content.

The send button should only become available when required information is complete and the quote is approved. Higher discounts or high-value quotations can require a manager's approval.

### 14. The approved quotation is sent

The system uses the same channel the customer used unless the employee chooses another approved channel.

For WhatsApp, the backend makes an authenticated request similar to:

```text
POST https://graph.facebook.com/{version}/{phone-number-id}/messages
Authorization: Bearer {server-side-token}
```

The request can send text, a document, or an approved message template. WhatsApp messages outside the permitted customer-service window generally require an approved template, so follow-up templates need to be prepared in advance.

For Gmail, the backend creates a properly formatted email and calls:

```text
POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
```

The email should remain in the same thread when replying to an existing enquiry. The quotation PDF can be attached, or the message can include a secure quotation link.

The provider returns an external message ID. The system stores it so later delivery events can be connected to the correct conversation and quote.

### 15. Delivery and customer response are tracked

For WhatsApp, webhook events can update the message from `queued` to `sent`, `delivered`, `read`, or `failed` depending on the available provider status.

For email, the system can reliably record that Gmail accepted the send request. Email open tracking is less reliable and should not be treated as proof that the customer read the quotation.

If sending fails, the background worker retries temporary failures. Permanent failures, such as an invalid destination, are shown to an employee instead of retrying forever.

### 16. A follow-up is scheduled

When the quote is sent, the backend creates a follow-up record, for example:

```json
{
  "lead_id": "lead_123",
  "due_at": "2026-08-27T10:00:00+04:00",
  "reason": "quotation_not_answered",
  "status": "pending",
  "assigned_to": "employee_8"
}
```

At the due time, a background worker checks whether the lead already replied, accepted, declined, or was closed.

If no response exists, the system creates a follow-up task and drafts a message. Depending on the business's settings, an employee approves it or the system sends an approved template automatically.

If a visit is agreed, the system can call Google Calendar's event creation API to add an appointment. Calendar creation should use a unique event ID or stored external ID to avoid duplicate appointments when a request is retried.

> **What actually happened:** this whole section — an automatic background worker
> that checks for unanswered quotes and nudges the customer — was never built. What
> does exist: when staff move a lead to "Scheduled," a dropdown shows only real open
> half-hour slots (checked against every other lead's booked time, business hours
> Monday–Friday 9–5) so nothing gets double-booked. That's stored only inside this
> app's own database — there's no Google Calendar integration, so the appointment
> won't show up in anyone's actual calendar app.

### 17. The dashboard updates

The dashboard reads from the database rather than asking every external service each time the page opens.

Useful views include:

- new enquiries requiring review
- enquiries waiting for customer information
- quotes waiting for employee approval
- quotes sent and awaiting response
- follow-ups due today or overdue
- accepted, declined, and lost leads
- conversations with failed messages

When a message or approval changes, the browser can receive a real-time update or refresh the relevant data. Every displayed number should be derived from stored records so the result can be audited.

## One complete example

> **What actually happened:** this walkthrough is the original WhatsApp-based plan,
> not what actually runs. The real equivalent is Gmail-based, has no automatic
> follow-up step (step 16 below) and no calendar step (step 18) — see the notes under
> "A follow-up is scheduled" above for what scheduling actually looks like today.

1. A customer sends a WhatsApp message at 10:15.
2. Meta calls the WhatsApp webhook with message ID `wamid_456`.
3. The backend verifies the event, saves the raw message, and acknowledges it.
4. The backend finds no matching phone number, so it creates a provisional customer.
5. The AI extracts AC service, JVC, tomorrow, two-bedroom apartment, and high urgency.
6. The rules detect that the exact address and number of AC units are missing.
7. The AI drafts a short clarification question.
8. An employee approves it and the backend sends it through WhatsApp.
9. The customer replies with the missing information.
10. The existing lead is updated.
11. The pricing engine selects the inspection and service items from the catalogue.
12. The AI writes a clear scope description, while normal code calculates the totals.
13. A quote PDF is generated and placed in the employee approval queue.
14. The employee changes one line item and approves version 2.
15. The backend sends the PDF and stores the WhatsApp message ID.
16. A follow-up is scheduled for the next day.
17. The dashboard moves the lead to `Quote sent`.
18. If the customer accepts, the lead becomes a confirmed job and an appointment can be created.

## The workflow states

The system should use explicit statuses so everyone knows what happens next.

```text
New enquiry
  -> Processing
  -> Waiting for customer information
  -> Ready for estimate
  -> Quote awaiting approval
  -> Quote approved
  -> Quote sent
  -> Follow-up due
  -> Accepted / Declined / Lost
  -> Confirmed job, if accepted
```

Not every enquiry will follow the happy path. Other useful states include `Needs manual review`, `Send failed`, `Duplicate`, `Spam`, and `Cancelled`.

## Data protection and business controls

The first version should include the following controls:

- encrypted connections for all API traffic
- secret tokens stored only in secure server settings
- minimum necessary Gmail and WhatsApp permissions
- separate business data for each customer company
- employee roles and access permissions

> **What actually happened:** the last two aren't built yet. The whole system
> currently runs for a single hardcoded business — there's no way to sign up a second
> company and keep its leads separate, and there are no employee accounts or logins at
> all, so there's nothing to have separate permissions for either. Fine for one pilot
> business testing it out; would need real work before a second company could use the
> same system safely.
- audit history for quote edits, approvals, and sends
- retention rules for messages and attachments
- backups and tested restoration
- deletion and correction process for customer data
- redaction of sensitive data before AI processing when possible
- human review for uncertain, high-value, or unusual enquiries

The business also needs a clear lawful basis and customer communication policy for storing contact details and sending follow-ups. The exact compliance requirements should be reviewed for the business, industry, and UAE data-handling arrangement before production use.

## Common failure cases and how the system responds

| Failure | Correct response |
|---|---|
| Same webhook arrives twice | Ignore the duplicate using the external message ID |
| AI cannot understand the enquiry | Send it to manual review |
| Required information is missing | Ask a focused clarification question |
| AI suggests a nonexistent service | Reject it during validation |
| Price catalogue has no matching item | Require employee pricing |
| Employee edits an approved quote | Create a new version and require approval again |
| WhatsApp or Gmail is temporarily unavailable | Retry through the background queue |
| Message permanently fails | Alert the assigned employee |
| Customer replies before scheduled follow-up | Cancel or suppress the follow-up |
| Worker runs the same job twice | Use idempotency checks to prevent duplicate sends |
| Gmail watch expires | Renew it automatically and run periodic reconciliation |

## What I would build for the first pilot

The pilot does not need every part described above.

The smallest useful version is:

1. Connect one channel, preferably the channel the pilot business uses most.
2. Capture and store incoming text messages.
3. Extract structured information with the AI.
4. Show missing fields and draft one reply.
5. Create or update the customer and lead.
6. Use a small, employee-maintained price list.
7. Generate a draft quotation.
8. Require employee approval before sending.
9. Create one follow-up task.
10. Show all leads and statuses in a simple dashboard.

For the earliest demonstration, the message can even be pasted into the system manually. This proves whether the extraction, quotation, and follow-up workflow is valuable before spending time on WhatsApp business verification and full Gmail integration.

## What should wait until later

- automatic sending without approval
- both WhatsApp and Gmail at the same time if one channel is enough for the pilot
- complex staff assignment and permissions
- custom-trained AI models
- advanced lead scoring
- many quotation templates
- deep CRM or accounting integrations
- automatic material purchasing
- complex analytics
- multi-branch and multi-country support

## How to explain the system to a non-technical person

> The system acts like a digital coordinator. WhatsApp or Gmail tells it when a customer has sent a message. It saves the original message, uses AI to turn the customer's wording into organized details, and checks which important details are missing. It can draft the next question and prepare a quotation using the company's real price list. An employee checks and approves the quotation before it is sent. The system then remembers when to follow up and keeps the whole conversation and lead status visible in one dashboard. The AI helps with reading and writing, while normal software controls prices, records, approvals, and sending.

## Official references

> **Note:** these are references for the originally recommended stack (OpenAI,
> WhatsApp, Google Calendar). The project actually used Anthropic Claude instead of
> OpenAI, and never built WhatsApp or Calendar integration — see Anthropic's own
> developer documentation for the equivalent of the OpenAI links below.

- [Meta's official WhatsApp Business Platform API collection](https://www.postman.com/meta/whatsapp-business-platform/overview/)
- [Meta WhatsApp webhook payload reference](https://www.postman.com/meta/whatsapp-business-platform/folder/tduohwq/webhook-payload-reference)
- [Meta WhatsApp messages reference](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages)
- [Gmail push notification guide](https://developers.google.com/workspace/gmail/api/guides/push)
- [Gmail API reference](https://developers.google.com/workspace/gmail/api/reference/rest)
- [Gmail server-side authorization guide](https://developers.google.com/workspace/gmail/api/auth/web-server)
- [OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI function calling guide](https://developers.openai.com/api/docs/guides/function-calling)
- [Google Calendar event creation guide](https://developers.google.com/workspace/calendar/api/guides/create-events)

## The Editing Phase

This part is just me keeping track of what actually happened while building this,
in plain language, not the technical version.

I started by trying to figure out what it would even take to read a customer's
WhatsApp or email and turn it into a lead automatically. My first instinct was to
keep it outside the actual app — use a no-code tool to connect Gmail, WhatsApp, and
the AI together without writing real code for it yet. But I changed my mind and
decided to build a small working demo directly inside the app instead, because I
wanted to actually see and click through something, not just have a plan on paper.

The first version of that demo was a page where I could paste in a fake customer
email and watch the AI read it, figure out what the person wanted, and create a lead
automatically. When I tried it, I noticed the Quotes section stayed empty. I changed
my mind about the AI generating the quote itself — I decided pricing should stay a
person's decision, since a "car making a noise" could mean a $50 fix or a $2,000 one,
and the AI shouldn't guess. Instead I had it just suggest a rough starting point for
the quote that a person still has to review and approve.

Once that worked, I wanted the pipeline stages to mean something closer to real life.
I changed "Won" from meaning "the customer said yes" to meaning "the car was actually
fixed and given back," and added a "Scheduled" step in between so there's a record of
when the appointment is, not just that one was agreed to.

Next I connected the app to a real Gmail account so it could actually send the quote
by email instead of pretending to. Testing that, I noticed sending a quote didn't
move the lead forward on its own — I had to keep manually dragging it to "Quote Sent."
I changed it so that the moment a quote is actually emailed, the lead moves itself,
since that's the real-world event the stage is supposed to represent anyway.

Then I ran into the same customer emailing a second time, and the app was creating a
whole new lead instead of recognizing them. I changed the matching so a returning
customer, identified by their email or phone, continues their existing lead instead
of duplicating it. That fix then exposed another problem — even after I matched the
lead correctly, the newly suggested quote items still weren't showing up. It turned
out I had told the app to only ever show AI-suggested items on leads that had zero
quotes yet, which made sense at first but broke as soon as a lead had already been
quoted once and then asked about something new. I changed that rule so a suggestion
shows up whenever there's a fresh one waiting, regardless of past quotes.

After that I moved from just simulating incoming email to actually reading a real
Gmail inbox. While I was in the middle of that, a completely separate piece of work
was happening at the same time — the database itself was being moved from a simple
local file to a real cloud database. I had to stop and make sure I wasn't stepping on
that before continuing.

Once real email reading was working, I found a lead had been created with the name
literally saved as "<UNKNOWN>." I changed how the app treats the AI's answer for a
person's name — before, if the AI didn't know the name, it would sometimes write the
word "unknown" instead of actually leaving it blank, and the app just accepted that
as if it were a real name. I fixed it to recognize that kind of placeholder text and
treat it the same as if nothing was given at all, and fixed the one lead that had
already been created wrong.

I then added the ability to actually approve and send the AI's drafted reply for
real, instead of it just sitting there as a note nobody could act on, and added a way
to mark notifications as read instead of them just piling up.

Testing quotes again, I found two more problems in the same feature: the quantity was
always stuck at 1 no matter what the customer asked for, and when a customer
clarified something vague they'd said earlier (like turning "I want a wheel change"
into "replace 2 rear tires"), the app kept both the old vague item and the new
specific one instead of realizing they were the same request. I changed the AI's
instructions to actually track quantity as its own number, and to look at what it had
already suggested before adding anything new, so a clarification replaces the old
guess instead of duplicating it. I made sure this fix wasn't just about tires — I
tested it against completely different kinds of requests (brake pads, oil changes, a
battery) to make sure the fix was general and not a special case I'd only checked
once.

I also replaced the free-text date field for scheduling an appointment with a proper
dropdown that only shows real, currently open time slots, instead of letting someone
pick a time that's already taken or outside business hours.

Last, I realized the AI was only ever looking at the newest message when deciding how
to respond, never the earlier parts of the conversation. That meant a short reply
like "sounds good, thanks" had nothing for the AI to make sense of, and I found it
could even get mistaken for spam and be silently ignored. I changed it so the AI
always sees the whole conversation so far, not just the latest line, and while fixing
that I noticed the app had never been saving the business's own sent replies as part
of the conversation either — only the customer's messages were being kept. I fixed
that too, so both sides of the conversation are actually remembered.
