// notes.gs — Personal Todos & Notes, Team Ideas (Google Keep-style)
// Run initNotesSheets() ONCE from Apps Script editor to create the required sheets.

function initNotesSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = {
    'Todos': ['Todo_ID','Emp_ID','Title','Done','Created_At','Updated_At'],
    'Notes': ['Note_ID','Emp_ID','Title','Content','Color','Pinned','Created_At','Updated_At'],
    'Ideas': ['Idea_ID','Emp_ID','Title','Content','Status','Created_At','Updated_At']
  };
  Object.keys(config).forEach(function(name) {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name).appendRow(config[name]);
      Logger.log('Created sheet: ' + name);
    }
  });
  Logger.log('initNotesSheets complete.');
}

function _safeDbGetAll(sheet) {
  try { return dbGetAll(sheet); } catch(e) { return []; }
}

// ── Todos ──────────────────────────────────────────────────────────────────────

function getTodos(email) {
  try {
    var user = getCurrentUser(email);
    var todos = _safeDbGetAll('Todos')
      .filter(function(t) { return t['Emp_ID'] === user.empId; })
      .sort(function(a, b) {
        var da = String(a['Done']).toUpperCase(), db = String(b['Done']).toUpperCase();
        if (da !== db) return da === 'TRUE' ? 1 : -1;
        return String(b['Created_At']).localeCompare(String(a['Created_At']));
      });
    return { ok: true, todos: todos };
  } catch(e) { return { ok: false, error: e.message }; }
}

function saveTodo(record, email) {
  try {
    var user = getCurrentUser(email);
    var now = _nowTs();
    if (record.Todo_ID) {
      var updates = { Updated_At: now };
      if (record.Title !== undefined) updates.Title = record.Title;
      if (record.Done  !== undefined) updates.Done  = !!record.Done;
      dbUpdate('Todos', 'Todo_ID', record.Todo_ID, updates);
    } else {
      if (!record.Title || !String(record.Title).trim()) return { ok: false, error: 'Title required.' };
      var id = generateId('Todos', 'TD', 5);
      dbInsert('Todos', {
        Todo_ID: id, Emp_ID: user.empId,
        Title: String(record.Title).trim(), Done: false,
        Created_At: now, Updated_At: now
      });
    }
    return getTodos(email);
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteTodo(todoId, email) {
  try {
    var user = getCurrentUser(email);
    var todo = _safeDbGetAll('Todos').find(function(t) { return t['Todo_ID'] === todoId; });
    if (!todo || todo['Emp_ID'] !== user.empId) throw new Error('Not found.');
    dbDeleteRow('Todos', 'Todo_ID', todoId);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Notes ──────────────────────────────────────────────────────────────────────

function getNotes(email) {
  try {
    var user = getCurrentUser(email);
    var notes = _safeDbGetAll('Notes')
      .filter(function(n) { return n['Emp_ID'] === user.empId; })
      .sort(function(a, b) {
        var pa = String(a['Pinned']).toUpperCase(), pb = String(b['Pinned']).toUpperCase();
        if (pa !== pb) return pa === 'TRUE' ? -1 : 1;
        return String(b['Updated_At']).localeCompare(String(a['Updated_At']));
      });
    return { ok: true, notes: notes };
  } catch(e) { return { ok: false, error: e.message }; }
}

function saveNote(record, email) {
  try {
    var user = getCurrentUser(email);
    var now = _nowTs();
    if (record.Note_ID) {
      var note = _safeDbGetAll('Notes').find(function(n) { return n['Note_ID'] === record.Note_ID; });
      if (!note || note['Emp_ID'] !== user.empId) throw new Error('Not found.');
      var updates = { Updated_At: now };
      if (record.Title   !== undefined) updates.Title   = record.Title;
      if (record.Content !== undefined) updates.Content = record.Content;
      if (record.Color   !== undefined) updates.Color   = record.Color;
      if (record.Pinned  !== undefined) updates.Pinned  = !!record.Pinned;
      dbUpdate('Notes', 'Note_ID', record.Note_ID, updates);
    } else {
      var id = generateId('Notes', 'NT', 5);
      dbInsert('Notes', {
        Note_ID: id, Emp_ID: user.empId,
        Title: record.Title || '', Content: record.Content || '',
        Color: record.Color || '#ffffff', Pinned: false,
        Created_At: now, Updated_At: now
      });
    }
    return getNotes(email);
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteNote(noteId, email) {
  try {
    var user = getCurrentUser(email);
    var note = _safeDbGetAll('Notes').find(function(n) { return n['Note_ID'] === noteId; });
    if (!note || note['Emp_ID'] !== user.empId) throw new Error('Not found.');
    dbDeleteRow('Notes', 'Note_ID', noteId);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Ideas ──────────────────────────────────────────────────────────────────────

function getIdeas(email) {
  try {
    getCurrentUser(email);
    var empMap = {};
    dbGetAll('Employees').forEach(function(e) {
      empMap[e['Emp_ID']] = ((e['First_Name']||'') + ' ' + (e['Last_Name']||'')).trim() || e['Email'];
    });
    var ideas = _safeDbGetAll('Ideas')
      .sort(function(a, b) { return String(b['Created_At']).localeCompare(String(a['Created_At'])); })
      .map(function(i) { return Object.assign({}, i, { Author_Name: empMap[i['Emp_ID']] || i['Emp_ID'] }); });
    return { ok: true, ideas: ideas };
  } catch(e) { return { ok: false, error: e.message }; }
}

function saveIdea(record, email) {
  try {
    var user = getCurrentUser(email);
    var now = _nowTs();
    if (record.Idea_ID) {
      var idea = _safeDbGetAll('Ideas').find(function(i) { return i['Idea_ID'] === record.Idea_ID; });
      if (!idea) throw new Error('Not found.');
      if (idea['Emp_ID'] !== user.empId && !_isAdmin(user.role)) throw new Error('Not authorized.');
      var updates = { Updated_At: now };
      if (record.Title   !== undefined) updates.Title   = record.Title;
      if (record.Content !== undefined) updates.Content = record.Content;
      if (record.Status  !== undefined) updates.Status  = record.Status;
      dbUpdate('Ideas', 'Idea_ID', record.Idea_ID, updates);
    } else {
      if (!record.Title || !String(record.Title).trim()) return { ok: false, error: 'Title required.' };
      var id = generateId('Ideas', 'ID', 5);
      dbInsert('Ideas', {
        Idea_ID: id, Emp_ID: user.empId,
        Title: String(record.Title).trim(), Content: record.Content || '',
        Status: 'Open', Created_At: now, Updated_At: now
      });
    }
    return getIdeas(email);
  } catch(e) { return { ok: false, error: e.message }; }
}

function deleteIdea(ideaId, email) {
  try {
    var user = getCurrentUser(email);
    var idea = _safeDbGetAll('Ideas').find(function(i) { return i['Idea_ID'] === ideaId; });
    if (!idea) throw new Error('Not found.');
    if (idea['Emp_ID'] !== user.empId && !_isAdmin(user.role)) throw new Error('Not authorized.');
    dbDeleteRow('Ideas', 'Idea_ID', ideaId);
    return { ok: true };
  } catch(e) { return { ok: false, error: e.message }; }
}
