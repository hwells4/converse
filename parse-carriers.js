// Parse the JSON data and create a TypeScript script
import fs from 'fs';

// The JSON data from the file
const jsonData = '[{"data":"[{\\"name\\":\\"Neptune\\",\\"id\\":\\"a04am000005OG42AAG\\"},{\\"name\\":\\"SageSure\\",\\"id\\":\\"a04am000005OG43AAG\\"},{\\"name\\":\\"NAUTILUS INSURANCE COMPANY\\",\\"id\\":\\"a04am000005OG45AAG\\"},{\\"name\\":\\"USLI\\",\\"id\\":\\"a04am000005OG49AAG\\"},{\\"name\\":\\"PENN AMERICA INS\\",\\"id\\":\\"a04am000005OG4DAAW\\"},{\\"name\\":\\"Bristol West\\",\\"id\\":\\"a04am000005OG4EAAW\\"},{\\"name\\":\\"CRC GROUP\\",\\"id\\":\\"a04am000005OG4JAAW\\"},{\\"name\\":\\"Kinsale Insurance\\",\\"id\\":\\"a04am000005OG4KAAW\\"},{\\"name\\":\\"Encompass Insurance\\",\\"id\\":\\"a04am000005OG4SAAW\\"},{\\"name\\":\\"Texas Windstorm Insurance Association\\",\\"id\\":\\"a04am000005OG4cAAG\\"},{\\"name\\":\\"Liberty Mutual\\",\\"id\\":\\"a04am000005OG4pAAG\\"},{\\"name\\":\\"Travelers\\",\\"id\\":\\"a04am000005OG4uAAG\\"},{\\"name\\":\\"Safeco Insurance\\",\\"id\\":\\"a04am000005OG4vAAG\\"},{\\"name\\":\\"Guard Insurance\\",\\"id\\":\\"a04am000005OG52AAG\\"},{\\"name\\":\\"ASI (American Strategic Insurance)\\",\\"id\\":\\"a04am000005OG53AAG\\"},{\\"name\\":\\"Texas Mutual\\",\\"id\\":\\"a04am000005OG54AAG\\"},{\\"name\\":\\"Progressive Insurance\\",\\"id\\":\\"a04am000005OG56AAG\\"},{\\"name\\":\\"Cypress Texas Insurance Company\\",\\"id\\":\\"a04am000005OG58AAG\\"},{\\"name\\":\\"Homeowners of America\\",\\"id\\":\\"a04am000005OG5EAAW\\"},{\\"name\\":\\"National General\\",\\"id\\":\\"a04am000005OG5HAAW\\"},{\\"name\\":\\"Foremost Insurance\\",\\"id\\":\\"a04am000005OG5NAAW\\"},{\\"name\\":\\"State Auto Insurance\\",\\"id\\":\\"a04am000005OG5QAAW\\"},{\\"name\\":\\"Coterie Insurance\\",\\"id\\":\\"a04am000005OTqwAAG\\"},{\\"name\\":\\"Nationwide Brokerage Solutions\\",\\"id\\":\\"a04am000005OTrIAAW\\"},{\\"name\\":\\"Travelers Select\\",\\"id\\":\\"a04am000005OTrMAAW\\"},{\\"name\\":\\"Lemonade Insurance\\",\\"id\\":\\"a04am000005OTrSAAW\\"},{\\"name\\":\\"Branch Insurance\\",\\"id\\":\\"a04am000005OTrTAAW\\"},{\\"name\\":\\"Attune Insurance\\",\\"id\\":\\"a04am000005OTrVAAW\\"},{\\"name\\":\\"PersonalUmbrella.com\\",\\"id\\":\\"a04am000005OTreAAG\\"},{\\"name\\":\\"Jewelers Mutual Insurance\\",\\"id\\":\\"a04am000005OTrjAAG\\"},{\\"name\\":\\"Reinsure Insurance\\",\\"id\\":\\"a04am000005OTrwAAG\\"},{\\"name\\":\\"Coterie Insurance\\",\\"id\\":\\"a04am000005OTrxAAG\\"},{\\"name\\":\\"Surechoice by Sagesure\\",\\"id\\":\\"a04am000005OTs0AAG\\"},{\\"name\\":\\"SafePort Insurance Company\\",\\"id\\":\\"a04am000005OTs2AAG\\"},{\\"name\\":\\"FED NAT by Sagesure\\",\\"id\\":\\"a04am000005OTs4AAG\\"},{\\"name\\":\\"Spinnaker Insurance Company by Hippo\\",\\"id\\":\\"a04am000005OTs6AAG\\"},{\\"name\\":\\"BiBERK Insurance\\",\\"id\\":\\"a04am000005OTs8AAG\\"},{\\"name\\":\\"Next First\\",\\"id\\":\\"a04am000005OTsBAAW\\"},{\\"name\\":\\"MICHIGAN BASIC PROPERTY INSURANCE ASSOCIATION\\",\\"id\\":\\"a04am000005OTsVAAW\\"},{\\"name\\":\\"RSG Ryan Specialty Group\\",\\"id\\":\\"a04am000005OTsYAAW\\"},{\\"name\\":\\"Texas Windstorm\\",\\"id\\":\\"a04am000005OTsaAAG\\"},{\\"name\\":\\"ReInsurePro\\",\\"id\\":\\"a04am000005OTsiAAG\\"},{\\"name\\":\\"Pouch Insurance\\",\\"id\\":\\"a04am000005OTsrAAG\\"},{\\"name\\":\\"Westchester Insurance\\",\\"id\\":\\"a04am000005OTssAAG\\"},{\\"name\\":\\"Pathpoint Insurance\\",\\"id\\":\\"a04am000005OTstAAG\\"},{\\"name\\":\\"The General\\",\\"id\\":\\"a04am000005OTsuAAG\\"},{\\"name\\":\\"Foremost Agent 360\\",\\"id\\":\\"a04am000005OTsxAAG\\"},{\\"name\\":\\"Personal Umbrella\\",\\"id\\":\\"a04am000005OTt3AAG\\"},{\\"name\\":\\"Encompass (Amwins)\\",\\"id\\":\\"a04am000005OTt5AAG\\"},{\\"name\\":\\"Safeco (Amwins)\\",\\"id\\":\\"a04am000005OTt6AAG\\"},{\\"name\\":\\"Steadily Insurance\\",\\"id\\":\\"a04am000005OTtFAAW\\"},{\\"name\\":\\"Scottsdale Insurance Company\\",\\"id\\":\\"a04am000005OTtJAAW\\"},{\\"name\\":\\"LLOYDS OF LONDON\\",\\"id\\":\\"a04am000005OTtMAAW\\"},{\\"name\\":\\"AmGUARD INSURANCE COMPANY\\",\\"id\\":\\"a04am000005OTtQAAW\\"},{\\"name\\":\\"Wellington\\",\\"id\\":\\"a04am000005OTtRAAW\\"},{\\"name\\":\\"Allstate Insurance\\",\\"id\\":\\"a04am000005OTtTAAW\\"},{\\"name\\":\\"FOREMOST STAR\\",\\"id\\":\\"a04am000005OTtXAAW\\"},{\\"name\\":\\"MESA UNDERWRITERS\\",\\"id\\":\\"a04am000005OTtZAAW\\"},{\\"name\\":\\"Nationwide Insurance\\",\\"id\\":\\"a04am000005OTtbAAG\\"},{\\"name\\":\\"Markel Insurance Company\\",\\"id\\":\\"a04am000005OTtcAAG\\"},{\\"name\\":\\"HISCOX INSURANCE COMPANY\\",\\"id\\":\\"a04am000005OTteAAG\\"},{\\"name\\":\\"Hagerty INSURANCE AGENCY INC\\",\\"id\\":\\"a04am000005OTthAAG\\"},{\\"name\\":\\"RPS\\",\\"id\\":\\"a04am000005OTtjAAG\\"},{\\"name\\":\\"Mercury Insurance\\",\\"id\\":\\"a04am000005OTtoAAG\\"},{\\"name\\":\\"American Modern\\",\\"id\\":\\"a04am000005OTtpAAG\\"},{\\"name\\":\\"Hippo Insurance\\",\\"id\\":\\"a04am000005OTtsAAG\\"},{\\"name\\":\\"Swyfft Insurance\\",\\"id\\":\\"a04am000005OTtxAAG\\"},{\\"name\\":\\"Chubb Group\\",\\"id\\":\\"a04am000005OTu9AAG\\"},{\\"name\\":\\"US Assure\\",\\"id\\":\\"a04am000005OTuTAAW\\"},{\\"name\\":\\"Hartford\\",\\"id\\":\\"a04am000005OTuVAAW\\"},{\\"name\\":\\"WESTERN WORLD INSURANCE COMPANY\\",\\"id\\":\\"a04am000005OTuXAAW\\"},{\\"name\\":\\"Wright Flood\\",\\"id\\":\\"a04am000005OTusAAG\\"},{\\"name\\":\\"Germania Insurance\\",\\"id\\":\\"a04am000005OTuzAAG\\"},{\\"name\\":\\"Texas Fair Plan\\",\\"id\\":\\"a04am000005OTv2AAG\\"},{\\"name\\":\\"NFIP\\",\\"id\\":\\"a04am000005OTv6AAG\\"},{\\"name\\":\\"Clearcover\\",\\"id\\":\\"a04am000005OTvDAAW\\"},{\\"name\\":\\"RT Specialty\\",\\"id\\":\\"a04am000005OTvYAAW\\"},{\\"name\\":\\"Next Insurance\\",\\"id\\":\\"a04am000005OTvZAAW\\"},{\\"name\\":\\"Geico Insurance\\",\\"id\\":\\"a04am000005OTxTAAW\\"},{\\"name\\":\\"Starr Surplus Lines Insurance Company\\",\\"id\\":\\"a04am000005OTxUAAW\\"},{\\"name\\":\\"Travelers Commercial Service Direct\\",\\"id\\":\\"a04am000007WaQvAAK\\"},{\\"name\\":\\"USAssure\\",\\"id\\":\\"a04am000008A5wHAAS\\"}]"}]';

try {
  // Parse the outer JSON
  const parsed = JSON.parse(jsonData);
  
  // Parse the inner JSON string
  const carriersData = JSON.parse(parsed[0].data);
  
  console.log(`Found ${carriersData.length} carriers`);
  
  // Create TypeScript content
  const tsContent = `import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { carriers } from "./shared/schema";

const carriersData = ${JSON.stringify(carriersData, null, 2)};

async function addCarriers() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const client = postgres(process.env.DATABASE_URL);
  const db = drizzle(client);

  try {
    console.log(\`Preparing to insert \${carriersData.length} carriers...\`);

    // Insert new carriers
    let addedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const carrier of carriersData) {
      try {
        const result = await db.insert(carriers).values({
          name: carrier.name,
          salesforceId: carrier.id
        }).returning();
        console.log(\`✓ Added: \${carrier.name} (\${carrier.id})\`);
        addedCount++;
      } catch (error: any) {
        if (error.message.includes('unique')) {
          console.log(\`⚠ Skipped: \${carrier.name} (\${carrier.id}) - already exists\`);
          skippedCount++;
        } else {
          console.error(\`✗ Failed to add: \${carrier.name} - \${error.message}\`);
          errorCount++;
        }
      }
    }

    console.log(\`\\nCarriers addition completed!\`);
    console.log(\`Added: \${addedCount}\`);
    console.log(\`Skipped: \${skippedCount}\`);
    console.log(\`Errors: \${errorCount}\`);
    
    // Show final count
    const finalCarriers = await db.select().from(carriers);
    console.log(\`Total carriers in database: \${finalCarriers.length}\`);

  } catch (error) {
    console.error('Error adding carriers:', error);
  } finally {
    await client.end();
  }
}

// Run the script
addCarriers().catch(console.error);`;

  // Write the TypeScript file
  fs.writeFileSync('add-carriers-from-json.ts', tsContent);
  console.log('Created add-carriers-from-json.ts');
  
  // Also output the carriers for verification
  carriersData.forEach((carrier, index) => {
    console.log(`${index + 1}. ${carrier.name} - ${carrier.id}`);
  });
  
} catch (error) {
  console.error('Error parsing JSON:', error);
}