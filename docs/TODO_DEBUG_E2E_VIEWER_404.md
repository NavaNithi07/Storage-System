# TODO_DEBUG_E2E_VIEWER_404

## Step 1: Add backend debug logs
- [ ] Instrument `backend/controllers/fileController.js` inside `downloadFile` with required logs:
  - Requested file ID
  - MongoDB lookup result (found/not)
  - File metadata found (filename, category, fileUrl, fileType, size)
  - Storage URL found/final signed URL
  - Route matched (confirmed via route log in routes)
  - Response code from storage
  - Storage access result (remoteRes status + streaming end/error)
- [ ] Add a route-level console log in `backend/routes/fileRoutes.js` for `GET /download/:id`.

## Step 2: Add minimal frontend debug logs
- [ ] Update `frontend/src/pages/DocumentViewer.jsx` to log:
  - params.id
  - file._id
  - download URL being requested
  - response status code for PDF/docx/xlsx fetches

## Step 3: Reproduce
- [ ] Start backend, open the failing viewer link, capture console logs from both FE and BE.

## Step 4: Permanent fix (based on logs)
- [ ] If DB record missing: fix upload metadata persistence in `uploadFileByCategory`.
- [ ] If storage URL missing/broken: fix how `fileUrl` is generated/stored and how `downloadFile` derives/signes it.
- [ ] If route/controller mismatch: fix route registration or param handling.

## Step 5: Fallback to guarantee visibility
- [ ] If preview rendering fails, open the actual download endpoint (`/files/download/:id`) in a new tab.
- [ ] Ensure this fallback never leaves user on a white screen.

