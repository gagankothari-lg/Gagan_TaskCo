// chat.gs — Google Chat App: natural-language task + work-log commands.
//
// Supported commands (message the bot or @mention it in a space):
//
//   task: <title> [@assignee] [#project] [by <date>] [priority: low|medium|high|critical]
//   log:  <Xh> <what you did> [blocked: <text>] [tomorrow: <plan>]
//   tasks          — list your open tasks
//   help           — show this guide

// ── Entry point ───────────────────────────────────────────────────────────────

function onMessage(event) {
  // argumentText strips the @bot mention; fall back to full text
  var raw    = ((event.message.argumentText || event.message.text) || '').trim();
  var sender = event.message.sender.email;
  var lower  = raw.toLowerCase();

  try {
    if (!raw || lower === 'help')                       return _chatHelp();
    if (lower === 'tasks' || lower === 'my tasks')      return _chatListTasks(sender);
    if (/^(task|t)\s*:/i.test(raw))                     return _chatNewTask(raw, sender);
    if (/^(log|wlog|worklog)\s*:/i.test(raw))           return _chatNewWorkLog(raw, sender);
    return _chatCard('Unknown command', 'Type *help* to see available commands.');
  } catch (e) {
    return _chatCard('Error', e.message);
  }
}

// ── Task creation ─────────────────────────────────────────────────────────────
// Examples:
//   task: Update API docs @Gagan by Friday #backend priority: high
//   t: Fix login bug priority: critical

function _chatNewTask(raw, senderEmail) {
  var text = raw.replace(/^(task|t)\s*:\s*/i, '').trim();

  var priority  = _extract(text, /\bpriority\s*:\s*(\w+)/i)              || 'Medium';
  var assigneeQ = _extract(text, /@([\w.]+)/);
  var projectQ  = _extract(text, /#([\w_-]+)/);
  var dueStr    = _extract(text, /\bby\s+(.+?)(?=\s+[@#]|\s+priority\s*:|\s*$)/i);

  // Strip all tokens to get clean title
  var title = text
    .replace(/\bpriority\s*:\s*\w+/gi, '')
    .replace(/@[\w.]+/g, '')
    .replace(/#[\w_-]+/g, '')
    .replace(/\bby\s+.+?(?=\s+[@#]|\s+priority\s*:|\s*$)/gi, '')
    .replace(/\s{2,}/g, ' ').trim();

  if (!title) {
    return _chatCard('Missing title',
      'Usage: `task: <title> [@assignee] [#project] [by <date>] [priority: high]`');
  }

  var employees = dbGetAll('Employees').filter(function(e) {
    return String(e['Is_Active']).toUpperCase() === 'TRUE';
  });
  var sender = _findByEmail(senderEmail, employees);
  if (!sender) return _chatCard('Not registered',
    'Your email (' + senderEmail + ') is not in the system.');

  var assignee  = assigneeQ ? _resolveEmployee(assigneeQ, employees) : sender;
  var project   = projectQ  ? _resolveProject(projectQ)              : null;
  var dueDate   = dueStr    ? _parseDate(dueStr)                     : '';
  var pri       = _normaliseP(priority);

  var taskId = generateId('Tasks', 'TSK', 4);
  var now    = new Date().toISOString();
  dbInsert('Tasks', {
    Task_ID:         taskId,
    Proj_ID:         project ? project['Proj_ID'] : '',
    SubFn_ID:        '',
    Title:           title,
    Description:     '',
    Assignee_ID:     assignee ? assignee['Emp_ID'] : '',
    Assigner_ID:     sender['Emp_ID'],
    Status:          'Backlog',
    Priority:        pri,
    Due_Date:        dueDate,
    Estimated_Hours: '',
    Actual_Hours:    '',
    Created_At:      now,
    Updated_At:      now
  });

  var lines = ['*' + title + '*'];
  if (assignee)  lines.push('👤 ' + _empName(assignee));
  if (project)   lines.push('📁 ' + project['Name']);
  if (dueDate)   lines.push('📅 ' + dueDate);
  lines.push('🔖 ' + pri + '  ·  Backlog');
  return _chatCard('Task created — ' + taskId, lines.join('\n'));
}

// ── Work log ──────────────────────────────────────────────────────────────────
// Examples:
//   log: 3h Updated API docs and fixed broken links. blocked: staging down. tomorrow: write tests
//   wlog: 2.5h Reviewed 4 PRs

function _chatNewWorkLog(raw, senderEmail) {
  var text = raw.replace(/^(log|wlog|worklog)\s*:\s*/i, '').trim();

  var hours    = _extract(text, /^(\d+(?:\.\d+)?)\s*h/i)                              || '';
  var blocked  = _extract(text, /\bblocked\s*:\s*(.+?)(?=\s+tomorrow\s*:|\s*$)/i)     || '';
  var tomorrow = _extract(text, /\btomorrow\s*:\s*(.+?)$/i)                            || '';
  var desc = text
    .replace(/^\d+(?:\.\d+)?\s*h\s*/i, '')
    .replace(/\bblocked\s*:.+?(?=\s+tomorrow\s*:|\s*$)/gi, '')
    .replace(/\btomorrow\s*:.+$/gi, '')
    .replace(/\s{2,}/g, ' ').trim();

  if (!desc && !hours) {
    return _chatCard('Missing details',
      'Usage: `log: 2h <what you did> [blocked: <text>] [tomorrow: <plan>]`');
  }

  var employees = dbGetAll('Employees').filter(function(e) {
    return String(e['Is_Active']).toUpperCase() === 'TRUE';
  });
  var sender = _findByEmail(senderEmail, employees);
  if (!sender) return _chatCard('Not registered',
    'Your email (' + senderEmail + ') is not in the system.');

  var logId = generateId('Work_Log', 'LOG', 4);
  var today = new Date().toISOString().substring(0, 10);
  dbInsert('Work_Log', {
    Log_ID:        logId,
    Emp_ID:        sender['Emp_ID'],
    Date:          today,
    Tasks_Worked:  '',
    Description:   desc,
    Hours_Total:   hours ? parseFloat(hours) : '',
    Blockers:      blocked,
    Plan_Tomorrow: tomorrow,
    Created_At:    new Date().toISOString()
  });

  var lines = [desc || '(no description)'];
  if (hours)    lines.push('⏱ ' + hours + 'h logged');
  if (blocked)  lines.push('🚧 Blocked: ' + blocked);
  if (tomorrow) lines.push('📌 Tomorrow: ' + tomorrow);
  return _chatCard('Work log saved — ' + today, lines.join('\n'));
}

// ── List tasks ────────────────────────────────────────────────────────────────

function _chatListTasks(senderEmail) {
  var employees = dbGetAll('Employees');
  var sender    = _findByEmail(senderEmail, employees);
  if (!sender) return _chatCard('Not registered', 'Your email is not in the system.');

  var tasks = dbGetAll('Tasks').filter(function(t) {
    return t['Assignee_ID'] === sender['Emp_ID'] &&
           t['Status'] !== 'Done' && t['Status'] !== 'Cancelled';
  });

  if (!tasks.length) return _chatCard('Your tasks', 'No open tasks — you\'re all clear!');

  var lines = tasks.slice(0, 10).map(function(t) {
    var due = t['Due_Date'] ? '  📅 ' + String(t['Due_Date']).substring(0, 10) : '';
    return '• [' + t['Status'] + '] *' + t['Title'] + '*' + due;
  });
  if (tasks.length > 10) lines.push('_...and ' + (tasks.length - 10) + ' more_');
  return _chatCard('Your open tasks (' + tasks.length + ')', lines.join('\n'));
}

// ── Help ──────────────────────────────────────────────────────────────────────

function _chatHelp() {
  var body = [
    '*Create a task*',
    '`task: <title> [@assignee] [#project] [by <date>] [priority: high]`',
    '',
    '*Log your work*',
    '`log: 2h <what you did> [blocked: <text>] [tomorrow: <plan>]`',
    '',
    '*List your open tasks*',
    '`tasks`',
    '',
    '*Priority values*',  '`low`  `medium`  `high`  `critical` (or `urgent`)',
    '',
    '*Date examples*',
    '`by today`  `by tomorrow`  `by friday`  `by 20 jun`'
  ].join('\n');
  return _chatCard('Task Management Bot — commands', body);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function _extract(text, re) {
  var m = text.match(re);
  return m ? m[1].trim() : null;
}

function _findByEmail(email, employees) {
  var e = email.toLowerCase();
  return employees.find(function(emp) {
    return (emp['Email'] || '').toLowerCase() === e;
  }) || null;
}

function _resolveEmployee(query, employees) {
  var q = query.toLowerCase();
  return employees.find(function(e) {
    return _empName(e).toLowerCase().indexOf(q) !== -1 ||
           (e['Email'] || '').toLowerCase().startsWith(q);
  }) || null;
}

function _resolveProject(slug) {
  var q = slug.toLowerCase().replace(/_/g, ' ');
  return dbGetAll('Projects').find(function(p) {
    var name = (p['Name'] || '').toLowerCase();
    return name.replace(/\s+/g, '') === q.replace(/\s+/g, '') ||
           name.indexOf(q) !== -1;
  }) || null;
}

function _normaliseP(p) {
  var map = {
    critical: 'Critical', urgent: 'Critical',
    high:     'High',
    medium:   'Medium',   med: 'Medium',
    low:      'Low'
  };
  return map[(p || '').toLowerCase()] || 'Medium';
}

// Parses human-friendly date strings into YYYY-MM-DD
function _parseDate(str) {
  var s   = str.trim().toLowerCase();
  var now = new Date();
  var d;

  if      (s === 'today')     { d = new Date(now); }
  else if (s === 'tomorrow')  { d = new Date(now); d.setDate(d.getDate() + 1); }
  else if (s === 'yesterday') { d = new Date(now); d.setDate(d.getDate() - 1); }
  else {
    var days = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
    // short forms
    var shorts = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };
    var day = days[s] !== undefined ? days[s] : (shorts[s.substring(0,3)] !== undefined ? shorts[s.substring(0,3)] : -1);
    if (day !== -1) {
      d = new Date(now);
      var diff = (day - d.getDay() + 7) % 7 || 7; // always future
      d.setDate(d.getDate() + diff);
    } else {
      // Try "20 jun", "jun 20", "20/06", standard ISO, etc.
      d = new Date(str);
      if (isNaN(d.getTime())) return str; // return raw if unparseable
    }
  }
  return d.toISOString().substring(0, 10);
}

// Returns a Chat Cards v2 response
function _chatCard(title, body) {
  return {
    cardsV2: [{
      cardId: 'response',
      card: {
        header: { title: title },
        sections: [{
          widgets: [{ textParagraph: { text: body } }]
        }]
      }
    }]
  };
}
