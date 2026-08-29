import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// See src/lib/db.ts for why this is here.
setDefaultResultOrder("ipv4first");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEMO_LEADS: Array<{
  name: string;
  email: string;
  company: string;
  stage: "NEW" | "QUALIFIED" | "QUOTE_SENT" | "WON" | "LOST";
  daysAgo: number;
  // Only present from QUALIFIED onward — vehicle details are required to
  // reach that stage (see updateLeadStage), so NEW/never-qualified LOST
  // leads correctly have none.
  vehicle?: { make: string; model: string; year: string };
}> = [
  { name: "Amara Chen", email: "amara@brightwood.co", company: "Brightwood Interiors", stage: "NEW", daysAgo: 1 },
  { name: "Diego Ramos", email: "diego@ramosauto.com", company: "Ramos Auto Detailing", stage: "NEW", daysAgo: 2 },
  { name: "Priya Nair", email: "priya@nairconsulting.com", company: "Nair Consulting", stage: "QUALIFIED", daysAgo: 4, vehicle: { make: "Honda", model: "Civic", year: "2020" } },
  { name: "Tom Whitfield", email: "tom@whitfieldbuild.co", company: "Whitfield Build Co.", stage: "QUALIFIED", daysAgo: 6, vehicle: { make: "Ford", model: "F-150", year: "2018" } },
  { name: "Sofia Marchetti", email: "sofia@marchettievents.com", company: "Marchetti Events", stage: "QUOTE_SENT", daysAgo: 8, vehicle: { make: "Toyota", model: "Camry", year: "2021" } },
  { name: "Liam O'Connor", email: "liam@oconnorlandscaping.com", company: "O'Connor Landscaping", stage: "QUOTE_SENT", daysAgo: 10, vehicle: { make: "Nissan", model: "Altima", year: "2019" } },
  { name: "Hana Suzuki", email: "hana@suzukidesign.jp", company: "Suzuki Design Studio", stage: "WON", daysAgo: 14, vehicle: { make: "Mazda", model: "CX-5", year: "2022" } },
  { name: "Marcus Bell", email: "marcus@bellrealty.com", company: "Bell Realty Group", stage: "WON", daysAgo: 20, vehicle: { make: "BMW", model: "3 Series", year: "2017" } },
  { name: "Elena Popescu", email: "elena@popescucatering.ro", company: "Popescu Catering", stage: "LOST", daysAgo: 18 },
];

const DEMO_CATALOG_ITEMS: Array<{ description: string; unitPriceDollars: number }> = [
  { description: "Oil change", unitPriceDollars: 65 },
  { description: "Front brake pad replacement", unitPriceDollars: 220 },
  { description: "Rear brake pad replacement", unitPriceDollars: 200 },
  { description: "Tire rotation", unitPriceDollars: 40 },
  { description: "Battery replacement", unitPriceDollars: 180 },
  { description: "Diagnostic inspection", unitPriceDollars: 95 },
];

async function main() {
  const business = await prisma.business.upsert({
    where: { id: "demo-business" },
    update: {},
    create: {
      id: "demo-business",
      name: "Demo Business",
      category: "AUTO_GARAGE",
      // Placeholder — swap for the real address once known (see report 25).
      address: "123 Industrial Area 3, Al Quoz, Dubai, UAE",
    },
  });

  // Delete-then-recreate keeps this safely re-runnable without needing a
  // uniqueness constraint on (businessId, description).
  await prisma.serviceCatalogItem.deleteMany({ where: { businessId: business.id } });
  await prisma.serviceCatalogItem.createMany({
    data: DEMO_CATALOG_ITEMS.map((item) => ({
      businessId: business.id,
      description: item.description,
      unitPrice: Math.round(item.unitPriceDollars * 100),
      category: "AUTO_GARAGE",
    })),
  });

  for (const demo of DEMO_LEADS) {
    const createdAt = new Date(Date.now() - demo.daysAgo * 24 * 60 * 60 * 1000);
    const lead = await prisma.lead.create({
      data: {
        businessId: business.id,
        name: demo.name,
        email: demo.email,
        company: demo.company,
        stage: demo.stage,
        source: "MANUAL",
        vehicleMake: demo.vehicle?.make ?? null,
        vehicleModel: demo.vehicle?.model ?? null,
        vehicleYear: demo.vehicle?.year ?? null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    await prisma.activity.create({
      data: {
        leadId: lead.id,
        type: "NOTE",
        note: "Lead created (seed data).",
        createdAt,
      },
    });

    if (demo.stage !== "NEW") {
      await prisma.activity.create({
        data: {
          leadId: lead.id,
          type: "STAGE_CHANGE",
          fromStage: "NEW",
          toStage: demo.stage,
          createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
        },
      });
    }
  }

  console.log(
    `Seeded business "${business.name}" with ${DEMO_LEADS.length} leads and ${DEMO_CATALOG_ITEMS.length} catalog items.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
