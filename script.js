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
let currentUser = null;       // { uid, name, email, role }
let jobs = [];                // массив вакансий из Firestore
let applications = [];        // массив откликов из Firestore
let editingJobId = null;      // id вакансии при редактировании
let currentChatAppId = null;  // id отклика в открытом чате
let unsubscribeChat = null;   // отписка от слушателя чата

// ====================== DOM-ЭЛЕМЕНТЫ ======================
let loginModal, registerModal, postJobModal, respondModal, 
    applicationsModal, chatModal, myJobsModal, resumeModal;

function initModals() {
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

    // Восстановить иконку темы после перерисовки шапки
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = document.body.classList.contains('dark') ? '☀️' : '🌙';
}

// ====================== ЕДИНЫЙ ОБРАБОТЧИК КЛИКОВ ======================
document.addEventListener('click', (e) => {

    // Тёмная тема
    if (e.target.id === 'theme-toggle') {
        toggleTheme();
        return;
    }

    // Открыть модал входа
    if (e.target.classList.contains('login-btn')) {
        loginModal.style.display = 'flex';
        return;
    }

    // Разместить вакансию
    if (e.target.closest('.post-job-btn')) {
        openPostJobModal();
        return;
    }

    // Выйти
    if (e.target.id === 'logout-btn') {
        logoutUser();
        return;
    }

    // Мои вакансии
    if (e.target.id === 'my-jobs-btn') {
        showMyJobs();
        return;
    }

    // Мои отклики / отклики на вакансии
    if (e.target.id === 'my-applications-btn') {
        showMyApplications();
        return;
    }

    // Откликнуться на вакансию
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
            respondModal.style.display = 'flex';
        }
        return;
    }

    // Редактировать вакансию
    if (e.target.classList.contains('edit-job-btn')) {
        editJob(e.target.dataset.id);
        return;
    }

    // Удалить вакансию
    if (e.target.classList.contains('delete-job-btn')) {
        if (!confirm('Удалить эту вакансию навсегда?')) return;
        deleteJob(e.target.dataset.id);
        return;
    }

    // Открыть чат
    if (e.target.classList.contains('open-chat-btn')) {
        openChat(e.target.dataset.appId);
        return;
    }

    // Посмотреть резюме (работодатель)
    if (e.target.classList.contains('view-resume-btn')) {
        viewResume(e.target.dataset.userId, e.target.dataset.userName);
        return;
    }

    // Связаться с кандидатом
    if (e.target.classList.contains('contact-candidate-btn')) {
        contactCandidate(e.target.dataset.userId, e.target.dataset.userName);
        return;
    }

    // Отправить сообщение в чат
    if (e.target.id === 'chat-send-btn' || e.target.closest('#chat-send-btn')) {
        sendChatMessage();
        return;
    }

    // Переключатель кнопок (тип занятости / формат / график)
    if (e.target.classList.contains('type-btn')) {
        const group = e.target.closest('.button-group');
        if (!group) return;
        group.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        const hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
        if (hiddenInput) hiddenInput.value = e.target.dataset.value;
        return;
    }

    // Раскрыть / скрыть "О себе"
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
});

// ====================== ЗАКРЫТИЕ МОДАЛОК ======================
document.querySelectorAll('.close-modal, .close-register, .close-post-job, .close-respond, .close-applications, .close-chat, .close-my-jobs, .close-resume').forEach(btn => {
    btn.addEventListener('click', () => {
        const modal = btn.closest('.modal');
        if (modal) modal.style.display = 'none';

        // Отписаться от чата при закрытии
        if (modal && modal.id === 'chat-modal' && unsubscribeChat) {
            unsubscribeChat();
            unsubscribeChat = null;
        }
    });
});

// ====================== АВТОРИЗАЦИЯ — FIREBASE AUTH ======================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        try {
            const cred = await auth.signInWithEmailAndPassword(email, password);
            const snap = await db.collection('users').doc(cred.user.uid).get();
            if (snap.exists) {
                currentUser = { uid: cred.user.uid, ...snap.data() };
            }
            loginModal.style.display = 'none';
            updateHeader();
            loadJobs();
        } catch (err) {
            alert('❌ ' + firebaseErrorRu(err.code));
        }
    });
}

// РЕГИСТРАЦИЯ
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
        } catch (err) {
            alert('❌ ' + firebaseErrorRu(err.code));
        }
    });
}

// Слушатель состояния авторизации
auth.onAuthStateChanged(async (firebaseUser) => {
    if (firebaseUser) {
        const snap = await db.collection('users').doc(firebaseUser.uid).get();
        if (snap.exists) {
            currentUser = { uid: firebaseUser.uid, ...snap.data() };
        }
    } else {
        currentUser = null;
    }
    updateHeader();
    loadJobs();
});

function logoutUser() {
    if (!confirm('Выйти из аккаунта?')) return;
    auth.signOut();
}

// Перевод кодов ошибок Firebase
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

// ====================== ВАКАНСИИ — FIRESTORE ======================
function loadJobs() {
    db.collection('jobs').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderJobs(getFilteredJobs());
    });
}

async function saveJob(jobData) {
    if (editingJobId) {
        await db.collection('jobs').doc(editingJobId).update(jobData);
        alert('✅ Вакансия успешно обновлена!');
        editingJobId = null;
    } else {
        jobData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        jobData.employerId = currentUser.uid;
        jobData.employerName = currentUser.name;
        await db.collection('jobs').add(jobData);
        alert('✅ Вакансия успешно опубликована!');
    }
}

async function deleteJob(jobId) {
    // Удаляем связанные отклики
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

function editJob(jobId) {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    editingJobId = jobId;

    document.getElementById('job-title').value      = job.title || '';
    document.getElementById('job-company').value    = job.company || '';
    document.getElementById('job-salary').value     = job.salary || '';
    document.getElementById('job-city').value       = job.city || '';
    document.getElementById('job-experience').value = job.experience || '';
    document.getElementById('job-description').value = job.description || '';

    // БАГ-ФИX: восстанавливаем активные кнопки для type / remote / schedule
    ['job-type', 'job-remote', 'job-schedule'].forEach(inputId => {
        const hiddenInput = document.getElementById(inputId);
        const group = document.getElementById(inputId + '-group');
        if (!hiddenInput || !group || !job[inputId.replace('job-', '')]) return;

        const val = job[inputId.replace('job-', '')];
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
        } catch (err) {
            alert('Ошибка при сохранении: ' + err.message);
        }
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
// ====================== МОИ ОТКЛИКИ (соискатель) ======================
async function showMyApplications() {
    if (!currentUser) return;

    if (currentUser.role === 'candidate') {
        const container = document.getElementById('applications-list');
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#777;">Загрузка...</p>';
        applicationsModal.style.display = 'flex';

        const snap = await db.collection('applications')
            .where('applicantId', '==', currentUser.uid)
            .get();

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
        const myJobIds = jobs
            .filter(j => j.employerId === currentUser.uid)
            .map(j => j.id);

        const container = document.getElementById('applications-list');
        container.innerHTML = '<p style="text-align:center;padding:40px;color:#777;">Загрузка...</p>';
        applicationsModal.style.display = 'flex';

        if (myJobIds.length === 0) {
            container.innerHTML = `<p style="text-align:center;padding:80px;color:#777;">У вас нет вакансий с откликами</p>`;
            return;
        }

        const snap = await db.collection('applications')
            .where('jobId', 'in', myJobIds)
            .get();

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

// ====================== ОТКЛИКИ — FIRESTORE ======================
// ====================== ОТКЛИК НА ВАКАНСИЮ ======================
const respondForm = document.getElementById('respond-form');
if (respondForm) {
    respondForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const jobId = e.target.dataset.jobId;
        if (!jobId || !currentUser) return;

        // Проверка дубликата
        const dup = await db.collection('applications')
            .where('jobId', '==', jobId)
            .where('applicantId', '==', currentUser.uid)
            .get();

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
                date:          new Date().toISOString(),
            });

            alert('✅ Отклик успешно отправлен!');
            respondModal.style.display = 'none';
            e.target.reset();
        } catch (err) {
            alert('Ошибка при отправке отклика: ' + err.message);
        }
    });
}
// ====================== ЧАТ — FIRESTORE REALTIME ======================
function openChat(appId) {
    currentChatAppId = appId;

    // Найти отклик в кэше или запросить
    const app = applications.find(a => a.id === appId);
    const jobTitle   = app?.jobTitle || 'Чат';
    const interlocutor = currentUser.role === 'employer'
        ? app?.applicantName
        : (jobs.find(j => j.id === app?.jobId)?.company || 'Работодатель');

    document.getElementById('chat-job-title').textContent = jobTitle;
    document.getElementById('chat-with').textContent = `Собеседник: ${interlocutor}`;
    document.getElementById('chat-messages').innerHTML = '<p style="text-align:center;color:#777;padding:40px;">Загрузка...</p>';
    chatModal.style.display = 'flex';

    // Отписаться от предыдущего слушателя
    if (unsubscribeChat) unsubscribeChat();

    // Подписаться на сообщения в реальном времени
    unsubscribeChat = db.collection('applications').doc(appId)
        .collection('messages')
        .orderBy('time', 'asc')
        .onSnapshot(snap => {
            const messages = snap.docs.map(d => d.data());
            renderChatMessages(messages);
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
        .collection('messages')
        .add({
            senderId:   currentUser.uid,
            senderName: currentUser.name,
            text,
            time: firebase.firestore.FieldValue.serverTimestamp(),
        });

    input.value = '';
}

// Enter для отправки сообщения (Shift+Enter — перенос строки)
const chatInput = document.getElementById('chat-input');
if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
}

// ====================== РЕЗЮМЕ — FIRESTORE ======================
document.getElementById('nav-resume')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        alert('Войдите в аккаунт!');
        loginModal.style.display = 'flex';
        return;
    }
    if (currentUser.role === 'candidate') {
        await loadMyResume();
        resumeModal.style.display = 'flex';
    } else {
        showAllResumes();
    }
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
    } else {
        document.getElementById('resume-form').reset();
    }
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
                <button class="toggle-about-btn" data-full="${encodeURIComponent(aboutText)}">
                    Показать полностью ↓
                </button>` : ''}
            </div>
            <button class="contact-candidate-btn" data-user-id="${userId}" data-user-name="${resume.authorName}" style="margin-top:12px;">
                Связаться
            </button>`;
        listContainer.appendChild(div);
    });
}

async function viewResume(userId, userName) {
    const snap = await db.collection('resumes').doc(userId).get();
    if (!snap.exists) {
        alert(`Пользователь ${userName} ещё не заполнил резюме.`);
        return;
    }
    const r = snap.data();
    alert(`Резюме кандидата: ${userName}\n\nДолжность: ${r.position}\nГород: ${r.city}\nОпыт: ${r.experience} лет\n\nО себе:\n${r.about}`);
}

async function contactCandidate(userId, userName) {
    // Найти или создать отклик для прямого сообщения
    const snap = await db.collection('applications')
        .where('applicantId', '==', userId)
        .where('jobId', '==', 'direct')
        .where('employerId', '==', currentUser.uid)
        .get();

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

    // Добавить в локальный кэш если нужно
    if (!applications.find(a => a.id === appId)) {
        applications.push({ id: appId, jobTitle: 'Прямое сообщение', applicantId: userId, applicantName: userName });
    }

    resumeModal.style.display = 'none';
    openChat(appId);
}

// ====================== ФИЛЬТРЫ ======================
function getFilteredJobs() {
    const searchText   = document.getElementById('search-input').value.toLowerCase().trim();
    const selectedCity = document.getElementById('city-select').value;
    const minSalary    = parseInt(document.getElementById('salary-slider').value) || 0;

    return jobs.filter(job => {
        const matchText = !searchText ||
            job.title.toLowerCase().includes(searchText) ||
            job.company.toLowerCase().includes(searchText);
        const matchCity = !selectedCity || job.city === selectedCity;
        return matchText && matchCity && job.salary >= minSalary;
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
        const card = document.createElement('div');
        card.className = 'job-card';
        card.innerHTML = `
            <h3>${job.title}</h3>
            <p><strong>${job.company}</strong></p>
            <p class="salary">${Number(job.salary).toLocaleString('ru-RU')} ₽</p>
            <p>${job.city} • ${job.experience}</p>
            ${job.remote ? `<p>📍 ${job.remote}${job.schedule ? ` • 📅 ${job.schedule}` : ''}</p>` : ''}
            ${job.type   ? `<p>💼 ${job.type}</p>` : ''}
            <button class="respond-btn" data-id="${job.id}">Откликнуться</button>`;
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
document.getElementById('city-select').addEventListener('change', () => renderJobs(getFilteredJobs()));
document.getElementById('search-btn').addEventListener('click', () => renderJobs(getFilteredJobs()));

// Ссылки между модалками
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