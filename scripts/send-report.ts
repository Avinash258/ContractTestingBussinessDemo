import { sendReportEmail } from '../src/reporting/sendReportEmail';

sendReportEmail().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
