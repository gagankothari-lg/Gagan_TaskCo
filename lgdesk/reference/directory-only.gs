// directory.gs — Team Directory + Company Directory

function getTeamDirectory(email) {
  try {
    var user = getCurrentUser(email);
    var all  = dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active']).toUpperCase() === 'TRUE';
    });
    var empMap = {};
    all.forEach(function(e) { empMap[e['Emp_ID']] = _empName(e); });

    var isAdmin   = _isAdmin(user.role);
    var isManager = _isManager(user.role);

    // Team Directory always shows only the current user's own team — for everyone.
    // Use Company Directory tab (getCompanyDirectory) for the full organisation view.
    var myTeam = user.emp['Team'] || '';
    var employees = all.filter(function(e) {
      return e['Team'] === myTeam;
    }).map(function(e) {
      return {
        empId:         e['Emp_ID'],
        name:          _empName(e),
        email:         e['Email'],
        role:          e['Role'],
        designation:   e['Designation']   || '',
        team:          e['Team']           || '',
        subDepartment: e['Sub_Department'] || '',
        managerName:   empMap[e['Manager_ID']] || ''
      };
    });

    employees.sort(function(a, b) { return a.name < b.name ? -1 : 1; });
    var teamChatSpaces = {};
    try { teamChatSpaces = getTeamChatSpaces(); } catch(e) {}
    return { ok: true, employees: employees, isManager: isManager, isAdmin: isAdmin, teamChatSpaces: teamChatSpaces };
  } catch(e) { return { ok: false, error: e.message }; }
}

// ── Company Directory ─────────────────────────────────────────────────────────
// Returns ALL active employees for everyone (no role restriction).
// Used for the Company Directory tab — employees see the whole company.
function getCompanyDirectory(email) {
  try {
    getCurrentUser(email); // verify session only
    var all = dbGetAll('Employees').filter(function(e) {
      return String(e['Is_Active']).toUpperCase() === 'TRUE';
    });
    var empMap = {};
    all.forEach(function(e) { empMap[e['Emp_ID']] = _empName(e); });

    var employees = all.map(function(e) {
      return {
        empId:         e['Emp_ID'],
        name:          _empName(e),
        email:         e['Email'],
        role:          e['Role'],
        designation:   e['Designation']   || '',
        team:          e['Team']           || '',
        subDepartment: e['Sub_Department'] || '',
        managerName:   empMap[e['Manager_ID']] || ''
      };
    }).sort(function(a, b) { return a.name < b.name ? -1 : 1; });

    var teamChatSpaces = {};
    try { teamChatSpaces = getTeamChatSpaces(); } catch(e) {}
    return { ok: true, employees: employees, teamChatSpaces: teamChatSpaces };
  } catch(e) { return { ok: false, error: e.message }; }
}
