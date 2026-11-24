BETWEEN THE PAGES — BETA WEBSITE + APP v2.4.1
Ready-to-upload production bundle, prepared 20 November 2026

Existing Netlify project: between-the-pages-reviews
New address: https://between-the-pages-reviews.netlify.app
Upload this ZIP to the EXISTING project, not Netlify Drop as a new project.

Site routes after publishing:
  /            Website homepage
  /beta/       Pilot tester application (Netlify Forms)
  /privacy/    Privacy page
  /thanks/     Thank-you page
  /app/        Existing Between the Pages v2.4.1 beta app
  /app/feedback.html     Feedback form (Netlify Forms)

Netlify Forms is enabled for the site. On first production deploy, Netlify should
register btp-beta-application and btp-feedback. Check project Forms and send
one real application to verify it works. Then (in Netlify Forms > Submission
notifications) set up email notifications to a confirmed / team email address.

IMPORTANT DATA NOTE:
The old domain resonant-mousse-acba4c.netlify.app has been renamed, so data
stored by that old origin is not automatically available at the new URL.
User confirms an existing JSON backup has been exported. After publishing, open
/app/ in Safari and restore the backup through Settings, then verify books,
reviews, ARC data, and logs before adding new work. Do not share the backup
or upload it to Netlify: keep it in private device or iCloud storage.

The app continues to use localStorage key btp_prototype_v1. Routes on the NEW
origin share browser storage. Safari and installed home-screen app may have
different storage contexts; confirm actual data after opening the new address.

All links, static pages, forms and JavaScript were checked without deployment.
A live website and real form-submission test are still needed after upload.
