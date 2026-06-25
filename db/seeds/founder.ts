import { setFounderByEmail } from "@/lib/services/subscriptions/repository";

async function main() {
  const email = process.env.FOUNDER_EMAIL;
  if (!email) {
    throw new Error("FOUNDER_EMAIL environment variable is not set");
  }
  console.log(`Setting is_founder=true for: ${email}`);
  await setFounderByEmail(email);
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
