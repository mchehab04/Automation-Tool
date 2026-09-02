"use client";

import { LineItemsForm, type SeedLineItem } from "@/components/leads/line-items-form";
import { createQuote } from "@/lib/actions/quotes";

export type SuggestedLineItem = SeedLineItem;

export function QuoteForm({
  leadId,
  suggestedLineItems,
}: {
  leadId: string;
  suggestedLineItems?: SuggestedLineItem[];
}) {
  const hasSuggestions = Boolean(suggestedLineItems && suggestedLineItems.length > 0);

  return (
    <LineItemsForm
      action={createQuote.bind(null, leadId)}
      seedLineItems={suggestedLineItems}
      hint={hasSuggestions ? "AI-suggested from the enquiry — review before generating." : undefined}
      submitLabel="Generate quote"
    />
  );
}
