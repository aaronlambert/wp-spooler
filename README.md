# WP Theme Spooler UI

A local Express utility for creating new WordPress/Divi child-theme site copies from the `wp-theme-spool` template folder.

## Run

From the parent directory that contains `wp-theme-spool`:

```bash
npm install
npm start
```

Then open `http://localhost:3030`.

## What it does

- Creates a new site folder by copying `wp-theme-spool`.
- Excludes `node_modules`, `.git`, cache folders, and OS junk files while copying.
- Renames `_themename-divi-child` to your chosen theme slug.
- Updates child theme `style.css` header values.
- Replaces known placeholders in safe text files.

## Notes

- The app runs against the current working directory (`process.cwd()`).
- Destination folder must not already exist.
