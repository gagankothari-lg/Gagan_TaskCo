// attachments.gs — Image & Audio attachments for Projects, Tasks and Sub-tasks
// Files are stored in the user's deployment Drive (DriveApp) under a shared folder.
// Metadata is persisted in an "Attachments" sheet in the main spreadsheet.
// Uses the existing "drive" OAuth scope already declared in appsscript.json.

// ── Drive folder ─────────────────────────────────────────────────────────────
function _getAttachmentsFolder() {
  var sp       = _sp();
  var folderId = sp.getProperty('ATTACHMENTS_FOLDER_ID');
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch(e) {}
  }
  var folder = DriveApp.createFolder('TaskMgmt_Attachments');
  sp.setProperty('ATTACHMENTS_FOLDER_ID', folder.getId());
  return folder;
}

// ── Sheet bootstrap ──────────────────────────────────────────────────────────
function _ensureAttachmentsSheet() {
  var ss    = SpreadsheetApp.openById('1gesH_uB8GOTifSgIQbYSLjQLMChjgMmBhtErdQE7F8A');
  var sheet = ss.getSheetByName('Attachments');
  if (!sheet) {
    sheet = ss.insertSheet('Attachments');
    var headers = [
      'Attachment_ID','Entity_Type','Entity_ID',
      'File_Type','Drive_File_ID','File_Name','MIME_Type','File_Size',
      'Uploaded_By','Uploaded_At','Is_Active'
    ];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ── Upload ───────────────────────────────────────────────────────────────────
// entityType : 'Project' | 'Task' | 'SubTask'
// base64Data : raw base64 string (no data-URI prefix)
// Returns    : { ok, id, driveFileId, viewUrl, downloadUrl }
function uploadAttachment(entityType, entityId, fileName, mimeType, base64Data, email) {
  try {
    var user = getCurrentUser(email);
    if (!user || !user.emp) return { ok: false, error: 'Not authorized.' };

    // Decode and upload to Drive
    var bytes  = Utilities.base64Decode(base64Data);
    var blob   = Utilities.newBlob(bytes, mimeType, fileName);
    var folder = _getAttachmentsFolder();
    var file   = folder.createFile(blob);
    // Make file readable by anyone with the link so the thumbnail/audio loads in the browser
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileId      = file.getId();
    var viewUrl     = 'https://drive.google.com/uc?export=view&id='     + fileId;
    var downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;

    // Classify
    var fileType = 'file';
    if (mimeType.indexOf('image/') === 0) fileType = 'image';
    else if (mimeType.indexOf('audio/') === 0) fileType = 'audio';

    // Persist metadata
    _ensureAttachmentsSheet();
    var id = generateId('Attachments', 'ATT', 4);
    dbInsert('Attachments', {
      Attachment_ID: id,
      Entity_Type:   entityType,
      Entity_ID:     entityId,
      File_Type:     fileType,
      Drive_File_ID: fileId,
      File_Name:     fileName,
      MIME_Type:     mimeType,
      File_Size:     bytes.length,
      Uploaded_By:   user.empId,
      Uploaded_At:   _nowTs(),
      Is_Active:     'TRUE'
    });

    _audit(email, 'ATTACH_UPLOAD', entityType, entityId, '', id + ':' + fileName);
    return { ok: true, id: id, driveFileId: fileId, viewUrl: viewUrl, downloadUrl: downloadUrl, fileType: fileType, fileName: fileName };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── List attachments for an entity ───────────────────────────────────────────
function getAttachments(entityType, entityId, email) {
  try {
    var user = getCurrentUser(email);
    if (!user) return { ok: false, error: 'Not authorized.', attachments: [] };
    _ensureAttachmentsSheet();
    var records = dbGetAll('Attachments').filter(function(r) {
      return r['Entity_Type'] === entityType &&
             r['Entity_ID']   === entityId   &&
             String(r['Is_Active']).toUpperCase() === 'TRUE';
    }).map(function(r) {
      var fid = r['Drive_File_ID'] || '';
      return {
        id:          r['Attachment_ID'],
        fileType:    r['File_Type']    || 'file',
        fileName:    r['File_Name']    || '',
        mimeType:    r['MIME_Type']    || '',
        fileSize:    parseInt(r['File_Size']) || 0,
        driveFileId: fid,
        viewUrl:     fid ? 'https://drive.google.com/uc?export=view&id='     + fid : '',
        downloadUrl: fid ? 'https://drive.google.com/uc?export=download&id=' + fid : '',
        uploadedBy:  r['Uploaded_By']  || '',
        uploadedAt:  r['Uploaded_At']  || ''
      };
    });
    return { ok: true, attachments: records };
  } catch(e) { return { ok: false, error: e.message, attachments: [] }; }
}

// ── Delete attachment ─────────────────────────────────────────────────────────
// ── Batch attachment counts (for list-view badges) ───────────────────────────
// Returns { ok, counts } where counts = { entityId: number }
function getAllAttachmentCounts(email) {
  try {
    var user = getCurrentUser(email);
    if (!user) return { ok: false, counts: {} };
    _ensureAttachmentsSheet();
    var counts = {};
    dbGetAll('Attachments').filter(function(r) {
      return String(r['Is_Active']).toUpperCase() === 'TRUE';
    }).forEach(function(r) {
      var id = r['Entity_ID'] || '';
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return { ok: true, counts: counts };
  } catch(e) { return { ok: false, counts: {} }; }
}

// ── Delete attachment ─────────────────────────────────────────────────────────
function deleteAttachment(attachmentId, email) {
  try {
    var user = getCurrentUser(email);
    if (!user) return { ok: false, error: 'Not authorized.' };
    _ensureAttachmentsSheet();
    var records = dbGetAll('Attachments');
    var rec     = records.find(function(r) { return r['Attachment_ID'] === attachmentId; });
    if (!rec) return { ok: false, error: 'Attachment not found.' };
    if (rec['Uploaded_By'] !== user.empId && !_isAdmin(user.role))
      return { ok: false, error: 'Only the uploader or an admin can delete this attachment.' };
    // Trash the Drive file (non-destructive)
    try { DriveApp.getFileById(rec['Drive_File_ID']).setTrashed(true); } catch(e) {}
    dbUpdate('Attachments', 'Attachment_ID', attachmentId, { Is_Active: 'FALSE' });
    _audit(email, 'ATTACH_DELETE', rec['Entity_Type'], rec['Entity_ID'], attachmentId, '');
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}
