const K = {
  usersPending: 'usersPending', usersApproved: 'usersApproved',
  modules: 'modules', assignments: 'assignments', submissions: 'submissions',
  pendingPosts: 'pendingPosts', approvedPosts: 'approvedPosts',
  pendingMaterials: 'pendingMaterials', approvedMaterials: 'approvedMaterials',
  messages: 'messages', grades: 'grades', auditLog: 'auditLog',
  forum: 'forum', attendance: 'attendance', timetable: 'timetable',
  profiles: 'profiles'
};

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[c])); }
function setBadge(id, value, hideZero = true) { const el = document.getElementById(id); if (!el) return; if (hideZero && (!value || value === 0)) el.classList.add('hidden'); else { el.textContent = value; el.classList.remove('hidden'); } }
function writeAudit(entry) { const log = JSON.parse(localStorage.getItem(K.auditLog)) || []; log.push({ ...entry, ts: Date.now() }); localStorage.setItem(K.auditLog, JSON.stringify(log)); }
function csvEsc(s) { const str = String(s ?? ''); return /[",\n]/.test(str) ? `"${str.replace(/"/g,'""')}"` : str; }
function downloadCSV(csv, filename) { const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function getProfiles() { return JSON.parse(localStorage.getItem(K.profiles)) || {}; }
function setProfiles(p) { localStorage.setItem(K.profiles, JSON.stringify(p)); }

document.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || localStorage.getItem('rememberUser') || '{}');
  const page = location.pathname.split('/').pop();
  if (page === 'dvc.html') initDVC(currentUser);
  if (page === 'student.html') initStudent(currentUser);
  if (page === 'lecturer.html') initLecturer(currentUser);

  window.addEventListener('storage', (e) => {
    if ([K.usersPending, K.usersApproved, K.messages, K.grades, K.modules, K.submissions, K.pendingPosts, K.pendingMaterials, K.approvedPosts, K.approvedMaterials, K.forum, K.attendance, K.timetable, K.profiles].includes(e.key)) {
      const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (page === 'dvc.html') initDVC(user);
      if (page === 'student.html') initStudent(user);
      if (page === 'lecturer.html') initLecturer(user);
    }
  });
});

/* ---------- DVC ---------- */
function initDVC() {
  // Role analytics
  const weekly = document.getElementById('dvcWeekly');
  const growth = document.getElementById('dvcGrowth');
  const content = document.getElementById('dvcContent');
  const approvals = JSON.parse(localStorage.getItem(K.usersPending)) || [];
  const approvedUsers = JSON.parse(localStorage.getItem(K.usersApproved)) || [];
  const pendingPosts = JSON.parse(localStorage.getItem(K.pendingPosts)) || [];
  const pendingMaterials = JSON.parse(localStorage.getItem(K.pendingMaterials)) || [];
  const approvedStudents = approvedUsers.filter(u => u.role === 'student').length;

  if (weekly) weekly.innerHTML = `<p>Actions this week: ${JSON.parse(localStorage.getItem(K.auditLog))?.length || 0}</p>`;
  if (growth) growth.innerHTML = `<p>Total approved students: ${approvedStudents}</p>`;
  if (content) content.innerHTML = `<p>Pending posts: ${pendingPosts.length} • Pending materials: ${pendingMaterials.length}</p>`;

  setBadge('badgePendingAll', approvals.filter(u => !u.status).length + pendingPosts.length + pendingMaterials.length);

  // Announcements (approved posts)
  const dvcAnnouncements = document.getElementById('dvcAnnouncements');
  const approvedPosts = JSON.parse(localStorage.getItem(K.approvedPosts)) || [];
  if (dvcAnnouncements) dvcAnnouncements.innerHTML = approvedPosts.length ? approvedPosts.slice(-5).map(p => `<div class="card"><h4>${esc(p.title)}</h4><p>${esc(p.content)}</p><p class="muted">By ${esc(p.author)}</p></div>`).join('') : '<p>No announcements yet.</p>';

  // Users approvals
  initUserApprovals();

  // Moderate posts
  const postsPanel = document.getElementById('approvalPanel');
  const posts = JSON.parse(localStorage.getItem(K.pendingPosts)) || [];
  if (postsPanel) {
    postsPanel.innerHTML = posts.length ? posts.map((p, i) => `
      <div class="card"><h4>${esc(p.title)}</h4><p>${esc(p.content)}</p><p class="muted">By ${esc(p.author)}</p>
        <button class="primary" data-i="${i}" data-act="approve-post">Approve</button>
        <button class="ghost" data-i="${i}" data-act="reject-post">Reject</button>
      </div>
    `).join('') : '<p>No pending posts.</p>';
    postsPanel.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const i = parseInt(b.getAttribute('data-i'), 10);
        const act = b.getAttribute('data-act');
        let pend = JSON.parse(localStorage.getItem(K.pendingPosts)) || [];
        let appr = JSON.parse(localStorage.getItem(K.approvedPosts)) || [];
        if (act === 'approve-post') { appr.push(pend[i]); localStorage.setItem(K.approvedPosts, JSON.stringify(appr)); }
        writeAudit({ actor: 'DVC', action: act, target: pend[i]?.title });
        pend.splice(i,1); localStorage.setItem(K.pendingPosts, JSON.stringify(pend));
        initDVC();
      };
    });
  }

  // Moderate materials
  const matsPanel = document.getElementById('materialApproval');
  const mats = JSON.parse(localStorage.getItem(K.pendingMaterials)) || [];
  if (matsPanel) {
    matsPanel.innerHTML = mats.length ? mats.map((m, i) => `
      <div class="card"><h4>${esc(m.title)}</h4><p class="muted">By ${esc(m.author)}</p>
        <button class="primary" data-i="${i}" data-act="approve-mat">Approve</button>
        <button class="ghost" data-i="${i}" data-act="reject-mat">Reject</button>
      </div>
    `).join('') : '<p>No pending materials.</p>';
    matsPanel.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const i = parseInt(b.getAttribute('data-i'), 10);
        const act = b.getAttribute('data-act');
        let pend = JSON.parse(localStorage.getItem(K.pendingMaterials)) || [];
        let appr = JSON.parse(localStorage.getItem(K.approvedMaterials)) || [];
        if (act === 'approve-mat') { appr.push(pend[i]); localStorage.setItem(K.approvedMaterials, JSON.stringify(appr)); }
        writeAudit({ actor: 'DVC', action: act, target: pend[i]?.title });
        pend.splice(i,1); localStorage.setItem(K.pendingMaterials, JSON.stringify(pend));
        initDVC();
      };
    });
  }

  // Forum moderation
  const forumListDvc = document.getElementById('forumListDvc');
  const forumSearchDvc = document.getElementById('forumSearchDvc');
  const forum = JSON.parse(localStorage.getItem(K.forum)) || [];
  function renderForumDvc(items) {
    forumListDvc.innerHTML = items.length ? items.map((q, i) => `
      <div class="card">
        <h4>${esc(q.question)}</h4>
        <p class="muted">Tags: ${esc(q.tags.join(', '))}</p>
        <ul class="list">${q.answers.map(a => `<li><strong>${esc(a.by)}:</strong> ${esc(a.text)}</li>`).join('')}</ul>
        <button class="primary" data-i="${i}" data-act="pin">Pin</button>
        <button class="ghost" data-i="${i}" data-act="remove">Remove</button>
      </div>
    `).join('') : '<p>No questions yet.</p>';
    forumListDvc.querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        const i = parseInt(b.getAttribute('data-i'), 10);
        const act = b.getAttribute('data-act');
        let data = JSON.parse(localStorage.getItem(K.forum)) || [];
        if (act === 'remove') data.splice(i,1);
        if (act === 'pin') data[i].pinned = !data[i].pinned;
        localStorage.setItem(K.forum, JSON.stringify(data));
        renderForumDvc(data);
      };
    });
  }
  if (forumListDvc) renderForumDvc(forum);
  if (forumSearchDvc) forumSearchDvc.oninput = () => {
    const q = forumSearchDvc.value.toLowerCase();
    const data = JSON.parse(localStorage.getItem(K.forum)) || [];
    renderForumDvc(data.filter(x => x.question.toLowerCase().includes(q) || x.tags.join(',').toLowerCase().includes(q)));
  };

  // Attendance overview + export
  const attendanceOverview = document.getElementById('attendanceOverview');
  const attendance = JSON.parse(localStorage.getItem(K.attendance)) || [];
  if (attendanceOverview) {
    attendanceOverview.innerHTML = attendance.length ? attendance.map(a => `<p>${esc(a.module)} — ${a.records.length} check-ins</p>`).join('') : '<p>No attendance yet.</p>';
  }
  const exportAttendanceAll = document.getElementById('exportAttendanceAll');
  if (exportAttendanceAll) {
    exportAttendanceAll.onclick = () => {
      const header = ['Module','Student','RegNo','Timestamp'];
      const rows = attendance.flatMap(a => a.records.map(r => [csvEsc(a.module), csvEsc(r.name), csvEsc(r.regNo || ''), new Date(r.ts).toISOString()]));
      const csv = [header, ...rows].map(r => r.join(',')).join('\n');
      downloadCSV(csv, 'attendance_all.csv');
    };
  }

  // Timetable display
  const timetableDvc = document.getElementById('timetableDvc');
  const timetable = JSON.parse(localStorage.getItem(K.timetable)) || [];
  if (timetableDvc) {
    timetableDvc.innerHTML = timetable.length ? timetable.map(t => `<p>${esc(t.title)} — ${new Date(t.start).toLocaleString()} to ${new Date(t.end).toLocaleString()}</p>`).join('') : '<p>No sessions scheduled.</p>';
  }
}

function initUserApprovals() {
  const panel = document.getElementById('userApprovalPanel');
  const filterButtons = document.querySelectorAll('.filter-chip');
  const userSearch = document.getElementById('userSearch');
  const pageSizeSel = document.getElementById('pageSize');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');
  const exportBtn = document.getElementById('exportPendingStudents');

  let state = { filter: 'pending', q: '', page: 1, pageSize: parseInt(pageSizeSel.value, 10) };
  filterButtons.forEach(btn => btn.onclick = () => { filterButtons.forEach(b => b.classList.remove('active')); btn.classList.add('active'); state.filter = btn.getAttribute('data-filter'); state.page = 1; render(); });
  userSearch.oninput = () => { state.q = userSearch.value.toLowerCase(); state.page = 1; render(); };
  pageSizeSel.onchange = () => { state.pageSize = parseInt(pageSizeSel.value, 10); state.page = 1; render(); };
  prevBtn.onclick = () => { if (state.page > 1) { state.page--; render(); } };
  nextBtn.onclick = () => { state.page++; render(); };
  if (exportBtn) exportBtn.onclick = exportPendingStudentsCSV;

  function render() {
    const approvals = JSON.parse(localStorage.getItem(K.usersPending)) || [];
    let items = approvals.filter(u => {
      if (state.filter === 'pending') return !u.status;
      if (state.filter === 'approved') return u.status === 'approved';
      if (state.filter === 'rejected') return u.status === 'rejected';
      return true;
    });
    if (state.q) items = items.filter(u => `${(u.name||'').toLowerCase()} ${(u.email||'').toLowerCase()} ${(u.regNo||'').toLowerCase()} ${(u.role||'').toLowerCase()}`.includes(state.q));
    const total = items.length;
    const start = (state.page - 1) * state.pageSize;
    const pageItems = items.slice(start, start + state.pageSize);
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (pageInfo) pageInfo.textContent = `Page ${Math.min(state.page, totalPages)} of ${totalPages}`;

    panel.innerHTML = pageItems.length ? `
      <table class="table">
        <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Reg No</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${pageItems.map(u => `
          <tr>
            <td>${esc(u.name)}</td><td>${esc(u.role)}</td><td>${esc(u.email)}</td>
            <td>${u.role==='student' ? esc(u.regNo || '-') : '-'}</td>
            <td>${statusBadge(u.status)}</td>
            <td>${actionButtons(u)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    ` : '<p>No users found for this filter.</p>';

    panel.querySelectorAll('.approve-btn').forEach(btn => btn.onclick = () => approveUser(btn.getAttribute('data-id'), () => render()));
    panel.querySelectorAll('.reject-btn').forEach(btn => btn.onclick = () => rejectUser(btn.getAttribute('data-id'), () => render()));
  }
  render();
}

function statusBadge(status) {
  if (!status) return `<span class="badge" style="background: var(--accent);">pending</span>`;
  if (status === 'approved') return `<span class="badge" style="background: var(--ok);">approved</span>`;
  if (status === 'rejected') return `<span class="badge" style="background: var(--muted);">rejected</span>`;
  return esc(status);
}
function actionButtons(u) {
  if (!u.status) return `<button class="primary approve-btn" data-id="${u.id}">Approve</button> <button class="ghost reject-btn" data-id="${u.id}">Reject</button>`;
  return `<span class="muted">—</span>`;
}
function approveUser(id, onDone) {
  const approvals = JSON.parse(localStorage.getItem(K.usersPending)) || [];
  const idx = approvals.findIndex(u => u.id === id); if (idx < 0) return;
  approvals[idx].status = 'approved'; approvals[idx].approvedAt = Date.now();
  localStorage.setItem(K.usersPending, JSON.stringify(approvals));
  const approvedList = JSON.parse(localStorage.getItem(K.usersApproved)) || [];
  if (!approvedList.some(u => u.id === approvals[idx].id)) approvedList.push(approvals[idx]);
  localStorage.setItem(K.usersApproved, JSON.stringify(approvedList));
  writeAudit({ actor: 'DVC', action: 'approve-user', target: approvals[idx].name });
  onDone?.();
}
function rejectUser(id, onDone) {
  const approvals = JSON.parse(localStorage.getItem(K.usersPending)) || [];
  const idx = approvals.findIndex(u => u.id === id); if (idx < 0) return;
  approvals[idx].status = 'rejected'; approvals[idx].rejectedAt = Date.now();
  localStorage.setItem(K.usersPending, JSON.stringify(approvals));
  const approvedList = JSON.parse(localStorage.getItem(K.usersApproved)) || [];
  const i2 = approvedList.findIndex(u => u.id === id);
  if (i2 >= 0) { approvedList.splice(i2,1); localStorage.setItem(K.usersApproved, JSON.stringify(approvedList)); }
  writeAudit({ actor: 'DVC', action: 'reject-user', target: approvals[idx].name });
  onDone?.();
}
function exportPendingStudentsCSV() {
  const approvals = JSON.parse(localStorage.getItem(K.usersPending)) || [];
  const students = approvals.filter(u => u.role === 'student' && !u.status);
  const header = ['Name','Email','RegistrationNo','CreatedAt'];
  const rows = students.map(u => [csvEsc(u.name), csvEsc(u.email), csvEsc(u.regNo || ''), new Date(u.createdAt || Date.now()).toISOString()]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  downloadCSV(csv, 'pending_students.csv');
}

/* ---------- Lecturer ---------- */
function initLecturer(currentUser) {
  // Analytics cards
  const lecWeekly = document.getElementById('lecWeekly');
  const lecEngagement = document.getElementById('lecEngagement');
  const lecPendingContent = document.getElementById('lecPendingContent');
  const messages = JSON.parse(localStorage.getItem(K.messages)) || [];
  const assignments = JSON.parse(localStorage.getItem(K.assignments)) || [];
  const pendingPosts = (JSON.parse(localStorage.getItem(K.pendingPosts)) || []).filter(p => p.author === currentUser.name).length;
  const pendingMaterials = (JSON.parse(localStorage.getItem(K.pendingMaterials)) || []).filter(m => m.author === currentUser.name).length;
  if (lecWeekly) lecWeekly.innerHTML = `<p>Messages: ${messages.filter(m => m.to === currentUser.name || m.from === currentUser.name).length}</p>`;
  if (lecEngagement) lecEngagement.innerHTML = `<p>Assignments created: ${assignments.filter(a => a.author === currentUser.name).length}</p>`;
  if (lecPendingContent) lecPendingContent.innerHTML = `<p>Pending posts: ${pendingPosts} • Pending materials: ${pendingMaterials}</p>`;

  // Students list
  const studentList = document.getElementById('studentList');
  const approved = JSON.parse(localStorage.getItem(K.usersApproved)) || [];
  const names = approved.filter(u => u.role === 'student').map(u => `<li>${esc(u.name)} (RegNo: ${esc(u.regNo || '-')})</li>`).join('');
  if (studentList) studentList.innerHTML = names || '<li>No students yet.</li>';

  // Modules
  const modForm = document.getElementById('createModuleForm');
  if (modForm) {
    modForm.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('moduleTitle').value.trim(); if (!title) return;
      const modules = JSON.parse(localStorage.getItem(K.modules)) || [];
      modules.push({ title, author: currentUser.name });
      localStorage.setItem(K.modules, JSON.stringify(modules));
      e.target.reset();
      renderLecturerModules(currentUser);
    };
  }
  renderLecturerModules(currentUser);

  // Assignments
  const assignForm = document.getElementById('createAssignmentForm');
  if (assignForm) {
    assignForm.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('newAssignmentTitle').value.trim();
      const body = document.getElementById('newAssignmentBody').value.trim();
      if (!title || !body) return;
      const assignments = JSON.parse(localStorage.getItem(K.assignments)) || [];
      assignments.push({ title, body, author: currentUser.name, ts: Date.now() });
      localStorage.setItem(K.assignments, JSON.stringify(assignments));
      e.target.reset();
      renderReceivedSubmissions();
      renderReceivedSubmissions2();
    };
  }
  renderReceivedSubmissions();
  renderReceivedSubmissions2();

  // Materials
  const matForm = document.getElementById('materialForm');
  if (matForm) {
    matForm.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('materialTitle').value.trim();
      const file = document.getElementById('materialFile').files[0];
      if (!title || !file) return;
      const reader = new FileReader();
      reader.onload = function() {
        const pending = JSON.parse(localStorage.getItem(K.pendingMaterials)) || [];
        pending.push({ title, author: currentUser.name, data: reader.result });
        localStorage.setItem(K.pendingMaterials, JSON.stringify(pending));
        e.target.reset();
        renderLecturerMaterials(currentUser);
      };
      reader.readAsDataURL(file);
    };
  }
  renderLecturerMaterials(currentUser);

  // Posts
  const postForm = document.getElementById('postForm');
  if (postForm) {
    postForm.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('postTitle').value.trim();
      const content = document.getElementById('postContent').value.trim();
      if (!title || !content) return;
      const pending = JSON.parse(localStorage.getItem(K.pendingPosts)) || [];
      pending.push({ title, content, author: currentUser.name });
      localStorage.setItem(K.pendingPosts, JSON.stringify(pending));
      e.target.reset();
      renderLecturerPosts(currentUser);
    };
  }
  renderLecturerPosts(currentUser);

  // Grades
  const form = document.getElementById('gradeUploadForm');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      const student = document.getElementById('gradeStudentName').value.trim();
      const title = document.getElementById('gradeTitle').value.trim();
      const score = document.getElementById('gradeScore').value.trim();
      const remark = document.getElementById('gradeRemark').value.trim();
      if (!student || !title || !score || !remark) return;
      const grades = JSON.parse(localStorage.getItem(K.grades)) || [];
      grades.push({ title, student, score, remark, ts: Date.now(), by: currentUser.name });
      localStorage.setItem(K.grades, JSON.stringify(grades));
      e.target.reset();
      alert('Grade saved.');
    };
  }

  // Messages
  renderLecturerInbox(currentUser);
  const replyForm = document.getElementById('replyForm');
  if (replyForm) {
    replyForm.onsubmit = (e) => {
      e.preventDefault();
      const to = document.getElementById('replyTo').value.trim();
      const text = document.getElementById('replyText').value.trim();
      if (!to || !text) return;
      const messages = JSON.parse(localStorage.getItem(K.messages)) || [];
      messages.push({ from: currentUser.name, to, text, ts: Date.now() });
      localStorage.setItem(K.messages, JSON.stringify(messages));
      e.target.reset();
      renderLecturerInbox(currentUser);
      const unread2 = messages.filter(m => m.to === currentUser.name).length;
      setBadge('badgeUnread', unread2);
    };
  }

  // Forum view
  const forumListLect = document.getElementById('forumListLect');
  const forumSearchLect = document.getElementById('forumSearchLect');
  const forum = JSON.parse(localStorage.getItem(K.forum)) || [];
  function renderForumLect(items) {
    forumListLect.innerHTML = items.length ? items.map((q, i) => `
      <div class="card">
        <h4>${esc(q.question)}</h4>
        <p class="muted">Tags: ${esc(q.tags.join(', '))}</p>
        <ul class="list">${q.answers.map(a => `<li><strong>${esc(a.by)}:</strong> ${esc(a.text)}</li>`).join('')}</ul>
        <form data-i="${i}" class="inline reply">
          <input type="text" placeholder="Your answer..." required/>
          <button class="primary">Reply</button>
        </form>
      </div>
    `).join('') : '<p>No questions yet.</p>';
    forumListLect.querySelectorAll('form.reply').forEach(f => {
      f.onsubmit = (e) => {
        e.preventDefault();
        const i = parseInt(f.getAttribute('data-i'), 10);
        const text = f.querySelector('input').value.trim();
        let data = JSON.parse(localStorage.getItem(K.forum)) || [];
        data[i].answers.push({ by: currentUser.name, text });
        localStorage.setItem(K.forum, JSON.stringify(data));
        renderForumLect(data);
      };
    });
  }
  if (forumListLect) renderForumLect(forum);
  if (forumSearchLect) forumSearchLect.oninput = () => {
    const q = forumSearchLect.value.toLowerCase();
    const data = JSON.parse(localStorage.getItem(K.forum)) || [];
    renderForumLect(data.filter(x => x.question.toLowerCase().includes(q) || x.tags.join(',').toLowerCase().includes(q)));
  };

  // Attendance management
  const attendanceCreate = document.getElementById('attendanceCreate');
  const attendanceList = document.getElementById('attendanceList');
  const attendance = JSON.parse(localStorage.getItem(K.attendance)) || [];
  if (attendanceCreate) {
    attendanceCreate.onsubmit = (e) => {
      e.preventDefault();
      const module = document.getElementById('attModule').value.trim();
      if (!module) return;
      let data = JSON.parse(localStorage.getItem(K.attendance)) || [];
      if (!data.find(x => x.module === module)) data.push({ module, records: [] });
      localStorage.setItem(K.attendance, JSON.stringify(data));
      e.target.reset();
      renderAttendanceList();
    };
  }
  function renderAttendanceList() {
    const data = JSON.parse(localStorage.getItem(K.attendance)) || [];
    attendanceList.innerHTML = data.length ? data.map(a => `<p>${esc(a.module)} — ${a.records.length} check-ins</p>`).join('') : '<p>No attendance check-ins yet.</p>';
  }
  if (attendanceList) renderAttendanceList();

  // Timetable create
  const timetableCreate = document.getElementById('timetableCreate');
  const timetableLect = document.getElementById('timetableLect');
  const timetable = JSON.parse(localStorage.getItem(K.timetable)) || [];
  if (timetableCreate) {
    timetableCreate.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('ttTitle').value.trim();
      const start = document.getElementById('ttStart').value;
      const end = document.getElementById('ttEnd').value;
      if (!title || !start || !end) return;
      let data = JSON.parse(localStorage.getItem(K.timetable)) || [];
      data.push({ title, start, end, by: currentUser.name });
      localStorage.setItem(K.timetable, JSON.stringify(data));
      e.target.reset();
      renderTimetableLect();
    };
  }
  function renderTimetableLect() {
    const data = JSON.parse(localStorage.getItem(K.timetable)) || [];
    timetableLect.innerHTML = data.length ? data.map(t => `<p>${esc(t.title)} — ${new Date(t.start).toLocaleString()} to ${new Date(t.end).toLocaleString()}</p>`).join('') : '<p>No sessions scheduled.</p>';
  }
  if (timetableLect) renderTimetableLect();
}

function renderLecturerModules(currentUser) {
  const area = document.getElementById('lecturerModules'); if (!area) return;
  const modules = JSON.parse(localStorage.getItem(K.modules)) || [];
  const mine = modules.filter(m => m.author === currentUser.name);
  area.innerHTML = mine.length ? mine.map(m => `<div class="card"><h4>${esc(m.title)}</h4></div>`).join('') : '<p>No modules yet.</p>';
}
function renderReceivedSubmissions() {
  const list = document.getElementById('receivedSubmissions'); if (!list) return;
  const subs = JSON.parse(localStorage.getItem(K.submissions)) || [];
  list.innerHTML = subs.length ? subs.map(s => `<li>${esc(s.title)} by ${esc(s.student)} (RegNo: ${esc(findRegNo(s.student))}) — ${s.graded ? 'Graded' : 'Pending'}</li>`).join('') : '<li>No submissions yet.</li>';
}
function renderReceivedSubmissions2() {
  const list = document.getElementById('receivedSubmissions2'); if (!list) return;
  const subs = JSON.parse(localStorage.getItem(K.submissions)) || [];
  list.innerHTML = subs.length ? subs.map(s => `<li>${esc(s.title)} by ${esc(s.student)} (RegNo: ${esc(findRegNo(s.student))}) — ${s.graded ? 'Graded' : 'Pending'}</li>`).join('') : '<li>No submissions yet.</li>';
}
function renderLecturerMaterials(currentUser) {
  const list = document.getElementById('lecturerMaterials'); if (!list) return;
  const pending = JSON.parse(localStorage.getItem(K.pendingMaterials)) || [];
  const approved = JSON.parse(localStorage.getItem(K.approvedMaterials)) || [];
  const mp = pending.filter(m => m.author === currentUser.name).map(m => `<li>${esc(m.title)} — Pending</li>`).join('');
  const ma = approved.filter(m => m.author === currentUser.name).map(m => `<li>${esc(m.title)} — Approved</li>`).join('');
  list.innerHTML = (mp || ma) ? (mp + ma) : '<li>No materials submitted.</li>';
}
function renderLecturerPosts(currentUser) {
  const list = document.getElementById('lecturerPosts'); if (!list) return;
  const pending = JSON.parse(localStorage.getItem(K.pendingPosts)) || [];
  const approved = JSON.parse(localStorage.getItem(K.approvedPosts)) || [];
  const mp = pending.filter(p => p.author === currentUser.name).map(p => `<li>${esc(p.title)} — Pending</li>`).join('');
  const ma = approved.filter(p => p.author === currentUser.name).map(p => `<li>${esc(p.title)} — Approved</li>`).join('');
  list.innerHTML = (mp || ma) ? (mp + ma) : '<li>No posts submitted.</li>';
}
function renderLecturerInbox(currentUser) {
  const inbox = document.getElementById('lecturerInbox'); if (!inbox) return;
  const messages = JSON.parse(localStorage.getItem(K.messages)) || [];
  const mine = messages.filter(m => m.to === currentUser.name);
  inbox.innerHTML = mine.length ? mine.map(m => `<li><strong>${esc(m.from)}:</strong> ${esc(m.text)}</li>`).join('') : '<li>No messages.</li>';
}
function findRegNo(studentName) {
  const approved = JSON.parse(localStorage.getItem(K.usersApproved)) || [];
  const stu = approved.find(u => u.role==='student' && u.name===studentName);
  return stu?.regNo || '';
}

/* ---------- Student ---------- */
function initStudent(currentUser) {
  // Overview with regNo always visible
  const info = document.getElementById('studentInfo');
  if (info) info.innerHTML = currentUser?.name ? `
    <p><strong>Name:</strong> ${esc(currentUser.name)}</p>
    <p><strong>Email:</strong> ${esc(currentUser.email)}</p>
    <p><strong>Role:</strong> ${esc(currentUser.role)}</p>
    <p><strong>Registration No:</strong> ${esc(currentUser.regNo || '-')}</p>
  ` : '<p>No student logged in.</p>';

  // Analytics
  const stuWeekly = document.getElementById('stuWeekly');
  const stuProgress = document.getElementById('stuProgress');
  const stuAnnouncements = document.getElementById('stuAnnouncements');
  const subs = JSON.parse(localStorage.getItem(K.submissions)) || [];
  const mySubs = subs.filter(s => s.student === currentUser.name).length;
  if (stuWeekly) stuWeekly.innerHTML = `<p>Submissions this week: ${mySubs}</p>`;
  const grades = JSON.parse(localStorage.getItem(K.grades)) || [];
  const myGrades = grades.filter(g => g.student === currentUser.name).length;
  if (stuProgress) stuProgress.innerHTML = `<p>Grades recorded: ${myGrades}</p>`;
  const approvedPosts = JSON.parse(localStorage.getItem(K.approvedPosts)) || [];
  if (stuAnnouncements) stuAnnouncements.innerHTML = approvedPosts.length ? approvedPosts.slice(-3).map(p => `<div class="card"><h4>${esc(p.title)}</h4><p>${esc(p.content)}</p></div>`).join('') : '<p>No announcements.</p>';

  // Modules
  const allModules = JSON.parse(localStorage.getItem(K.modules)) || [];
  const sModules = document.getElementById('studentModules');
  if (sModules) sModules.innerHTML = allModules.length ? allModules.map(m => `<div class="card"><h4>${esc(m.title)}</h4><p class="muted">By ${esc(m.author)}</p></div>`).join('') : '<p>No modules yet.</p>';

  // Materials
  const materialsArea = document.getElementById('materialsArea');
  if (materialsArea) {
    const mats = JSON.parse(localStorage.getItem(K.approvedMaterials)) || [];
    materialsArea.innerHTML = mats.length ? mats.map(m => `<div class="card"><h4>${esc(m.title)}</h4><p class="muted">Approved by DVC</p></div>`).join('') : '<p>No materials available.</p>';
  }

  // Assignment upload
  const assignForm = document.getElementById('assignmentForm');
  if (assignForm) {
    assignForm.onsubmit = (e) => {
      e.preventDefault();
      const title = document.getElementById('assignmentTitle').value.trim();
      const file = document.getElementById('assignmentFile').files[0];
      if (!title || !file) return;
      const reader = new FileReader();
      reader.onload = function() {
        const subs = JSON.parse(localStorage.getItem(K.submissions)) || [];
        subs.push({ title, student: currentUser.name, data: reader.result, graded: false, ts: Date.now(), regNo: currentUser.regNo });
        localStorage.setItem(K.submissions, JSON.stringify(subs));
        e.target.reset();
        renderStudentSubmissions(currentUser);
      };
      reader.readAsDataURL(file);
    };
  }
  renderStudentSubmissions(currentUser);

  // Grades
  renderStudentGrades(currentUser);
  const exportBtn = document.getElementById('exportGrades');
  if (exportBtn) exportBtn.onclick = () => exportGradesCSV(currentUser);

  // Messages
  renderStudentInbox(currentUser);
  const msgForm = document.getElementById('messageForm');
  if (msgForm) {
    msgForm.onsubmit = (e) => {
      e.preventDefault();
      const to = document.getElementById('messageTo').value.trim();
      const text = document.getElementById('messageText').value.trim();
      if (!to || !text) return;
      const messages = JSON.parse(localStorage.getItem(K.messages)) || [];
      messages.push({ from: currentUser.name, to, text, ts: Date.now() });
      localStorage.setItem(K.messages, JSON.stringify(messages));
      e.target.reset();
      renderStudentInbox(currentUser);
      const unread = messages.filter(m => m.to === currentUser.name).length;
      setBadge('badgeUnread', unread);
    };
  }

  // Forum ask/search
  const forumList = document.getElementById('forumList');
  const forumAsk = document.getElementById('forumAsk');
  const forumSearch = document.getElementById('forumSearch');
  function renderForum(items) {
    forumList.innerHTML = items.length ? items.map((q) => `
      <div class="card ${q.pinned ? 'pinned' : ''}">
        <h4>${esc(q.question)}</h4>
        <p class="muted">Tags: ${esc(q.tags.join(', '))}</p>
        <ul class="list">${q.answers.map(a => `<li><strong>${esc(a.by)}:</strong> ${esc(a.text)}</li>`).join('')}</ul>
      </div>
    `).join('') : '<p>No questions yet.</p>';
  }
  const forumData = JSON.parse(localStorage.getItem(K.forum)) || [];
  if (forumList) renderForum(forumData);
  if (forumAsk) forumAsk.onsubmit = (e) => {
    e.preventDefault();
    const q = document.getElementById('forumQuestion').value.trim();
    const tags = document.getElementById('forumTags').value.trim().split(',').map(t => t.trim()).filter(Boolean);
    if (!q) return;
    const data = JSON.parse(localStorage.getItem(K.forum)) || [];
    data.push({ question: q, tags, answers: [], pinned: false, by: currentUser.name, ts: Date.now() });
    localStorage.setItem(K.forum, JSON.stringify(data));
    e.target.reset();
    renderForum(data);
  };
  if (forumSearch) forumSearch.oninput = () => {
    const q = forumSearch.value.toLowerCase();
    const data = JSON.parse(localStorage.getItem(K.forum)) || [];
    renderForum(data.filter(x => x.question.toLowerCase().includes(q) || x.tags.join(',').toLowerCase().includes(q)));
  };

  // Attendance check-in
  const attendanceCheckin = document.getElementById('attendanceCheckin');
  const attModuleSel = document.getElementById('attModuleSel');
  const attendanceMy = document.getElementById('attendanceMy');
  if (attendanceCheckin) {
    attendanceCheckin.onsubmit = (e) => {
      e.preventDefault();
      const module = attModuleSel.value.trim();
      if (!module) return;
      let data = JSON.parse(localStorage.getItem(K.attendance)) || [];
      let entry = data.find(x => x.module === module);
      if (!entry) { entry = { module, records: [] }; data.push(entry); }
      entry.records.push({ name: currentUser.name, regNo: currentUser.regNo, ts: Date.now() });
      localStorage.setItem(K.attendance, JSON.stringify(data));
      renderAttendanceMy();
      e.target.reset();
    };
  }
  function renderAttendanceMy() {
    const data = JSON.parse(localStorage.getItem(K.attendance)) || [];
    const mine = data.flatMap(a => a.records.filter(r => r.name === currentUser.name).map(r => ({ module: a.module, ts: r.ts })));
    attendanceMy.innerHTML = mine.length ? mine.map(r => `<p>${esc(r.module)} — ${new Date(r.ts).toLocaleString()}</p>`).join('') : '<p>No check-ins yet.</p>';
  }
  if (attendanceMy) renderAttendanceMy();

  // Timetable view
  const timetableStudent = document.getElementById('timetableStudent');
  const timetable = JSON.parse(localStorage.getItem(K.timetable)) || [];
  if (timetableStudent) {
    timetableStudent.innerHTML = timetable.length ? timetable.map(t => `<p>${esc(t.title)} — ${new Date(t.start).toLocaleString()} to ${new Date(t.end).toLocaleString()}</p>`).join('') : '<p>No sessions scheduled.</p>';
  }

  // Profile: avatar, bio, contact, regNo (readonly)
  const profileForm = document.getElementById('profileForm');
  const profileView = document.getElementById('profileView');
  if (profileForm) {
    document.getElementById('profileRegNo').value = currentUser.regNo || '';
    profileForm.onsubmit = (e) => {
      e.preventDefault();
      const bio = document.getElementById('profileBio').value.trim();
      const contact = document.getElementById('profileContact').value.trim();
      const avatarInput = document.getElementById('profileAvatar');
      const profiles = getProfiles();
      function saveProfile(avatarData) {
        profiles[currentUser.name] = { bio, contact, avatar: avatarData, regNo: currentUser.regNo };
        setProfiles(profiles);
        renderProfileView();
        e.target.reset();
      }
      if (avatarInput.files && avatarInput.files[0]) {
        const reader = new FileReader();
        reader.onload = () => saveProfile(reader.result);
        reader.readAsDataURL(avatarInput.files[0]);
      } else {
        saveProfile(profiles[currentUser.name]?.avatar || '');
      }
    };
    function renderProfileView() {
      const p = getProfiles()[currentUser.name] || { bio: '', contact: '', avatar: '', regNo: currentUser.regNo };
      profileView.innerHTML = `
        <div class="card">
          ${p.avatar ? `<img src="${p.avatar}" alt="Avatar" style="width:80px;height:80px;border-radius:50%;object-fit:cover;"/>` : '<div class="muted">No avatar</div>'}
          <p><strong>Bio:</strong> ${esc(p.bio || '')}</p>
          <p><strong>Contact:</strong> ${esc(p.contact || '')}</p>
          <p><strong>Registration No:</strong> ${esc(p.regNo || '')}</p>
        </div>
      `;
    }
    renderProfileView();
  }

  // Notifications badges
  const unread = (JSON.parse(localStorage.getItem(K.messages)) || []).filter(m => m.to === currentUser.name).length;
  setBadge('badgeUnread', unread);
  const lastSeenKey = `gradesSeen:${currentUser.name}`;
  const lastSeen = parseInt(localStorage.getItem(lastSeenKey) || '0', 10);
  const newCount = grades.filter(g => g.student === currentUser.name && (g.ts || 0) > lastSeen).length;
  if (newCount > 0) setBadge('badgeNewGrades', 'New', false);
  localStorage.setItem(lastSeenKey, String(Date.now()));
}

function renderStudentSubmissions(currentUser) {
  const list = document.getElementById('studentSubmissions'); if (!list) return;
  const subs = JSON.parse(localStorage.getItem(K.submissions)) || [];
  const mine = subs.filter(s => s.student === currentUser.name);
  list.innerHTML = mine.length ? mine.map(s => `<li>${esc(s.title)} — ${s.graded ? 'Graded' : 'Pending'}</li>`).join('') : '<li>No submissions yet.</li>';
}
function renderStudentGrades(currentUser) {
  const area = document.getElementById('gradesArea'); if (!area) return;
  const grades = JSON.parse(localStorage.getItem(K.grades)) || [];
  const mine = grades.filter(g => g.student === currentUser.name);
  area.innerHTML = mine.length ? mine.map(g => `<div class="card"><h4>${esc(g.title)}</h4><p>Score: ${esc(g.score)}</p><p>Remark: ${esc(g.remark)}</p><p class="muted">${new Date(g.ts).toLocaleString()}</p></div>`).join('') : '<p>No grades yet.</p>';
}
function exportGradesCSV(currentUser) {
  const grades = JSON.parse(localStorage.getItem(K.grades)) || [];
  const mine = grades.filter(g => g.student === currentUser.name);
  const header = ['Title','Student','Score','Remark','Timestamp'];
  const rows = mine.map(g => [csvEsc(g.title), csvEsc(g.student), csvEsc(g.score), csvEsc(g.remark), new Date(g.ts || Date.now()).toISOString()]);
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  downloadCSV(csv, `grades_${currentUser.name.replace(/\s+/g,'_')}.csv`);
}

