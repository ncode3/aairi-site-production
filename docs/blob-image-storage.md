# Azure Blob Image Storage Strategy

AARI keeps website code small and stores public media in Azure Blob Storage.

## Source of truth

Keep these in the website repo:

- HTML
- CSS
- JavaScript
- Critical local brand assets:
  - `images/header-logo.png`
  - `images/header-logo-mobile.png`
  - favicon references

Store these in Blob Storage:

- event photos
- cohort photos
- sponsor and partner images
- large banners
- student project images
- historical/media archive files

Do not delete local image files immediately after upload. Keep them until the Blob URLs have been verified in production and the next deploy is stable.

## Production image path

Storage account:

```text
staariwebsiteprod001
```

Container:

```text
website-assets
```

Folder/prefix:

```text
images/
```

Public URL pattern:

```text
https://staariwebsiteprod001.blob.core.windows.net/website-assets/images/<filename>
```

For nested folders, preserve the repo path:

```text
images/aari-action/aari-cohort-microsoft-atlanta.jpg
```

becomes:

```text
https://staariwebsiteprod001.blob.core.windows.net/website-assets/images/aari-action/aari-cohort-microsoft-atlanta.jpg
```

## Create or confirm the container

Enable public blob access on the storage account:

```bash
az storage account update \
  --resource-group rg-aari-website-prod \
  --name staariwebsiteprod001 \
  --allow-blob-public-access true
```

Create the container with blob-level anonymous read:

```bash
az storage container create \
  --account-name staariwebsiteprod001 \
  --name website-assets \
  --public-access blob \
  --auth-mode login
```

Confirm the account and container:

```bash
az storage account show \
  --resource-group rg-aari-website-prod \
  --name staariwebsiteprod001 \
  --query "{name:name, allowBlobPublicAccess:allowBlobPublicAccess, sku:sku.name}" \
  -o table

az storage container show \
  --account-name staariwebsiteprod001 \
  --name website-assets \
  --auth-mode login \
  --query "{name:name, publicAccess:properties.publicAccess}" \
  -o table
```

## Upload images

Upload the current repo image folder while preserving the `images/` prefix:

```bash
az storage blob upload-batch \
  --account-name staariwebsiteprod001 \
  --destination website-assets \
  --source images \
  --destination-path images \
  --auth-mode login \
  --overwrite true \
  --content-cache-control "public, max-age=31536000, immutable"
```

If the local Azure CLI storage command fails, use Azure Portal Storage Browser:

1. Azure Portal -> Storage accounts
2. Open `staariwebsiteprod001`
3. Storage browser -> Blob containers
4. Open `website-assets`
5. Upload files under the `images/` prefix
6. Set `Cache-Control` on versioned files to `public, max-age=31536000, immutable`

## Cache-control guidance

Use long cache headers for versioned or rarely changed images:

```text
public, max-age=31536000, immutable
```

Use shorter cache headers for images likely to change without renaming:

```text
public, max-age=3600
```

Best practice: rename changed images instead of overwriting them. Example:

```text
aari-cohort-microsoft-atlanta-2026-05.jpg
```

Then use the long immutable cache header.

Set cache-control on a single blob:

```bash
az storage blob update \
  --account-name staariwebsiteprod001 \
  --container-name website-assets \
  --name images/aari-action/aari-cohort-microsoft-atlanta.jpg \
  --content-cache-control "public, max-age=31536000, immutable" \
  --auth-mode login
```

## List uploaded images

```bash
az storage blob list \
  --account-name staariwebsiteprod001 \
  --container-name website-assets \
  --prefix images/ \
  --auth-mode login \
  --query "[].{name:name, contentType:properties.contentSettings.contentType, cacheControl:properties.contentSettings.cacheControl}" \
  -o table
```

## Verify URLs

Check that an uploaded image is public and cacheable:

```bash
curl -I -L \
  https://staariwebsiteprod001.blob.core.windows.net/website-assets/images/aari-action/aari-cohort-microsoft-atlanta.jpg
```

Expected:

- `HTTP/1.1 200 OK`
- `Content-Type: image/jpeg`, `image/png`, `image/webp`, or `image/svg+xml`
- `Cache-Control: public, max-age=31536000, immutable` for versioned images

## Website reference rules

Use Blob URLs for media:

```html
<img
  src="https://staariwebsiteprod001.blob.core.windows.net/website-assets/images/aari-action/aari-cohort-microsoft-atlanta.jpg"
  alt="AARI student cohort at Microsoft Atlanta"
  loading="lazy"
>
```

Keep the header logo local:

```html
<source media="(max-width: 767px)" srcset="images/header-logo-mobile.png">
<img src="images/header-logo.png" alt="AARI logo">
```

## Security notes

The `website-assets` container is public because the website loads these images directly in browsers. Do not upload private student records, unpublished grant files, internal documents, credentials, or sensitive media to this container.

For private or embargoed media, use a private container and a time-limited SAS URL or a future authenticated media workflow.

## CDN guidance

Do not add Azure CDN or Front Door by default. Blob Storage direct delivery is enough for the current site.

Add CDN later only if one of these is true:

- traffic volume justifies edge caching
- image delivery latency becomes a measured problem
- AARI needs custom media-domain routing
- AARI intentionally accepts the added monthly cost

If CDN is added later, prefer the cheapest fit and document the monthly base cost before deployment.
