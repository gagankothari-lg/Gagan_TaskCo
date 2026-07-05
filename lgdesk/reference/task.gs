// task.gs — Todos, Notes & Ideas stored per-user in Google Sheets via notes.gs.
// The previous per-user Google Tasks OAuth2 flow has been removed. All data is
// now stored in the Todos / Notes / Ideas sheets, keyed by Emp_ID. No OAuth
// consent screen or external API calls are required — works for every user
// immediately on first open.

var TASK_LIST_TODOS = 'Company-Todos';
var TASK_LIST_NOTES = 'Company-Notes';
var TASK_LIST_IDEAS = 'Company-Ideas';

// ── Conversion helpers (Sheets row → Google Tasks wire format) ─────────────────
// The frontend _taskToTodo / _taskToNote / _taskToIdea converters expect:
//   { id, title, status?, notes?, updated }
// We produce that shape here so the frontend needs no changes.

function _tTodoToTask(t) {
  return {
    id:      t['Todo_ID'],
    title:   t['Title']  || '',
    status:  (t['Done'] === true || String(t['Done']).toUpperCase() === 'TRUE') ? 'completed' : 'needsAction',
    updated: t['Updated_At'] || t['Created_At'] || ''
  };
}

function _tNoteToTask(n) {
  var color   = n['Color'] || '#ffffff';
  var content = n['Content'] || '';
  // Re-encode color using the same "__c__#RRGGBB\n" scheme the frontend _encodeColor uses.
  var notes   = (color && color !== '#ffffff') ? '__c__' + color + '\n' + content : content;
  return {
    id:      n['Note_ID'],
    title:   n['Title']  || '',
    notes:   notes,
    updated: n['Updated_At'] || n['Created_At'] || ''
  };
}

function _tIdeaToTask(i) {
  return {
    id:      i['Idea_ID'],
    title:   i['Title']  || '',
    notes:   'Status: ' + (i['Status'] || 'Open') + '\n\n' + (i['Content'] || ''),
    updated: i['Updated_At'] || i['Created_At'] || ''
  };
}

// Decode "__c__#RRGGBB\ncontent" produced by the frontend _encodeColor helper.
function _tDecodeNoteColor(raw) {
  var m = (raw || '').match(/^__c__(#[0-9a-fA-F]{6})\n([\s\S]*)$/);
  return m ? { color: m[1], text: m[2] } : { color: '#ffffff', text: raw || '' };
}

// Parse "Status: XXX\n\ncontent" format used for ideas.
function _tParseIdeaNotes(raw) {
  var m = (raw || '').match(/^Status:\s*(.+)\n\n([\s\S]*)$/);
  return m ? { status: m[1].trim(), content: m[2] } : { status: 'Open', content: raw || '' };
}

// ── Public server functions (called via google.script.run) ─────────────────────

// Always succeeds for any authenticated user.
function tasksEnsureLists(email) {
  try {
    getCurrentUser(email);
    return { ok: true, lists: {
      'Company-Todos': TASK_LIST_TODOS,
      'Company-Notes': TASK_LIST_NOTES,
      'Company-Ideas': TASK_LIST_IDEAS
    }};
  } catch(e) { return { ok: false, error: e.message }; }
}

function tasksListTasks(tasklistId, email) {
  try {
    if (tasklistId === TASK_LIST_TODOS) {
      var r = getTodos(email);
      if (!r.ok) return r;
      return { ok: true, tasks: r.todos.map(_tTodoToTask) };
    }
    if (tasklistId === TASK_LIST_NOTES) {
      var r = getNotes(email);
      if (!r.ok) return r;
      return { ok: true, tasks: r.notes.map(_tNoteToTask) };
    }
    if (tasklistId === TASK_LIST_IDEAS) {
      var r = getIdeas(email);
      if (!r.ok) return r;
      return { ok: true, tasks: r.ideas.map(_tIdeaToTask) };
    }
    return { ok: false, error: 'Unknown list: ' + tasklistId };
  } catch(e) { return { ok: false, error: e.message }; }
}

function tasksCreateTask(tasklistId, title, notes, email) {
  try {
    var user = getCurrentUser(email);
    var now  = _nowTs();

    if (tasklistId === TASK_LIST_TODOS) {
      var t = String(title || '').trim();
      if (!t) return { ok: false, error: 'Title required.' };
      var id = generateId('Todos', 'TD', 5);
      dbInsert('Todos', { Todo_ID: id, Emp_ID: user.empId, Title: t, Done: false, Created_At: now, Updated_At: now });
      return { ok: true, task: _tTodoToTask({ Todo_ID: id, Title: t, Done: false, Updated_At: now }) };
    }
    if (tasklistId === TASK_LIST_NOTES) {
      var decoded = _tDecodeNoteColor(notes);
      var id = generateId('Notes', 'NT', 5);
      dbInsert('Notes', { Note_ID: id, Emp_ID: user.empId, Title: String(title || ''), Content: decoded.text, Color: decoded.color, Pinned: false, Created_At: now, Updated_At: now });
      return { ok: true, task: _tNoteToTask({ Note_ID: id, Title: String(title || ''), Content: decoded.text, Color: decoded.color, Updated_At: now }) };
    }
    if (tasklistId === TASK_LIST_IDEAS) {
      var t = String(title || '').trim();
      if (!t) return { ok: false, error: 'Title required.' };
      var parsed = _tParseIdeaNotes(notes);
      var id = generateId('Ideas', 'ID', 5);
      dbInsert('Ideas', { Idea_ID: id, Emp_ID: user.empId, Title: t, Content: parsed.content, Status: 'Open', Created_At: now, Updated_At: now });
      return { ok: true, task: _tIdeaToTask({ Idea_ID: id, Title: t, Content: parsed.content, Status: 'Open', Updated_At: now }) };
    }
    return { ok: false, error: 'Unknown list: ' + tasklistId };
  } catch(e) { return { ok: false, error: e.message }; }
}

function tasksUpdateTask(tasklistId, taskId, title, notes, status, email) {
  try {
    var now = _nowTs();

    if (tasklistId === TASK_LIST_TODOS) {
      var updates = { Updated_At: now };
      if (title  !== undefined && title  !== null) updates.Title = String(title);
      if (status !== undefined && status !== null) updates.Done  = (status === 'completed');
      dbUpdate('Todos', 'Todo_ID', taskId, updates);
      return { ok: true, task: { id: taskId } };
    }
    if (tasklistId === TASK_LIST_NOTES) {
      var updates = { Updated_At: now };
      if (title !== undefined && title !== null) updates.Title = String(title);
      if (notes !== undefined && notes !== null) {
        var decoded = _tDecodeNoteColor(notes);
        updates.Content = decoded.text;
        updates.Color   = decoded.color;
      }
      dbUpdate('Notes', 'Note_ID', taskId, updates);
      // Echo back an equivalent task object so _taskToNote on the frontend reconstructs correctly.
      return { ok: true, task: {
        id:      taskId,
        title:   String(title !== undefined && title !== null ? title : ''),
        notes:   String(notes !== undefined && notes !== null ? notes : ''),
        updated: now
      }};
    }
    if (tasklistId === TASK_LIST_IDEAS) {
      var updates = { Updated_At: now };
      if (title !== undefined && title !== null) updates.Title = String(title);
      if (notes !== undefined && notes !== null) {
        var parsed = _tParseIdeaNotes(notes);
        updates.Content = parsed.content;
        updates.Status  = parsed.status;
      }
      if (status !== undefined && status !== null) updates.Status = status;
      dbUpdate('Ideas', 'Idea_ID', taskId, updates);
      return { ok: true, task: {
        id:      taskId,
        title:   String(title !== undefined && title !== null ? title : ''),
        notes:   String(notes !== undefined && notes !== null ? notes : ''),
        updated: now
      }};
    }
    return { ok: false, error: 'Unknown list: ' + tasklistId };
  } catch(e) { return { ok: false, error: e.message }; }
}

function tasksDeleteTask(tasklistId, taskId, email) {
  try {
    if (tasklistId === TASK_LIST_TODOS) return deleteTodo(taskId, email);
    if (tasklistId === TASK_LIST_NOTES) return deleteNote(taskId, email);
    if (tasklistId === TASK_LIST_IDEAS) return deleteIdea(taskId, email);
    return { ok: false, error: 'Unknown list: ' + tasklistId };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Stubs for the removed OAuth flow ──────────────────────────────────────────
// handleKeepCallback is still called from doGet in auth.gs when an old OAuth
// redirect URL is hit — keeping it as a no-op prevents a reference error.

function handleKeepCallback(e) { /* no-op — OAuth removed */ }

function tasksGetAuthUrl(email) {
  return { ok: false, error: 'OAuth not required — todos are stored in the workspace.' };
}

function tasksIsConnected(email) { return true; }

function tasksDisconnect(email) { return { ok: true }; }
