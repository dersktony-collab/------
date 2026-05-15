// ====================== ДАННЫЕ ======================
function getJobs() {
    const saved = localStorage.getItem('jobs');
    if (saved) return JSON.parse(saved);
    
    return [
        { id: 1, title: "Frontend-разработчик (React)", company: "TechVision", salary: 150000, city: "Москва", experience: "1-3 года", employerId: null },
        { id: 2, title: "Python Backend Developer", company: "DataFlow", salary: 180000, city: "Санкт-Петербург", experience: "2-4 года", employerId: null },
        { id: 3, title: "UI/UX Дизайнер", company: "PixelCraft", salary: 120000, city: "Удалённо", experience: "1-2 года", employerId: null },
        { id: 4, title: "Менеджер по продажам", company: "SmartSales", salary: 80000, city: "Екатеринбург", experience: "Без опыта", employerId: null },
        { id: 5, title: "DevOps Engineer", company: "CloudTech", salary: 200000, city: "Казань", experience: "3-5 лет", employerId: null },
        { id: 6, title: "Senior Frontend", company: "Yandex", salary: 280000, city: "Москва", experience: "3-6 лет", employerId: null }
    ];
}

function saveJobs(jobs) {
    localStorage.setItem('jobs', JSON.stringify(jobs));
}

// ====================== ОСНОВНОЙ КОД ======================
document.addEventListener('DOMContentLoaded', () => {
    // ====================== FIREBASE CONFIG ======================
const firebaseConfig = {
    apiKey: "AIzaSyCOeuIiRllmoAdwyfdAGZ-rI-9uETTZ9U",
    authDomain: "workflow-job-40c66.firebaseapp.com",
    projectId: "workflow-job-40c66",
    storageBucket: "workflow-job-40c66.firebasestorage.app",
    messagingSenderId: "47478848425",
    appId: "1:47478848425:web:527882fda5e852cf3562b8b",
    measurementId: "G-HXFGDXK7N0"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

    let jobs = getJobs();
    let applications = JSON.parse(localStorage.getItem('applications') || '[]');

    // === Элементы ===
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const postJobModal = document.getElementById('post-job-modal');
    const respondModal = document.getElementById('respond-modal');
    const applicationsModal = document.getElementById('applications-modal');
    const chatModal = document.getElementById('chat-modal');
    const myJobsModal = document.getElementById('my-jobs-modal');
    const resumeModal = document.getElementById('resume-modal');

    let currentUser = JSON.parse(localStorage.getItem('currentUser'));
    let currentChatAppId = null;

    // ====================== ТЁМНАЯ ТЕМА ======================
    function toggleTheme() {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        const btn = document.getElementById('theme-toggle');
        if (btn) btn.textContent = isDark ? '☀️' : '🌙';
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    function initTheme() {
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark');
        }
        // Прикрепляем слушатель один раз
        document.addEventListener('click', (e) => {
            if (e.target.id === 'theme-toggle') {
                toggleTheme();
            }
        });
    }

    // ====================== ШАПКА ======================
    function updateHeader() {
        const headerRight = document.querySelector('.header-right');
        if (!headerRight) return;

        if (currentUser) {
            const roleText = currentUser.role === 'employer' ? 'Работодатель' : 'Соискатель';
            let html = `
    <div class="user-info">
        <button id="theme-toggle" class="theme-btn">🌙</button>
        <span class="username">${currentUser.name.split(' ')[0]}</span>
            `;

            if (currentUser.role === 'employer') {
                html += `
                    <button id="my-jobs-btn" class="applications-btn">Мои вакансии</button>
                    <button id="my-applications-btn" class="applications-btn">Отклики</button>
                `;
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
                <button class="post-job-btn"><i class="fas fa-plus"></i> Разместить вакансию</button>
            `;
        }
    }

    // ====================== EVENT DELEGATION (рекомендуемый подход) ======================
    document.addEventListener('click', (e) => {

        // Логин
        if (e.target.classList.contains('login-btn')) {
            loginModal.style.display = 'flex';
        }

        // Разместить вакансию
        if (e.target.closest('.post-job-btn')) {
            openPostJobModal();
        }

        // Выход
        if (e.target.id === 'logout-btn') {
            logoutUser();
        }

        // Мои вакансии
        if (e.target.id === 'my-jobs-btn') {
            showMyJobs();
        }

        // Мои отклики
        if (e.target.id === 'my-applications-btn') {
            showMyApplications();
        }

        // Удаление вакансии
        if (e.target.classList.contains('delete-job-btn')) {
            if (!confirm('Удалить эту вакансию навсегда?')) return;
            const jobId = parseInt(e.target.dataset.id);
            
            // Удаляем связанные отклики
            applications = applications.filter(app => app.jobId !== jobId);
            localStorage.setItem('applications', JSON.stringify(applications));

            jobs = jobs.filter(j => j.id !== jobId);
            saveJobs(jobs);
            showMyJobs();
            renderJobs(getFilteredJobs());
        }

        // Открыть чат
        if (e.target.classList.contains('open-chat-btn')) {
            openChat(parseInt(e.target.dataset.appId));
        }

        // Откликнуться
        if (e.target.classList.contains('respond-btn')) {
            if (!currentUser || currentUser.role !== 'candidate') {
                alert('Откликаться могут только соискатели!');
                if (!currentUser) loginModal.style.display = 'flex';
                return;
            }
        
            const jobId = parseInt(e.target.dataset.id);
            const job = jobs.find(j => j.id === jobId);
            if (job) {
                document.getElementById('respond-job-title').textContent = job.title;
                respondModal.style.display = 'flex';
                document.getElementById('respond-form').dataset.jobId = job.id;
            }
        }
                // РЕДАКТИРОВАНИЕ ВАКАНСИИ (кнопка внутри мои вакансии!!!)
        if (e.target.classList.contains('edit-job-btn')) {
            const jobId = parseInt(e.target.dataset.id);
            if (jobId) {
                editJob(jobId);
            }
        }
                // Просмотр резюме
        if (e.target.classList.contains('view-resume-btn')) {
            const userId = parseInt(e.target.dataset.userId);
            const userName = e.target.dataset.userName;
            
            const resumeData = localStorage.getItem(`resume_${userId}`);
            if (!resumeData) {
                alert(`Пользователь ${userName} ещё не заполнил резюме.`);
                return;
            }

            const resume = JSON.parse(resumeData);
            alert(`Резюме кандидата: ${userName}\n\nДолжность: ${resume.position}\nГород: ${resume.city}\nОпыт: ${resume.experience} лет\n\nО себе:\n${resume.about}`);
        }
        if (e.target.classList.contains('contact-candidate-btn')) {
            const userId = parseInt(e.target.dataset.userId);
            const userName = e.target.dataset.userName;

            let app = applications.find(a => 
                a.applicantId === userId && 
                jobs.some(j => j.id === a.jobId && j.employerId === currentUser.id)
            );

            if (!app) {
                app = {
                    id: Date.now(),
                    jobId: null,
                    jobTitle: 'Прямое сообщение',
                    applicantId: userId,
                    applicantName: userName,
                    messages: []
                };
                applications.unshift(app);
                localStorage.setItem('applications', JSON.stringify(applications));
            }

            resumeModal.style.display = 'none';
            openChat(app.id);
        }
    });

    function logoutUser() {
        if (confirm('Выйти из аккаунта?')) {
            localStorage.removeItem('currentUser');
            currentUser = null;
            updateHeader();
        }
    }

    function openPostJobModal() {
        if (!currentUser || currentUser.role !== 'employer') {
            alert('Только работодатели могут размещать вакансии!');
            if (!currentUser) loginModal.style.display = 'flex';
            return;
        }
        postJobModal.style.display = 'flex';
    }
  // ====================== РЕДАКТИРОВАНИЕ ВАКАНСИИ ======================
    let editingJobId = null;

    function editJob(jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;

        editingJobId = jobId;

        // Заполняем поля формы
        document.getElementById('job-title').value = job.title;
        document.getElementById('job-company').value = job.company;
        document.getElementById('job-salary').value = job.salary;
        document.getElementById('job-city').value = job.city;
        document.getElementById('job-experience').value = job.experience;

        // Меняем заголовок
        document.querySelector('#post-job-modal h2').textContent = 'Редактировать вакансию';

        // Закрываем окно "Мои вакансии"
        const myJobsModal = document.getElementById('my-jobs-modal');
        if (myJobsModal) myJobsModal.style.display = 'none';

        // Открываем модалку редактирования
        postJobModal.style.display = 'flex';
    }

    // ====================== МОИ ВАКАНСИИ ======================
    function showMyJobs() {
        if (currentUser?.role !== 'employer') return;

        const container = document.getElementById('my-jobs-list');
        container.innerHTML = '';

        const myJobs = jobs.filter(job => job.employerId === currentUser.id);

        if (myJobs.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:60px; color:#777;">У вас пока нет размещённых вакансий</p>`;
        } else {
            myJobs.forEach(job => {
                const div = document.createElement('div');
                div.className = 'application-item';
                div.innerHTML = `
                    <div class="app-header">
                        <strong>${job.title}</strong>
                        <span>${job.salary.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    <p>${job.city} • ${job.experience}</p>
                    <div style="margin-top:12px;">
                        <button class="edit-job-btn" data-id="${job.id}">Редактировать</button>
                        <button class="delete-job-btn" data-id="${job.id}">Удалить</button>
                    </div>
                `;
                container.appendChild(div);
            });
        }
        myJobsModal.style.display = 'flex';
    }

              // ====================== МОИ ОТКЛИКИ / ОТКЛИКИ ======================
    function showMyApplications() {
        if (!currentUser) return;

        const container = document.getElementById('applications-list');
        container.innerHTML = '';

        if (currentUser.role === 'employer') {
            // ==================== ДЛЯ РАБОТОДАТЕЛЯ ====================
            const userApps = applications.filter(app => {
                const job = jobs.find(j => j.id === app.jobId);
                return job && job.employerId === currentUser.id;
            });

            if (userApps.length === 0) {
                container.innerHTML = `<p style="text-align:center; padding:60px; color:#777;">Пока нет откликов на ваши вакансии</p>`;
            } else {
                userApps.forEach(app => {
                    const div = document.createElement('div');
                    div.className = 'application-item';
                    div.innerHTML = `
                        <div class="app-header">
                            <strong>${app.jobTitle}</strong>
                            <span>${new Date(app.date).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <p><strong>Соискатель:</strong> ${app.applicantName}</p>
                        <p class="cover-letter">${app.message}</p>
                        
                        <div style="margin-top: 15px; display: flex; gap: 10px;">
                            <button class="open-chat-btn" data-app-id="${app.id}">Открыть чат</button>
                            <button class="view-resume-btn" data-user-id="${app.applicantId}" data-user-name="${app.applicantName}">
                                Посмотреть резюме
                            </button>
                        </div>
                    `;
                    container.appendChild(div);
                });
            }
        } else {
            // ==================== ДЛЯ СОИСКАТЕЛЯ ====================
            const userApps = applications.filter(app => app.applicantId === currentUser.id);

            if (userApps.length === 0) {
                container.innerHTML = `<p style="text-align:center; padding:60px; color:#777;">Вы ещё не откликались на вакансии</p>`;
            } else {
                userApps.forEach(app => {
                    const job = jobs.find(j => j.id === app.jobId);
                    const div = document.createElement('div');
                    div.className = 'application-item';
                    div.innerHTML = `
                        <div class="app-header">
                            <strong>${app.jobTitle}</strong>
                            <span>${new Date(app.date).toLocaleDateString('ru-RU')}</span>
                        </div>
                        <p><strong>Компания:</strong> ${job ? job.company : '—'}</p>
                        <p class="cover-letter">${app.message}</p>
                        <button class="open-chat-btn" data-app-id="${app.id}">Открыть чат</button>
                    `;
                    container.appendChild(div);
                });
            }
        }

        applicationsModal.style.display = 'flex';
    }
        // ====================== ЧАТ ======================
    function openChat(appId) {
        currentChatAppId = appId;
        const app = applications.find(a => a.id === appId);
        if (!app) return;

        document.getElementById('chat-job-title').textContent = app.jobTitle;
        document.getElementById('chat-with').textContent = 
            `Собеседник: ${currentUser.role === 'employer' ? app.applicantName : (jobs.find(j => j.id === app.jobId)?.company || 'Работодатель')}`;

        renderChatMessages(app);
        chatModal.style.display = 'flex';
    }

    function renderChatMessages(app) {
        const container = document.getElementById('chat-messages');
        container.innerHTML = '';

        if (!app.messages || app.messages.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:#777; padding:40px;">Напишите первое сообщение...</p>`;
            return;
        }

        const reversedMessages = [...app.messages].reverse();

        reversedMessages.forEach(msg => {
            const isMe = msg.senderId === currentUser.id;
            const div = document.createElement('div');
            div.className = `chat-message ${isMe ? 'my-message' : 'their-message'}`;
            div.innerHTML = `
                <small>${new Date(msg.time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</small>
                <p>${msg.text}</p>
            `;
            container.appendChild(div);
        });

        container.scrollTop = 0;
    }

    // === Самое надёжное решение — Event Delegation ===
    document.addEventListener('click', function(e) {
        if (e.target.id === 'chat-send-btn' || e.target.closest('#chat-send-btn')) {
            console.log("✅ Кнопка 'Отправить' нажата!");

            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (!text || !currentChatAppId) {
                console.log("Текст пустой или нет currentChatAppId");
                return;
            }

            const app = applications.find(a => a.id === currentChatAppId);
            if (!app) return;

            if (!app.messages) app.messages = [];

            app.messages.push({
                senderId: currentUser.id,
                senderName: currentUser.name,
                text: text,
                time: new Date().toISOString()
            });

            localStorage.setItem('applications', JSON.stringify(applications));
            renderChatMessages(app);
            input.value = '';
        }
    });
    // ====================== ФИЛЬТРЫ ======================
    function getFilteredJobs() {
        const searchText = document.getElementById('search-input').value.toLowerCase().trim();
        const selectedCity = document.getElementById('city-select').value;
        const minSalary = parseInt(document.getElementById('salary-slider').value) || 0;

        return jobs.filter(job => {
            const matchText = !searchText || 
                job.title.toLowerCase().includes(searchText) || 
                job.company.toLowerCase().includes(searchText);

            const matchCity = !selectedCity || 
                job.city === selectedCity ||
                (selectedCity === "Другой" && !["Москва","Санкт-Петербург","Новосибирск","Екатеринбург","Казань"].includes(job.city));

            return matchText && matchCity && job.salary >= minSalary;
        });
    }

    function renderJobs(filteredJobs) {
        const container = document.getElementById('jobs-grid');
        container.innerHTML = '';

        if (filteredJobs.length === 0) {
            container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; padding: 80px 20px; color: #777;">Вакансий не найдено 😔</p>`;
            return;
        }

        filteredJobs.forEach(job => {
            const card = document.createElement('div');
            card.className = 'job-card';
           card.innerHTML = `
    <h3>${job.title}</h3>
    <p><strong>${job.company}</strong></p>
    <p class="salary">${job.salary.toLocaleString('ru-RU')} ₽</p>
    <p>${job.city} • ${job.experience}</p>
    ${job.remote ? `<p>📍 ${job.remote} • ⏱ ${job.hours || '—'} ч/день • 📅 ${job.schedule || '—'}</p>` : ''}
    ${job.type ? `<p>💼 ${job.type}</p>` : ''}
    <button class="respond-btn" data-id="${job.id}">Откликнуться</button>
`;
            container.appendChild(card);
        });
    }

    function filterJobs() {
        renderJobs(getFilteredJobs());
    }

    // ====================== ЗАКРЫТИЕ МОДАЛОК ======================
    document.querySelectorAll('.close-modal, .close-register, .close-post-job, .close-respond, .close-applications, .close-chat, .close-my-jobs, .close-resume').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').style.display = 'none';
        });
    });

              // ====================== ФОРМЫ ======================

        // 1. Размещение и Редактирование вакансии
    document.getElementById('post-job-form').addEventListener('submit', (e) => {
        e.preventDefault();

        if (!currentUser || currentUser.role !== 'employer') {
            alert('Только работодатели могут управлять вакансиями!');
            return;
        }

        const jobData = {
    title: document.getElementById('job-title').value.trim(),
    company: document.getElementById('job-company').value.trim(),
    salary: parseInt(document.getElementById('job-salary').value),
    city: document.getElementById('job-city').value.trim(),
    experience: document.getElementById('job-experience').value.trim(),
    description: document.getElementById('job-description').value.trim(),
        type: document.getElementById('job-type').value,       
    remote: document.getElementById('job-remote').value,  
    hours: document.getElementById('job-hours').value,      
    schedule: document.getElementById('job-schedule').value, 
    employerId: currentUser.id,
};

        if (editingJobId) {
            // Редактирование
            const job = jobs.find(j => j.id === editingJobId);
            if (job) Object.assign(job, jobData);
            alert('✅ Вакансия успешно обновлена!');
            editingJobId = null;
        } else {
            // Создание новой
            jobData.id = Date.now();
            jobs.unshift(jobData);
            alert('✅ Вакансия успешно опубликована!');
        }

        saveJobs(jobs);
        postJobModal.style.display = 'none';
        e.target.reset();
        document.querySelector('#post-job-modal h2').textContent = 'Разместить новую вакансию';

        renderJobs(getFilteredJobs());
        if (myJobsModal.style.display === 'flex') showMyJobs();
    });

    // 2. Отправка отклика
    document.getElementById('respond-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const jobId = parseInt(e.target.dataset.jobId);
        if (!jobId) {
            alert("Ошибка: вакансия не найдена");
            return;
        }
        if (!currentUser) {
            alert("Вы не авторизованы!");
            return;
        }

        const message = document.getElementById('cover-letter').value.trim() || 'Без сопроводительного письма';

        const newApp = {
            id: Date.now(),
            jobId: jobId,
            jobTitle: jobs.find(j => j.id === jobId)?.title || "Вакансия",
            applicantId: currentUser.id,
            applicantName: currentUser.name,
            message: message,
            date: new Date().toISOString(),
            messages: []
        };

        applications.unshift(newApp);
        localStorage.setItem('applications', JSON.stringify(applications));

        alert('✅ Отклик успешно отправлен!');
        respondModal.style.display = 'none';
        e.target.reset();
    });
     // ====================== АВТОРИЗАЦИЯ ======================
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const input = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        const users = JSON.parse(localStorage.getItem('users') || '[]');
        
        const user = users.find(u => 
            (u.email === input || u.name === input) && u.password === password
        );

        if (user) {
            currentUser = user;
            localStorage.setItem('currentUser', JSON.stringify(user));
            
            alert(`✅ Добро пожаловать, ${user.name.split(' ')[0]}!`);
            loginModal.style.display = 'none';
            updateHeader();
            loadResume();
        } else {
            alert('❌ Неверный email, имя или пароль');
        }
    });

    document.getElementById('register-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const passwordConfirm = document.getElementById('reg-password-confirm').value;
        const role = document.getElementById('reg-role').value;

        if (password.length < 6) {
            return alert('Пароль должен быть минимум 6 символов');
        }
        if (password !== passwordConfirm) {
            return alert('Пароли не совпадают!');
        }

        const users = JSON.parse(localStorage.getItem('users') || '[]');

        if (users.some(u => u.email === email)) {
            return alert('Пользователь с таким email уже существует!');
        }

        const newUser = {
            id: Date.now(),
            name,
            email,
            password,
            role,
            registeredAt: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem('users', JSON.stringify(users));

        alert('🎉 Регистрация прошла успешно! Теперь войдите в аккаунт.');
        registerModal.style.display = 'none';
        loginModal.style.display = 'flex';
    });
        // ====================== РЕЗЮМЕ ======================
    document.getElementById('nav-resume')?.addEventListener('click', (e) => {
        e.preventDefault();

        if (!currentUser) {
            alert('Войдите в аккаунт!');
            loginModal.style.display = 'flex';
            return;
        }

        if (currentUser.role === 'candidate') {
            loadResume();
            resumeModal.style.display = 'flex';
        } else {
            showAllResumesInResumeModal();
        }
    });

    // Загрузка своего резюме (для соискателя)
    function loadResume() {
        document.querySelector('#resume-modal h2').textContent = 'Моё резюме';
        document.getElementById('resume-form').style.display = 'block';

        const saved = localStorage.getItem(`resume_${currentUser.id}`);
        if (saved) {
            const r = JSON.parse(saved);
            document.getElementById('resume-position').value = r.position || '';
            document.getElementById('resume-city').value = r.city || '';
            document.getElementById('resume-experience').value = r.experience || 0;
            document.getElementById('resume-about').value = r.about || '';
        } else {
            document.getElementById('resume-form').reset();
        }
    }

    // Сохранение резюме
    document.getElementById('resume-form')?.addEventListener('submit', (e) => {
        e.preventDefault();

        const resumeData = {
            position: document.getElementById('resume-position').value.trim(),
            city: document.getElementById('resume-city').value.trim(),
            experience: parseInt(document.getElementById('resume-experience').value) || 0,
            about: document.getElementById('resume-about').value.trim(),
            savedAt: new Date().toISOString()
        };

        localStorage.setItem(`resume_${currentUser.id}`, JSON.stringify(resumeData));
        alert('✅ Резюме успешно сохранено!');
        resumeModal.style.display = 'none';
    });

       // Список всех резюме для работодателя
    function showAllResumesInResumeModal() {
        const modalTitle = document.querySelector('#resume-modal h2');
        if (modalTitle) modalTitle.textContent = 'Резюме соискателей';

        document.getElementById('resume-form').style.display = 'none';

        let listContainer = document.getElementById('all-resumes-list');
        if (!listContainer) {
            listContainer = document.createElement('div');
            listContainer.id = 'all-resumes-list';
            listContainer.className = 'applications-list';
            listContainer.style.marginTop = '20px';
            resumeModal.querySelector('.modal-content').appendChild(listContainer);
        }

        listContainer.innerHTML = '';

        const users = JSON.parse(localStorage.getItem('users') || '[]');
        const candidates = users.filter(u => u.role === 'candidate');

        if (candidates.length === 0) {
            listContainer.innerHTML = `<p style="text-align:center; padding:80px; color:#777;">Пока нет соискателей</p>`;
            resumeModal.style.display = 'flex';
            return;
        }

        let hasResume = false;

        candidates.forEach(user => {
            const resumeData = localStorage.getItem(`resume_${user.id}`);
            if (!resumeData) return;
            hasResume = true;

            const resume = JSON.parse(resumeData);
            const aboutText = resume.about || '';
            const shortText = aboutText.length > 180 ? aboutText.substring(0, 180) + '...' : aboutText;

            const div = document.createElement('div');
            div.className = 'application-item';
            div.innerHTML = `
                <div class="app-header">
                    <strong>${user.name}</strong>
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

                ${currentUser && currentUser.role === 'employer' ? `
                <button class="contact-candidate-btn" data-user-id="${user.id}" data-user-name="${user.name}" style="margin-top:12px;">
                    Связаться
                </button>` : ''}
            `;
            listContainer.appendChild(div);
        });

        if (!hasResume) {
            listContainer.innerHTML = `<p style="text-align:center; padding:80px; color:#777;">Пока никто не заполнил резюме</p>`;
        }

        resumeModal.style.display = 'flex';
    }
    // Раскрытие / скрытие текста "О себе"
    document.addEventListener('click', (e) => {
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
        }
    });
    // ====================== ИНИЦИАЛИЗАЦИЯ ======================
    initTheme();
    updateHeader();

    // Фильтры зарплаты
    const salarySlider = document.getElementById('salary-slider');
    const salaryInput = document.getElementById('salary-input');
    const salaryValue = document.getElementById('salary-value');

    function updateSalaryDisplay() {
        const value = parseInt(salarySlider.value) || 0;
        salaryValue.textContent = value.toLocaleString('ru-RU') + ' ₽';
        salaryInput.value = value;
    }

    salarySlider.addEventListener('input', () => { updateSalaryDisplay(); filterJobs(); });
    salaryInput.addEventListener('input', () => {
        let val = parseInt(salaryInput.value) || 0;
        if (val > 300000) val = 300000;
        salarySlider.value = val;
        updateSalaryDisplay();
        filterJobs();
    });

    document.getElementById('search-input').addEventListener('input', filterJobs);
    document.getElementById('city-select').addEventListener('change', filterJobs);

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
    // Обработка всех групп кнопок
document.querySelectorAll('.button-group').forEach(group => {
    group.addEventListener('click', (e) => {
        if (e.target.classList.contains('type-btn')) {
            group.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
            
            const hiddenInput = group.parentElement.querySelector('input[type="hidden"]');
            if (hiddenInput) {
                hiddenInput.value = e.target.dataset.value;
            }
        }
    });
});

    // Запуск
    updateSalaryDisplay();
    renderJobs(getFilteredJobs());
});