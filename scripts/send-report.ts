/**
 * Standalone script to email the latest HTML report (ContractTestDemo pattern).
 * Usage: SMTP_USER=... SMTP_PASS=... npm run send-report
 */
import { sendReportEmail } from '../src/reporting/sendReportEmail';

const isCi = Boolean(process.env.CI || process.env.BUILD_BUILDID);

sendReportEmail({ force: true })
  .then((result) => {
    if (result.sent) return;
    if (isCi) {
      console.warn('Report email was not sent. Pipeline will continue.');
      return;
    }
    process.exit(1);
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(isCi ? 0 : 1);
  });
