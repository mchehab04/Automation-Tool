import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-5";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type ExtractedSuggestedLineItem = {
  description: string;
  quantity: string;
  estimated_price: string;
};

export type ExtractedEnquiry = {
  is_enquiry: boolean;
  name: string;
  email: string;
  phone: string;
  company: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year: string;
  summary: string;
  draft_reply: string;
  acknowledgment_message: string;
  suggested_line_items: ExtractedSuggestedLineItem[];
};

const EXTRACT_TOOL = {
  name: "record_enquiry",
  description:
    "Record a structured extraction of a customer's message to an auto dealership/garage.",
  input_schema: {
    type: "object" as const,
    properties: {
      is_enquiry: {
        type: "boolean" as const,
        description:
          "True if this is a genuine sales/service enquiry from a customer, false for spam or irrelevant messages.",
      },
      name: { type: "string" as const, description: "Customer's name, empty string if unknown." },
      email: { type: "string" as const, description: "Customer's email address, empty string if unknown." },
      phone: { type: "string" as const, description: "Customer's phone number, empty string if unknown." },
      company: { type: "string" as const, description: "Customer's company, empty string if not applicable." },
      vehicle_make: { type: "string" as const, description: "Vehicle's make (e.g. \"Toyota\"), empty string if not mentioned." },
      vehicle_model: { type: "string" as const, description: "Vehicle's model (e.g. \"Camry\"), empty string if not mentioned." },
      vehicle_year: { type: "string" as const, description: "Vehicle's model year, digits only (e.g. \"2019\"), empty string if not mentioned." },
      summary: {
        type: "string" as const,
        description: "One or two sentence summary of what the customer wants.",
      },
      draft_reply: {
        type: "string" as const,
        description:
          "A short, friendly reply asking for whatever contact info is missing. Empty string if name and at least one of email/phone are already present.",
      },
      acknowledgment_message: {
        type: "string" as const,
        description:
          "Written as the ENTIRE message that will accompany the quote once one is prepared — references what the customer asked about, mentions a quote is attached or on its way, warm and short. No separate greeting/sign-off is appended afterward, so include it here. Populate this ONLY when draft_reply is empty (nothing is missing or unclear) — the two are mutually exclusive. Empty string if draft_reply is non-empty, or if is_enquiry is false.",
      },
      suggested_line_items: {
        type: "array" as const,
        description:
          "A rough starting point for a quote, based only on what the customer described (e.g. a diagnostic inspection for a described symptom). Empty array if there isn't enough to go on, or if is_enquiry is false. These are drafts a human reviews before any quote is sent — do not try to be precise about pricing. " +
          "If the message thread includes an \"Already drafted for this quote\" section, that reflects everything suggested so far — return the FULL corrected list, not just what's new: fold in what the latest message adds, replace or correct any item the latest message clarifies (e.g. a vague \"wheel change\" followed up with \"replace 2 rear tires\" is the SAME job, not two separate line items), and keep anything still relevant. Don't just append. " +
                "If the message thread includes this business's service price catalogue, prefer reusing an entry's exact description and price whenever the customer's request matches it. Adapt only the quantity; don't rewrite the wording or guess a different price for a catalogued item. Only invent a description/price for something genuinely not in the catalogue.",
        items: {
          type: "object" as const,
          properties: {
            description: {
              type: "string" as const,
              description:
                "Describe ONE unit of the item/service, generically, in singular form — never state a count in the words themselves. This applies to any kind of enquiry, not just parts that come in pairs: write \"Oil change\", \"Rear tire replacement\", \"Brake pad (front)\", \"Wiper blade\", \"Diagnostic inspection\" — never \"2 oil changes\", \"Replace 2 rear tires\", \"4 brake pads\", \"Pair of wiper blades\". The count belongs ONLY in the quantity field below, never duplicated into this text.",
            },
            quantity: {
              type: "string" as const,
              description: "How many of that single unit, digits only, e.g. \"2\". \"1\" if not specified or not applicable.",
            },
            estimated_price: {
              type: "string" as const,
              description:
                "Rough estimate in whole USD for ONE unit only (never the line total for all of them) — digits only, e.g. \"120\". If the customer or a stated price covers multiple units (e.g. \"$300 for both rear tires\"), divide by quantity first: quantity \"2\", this field \"150\" — not \"300\".",
            },
          },
          required: ["description", "quantity", "estimated_price"],
        },
      },
    },
    required: [
      "is_enquiry",
      "name",
      "email",
      "phone",
      "company",
      "vehicle_make",
      "vehicle_model",
      "vehicle_year",
      "summary",
      "draft_reply",
      "acknowledgment_message",
      "suggested_line_items",
    ],
  },
};

const SYSTEM_PROMPTS = {
  // The simulator only has whatever text staff pasted in — no real headers —
  // so it still needs the model to attempt extracting contact info from the
  // body, and a lead can't be logged until enough of that is present.
  simulated:
    "You triage inbound customer messages for an auto dealership/garage's sales pipeline. " +
    "Extract the customer's contact details, their vehicle's make/model/year if mentioned, " +
    "and what they need. A lead can only be logged " +
    "once you have a name and at least one way to reach them (email or phone) — if the " +
    "thread doesn't have those yet, draft a short, friendly reply asking for whatever is " +
    "missing. Once you have everything needed to log the lead, instead draft a short " +
    "acknowledgment_message that will accompany the quote (skip draft_reply in that case).",
  // Real intake always has a reliable sender address from the email headers,
  // so the model doesn't need to gate on contact info — just extract what it
  // can and describe what the customer needs.
  real:
    "You triage inbound customer emails for an auto dealership/garage's sales pipeline. " +
    "Extract the customer's name, their vehicle's make/model/year if mentioned, and what " +
    "they need. The sender's email address is already " +
    "known from the message headers, so don't worry about whether contact info is present — " +
    "focus on summarizing the request and, if anything about it is unclear, drafting a short, " +
    "friendly clarifying question. When nothing about the request is unclear, instead draft a " +
    "short acknowledgment_message that will accompany the quote email (skip draft_reply in " +
    "that case). If the message includes this business's service price " +
    "catalogue, ground your suggested line items in it wherever the customer's request " +
    "matches an entry.",
  // Same "contact info already known" framing as `real` — a WhatsApp
  // webhook payload always carries the sender's phone number — but with
  // WhatsApp-appropriate tone/length instead of email wording.
  whatsapp:
    "You triage inbound customer WhatsApp messages for an auto dealership/garage's sales pipeline. " +
    "Extract the customer's name, their vehicle's make/model/year if mentioned, and what they " +
    "need. The sender's phone number is already known from the WhatsApp message, so don't worry " +
    "about whether contact info is present — focus on summarizing the request and, if anything " +
    "about it is unclear, drafting a short, friendly clarifying question. Keep any drafted message " +
    "brief and conversational, the way people actually text — no email-style greeting or sign-off, " +
    "1-2 short sentences rather than a paragraph. When nothing about the request is unclear, " +
    "instead draft a short acknowledgment_message that will accompany the quote (skip draft_reply " +
    "in that case). If the message includes this business's service price catalogue, ground your " +
    "suggested line items in it wherever the customer's request matches an entry.",
  // A staff member is manually logging a lead whose contact info they already
  // typed into the form themselves — this mode only exists to turn their free-
  // text note into quote-suggestion grounding, not to triage a customer
  // message. is_enquiry/name/email/phone/company/draft_reply/
  // acknowledgment_message are unused by the caller here; return them empty
  // (is_enquiry true) rather than spend effort inferring them.
  manual:
    "A staff member at an auto dealership/garage is manually logging a new lead and wrote a " +
    "short note describing what the customer needs. Extract the vehicle's make/model/year if " +
    "mentioned, and suggest a rough starting point for a quote based on the note. Leave name, " +
    "email, phone, company, draft_reply, and acknowledgment_message empty — this isn't a " +
    "customer message being triaged, contact info was already entered separately. Set " +
    "is_enquiry to true unless the note is clearly unrelated to a service request (e.g. an " +
    "internal reminder with nothing about what the customer needs), in which case leave " +
    "suggested_line_items empty too. If the note includes this business's service price " +
    "catalogue, ground your suggested line items in it wherever the note matches an entry.",
} as const;

export type ExistingSuggestion = { description: string; quantity: string; unitPrice: string };

// Whole-dollar-string, matching ExistingSuggestion's convention — catalogue
// prices are stored in cents (ServiceCatalogItem.unitPrice) and converted at
// this boundary, not carried through the app in dollars anywhere else.
export type CatalogItem = { description: string; unitPrice: string };

export async function extractEnquiry(
  threadText: string,
  mode: keyof typeof SYSTEM_PROMPTS,
  existingSuggestions?: ExistingSuggestion[],
  catalogItems?: CatalogItem[],
): Promise<ExtractedEnquiry> {
  const existingSuggestionsBlock =
    existingSuggestions && existingSuggestions.length > 0
      ? `\n\nAlready drafted for this quote (from earlier messages):\n${existingSuggestions
          .map((item) => `- ${item.description} (qty ${item.quantity}, ~$${item.unitPrice} each)`)
          .join("\n")}`
      : "";

  const catalogBlock =
    catalogItems && catalogItems.length > 0
      ? `\n\nThis business's service price catalogue (use these exact descriptions and prices when a customer's request matches one, rather than inventing your own wording/price — but if what they're asking about isn't in this list, describe and estimate it yourself as usual, since not every job is catalogued):\n${catalogItems
          .map((item) => `- ${item.description} — $${item.unitPrice}`)
          .join("\n")}`
      : "";

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPTS[mode],
    messages: [
      {
        role: "user",
        content: `Message thread:\n\n${threadText}${existingSuggestionsBlock}${catalogBlock}`,
      },
    ],
    tools: [EXTRACT_TOOL],
    tool_choice: { type: "tool", name: "record_enquiry" },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI didn't return a structured result.");
  }

  return toolUse.input as ExtractedEnquiry;
}
