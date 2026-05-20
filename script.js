// ====================== FIREBASE CONFIG ======================
const firebaseConfig = {
  apiKey: "AIzaSyCOeuIiRlllmoAdwyfdAGZ-rI-9uETTZ9U",
  authDomain: "workflow-job-40c66.firebaseapp.com",
  projectId: "workflow-job-40c66",
  storageBucket: "workflow-job-40c66.firebasestorage.app",
  messagingSenderId: "47478848425",
  appId: "1:47478848425:web:419f765dadc5b20c3562b8",
  measurementId: "G-7NH8E5MSBR"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ====================== СОСТОЯНИЕ ======================
let currentUser = null;
let jobs = [];
let applications = [];
let editingJobId = null;
let editingGigId = null;
let currentChatAppId = null;
let unsubscribeChat = null;
let activeCategory = '';
let filterType     = '';
let filterRemote   = '';
let filterSchedule = '';
let appliedJobIds = new Set();
let jobDetailModal;
let postGigModal;
let editGigModal;
let gigs = [];

// ====================== DOM-ЭЛЕМЕНТЫ ======================
let loginModal, registerModal, postJobModal, respondModal,
    applicationsModal, chatModal, myJobsModal, resumeModal;

function initModals() {
    postGigModal      = document.getElementById('post-gig-modal');
    editGigModal      = document.getElementById('edit-gig-modal');
    jobDetailModal    = document.getElementById('job-detail-modal');
    loginModal        = document.getElementById('login-modal');
    registerModal     = document.getElementById('register-modal');
    postJobModal      = document.getElementById('post-job-modal');
    respondModal      = document.getElementById('respond-modal');
    applicationsModal = document.getElementById('applications-modal');
    chatModal         = document.getElementById('chat-modal');
    myJobsModal       = document.getElementById('my-jobs-modal');
    resumeModal       = document.getElementById('resume-modal');
}

// ====================== ТЁМНАЯ ТЕМА ======================
function initTheme() {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// ====================== ПЕРЕХОД НА ГЛАВНУЮ (ЛОГО) ======================
function goHome() {
    // Показываем все основные секции
    const hero = document.querySelector('.hero');
    const cats = document.querySelector('.categories-section');
    const jobs_sec = document.querySelector('.jobs-section');
    const feats = document.querySelector('.features-section');
    const gigs_sec = document.getElementById('gigs-section');

    if (hero)     hero.style.display     = '';
    if (cats)     cats.style.display     = '';
    if (jobs_sec) jobs_sec.style.display = '';
    if (feats)    feats.style.display    = '';
    if (gigs_sec) gigs_sec.style.display = 'none';

    // Сбрасываем активный nav-link
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const navVac = document.getElementById('nav-vacancies');
    if (navVac) navVac.classList.add('active');

    // Плавный скролл наверх
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ====================== ШАПКА ======================
function updateHeader() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight) return;

    if (currentUser) {
        let html = `
            <div class="user-info">
                <button id="theme-toggle" class="theme-btn">🌙</button>
                <span class="username">${currentUser.name.split(' ')[0]}</span>`;

        if (currentUser.role === 'employer') {
            html += `
                <button id="my-jobs-btn" class="applications-btn">Мои вакансии</button>
                <button id="my-applications-btn" class="applications-btn">Отклики</button>`;
        } else {
            html += `<button id="my-applications-btn" class="applications-btn">Мои отклики</button>`;
        }

        html += `
                <button class="post-job-btn"><i class="fas fa-plus"></i> Разместить вакансию</button>
                <button id="logout-btn" class="logout-btn">Выйти</button>
            </div>`;

        headerRight.innerHTML = html;
    } else {
        headerRight.innerHTML = `
            <button id="theme-toggle" class="theme-btn">🌙</button>
            <button class="login-btn">Войти</button>
            <button class="post-job-btn"><i class="fas fa-plus"></i> Разместить вакансию</button>`;
    }

    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

// ====================== ЕДИНЫЙ ОБРАБОТЧИК КЛИКОВ ======================
document.addEventListener('click', (e) => {

    // ← ЛОГО → ГЛАВНАЯ
    if (e.target.closest('.logo')) { goHome(); return; }

    if (e.target.id === 'theme-toggle') { toggleTheme(); return; }

    if (e.target.classList.contains('login-btn')) { loginModal.style.display = 'flex'; return; }

    if (e.target.closest('.post-job-btn')) { openPostJobModal(); return; }

    if (e.target.id === 'logout-btn') { logoutUser(); return; }

    if (e.target.id === 'my-jobs-btn') { showMyJobs(); return; }

    if (e.target.id === 'my-applications-btn') { showMyApplications(); return; }

   if (e.target.classList.contains('respond-btn')) {
        if (!currentUser || currentUser.role !== 'candidate') {
            alert('Откликаться могут только соискатели!');
            if (!currentUser) loginModal.style.display = 'flex';
            return;
        }
        const jobId = e.target.dataset.id;
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            document.getElementById('respond-job-title').textContent = job.title;
            document.getElementById('respond-form').dataset.jobId = jobId;
            if (jobDetailModal) jobDetailModal.style.display = 'none';
            respondModal.style.display = 'flex';
        }
        return;
    }

    if (e.target.classList.contains('edit-job-btn')) { editJob(e.target.dataset.id); return; }

    if (e.target.classList.contains('delete-job-btn')) {
        if (!confirm('Удалить эту вакансию навсегда?')) return;
        deleteJob(e.target.dataset.id);
        return;
    }

    // Раскрыть / свернуть описание подработки
    if (e.target.classList.contains('gig-expand-btn') || e.target.closest('.gig-expand-btn')) {
        const btn = e.target.classList.contains('gig-expand-btn') ? e.target : e.target.closest('.gig-expand-btn');
        const wrap = btn.closest('.gig-desc-wrap');
        const textEl = wrap.querySelector('.gig-desc-text');
        const isExpanded = btn.dataset.expanded === 'true';

        if (isExpanded) {
            textEl.textContent = decodeURIComponent(btn.dataset.short);
            btn.dataset.expanded = 'false';
            btn.innerHTML = `<i class="fas fa-chevron-down" style="font-size:10px;transition:transform 0.2s;pointer-events:none;"></i> Читать полностью`;
        } else {
            textEl.textContent = decodeURIComponent(btn.dataset.full);
            btn.dataset.expanded = 'true';
            btn.innerHTML = `<i class="fas fa-chevron-up" style="font-size:10px;transition:transform 0.2s;pointer-events:none;"></i> Свернуть`;
        }
        return;
    }

    // Редактирование подработки
    if (e.target.classList.contains('edit-gig-btn') || e.target.closest('.edit-gig-btn')) {
        const btn = e.target.classList.contains('edit-gig-btn') ? e.target : e.target.closest('.edit-gig-btn');
        openEditGigModal(btn.dataset.id);
        return;
    }

    // Удаление подработки
    if (e.target.classList.contains('delete-gig-btn') || e.target.closest('.delete-gig-btn')) {
        const btn = e.target.classList.contains('delete-gig-btn') ? e.target : e.target.closest('.delete-gig-btn');
        if (!confirm('Удалить эту подработку навсегда?')) return;
        deleteGig(btn.dataset.id);
        return;
    }

    if (e.target.classList.contains('open-chat-btn')) { openChat(e.target.dataset.appId); return; }

    if (e.target.classList.contains('view-resume-btn')) {
        viewResume(e.target.dataset.userId, e.target.dataset.userName);
        return;
    }

    if (e.target.classList.contains('contact-candidate-btn')) {
        contactCandidate(e.target.dataset.userId, e.target.dataset.userName);
        return;
    }

    if (e.target.id === 'chat-send-btn' || e.target.closest('#chat-send-btn')) {
        sendChatMessage();
        return;
    }

    if (e.target.classList.contains('type-btn')) {
        const group = e.target.closest('.button-group');
        if (!group) return;
        group.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
        if (hiddenInput) hiddenInput.value = e.target.dataset.value;
        return;
    }

    if (e.target.classList.contains('toggle-about-btn')) {
        const btn = e.target;
        const shortP = btn.parentElement.querySelector('.short-text');
        const fullText = decodeURIComponent(btn.dataset.full);
        if (btn.textContent.includes('Показать')) {
            shortP.textContent = fullText;
            btn.textContent = 'Скрыть ↑';
        } else {
            shortP.textContent = fullText.substring(0, 180) + '...';
            btn.textContent = 'Показать полностью ↓';
        }
        return;
    }

    if (e.target.classList.contains('detail-btn')) {
        openJobDetail(e.target.dataset.id);
        return;
    }

    if (e.target.id === 'post-gig-btn' || e.target.closest('#post-gig-btn')) {
        if (!currentUser) {
            alert('Войдите в аккаунт!');
            loginModal.style.display = 'flex';
            return;
        }
        postGigModal.style.display = 'flex';
        return;
    }
});

// ====================== ЗАКРЫТИЕ МОДАЛОК ======================
// FIX: добавлен .close-job-detail который отсутствовал в оригинале
document.querySelectorAll('.close-modal, .close-register, .close-post-job, .close-respond, .close-applications, .close-chat, .close-my-jobs, .close-resume, .close-job-detail, .close-post-gig, .close-edit-gig').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) modal.style.display = 'none';

        if (modal && modal.id === 'chat-modal' && unsubscribeChat) {
            unsubscribeChat();
            unsubscribeChat = null;
        }
    });
});

// Закрытие по клику на фон модалки
document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            if (modal.id === 'chat-modal' && unsubscribeChat) {
                unsubscribeChat();
                unsubscribeChat = null;
            }
        }
    });
});

// ====================== АВТОРИЗАЦИЯ ======================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        try {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            const snap = await db.collection('users').doc(cred.user.uid).get();
            if (snap.exists) currentUser = { uid: cred.user.uid, ...snap.data() };
            loginModal.style.display = 'none';
            updateHeader();
            loadJobs();
        } catch (err) { alert('❌ ' + firebaseErrorRu(err.code)); }
    });
}

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name     = document.getElementById('reg-name').value.trim();
        const email    = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const confirm  = document.getElementById('reg-password-confirm').value;
        const role     = document.getElementById('reg-role').value;

        if (password.length < 6) return alert('Пароль должен быть минимум 6 символов');
        if (password !== confirm) return alert('Пароли не совпадают!');

        try {
            const cred = await auth.createUserWithEmailAndPassword(email, password);
            const userData = { name, email, role, registeredAt: new Date().toISOString() };
            await db.collection('users').doc(cred.user.uid).set(userData);
            alert('🎉 Регистрация прошла успешно! Теперь войдите в аккаунт.');
            registerModal.style.display = 'none';
            loginModal.style.display = 'flex';
            e.target.reset();
        } catch (err) { alert('❌ ' + firebaseErrorRu(err.code)); }
    });
}

auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
        const snap = await db.collection('users').doc(firebaseUser.uid).get();
        if (snap.exists) currentUser = { uid: firebaseUser.uid, ...snap.data() };
        await loadAppliedJobIds();
    } else {
        currentUser = null;
        appliedJobIds = new Set();
    }
    updateHeader();
    loadJobs();
});

async function loadAppliedJobIds() {
    if (!currentUser || currentUser.role !== 'candidate') return;
    const snap = await db.collection('applications')
        .where('applicantId', '==', currentUser.uid).get();
    appliedJobIds = new Set(snap.docs.map(d => d.data().jobId));
}

function logoutUser() {
    if (!confirm('Выйти из аккаунта?')) return;
    auth.signOut();
}

function firebaseErrorRu(code) {
    const map = {
        'auth/user-not-found':       'Пользователь не найден',
        'auth/wrong-password':       'Неверный пароль',
        'auth/email-already-in-use': 'Email уже используется',
        'auth/invalid-email':        'Неверный формат email',
        'auth/weak-password':        'Слишком слабый пароль (мин. 6 символов)',
        'auth/too-many-requests':    'Слишком много попыток. Попробуйте позже',
        'auth/invalid-credential':   'Неверный email или пароль',
    };
    return map[code] || 'Произошла ошибка. Попробуйте ещё раз.';
}

// ====================== ПОДРАБОТКИ — FIRESTORE ======================
function loadGigs() {
    db.collection('gigs').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        gigs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderGigs(gigs);
    });
}

function renderGigs(list) {
    const container = document.getElementById('gigs-grid');
    if (!container) return;
    container.innerHTML = '';

    if (list.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:80px 20px;color:#777;">Подработок пока нет 😔</p>`;
        return;
    }

    list.forEach(gig => {
        const payLabel = gig.payType === 'hour'
            ? `${Number(gig.pay).toLocaleString('ru-RU')} ₽/час`
            : `${Number(gig.pay).toLocaleString('ru-RU')} ₽/день`;
        const dateStr = gig.date
            ? new Date(gig.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
            : '—';

        const isOwner = currentUser && currentUser.uid === gig.authorId;
        const ownerButtons = isOwner ? `
            <div style="display:flex;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--gray-200);">
                <button class="edit-gig-btn" data-id="${gig.id}"
                    style="flex:1;padding:8px 12px;background:rgba(61,61,180,0.07);color:var(--primary);
                           border:1.5px solid rgba(61,61,180,0.2);border-radius:8px;font-size:13px;
                           font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;
                           display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i class="fas fa-pen" style="font-size:11px;pointer-events:none;"></i>
                    Редактировать
                </button>
                <button class="delete-gig-btn" data-id="${gig.id}"
                    style="flex:1;padding:8px 12px;background:transparent;color:#e63946;
                           border:1.5px solid #e63946;border-radius:8px;font-size:13px;
                           font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;
                           display:flex;align-items:center;justify-content:center;gap:6px;">
                    <i class="fas fa-trash" style="font-size:11px;pointer-events:none;"></i>
                    Удалить
                </button>
            </div>` : '';

        const isLong = gig.description && gig.description.length > 120;
        const shortDesc = isLong ? gig.description.substring(0, 120).trimEnd() + '…' : gig.description;

        const timeStr = (gig.timeStart && gig.timeEnd)
            ? `${gig.timeStart} — ${gig.timeEnd}`
            : gig.timeStart || '';

        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <div class="job-card-header">
                <div class="company-logo" style="background:rgba(255,160,0,0.1);color:#e67e00;border-color:rgba(255,160,0,0.2);">
                    <i class="fas fa-bolt"></i>
                </div>
                <div class="job-card-title-group">
                    <h3>${gig.title}</h3>
                    <div class="company-name">${gig.authorName}</div>
                </div>
            </div>
            <div class="salary" style="color:#e67e00;">${payLabel}</div>
            <div class="job-meta">
                <i class="fas fa-map-marker-alt job-meta-icon"></i> ${gig.city}
                <span style="opacity:0.4;">•</span>
                <i class="fas fa-calendar job-meta-icon"></i> ${dateStr}
                ${timeStr ? `<span style="opacity:0.4;">•</span><i class="fas fa-clock job-meta-icon"></i> ${timeStr}` : ''}
            </div>
            <div class="job-tags">
                <span class="job-tag" style="background:rgba(255,160,0,0.08);color:#e67e00;border-color:rgba(255,160,0,0.2);">
                    ${gig.payType === 'hour' ? '⏱ Почасовая' : '📅 За день'}
                </span>
            </div>
            <div class="gig-desc-wrap" style="margin:10px 0 14px;">
                <p class="gig-desc-text" style="font-size:13.5px;color:var(--gray-600);line-height:1.6;margin:0;">${shortDesc}</p>
                ${isLong ? `
                <button class="gig-expand-btn" data-full="${encodeURIComponent(gig.description)}" data-short="${encodeURIComponent(shortDesc)}" data-expanded="false"
                    style="margin-top:5px;background:none;border:none;padding:0;font-size:12.5px;font-weight:700;
                           color:#e67e00;cursor:pointer;font-family:inherit;display:inline-flex;align-items:center;gap:4px;
                           text-decoration:underline;text-underline-offset:3px;text-decoration-color:rgba(230,126,0,0.4);">
                    <i class="fas fa-chevron-down" style="font-size:10px;transition:transform 0.2s;pointer-events:none;"></i>
                    Читать полностью
                </button>` : ''}
            </div>
            <a href="tel:${gig.phone}" class="gig-contact-btn">
                <i class="fas fa-phone"></i>
                ${gig.phone}
            </a>
            ${ownerButtons}`;
        container.appendChild(card);
    });
}

// Открыть модал редактирования подработки
function openEditGigModal(gigId) {
    const gig = gigs.find(g => g.id === gigId);
    if (!gig) return;

    editingGigId = gigId;

    document.getElementById('edit-gig-title').value       = gig.title || '';
    document.getElementById('edit-gig-city').value        = gig.city || '';
    document.getElementById('edit-gig-date').value        = gig.date || '';
    document.getElementById('edit-gig-time-start').value  = gig.timeStart || '';
    document.getElementById('edit-gig-time-end').value    = gig.timeEnd || '';
    document.getElementById('edit-gig-pay').value         = gig.pay || '';
    document.getElementById('edit-gig-phone').value       = gig.phone || '';
    document.getElementById('edit-gig-description').value = gig.description || '';

    const payType = gig.payType || 'day';
    document.getElementById('edit-gig-pay-type').value = payType;
    document.querySelectorAll('#edit-gig-pay-type-group .type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.value === payType);
    });

    editGigModal.style.display = 'flex';
}

// Сохранить изменения подработки
const editGigForm = document.getElementById('edit-gig-form');
if (editGigForm) {
    editGigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || !editingGigId) return;

        const updatedData = {
            title:       document.getElementById('edit-gig-title').value.trim(),
            city:        document.getElementById('edit-gig-city').value.trim(),
            date:        document.getElementById('edit-gig-date').value,
            timeStart:   document.getElementById('edit-gig-time-start').value,
            timeEnd:     document.getElementById('edit-gig-time-end').value,
            payType:     document.getElementById('edit-gig-pay-type').value,
            pay:         parseInt(document.getElementById('edit-gig-pay').value),
            phone:       document.getElementById('edit-gig-phone').value.trim(),
            description: document.getElementById('edit-gig-description').value.trim(),
        };

        try {
            await db.collection('gigs').doc(editingGigId).update(updatedData);
            alert('✅ Подработка успешно обновлена!');
            editGigModal.style.display = 'none';
            editingGigId = null;
        } catch (err) {
            alert('Ошибка при обновлении: ' + err.message);
        }
    });
}

// Удалить подработку
async function deleteGig(gigId) {
    try {
        await db.collection('gigs').doc(gigId).delete();
        alert('🗑 Подработка удалена.');
    } catch (err) {
        alert('Ошибка при удалении: ' + err.message);
    }
}

// Публикация новой подработки
const postGigForm = document.getElementById('post-gig-form');
if (postGigForm) {
    postGigForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const gigData = {
            title:       document.getElementById('gig-title').value.trim(),
            city:        document.getElementById('gig-city').value.trim(),
            date:        document.getElementById('gig-date').value,
            timeStart:   document.getElementById('gig-time-start').value,
            timeEnd:     document.getElementById('gig-time-end').value,
            payType:     document.getElementById('gig-pay-type').value,
            pay:         parseInt(document.getElementById('gig-pay').value),
            phone:       document.getElementById('gig-phone').value.trim(),
            description: document.getElementById('gig-description').value.trim(),
            authorId:    currentUser.uid,
            authorName:  currentUser.name,
            createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
        };

        try {
            await db.collection('gigs').add(gigData);
            alert('✅ Подработка успешно опубликована!');
            postGigModal.style.display = 'none';
            e.target.reset();
        } catch (err) {
            alert('Ошибка: ' + err.message);
        }
    });
}

// ====================== ВАКАНСИИ — FIRESTORE ======================
function loadJobs() {
    db.collection('jobs').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        updateCategoryCounts();
        renderJobs(getFilteredJobs());
    });
}

async function saveJob(jobData) {
    if (editingJobId) {
        await db.collection('jobs').doc(editingJobId).update(jobData);
        alert('✅ Вакансия успешно обновлена!');
        editingJobId = null;
    } else {
        jobData.createdAt    = firebase.firestore.FieldValue.serverTimestamp();
        jobData.employerId   = currentUser.uid;
        jobData.employerName = currentUser.name;
        await db.collection('jobs').add(jobData);
        alert('✅ Вакансия успешно опубликована!');
    }
}

async function deleteJob(jobId) {
    const appsSnap = await db.collection('applications').where('jobId', '==', jobId).get();
    const batch = db.batch();
    appsSnap.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(db.collection('jobs').doc(jobId));
    await batch.commit();
    showMyJobs();
}

function openPostJobModal() {
    if (!currentUser || currentUser.role !== 'employer') {
        alert('Только работодатели могут размещать вакансии!');
        if (!currentUser) loginModal.style.display = 'flex';
        return;
    }
    postJobModal.style.display = 'flex';
}

function openJobDetail(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const alreadyApplied = currentUser?.role === 'candidate' && appliedJobIds.has(job.id);
    const respondBtnHtml = alreadyApplied
        ? `<button class="jd-respond-btn responded" disabled>✓ Вы уже откликнулись</button>`
        : `<button class="jd-respond-btn respond-btn" data-id="${job.id}">Откликнуться на вакансию</button>`;

    const date = job.createdAt?.toDate
        ? job.createdAt.toDate().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'недавно';

    document.getElementById('job-detail-body').innerHTML = `
        <div class="jd-header">
            <div class="jd-logo">${job.company?.charAt(0)?.toUpperCase() || '?'}</div>
            <div class="jd-header-info">
                <h2>${job.title}</h2>
                <p>${job.company}${job.employerName ? ` • ${job.employerName}` : ''}</p>
            </div>
        </div>
        <div class="jd-body">
            <div class="jd-grid">
                <div class="jd-param">
                    <div class="jd-param-label">Зарплата</div>
                    <div class="jd-param-value salary">${Number(job.salary).toLocaleString('ru-RU')} ₽</div>
                </div>
                <div class="jd-param">
                    <div class="jd-param-label">Город</div>
                    <div class="jd-param-value">📍 ${job.city}</div>
                </div>
                <div class="jd-param">
                    <div class="jd-param-label">Опыт работы</div>
                    <div class="jd-param-value">🎓 ${job.experience}</div>
                </div>
                <div class="jd-param">
                    <div class="jd-param-label">Формат</div>
                    <div class="jd-param-value">🏠 ${job.remote || '—'}</div>
                </div>
            </div>
            <div class="jd-tags">
                ${job.type     ? `<span class="jd-tag">💼 ${job.type}</span>` : ''}
                ${job.schedule ? `<span class="jd-tag">📅 ${job.schedule}</span>` : ''}
                ${job.remote   ? `<span class="jd-tag">📍 ${job.remote}</span>` : ''}
            </div>
            <div class="jd-section-label">Описание вакансии</div>
            <div class="jd-description">${job.description || 'Описание не указано'}</div>
            <div class="jd-footer">
                <span class="jd-date">Опубликовано: ${date}</span>
                ${respondBtnHtml}
            </div>
        </div>`;

    jobDetailModal.style.display = 'flex';
}

function editJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    editingJobId = jobId;
    document.getElementById('job-title').value       = job.title || '';
    document.getElementById('job-company').value     = job.company || '';
    document.getElementById('job-salary').value      = job.salary || '';
    document.getElementById('job-city').value        = job.city || '';
    document.getElementById('job-experience').value  = job.experience || '';
    document.getElementById('job-description').value = job.description || '';

    ['job-type', 'job-remote', 'job-schedule'].forEach(inputId => {
        const hiddenInput = document.getElementById(inputId);
        const group = document.getElementById(inputId + '-group');
        const fieldKey = inputId.replace('job-', '');
        if (!hiddenInput || !group || !job[fieldKey]) return;
        const val = job[fieldKey];
        hiddenInput.value = val;
        group.querySelectorAll('.type-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.value === val);
        });
    });

    document.querySelector('#post-job-modal h2').textContent = 'Редактировать вакансию';
    myJobsModal.style.display = 'none';
    postJobModal.style.display = 'flex';
}

const postJobForm = document.getElementById('post-job-form');
if (postJobForm) {
    postJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser || currentUser.role !== 'employer') return;

        const jobData = {
            title:       document.getElementById('job-title').value.trim(),
            company:     document.getElementById('job-company').value.trim(),
            salary:      parseInt(document.getElementById('job-salary').value),
            city:        document.getElementById('job-city').value.trim(),
            experience:  document.getElementById('job-experience').value.trim(),
            description: document.getElementById('job-description').value.trim(),
            type:        document.getElementById('job-type').value,
            remote:      document.getElementById('job-remote').value,
            schedule:    document.getElementById('job-schedule').value,
        };

        try {
            await saveJob(jobData);
            postJobModal.style.display = 'none';
            e.target.reset();
            document.querySelector('#post-job-modal h2').textContent = 'Разместить новую вакансию';
            resetButtonGroups();
            if (myJobsModal.style.display === 'flex') showMyJobs();
        } catch (err) { alert('Ошибка при сохранении: ' + err.message); }
    });
}

function resetButtonGroups() {
    document.querySelectorAll('.button-group').forEach(group => {
        const btns = group.querySelectorAll('.type-btn');
        btns.forEach((btn, i) => btn.classList.toggle('active', i === 0));
        const hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
        if (hiddenInput && btns[0]) hiddenInput.value = btns[0].dataset.value;
    });
}

// ====================== МОИ ВАКАНСИИ ======================
function showMyJobs() {
    if (currentUser?.role !== 'employer') return;
    const container = document.getElementById('my-jobs-list');
    container.innerHTML = '';
    const myJobs = jobs.filter(j => j.employerId === currentUser.uid);

    if (myJobs.length === 0) {
        container.innerHTML = `<p style="text-align:center;padding:60px;color:#777;">У вас пока нет размещённых вакансий</p>`;
    } else {
        myJobs.forEach(job => {
            const div = document.createElement('div');
            div.className = 'application-item';
            div.innerHTML = `
                <div class="app-header">
                    <strong>${job.title}</strong>
                    <span>${Number(job.salary).toLocaleString('ru-RU')} ₽</span>
                </div>
                <p>${job.city} • ${job.experience}</p>
                <div style="margin-top:12px;display:flex;gap:8px;">
                    <button class="edit-job-btn" data-id="${job.id}">Редактировать</button>
                    <button class="delete-job-btn" data-id="${job.id}">Удалить</button>
                </div>`;
            container.appendChild(div);
        });
    }
    myJobsModal.style.display = 'flex';
}

// ====================== МОИ ОТКЛИКИ ======================
async function showMyApplications() {
    if (!currentUser) return;

    if (currentUser.role === 'candidate') {
        const container = document.getElementById('applications-list');
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#777;">Загрузка...</p>';
        applicationsModal.style.display = 'flex';

        const snap = await db.collection('applications')
            .where('applicantId', '==', currentUser.uid).get();
        applications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        container.innerHTML = '';

        if (applications.length === 0) {
            container.innerHTML = `<p style="text-align:center;padding:80px;color:#777;">Вы ещё не откликались на вакансии</p>`;
            return;
        }

        applications.forEach(app => {
            const div = document.createElement('div');
            div.className = 'application-item';
            div.innerHTML = `
                <div class="app-header">
                    <strong>${app.jobTitle}</strong>
                    <span>${new Date(app.date).toLocaleDateString('ru-RU')}</span>
                </div>
                <p class="cover-letter">${app.message}</p>
                <div style="margin-top:12px;display:flex;gap:8px;">
                    <button class="open-chat-btn" data-app-id="${app.id}">💬 Чат</button>
                </div>`;
            container.appendChild(div);
        });

    } else {
        const myJobIds = jobs.filter(j => j.employerId === currentUser.uid).map(j => j.id);
        const container = document.getElementById('applications-list');
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#777;">Загрузка...</p>';
        applicationsModal.style.display = 'flex';

        if (myJobIds.length === 0) {
            container.innerHTML = `<p style="text-align:center;padding:80px;color:#777;">У вас нет вакансий с откликами</p>`;
            return;
        }

        const snap = await db.collection('applications').where('jobId', 'in', myJobIds).get();
        applications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        container.innerHTML = '';

        if (applications.length === 0) {
            container.innerHTML = `<p style="text-align:center;padding:80px;color:#777;">Откликов пока нет</p>`;
            return;
        }

        applications.forEach(app => {
            const div = document.createElement('div');
            div.className = 'application-item';
            div.innerHTML = `
                <div class="app-header">
                    <strong>${app.applicantName}</strong>
                    <span>${new Date(app.date).toLocaleDateString('ru-RU')}</span>
                </div>
                <p style="color:#777;font-size:13px;">Вакансия: ${app.jobTitle}</p>
                <p class="cover-letter">${app.message}</p>
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="open-chat-btn" data-app-id="${app.id}">💬 Чат</button>
                    <button class="view-resume-btn" data-user-id="${app.applicantId}" data-user-name="${app.applicantName}">📄 Резюме</button>
                </div>`;
            container.appendChild(div);
        });
    }
}

// ====================== ОТКЛИК НА ВАКАНСИЮ ======================
const respondForm = document.getElementById('respond-form');
if (respondForm) {
    respondForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const jobId = e.target.dataset.jobId;
        if (!jobId || !currentUser) return;

        const dup = await db.collection('applications')
            .where('jobId', '==', jobId)
            .where('applicantId', '==', currentUser.uid).get();
        if (!dup.empty) {
            alert('Вы уже откликались на эту вакансию!');
            respondModal.style.display = 'none';
            return;
        }

        const job = jobs.find(j => j.id === jobId);
        const message = document.getElementById('cover-letter').value.trim() || 'Без сопроводительного письма';

        try {
            await db.collection('applications').add({
                jobId,
                jobTitle:      job?.title || 'Вакансия',
                applicantId:   currentUser.uid,
                applicantName: currentUser.name,
                message,
                date: new Date().toISOString(),
            });
            appliedJobIds.add(jobId);
            renderJobs(getFilteredJobs());
            respondModal.style.display = 'none';
            if (jobDetailModal) jobDetailModal.style.display = 'none';
            e.target.reset();
            alert('✅ Отклик успешно отправлен!');
        } catch (err) { alert('Ошибка при отправке отклика: ' + err.message); }
    });
}

// ====================== ЧАТ ======================
function openChat(appId) {
    currentChatAppId = appId;
    const app = applications.find(a => a.id === appId);
    const jobTitle     = app?.jobTitle || 'Чат';
    const interlocutor = currentUser.role === 'employer'
        ? app?.applicantName
        : (jobs.find(j => j.id === app?.jobId)?.company || 'Работодатель');

    document.getElementById('chat-job-title').textContent = jobTitle;
    document.getElementById('chat-with').textContent = `Собеседник: ${interlocutor}`;
    document.getElementById('chat-messages').innerHTML = '<p style="text-align:center;color:#777;padding:40px;">Загрузка...</p>';
    chatModal.style.display = 'flex';

    if (unsubscribeChat) unsubscribeChat();

    unsubscribeChat = db.collection('applications').doc(appId)
        .collection('messages').orderBy('time', 'asc')
        .onSnapshot(snap => {
            renderChatMessages(snap.docs.map(d => d.data()));
        });
}

function renderChatMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    if (!messages || messages.length === 0) {
        container.innerHTML = `<p style="text-align:center;color:#777;padding:40px;">Напишите первое сообщение...</p>`;
        return;
    }

    messages.forEach(msg => {
        const isMe = msg.senderId === currentUser.uid;
        const div = document.createElement('div');
        div.className = `chat-message ${isMe ? 'my-message' : 'their-message'}`;
        div.innerHTML = `
            <small>${new Date(msg.time?.toDate?.() || msg.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small>
            <p>${msg.text}</p>`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || !currentChatAppId) return;

    await db.collection('applications').doc(currentChatAppId)
        .collection('messages').add({
            senderId:   currentUser.uid,
            senderName: currentUser.name,
            text,
            time: firebase.firestore.FieldValue.serverTimestamp(),
        });
    input.value = '';
}

const chatInput = document.getElementById('chat-input');
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
}

// ====================== РЕЗЮМЕ ======================
document.getElementById('nav-resume')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentUser) { alert('Войдите в аккаунт!'); loginModal.style.display = 'flex'; return; }
    if (currentUser.role === 'candidate') {
        await loadMyResume();
        resumeModal.style.display = 'flex';
    } else { showAllResumes(); }
});

async function loadMyResume() {
    document.querySelector('#resume-modal h2').textContent = 'Моё резюме';
    document.getElementById('resume-form').style.display = 'block';
    const snap = await db.collection('resumes').doc(currentUser.uid).get();
    if (snap.exists) {
        const r = snap.data();
        document.getElementById('resume-position').value   = r.position || '';
        document.getElementById('resume-city').value       = r.city || '';
        document.getElementById('resume-experience').value = r.experience || 0;
        document.getElementById('resume-about').value      = r.about || '';
    } else { document.getElementById('resume-form').reset(); }
}

document.getElementById('resume-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const resumeData = {
        position:   document.getElementById('resume-position').value.trim(),
        city:       document.getElementById('resume-city').value.trim(),
        experience: parseInt(document.getElementById('resume-experience').value) || 0,
        about:      document.getElementById('resume-about').value.trim(),
        authorName: currentUser.name,
        authorId:   currentUser.uid,
        savedAt:    new Date().toISOString(),
    };
    await db.collection('resumes').doc(currentUser.uid).set(resumeData);
    alert('✅ Резюме успешно сохранено!');
    resumeModal.style.display = 'none';
});

async function showAllResumes() {
    document.querySelector('#resume-modal h2').textContent = 'Резюме соискателей';
    document.getElementById('resume-form').style.display = 'none';

    let listContainer = document.getElementById('all-resumes-list');
    if (!listContainer) {
        listContainer = document.createElement('div');
        listContainer.id = 'all-resumes-list';
        listContainer.className = 'applications-list';
        listContainer.style.marginTop = '20px';
        resumeModal.querySelector('.modal-content').appendChild(listContainer);
    }
    listContainer.innerHTML = '<p style="text-align:center;padding:40px;color:#777;">Загрузка...</p>';
    resumeModal.style.display = 'flex';

    const snap = await db.collection('resumes').orderBy('savedAt', 'desc').get();
    listContainer.innerHTML = '';

    if (snap.empty) {
        listContainer.innerHTML = `<p style="text-align:center;padding:80px;color:#777;">Пока никто не заполнил резюме</p>`;
        return;
    }

    snap.docs.forEach(doc => {
        const resume = doc.data();
        const userId = doc.id;
        const aboutText = resume.about || '';
        const shortText = aboutText.length > 180 ? aboutText.substring(0, 180) + '...' : aboutText;

        const div = document.createElement('div');
        div.className = 'application-item';
        div.innerHTML = `
            <div class="app-header">
                <strong>${resume.authorName || '—'}</strong>
                <span>${resume.position || '—'}</span>
            </div>
            <p><strong>Город:</strong> ${resume.city} • <strong>Опыт:</strong> ${resume.experience} лет</p>
            <div class="about-section">
                <p class="cover-letter short-text">${shortText}</p>
                ${aboutText.length > 180 ? `
                <button class="toggle-about-btn" data-full="${encodeURIComponent(aboutText)}">Показать полностью ↓</button>` : ''}
            </div>
            <button class="contact-candidate-btn" data-user-id="${userId}" data-user-name="${resume.authorName}" style="margin-top:12px;">
                Связаться
            </button>`;
        listContainer.appendChild(div);
    });
}

async function viewResume(userId, userName) {
    const snap = await db.collection('resumes').doc(userId).get();
    if (!snap.exists) { alert(`Пользователь ${userName} ещё не заполнил резюме.`); return; }
    const r = snap.data();
    alert(`Резюме кандидата: ${userName}\n\nДолжность: ${r.position}\nГород: ${r.city}\nОпыт: ${r.experience} лет\n\nО себе:\n${r.about}`);
}

async function contactCandidate(userId, userName) {
    const snap = await db.collection('applications')
        .where('applicantId', '==', userId)
        .where('jobId', '==', 'direct')
        .where('employerId', '==', currentUser.uid).get();

    let appId;
    if (!snap.empty) {
        appId = snap.docs[0].id;
    } else {
        const ref = await db.collection('applications').add({
            jobId:         'direct',
            jobTitle:      'Прямое сообщение',
            applicantId:   userId,
            applicantName: userName,
            employerId:    currentUser.uid,
            message:       '',
            date:          new Date().toISOString(),
        });
        appId = ref.id;
    }
    if (!applications.find(a => a.id === appId)) {
        applications.push({ id: appId, jobTitle: 'Прямое сообщение', applicantId: userId, applicantName: userName });
    }
    resumeModal.style.display = 'none';
    openChat(appId);
}

// ====================== НАВИГАЦИЯ ======================
document.getElementById('nav-gigs')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('.hero').style.display               = 'none';
    document.querySelector('.categories-section').style.display = 'none';
    document.querySelector('.jobs-section').style.display       = 'none';
    document.querySelector('.features-section').style.display   = 'none';
    document.getElementById('gigs-section').style.display       = 'block';
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    e.target.classList.add('active');
    loadGigs();
});

// FIX: объединены два конфликтующих nav-vacancies обработчика в один
document.getElementById('nav-vacancies')?.addEventListener('click', function(e) {
    e.preventDefault();

    // Показываем основные секции
    const hero = document.querySelector('.hero');
    const cats = document.querySelector('.categories-section');
    const jobsSec = document.querySelector('.jobs-section');
    const feats = document.querySelector('.features-section');
    const gigsSec = document.getElementById('gigs-section');

    if (hero)     hero.style.display     = '';
    if (cats)     cats.style.display     = '';
    if (jobsSec)  jobsSec.style.display  = '';
    if (feats)    feats.style.display    = '';
    if (gigsSec)  gigsSec.style.display  = 'none';

    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    this.classList.add('active');

    // Плавный скролл к секции вакансий
    const target = document.getElementById('jobs-section-anchor');
    if (!target) return;
    const headerHeight = document.querySelector('.header')?.offsetHeight || 70;
    const targetTop = target.getBoundingClientRect().top + window.scrollY - headerHeight;
    const startTop  = window.scrollY;
    const distance  = targetTop - startTop;
    const duration  = 800;
    let startTime   = null;

    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed  = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        window.scrollTo(0, startTop + distance * easeInOutCubic(progress));
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
});

// ====================== ФИЛЬТРЫ ======================
function getFilteredJobs() {
    const searchText   = document.getElementById('search-input').value.toLowerCase().trim();
    const selectedCity = document.getElementById('city-select').value;
    const minSalary    = parseInt(document.getElementById('salary-slider').value) || 0;

    const categoryKeywords = {
    'Разработка': ['разработч','программист','developer','frontend','backend','fullstack','python','javascript','react','vue','angular','java','swift','kotlin','php','golang','devops','тестировщик','software engineer'],
    'Маркетинг':  ['маркетолог','маркетинг','marketing','таргетолог реклам','seo-','sem-','бренд-менедж','медиапланир','продвижени сайт'],
    'Дизайн':     ['дизайнер','веб-дизайн','figma','photoshop','illustrator','ux/ui','ui/ux','графический дизайн','верстальщик','motion design','арт-директор'],
    'Продажи':    ['менеджер по продажам','менеджер продаж','sales manager','b2b продаж','b2c продаж','торговый представ','продавец-консульт','оптовых продаж'],
    'СММ':        ['смм','smm-','социальных сетях','instagram','вконтакте','tiktok','telegram','reels','комьюнити','контент-менеджер','инфлюенс','поддержк','support','helpdesk','оператор','клиентской поддержк','служба поддержк'],
};

    return jobs.filter(job => {
        const matchText = !searchText ||
            job.title?.toLowerCase().includes(searchText) ||
            job.company?.toLowerCase().includes(searchText);
        const matchCity = !selectedCity || job.city === selectedCity;

        // Новая логика категорий с ключевыми словами
        const keywords = categoryKeywords[activeCategory];
        const jobText  = `${job.title} ${job.description}`.toLowerCase();
        const matchCategory = !activeCategory ||
            (keywords
                ? keywords.some(kw => jobText.includes(kw))
                : jobText.includes(activeCategory.toLowerCase())
            );

        const matchType     = !filterType     || job.type     === filterType;
        const matchRemote   = !filterRemote   || job.remote   === filterRemote;
        const matchSchedule = !filterSchedule || job.schedule === filterSchedule;

        return matchText && matchCity && matchCategory && matchType && matchRemote && matchSchedule && job.salary >= minSalary;
    });
}

function renderJobs(filteredJobs) {
    const container = document.getElementById('jobs-grid');
    container.innerHTML = '';

    if (filteredJobs.length === 0) {
        container.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:80px 20px;color:#777;">Вакансий не найдено 😔</p>`;
        return;
    }

    filteredJobs.forEach(job => {
        const alreadyApplied = currentUser?.role === 'candidate' && appliedJobIds.has(job.id);
        const respondBtn = alreadyApplied
            ? `<button class="respond-btn responded" disabled
                style="background:rgba(39,174,96,0.08);color:#27ae60;border-color:rgba(39,174,96,0.3);cursor:default;">
                ✓ Вы откликнулись</button>`
            : `<button class="respond-btn" data-id="${job.id}">Откликнуться</button>`;

        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <div class="job-card-header">
                <div class="company-logo">${job.company?.charAt(0)?.toUpperCase() || '?'}</div>
                <div class="job-card-title-group">
                    <h3>${job.title}</h3>
                    <div class="company-name">${job.company}</div>
                </div>
            </div>
            <div class="salary">${Number(job.salary).toLocaleString('ru-RU')} ₽</div>
            <div class="job-meta">
                <i class="fas fa-map-marker-alt job-meta-icon"></i>
                ${job.city}
                <span style="opacity:0.4;">•</span>
                <i class="fas fa-graduation-cap job-meta-icon"></i>
                ${job.experience}
            </div>
            <div class="job-tags">
                ${job.remote   ? `<span class="job-tag">${job.remote}</span>`   : ''}
                ${job.schedule ? `<span class="job-tag">${job.schedule}</span>` : ''}
                ${job.type     ? `<span class="job-tag">${job.type}</span>`     : ''}
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;">
                <button class="detail-btn" data-id="${job.id}">
                    <i class="fas fa-eye" style="font-size:13px;"></i>
                    Подробнее
                </button>
                ${respondBtn}
            </div>`;
        container.appendChild(card);
    });
}

// ====================== СЛАЙДЕР ЗАРПЛАТЫ ======================
const salarySlider = document.getElementById('salary-slider');
const salaryInput  = document.getElementById('salary-input');
const salaryValue  = document.getElementById('salary-value');

function updateSalaryDisplay() {
    const value = parseInt(salarySlider.value) || 0;
    salaryValue.textContent = value.toLocaleString('ru-RU') + ' ₽';
    salaryInput.value = value;
}

salarySlider.addEventListener('input', () => { updateSalaryDisplay(); renderJobs(getFilteredJobs()); });
salaryInput.addEventListener('input', () => {
    let val = parseInt(salaryInput.value) || 0;
    if (val > 300000) val = 300000;
    salarySlider.value = val;
    updateSalaryDisplay();
    renderJobs(getFilteredJobs());
});

document.getElementById('search-input').addEventListener('input', () => renderJobs(getFilteredJobs()));
document.getElementById('search-btn').addEventListener('click', () => renderJobs(getFilteredJobs()));

document.getElementById('register-link')?.addEventListener('click', e => {
    e.preventDefault();
    loginModal.style.display = 'none';
    registerModal.style.display = 'flex';
});
document.getElementById('login-link')?.addEventListener('click', e => {
    e.preventDefault();
    registerModal.style.display = 'none';
    loginModal.style.display = 'flex';
});

// ====================== ИНИЦИАЛИЗАЦИЯ ======================
initTheme();
updateSalaryDisplay();
initModals();
initCitySelect();
initCategories();
initFilters();
initRegisterSteps();

// ====================== ШАГИ РЕГИСТРАЦИИ ======================
function initRegisterSteps() {
    const step1 = document.getElementById('register-step-1');
    const step2 = document.getElementById('register-step-2');
    const nextBtn = document.getElementById('role-next-btn');
    const backBtn = document.getElementById('register-back-btn');
    const badge   = document.getElementById('register-role-badge');
    const roleInput = document.getElementById('reg-role');
    const cardCandidate = document.getElementById('role-candidate');
    const cardEmployer  = document.getElementById('role-employer');
    let selectedRole = '';

    function selectRole(role, card) {
        selectedRole = role;
        cardCandidate.classList.remove('selected');
        cardEmployer.classList.remove('selected');
        card.classList.add('selected');
        nextBtn.disabled = false;
        nextBtn.style.opacity = '1';
        nextBtn.style.cursor = 'pointer';
    }

    cardCandidate.addEventListener('click', () => selectRole('candidate', cardCandidate));
    cardEmployer.addEventListener('click',  () => selectRole('employer',  cardEmployer));

    nextBtn.addEventListener('click', () => {
        if (!selectedRole) return;
        roleInput.value = selectedRole;
        badge.textContent = selectedRole === 'candidate' ? '👤 Соискатель' : '🏢 Работодатель';
        step1.style.display = 'none';
        step2.style.display = 'block';
    });

    backBtn.addEventListener('click', () => { step2.style.display = 'none'; step1.style.display = 'block'; });

    document.querySelector('.close-register').addEventListener('click', () => {
        step1.style.display = 'block';
        step2.style.display = 'none';
        selectedRole = '';
        cardCandidate.classList.remove('selected');
        cardEmployer.classList.remove('selected');
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
    });
}

// ====================== КАСТОМНЫЙ ДРОПДАУН ГОРОДА ======================
function initCitySelect() {
    const cities = [
        'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург',
        'Казань', 'Нижний Новгород', 'Челябинск', 'Самара',
        'Ростов-на-Дону', 'Уфа', 'Красноярск', 'Пермь',
        'Воронеж', 'Краснодар', 'divider', 'Удалённо'
    ];

    const wrap     = document.getElementById('citySelectWrap');
    const trigger  = document.getElementById('csTrigger');
    const dropdown = document.getElementById('csDropdown');
    const list     = document.getElementById('csList');
    const hidden   = document.getElementById('city-select');

    if (!wrap) return;

    trigger.innerHTML = `
        <i class="fas fa-map-marker-alt cs-icon"></i>
        <input type="text" id="csInput" placeholder="Выберите город" autocomplete="off"
            style="border:none;outline:none;background:transparent;font-size:15px;font-family:inherit;
                   color:#1a1d3a;width:140px;cursor:pointer;">
        <i class="fas fa-chevron-down cs-arrow"></i>`;

    const input = document.getElementById('csInput');

    function renderList(filter = '') {
        list.innerHTML = '';
        if (hidden.value) {
            const reset = document.createElement('div');
            reset.className = 'cs-option cs-reset';
            reset.innerHTML = `<i class="fas fa-times" style="font-size:12px;color:#e63946;width:16px;text-align:center;"></i>Сбросить выбор`;
            reset.style.color = '#e63946';
            reset.addEventListener('click', () => {
                hidden.value = '';
                input.value = '';
                input.placeholder = 'Выберите город';
                close();
                renderJobs(getFilteredJobs());
            });
            list.appendChild(reset);
            const div = document.createElement('div');
            div.className = 'cs-divider';
            list.appendChild(div);
        }

        const filtered = filter
            ? cities.filter(c => c !== 'divider' && c.toLowerCase().includes(filter.toLowerCase()))
            : cities;

        let hasResults = false;
        filtered.forEach(c => {
            if (c === 'divider') {
                if (!filter) { const div = document.createElement('div'); div.className = 'cs-divider'; list.appendChild(div); }
                return;
            }
            hasResults = true;
            const div = document.createElement('div');
            div.className = 'cs-option' + (hidden.value === c ? ' selected' : '');
            const icon = c === 'Удалённо' ? 'fa-home' : 'fa-building';
            div.innerHTML = `<i class="fas ${icon}" style="font-size:12px;color:#9ca3bc;width:16px;text-align:center;"></i>${c}<i class="fas fa-check cs-check"></i>`;
            div.addEventListener('click', () => {
                hidden.value = c;
                input.value = c;
                list.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
                div.classList.add('selected');
                close();
                renderJobs(getFilteredJobs());
            });
            list.appendChild(div);
        });

        if (!hasResults) {
            const div = document.createElement('div');
            div.className = 'cs-option';
            div.innerHTML = `<i class="fas fa-plus" style="font-size:12px;color:#3d3db4;width:16px;text-align:center;"></i>Использовать «${filter}»`;
            div.style.color = '#3d3db4';
            div.addEventListener('click', () => { hidden.value = filter; input.value = filter; close(); renderJobs(getFilteredJobs()); });
            list.appendChild(div);
        }
    }

    function open()  { trigger.classList.add('open'); dropdown.classList.add('open'); renderList(input.value); input.focus(); }
    function close() { trigger.classList.remove('open'); dropdown.classList.remove('open'); }

    trigger.addEventListener('click', (e) => { e.stopPropagation(); dropdown.classList.contains('open') ? close() : open(); });
    input.addEventListener('input', (e) => { e.stopPropagation(); if (!dropdown.classList.contains('open')) { trigger.classList.add('open'); dropdown.classList.add('open'); } renderList(input.value); });
    input.addEventListener('click', (e) => { e.stopPropagation(); if (!dropdown.classList.contains('open')) open(); });
    document.addEventListener('click', (e) => { if (!wrap.contains(e.target)) close(); });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { const first = list.querySelector('.cs-option:not(.cs-reset)'); if (first) first.click(); }
        if (e.key === 'Escape') close();
    });
}

// ====================== ФИЛЬТРЫ-ЧИПЫ ======================
function initFilters() {
    function bindChips(groupId, setter) {
        const group = document.getElementById(groupId);
        if (!group) return;
        group.querySelectorAll('.filter-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                group.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                setter(btn.dataset.value);
                renderJobs(getFilteredJobs());
            });
        });
    }
    bindChips('filter-type',     v => filterType     = v);
    bindChips('filter-remote',   v => filterRemote   = v);
    bindChips('filter-schedule', v => filterSchedule = v);
}

// ====================== КАТЕГОРИИ ======================
function initCategories() {
    document.querySelectorAll('.category-card').forEach(card => {
        card.addEventListener('click', e => {
            e.preventDefault();
            document.querySelectorAll('.category-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            activeCategory = card.dataset.cat || '';
            const searchInput = document.getElementById('search-input');
            if (searchInput) searchInput.value = '';
            renderJobs(getFilteredJobs());
            document.querySelector('.jobs-section')?.scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function updateCategoryCounts() {
   const categoryKeywords = {
    'Разработка': [
        'разработ', 'программ', 'developer', 'frontend', 'backend',
        'fullstack', 'python', 'javascript', 'react', 'vue', 'angular',
        'java', 'swift', 'kotlin', 'php', 'c++', 'c#', 'golang',
        'devops', 'qa', 'тестировщ', 'software', 'инженер-программ',
        'веб-разработ', 'мобильн'
    ],
    'Маркетинг': [
        'маркетолог', 'маркетинг', 'marketing', 'реклам', 'seo', 'sem',
        'бренд', 'пиар', 'pr-', 'трафик', 'продвижен',
        'email-маркет', 'crm', 'growth hacker', 'медиапланир'
    ],
    'Дизайн': [
        'дизайнер', 'дизайн', 'design', 'figma', 'photoshop', 'illustrator',
        'ux', 'ui', 'графич', 'верстальщ', 'motion', '3d-', 'sketch',
        'арт-директ', 'визуал', 'интерфейс'
    ],
    'Продажи': [
        'менеджер по продаж', 'менеджер продаж', 'sales manager',
        'b2b', 'b2c', 'тендер', 'коммерч директ',
        'торгов представ', 'оптов', 'розниц',
        'продавец', 'реализац'
    ],
    'СММ': [
        'смм', 'smm', 'социальн сет', 'instagram', 'вконтакте', 'tiktok',
        'telegram', 'youtube', 'блогер', 'reels', 'таргетолог',
        'комьюнити', 'контент-менедж', 'инфлюенс',
        'поддержк', 'клиентской поддержк', 'техническ поддержк',
        'служба поддержк', 'support', 'helpdesk', 'оператор'
    ],
};

    Object.entries(categoryKeywords).forEach(([cat, keywords]) => {
        const count = jobs.filter(job => {
            const text = `${job.title} ${job.description}`.toLowerCase();
            return keywords.some(kw => text.includes(kw.toLowerCase()));
        }).length;

        const el = document.getElementById(`cat-count-${cat}`);
        if (el) el.textContent = formatCount(count);
    });

    const allEl = document.getElementById('cat-count-all');
    if (allEl) allEl.textContent = formatCount(jobs.length);
}

function formatCount(n) {
    if (n === 0)      return '0 вакансий';
    if (n === 1)      return '1 вакансия';
    if (n < 5)        return `${n} вакансии`;
    return `${n} вакансий`;
}