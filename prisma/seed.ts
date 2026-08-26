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
}> = [
  { name: "Amara Chen", email: "amara@brightwood.co", company: "Brightwood Interiors", stage: "NEW", daysAgo: 1 },
  { name: "Diego Ramos", email: "diego@ramosauto.com", company: "Ramos Auto Detailing", stage: "NEW", daysAgo: 2 },
  { name: "Priya Nair", email: "priya@nairconsulting.com", company: "Nair Consulting", stage: "QUALIFIED", daysAgo: 4 },
  { name: "Tom Whitfield", email: "tom@whitfieldbuild.co", company: "Whitfield Build Co.", stage: "QUALIFIED", daysAgo: 6 },
  { name: "Sofia Marchetti", email: "sofia@marchettievents.com", company: "Marchetti Events", stage: "QUOTE_SENT", daysAgo: 8 },
  { name: "Liam O'Connor", email: "liam@oconnorlandscaping.com", company: "O'Connor Landscaping", stage: "QUOTE_SENT", daysAgo: 10 },
  { name: "Hana Suzuki", email: "hana@suzukidesign.jp", company: "Suzuki Design Studio", stage: "WON", daysAgo: 14 },
  { name: "Marcus Bell", email: "marcus@bellrealty.com", company: "Bell Realty Group", stage: "WON", daysAgo: 20 },
  { name: "Elena Popescu", email: "elena@popescucatering.ro", company: "Popescu Catering", stage: "LOST", daysAgo: 18 },
];

async function main() {
  const business = await prisma.business.upsert({
    where: { id: "demo-business" },
    update: {},
    create: { id: "demo-business", name: "Demo Business" },
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

  console.log(`Seeded business "${business.name}" with ${DEMO_LEADS.length} leads.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
