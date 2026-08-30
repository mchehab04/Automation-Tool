"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { MAX_LENGTHS, parseForgivingNumber } from "@/lib/validation";

const DEMO_BUSINESS_ID = "demo-business";

function revalidateSettings() {
  revalidatePath("/settings");
  // Business name/address and the catalogue feed the quote PDF and AI
  // extraction elsewhere in the app — broad invalidation matches the pattern
  // already used by quotes.ts/leads.ts for cross-cutting data like this.
  revalidatePath("/", "layout");
}

export async function updateBusinessDetails(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_LENGTHS.businessName);
  const address = String(formData.get("address") ?? "").trim().slice(0, MAX_LENGTHS.businessAddress);

  if (!name) {
    throw new Error("Business name is required.");
  }

  await prisma.business.update({
    where: { id: DEMO_BUSINESS_ID },
    data: { name, address: address || null },
  });

  revalidateSettings();
}

function parseCatalogItemForm(formData: FormData) {
  const description = String(formData.get("description") ?? "")
    .trim()
    .slice(0, MAX_LENGTHS.quoteDescription);
  const unitPriceDollars = parseForgivingNumber(String(formData.get("unitPrice") ?? "0"));

  if (!description) {
    throw new Error("Description is required.");
  }
  if (unitPriceDollars < 0) {
    throw new Error("Price can't be negative.");
  }

  return { description, unitPrice: Math.round(unitPriceDollars * 100) };
}

export async function createCatalogItem(formData: FormData) {
  const { description, unitPrice } = parseCatalogItemForm(formData);

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: DEMO_BUSINESS_ID },
    select: { category: true },
  });

  await prisma.serviceCatalogItem.create({
    data: {
      businessId: DEMO_BUSINESS_ID,
      description,
      unitPrice,
      // Matches the business's own category — a catalogue item is 1:1 scoped
      // to one business, so it always shares that business's vertical (see
      // report 20's decision on what this field means).
      category: business.category,
    },
  });

  revalidateSettings();
}

export async function updateCatalogItem(itemId: string, formData: FormData) {
  const { description, unitPrice } = parseCatalogItemForm(formData);

  await prisma.serviceCatalogItem.update({
    where: { id: itemId, businessId: DEMO_BUSINESS_ID },
    data: { description, unitPrice },
  });

  revalidateSettings();
}

export async function deleteCatalogItem(itemId: string) {
  await prisma.serviceCatalogItem.delete({
    where: { id: itemId, businessId: DEMO_BUSINESS_ID },
  });

  revalidateSettings();
}
