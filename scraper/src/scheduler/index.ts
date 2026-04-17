import cron from 'node-cron';

/**
 * Set up scheduled scraping tasks using node-cron.
 * Placeholder — configure cron expressions and task callbacks as needed.
 */
export function setupScheduler(): void {
  // Example: run every 15 minutes
  cron.schedule('*/15 * * * *', () => {
    console.log('Scheduled scrape task triggered');
    // TODO: invoke scraper adapters and persistence logic here
  });

  console.log('Scheduler initialized');
}
