import cron from 'node-cron';

/**
 * NOT IMPLEMENTED — placeholder for live ECI ingestion (see src/index.ts).
 * Nothing calls this; the cron callback does not scrape anything.
 */
export function setupScheduler(): void {
  // Example: run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('Scheduled scrape task triggered');
    // TODO: invoke scraper adapters and persistence logic here
  });

  console.log('Scheduler initialized');
}
