/**
 * EduMaster - Quiz Logic Engine
 */

const App = (() => {
    // --- State ---
    const state = {
        currentView: 'view-welcome',
        subject: null,
        level: 'beginner',
        skill: null, // 'grammar', 'vocabulary', etc.
        questionCount: 10,
        questions: [],
        currentQuestionIndex: 0,
        score: 0,
        userAnswers: [],
        mode: 'solo', // 'solo' or 'team'
        team1Name: 'Jamoa 1',
        team2Name: 'Jamoa 2',
        team1Score: 0,
        team2Score: 0,
        team1Progress: 0,
        team2Progress: 0,
        activeTeam: 1, // 1 or 2
        betTarget: null, // 'team1' or 'team2' (for 5-point diff mode)
        winner: null,
        // Time Mode
        gameMode: 'count', // 'count' or 'time'
        timeLimit: 0, // in seconds
        timerInterval: null, winner: null,
        // Team objects
        team1: { questions: [], score: 0, currentQuestionIndex: 0, finished: false },
        team2: { questions: [], score: 0, currentQuestionIndex: 0, finished: false },
        // Music
        selectedMusic: 'default', // 'default', 'none', or 'sweater_weather'
        musicFiles: {
            'default': 'Олександр Коломієць Полька 3.m4a',
            'sweater_weather': 'https://upload.wikimedia.org/wikipedia/en/9/9f/The_Neighbourhood_-_Sweater_Weather.ogg',
            'dancin': 'Aaron Smith Dancin (KRONO Remix) - Lyrics.m4a'
        }
    };

    const init = () => {
        if (typeof QuestionBank === 'undefined') {
            alert("DIQQAT: Savollar bazasi (Questions.js) yuklanmadi! Faylda xato bo'lishi mumkin.");
        } else {
            console.log("QuestionBank loaded successfully.");
        }

        // Initialize Music UI
        // We simulate a click on default or just let logic handle it later?
        // Better to visually set default checkmark.
        // But elements might not be in DOM if View is hidden? Actually they are in DOM just hidden.
        // Let's just hope the default HTML structure covers the initial state (Checkmark on Default).

        navigate(state.currentView);
    };

    // --- Audio Controller (Synthesized Sounds) ---
    const AudioController = (() => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();

        const playTone = (freq, type, duration) => {
            if (ctx.state === 'suspended') ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + duration);
        };

        return {
            click: () => playTone(800, 'sine', 0.1),
            correct: () => {
                playTone(600, 'sine', 0.1);
                setTimeout(() => playTone(1200, 'sine', 0.2), 100);
            },
            wrong: () => {
                playTone(300, 'sawtooth', 0.3);
                setTimeout(() => playTone(200, 'sawtooth', 0.4), 200);
            },
            win: () => {
                [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'square', 0.2), i * 150));
            }
        };
    })();

    // --- Dice Confetti Effect ---
    const Confetti = (() => {
        const canvas = document.getElementById('confetti-canvas');
        if (!canvas) return { start: () => { }, stop: () => { } };
        const ctx = canvas.getContext('2d');
        let particles = [];
        let animationId = null;
        let stopLooping = false;

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        window.addEventListener('resize', resize);
        resize();

        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height - canvas.height;
                this.size = Math.random() * 10 + 5;
                this.speedY = Math.random() * 3 + 2;
                this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = (Math.random() - 0.5) * 4;
            }
            update() {
                this.y += this.speedY;
                this.rotation += this.rotationSpeed;
                // Loop only if not stopping
                if (!stopLooping && this.y > canvas.height + 50) {
                    this.y = -50;
                    this.x = Math.random() * canvas.width;
                }
            }
            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation * Math.PI / 180);

                // Draw colorful square
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

                ctx.restore();
            }
        }

        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = 0;
            particles.forEach(p => {
                p.update();
                p.draw();
                if (p.y <= canvas.height + 100) active++;
            });

            if (stopLooping && active === 0) {
                cancelAnimationFrame(animationId);
                animationId = null;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                return;
            }
            animationId = requestAnimationFrame(loop);
        };

        return {
            start: () => {
                if (animationId) cancelAnimationFrame(animationId);
                particles = Array.from({ length: 60 }, () => new Particle());
                stopLooping = false;
                loop();
                // Loop for 4 seconds then stop
                setTimeout(() => stopLooping = true, 4000);
            },
            stop: () => {
                if (animationId) cancelAnimationFrame(animationId);
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                animationId = null;
            }
        };
    })();

    // --- Helpers ---
    const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffle = (array) => array.sort(() => Math.random() - 0.5);

    // --- Backup Generator (Fail-safe) ---
    // --- Backup Generator (Fail-safe) ---
    const BackupGenerator = {
        english: (count, level) => {
            const basic = [
                { w: "Apple", t: "Olma", o: ["Nok", "Uzum", "Anor"] },
                { w: "Teacher", t: "O'qituvchi", o: ["Shifokor", "Haydovchi", "Oshpaz"] },
                { w: "Red", t: "Qizil", o: ["Oq", "Qora", "Ko'k"] },
                { w: "Hello", t: "Salom", o: ["Xayr", "Rahmat", "Iltimos"] }
            ];
            const medium = [
                { w: "Beautiful", t: "Chiroyli", o: ["Xunuk", "Katta", "Kichik"] },
                { w: "Environment", t: "Atrof-muhit", o: ["Kosmos", "Dengiz", "Shahar"] },
                { w: "Success", t: "Muvaffaqiyat", o: ["Mag'lubiyat", "Omad", "Baxt"] },
                { w: "Decision", t: "Qaror", o: ["Fikr", "O'y", "Orzu"] }
            ];
            const hard = [
                { w: "Ubiquitous", t: "Hamma joyda", o: ["Kamdan-kam", "Yagona", "Yashirin"] },
                { w: "Ephemeral", t: "O'tkinchi", o: ["Abadiy", "Uzun", "Doimiy"] },
                { w: "Magnanimous", t: "Saxovatli", o: ["Xudbin", "Kichik", "Past"] },
                { w: "Ambiguous", t: "Ikki ma'noli", o: ["Aniq", "Oddiy", "Qiyin"] }
            ];

            let dataset = basic;
            if (level === 'intermediate') dataset = medium;
            if (level === 'advanced') dataset = hard;

            // Shuffle dataset to prevent repetition for small counts (like in mixed mode)
            dataset = shuffle([...dataset]);

            const list = [];
            for (let i = 0; i < count; i++) {
                const item = dataset[i % dataset.length];
                const opts = [item.t, ...item.o].sort(() => Math.random() - 0.5);
                list.push({
                    id: i, q: `'${item.w}' so'zining tarjimasi?`,
                    options: opts, answer: item.t,
                    explanation: "To'g'ri javobni eslab qoling.", motivation: "Davom eting!"
                });
            }
            return list;
        },
        uzbek: (count, level) => {
            const list = [];
            const words = [
                { q: "Kitobning ko'pligi?", a: "Kitoblar", o: ["Kitob", "Kitoblarim", "Kitobi"] },
                { q: "Ona so'zining sinonimi?", a: "Volida", o: ["Ota", "Singil", "Buvi"] },
                { q: "O'zbekiston poytaxti?", a: "Toshkent", o: ["Samarqand", "Buxoro", "Xiva"] },
                { q: "Navoiy kim?", a: "Shoir", o: ["Xon", "Olim", "Rassom"] },
                { q: "Qaysi so'z to'g'ri yozilgan?", a: "Maktab", o: ["Maktap", "Maqtab", "Mactab"] },
                { q: "So'roq gap belgisi?", a: "?", o: ["!", ".", ","] },
                { q: "Daraxt nima?", a: "O'simlik", o: ["Hayvon", "Tosh", "Suv"] },
                { q: "Quyosh qayerdan chiqadi?", a: "Sharqdan", o: ["G'arbdan", "Shimoldan", "Janubdan"] }
            ];

            const dataset = shuffle([...words]);

            for (let i = 0; i < count; i++) {
                const w = dataset[i % dataset.length];
                list.push({
                    id: i, q: w.q,
                    options: [...w.o, w.a].sort(() => Math.random() - 0.5),
                    answer: w.a
                });
            }
            return list;
        },
        iq: (count, level) => {
            const list = [];
            for (let i = 0; i < count; i++) {
                let qText, ans, explanation, opts;
                const type = (level === 'advanced') ? 3 : (level === 'intermediate' ? 2 : 1);

                if (type === 1) { // Beginner: Linear
                    const start = Math.floor(Math.random() * 20) + 1;
                    const step = Math.floor(Math.random() * 5) + 1;
                    const seq = [start, start + step, start + step * 2, start + step * 3];
                    ans = start + step * 4;
                    explanation = `Har bir son ${step} taga ortmoqda.`;
                    qText = `${seq.join(', ')}, ...?`;
                } else if (type === 2) { // Int: Squares or Geometric
                    const start = Math.floor(Math.random() * 5) + 1;
                    const mult = Math.floor(Math.random() * 2) + 2;
                    const seq = [start, start * mult, start * mult * mult, start * mult * mult * mult];
                    ans = start * Math.pow(mult, 4);
                    explanation = `Har bir son ${mult} ga ko'paymoqda.`;
                    qText = `${seq.join(', ')}, ...?`;
                } else { // Adv: Fibonacci-ish
                    let a = Math.floor(Math.random() * 5) + 1;
                    let b = Math.floor(Math.random() * 5) + 1;
                    const seq = [a, b, a + b, a + b + b, (a + b) + (a + b + b)]; // 1,1,2,3,5
                    ans = seq[seq.length - 1] + seq[seq.length - 2];
                    explanation = "Oldingi ikki son yig'indisi.";
                    qText = `${seq.join(', ')}, ...?`;
                }

                opts = new Set([ans]);
                while (opts.size < 4) opts.add(ans + Math.floor(Math.random() * 10) - 5);

                list.push({
                    id: i, q: qText,
                    options: Array.from(opts).map(String).sort(() => Math.random() - 0.5),
                    answer: String(ans),
                    explanation: explanation, motivation: "Mantiqiy!"
                });
            }
            return list;
        },
        math: (count, level) => {
            const list = [];
            for (let i = 0; i < count; i++) {
                let a, b, ans, op;
                let range = 20;
                if (level === 'intermediate') range = 50;
                if (level === 'advanced') range = 100;

                const type = Math.random();

                if (level === 'beginner' || type < 0.5) {
                    a = Math.floor(Math.random() * range) + 1;
                    b = Math.floor(Math.random() * range) + 1;
                    op = '+'; ans = a + b;
                } else if (level === 'intermediate' || type < 0.8) {
                    a = Math.floor(Math.random() * range) + range;
                    b = Math.floor(Math.random() * range) + 1;
                    op = '-'; ans = a - b;
                } else {
                    a = Math.floor(Math.random() * (range / 2)) + 2;
                    b = Math.floor(Math.random() * 10) + 2;
                    op = '*'; ans = a * b;
                }

                const opts = new Set([ans]);
                while (opts.size < 4) opts.add(ans + Math.floor(Math.random() * 10) - 5);
                list.push({
                    id: i, q: `${a} ${op} ${b} = ?`,
                    options: Array.from(opts).map(String).sort(() => Math.random() - 0.5),
                    answer: String(ans), explanation: "Hisoblash.", motivation: "To'g'ri!"
                });
            }
            return list;
        },
        history: (count, level, skill) => {
            // SEQUENTIAL & UZBEK - NO RANDOM SHUFFLE OF QUESTION ORDER
            const uzbekData = [
                { q: "Amir Temur nechanchi yilda tug'ilgan?", a: "1336", o: ["1337", "1441", "1340"], e: "Amir Temur 1336-yil Shahrisabzda tug'ilgan." },
                { q: "O'zbekiston mustaqillikka qachon erishgan?", a: "1991", o: ["1989", "1992", "1990"], e: "1991-yil 31-avgust." },
                { q: "Alisher Navoiyning mashhur asari?", a: "Xamsa", o: ["Boburnoma", "Qutadg'u bilig", "Zarbulmasal"], e: "Xamsa - 5 doston." },
                { q: "Ulug'bek rasadxonasi qayerda?", a: "Samarqand", o: ["Buxoro", "Xiva", "Toshkent"], e: "Samarqandda joylashgan." },
                { q: "Somoniylar davlati poytaxti?", a: "Buxoro", o: ["Samarqand", "Marv", "Urganch"], e: "Poytaxt Buxoro bo'lgan." },
                { q: "Bobur qaysi asarni yozgan?", a: "Boburnoma", o: ["Xamsa", "Shohnoma", "Devon"], e: "Mashhur memuar asar." },
                { q: "Jaloliddin Manguberdi kimga qarshi kurashgan?", a: "Chingizxon", o: ["Amir Temur", "Iskandar Zulqarnayn", "Kir"], e: "Mo'g'ullarga qarshi." },
                { q: "Toshkent qachon poytaxt bo'ldi?", a: "1930", o: ["1924", "1991", "1865"], e: "1930-yilda ko'chirilgan." },
                { q: "Spitamen kimga qarshi kurashgan?", a: "Makedoniyalik Iskandar", o: ["Doro", "Chingizxon", "Eron"], e: "Yunonlarga qarshi." },
                { q: "Mang'itlar sulolasi qayerda hukmronlik qilgan?", a: "Buxoro Amirligi", o: ["Xiva Xonligi", "Qo'qon Xonligi", "Temuriylar"], e: "Buxoroda." }
            ];

            const worldData = [
                { q: "Ikkinchi jahon urushi qachon boshlangan?", a: "1939", o: ["1941", "1945", "1914"], e: "1939-yil 1-sentyabr." },
                { q: "Piramidalar qayerda joylashgan?", a: "Misr", o: ["Sudan", "Meksika", "Xitoy"], e: "Gizadagi piramidalar." },
                { q: "Rim imperiyasi qachon qulagan?", a: "476", o: ["1453", "1000", "395"], e: "G'arbiy Rim 476-yilda." },
                { q: "Napoleon Bonapart qaysi davlat imperatori edi?", a: "Fransiya", o: ["Angliya", "Germaniya", "Italiya"], e: "Fransiya imperatori." },
                { q: "Birinchi odam oyga qachon qadam qo'ygan?", a: "1969", o: ["1961", "1975", "1957"], e: "Neil Armstrong 1969-yil." },
                { q: "Buyuk ipak yo'li qayerdan boshlangan?", a: "Xitoy", o: ["Hindiston", "Rim", "Eron"], e: "Xitoyning Sian shahridan." },
                { q: "Amerikani kim kashf etgan?", a: "Xristofor Kolumb", o: ["Vasko da Gama", "Magellan", "Kuk"], e: "1492-yilda." },
                { q: "Titanic qachon cho'kkan?", a: "1912", o: ["1905", "1920", "1899"], e: "1912-yil aprel." },
                { q: "Temir xotin laqabli siyosatchi?", a: "Margaret Tetcher", o: ["Indira Gandi", "Merkel", "Qirolicha Viktoriya"], e: "Buyuk Britaniya Bosh vaziri." },
                { q: "Eng uzun daryo?", a: "Nil", o: ["Amazonka", "Volga", "Amudaryo"], e: "Nil daryosi." }
            ];

            const dataset = (skill === 'world_history') ? worldData : uzbekData;
            const shuffledDataset = shuffle([...dataset]);

            const list = [];
            for (let i = 0; i < count; i++) {
                const item = shuffledDataset[i % shuffledDataset.length];
                const opts = [item.a, ...item.o].sort(() => Math.random() - 0.5);
                list.push({
                    id: i, q: item.q,
                    options: opts, answer: item.a,
                    explanation: item.e, motivation: "Tarixni bilasiz!"
                });
            }
            return list;
        },
        mixed: (count, level) => {
            const list = [];
            for (let i = 0; i < count; i++) {
                const type = Math.random();
                let qItem;
                // Randomly pick a source
                if (type < 0.25) { // English
                    const set = BackupGenerator.english(1, level);
                    qItem = set[0];
                    qItem.motivation = "Ingliz tili!";
                } else if (type < 0.5) { // Math
                    const set = BackupGenerator.math(1, level);
                    qItem = set[0];
                    qItem.motivation = "Matematika!";
                } else if (type < 0.75) { // IQ
                    const set = BackupGenerator.iq(1, level);
                    qItem = set[0];
                    qItem.motivation = "Mantiq!";
                } else { // History
                    const skill = (Math.random() > 0.5) ? 'world_history' : 'uzbek_history';
                    const set = BackupGenerator.history(1, level, skill); // Will pick 1st item sequentially effectively random here due to short loop
                    // Ideally history isn't shuffled but for mixed we want random questions
                    // The history generator loops, so we can pass a random offset? No, let's just pick one.
                    // Because history generator is deterministic (always starts at 0), we need a better way.
                    // Actually, for mixed, let's grab the full set and pick random? Too expensive.
                    // Let's just rely on the fact that if we call it many times it might be repetitive if not careful.
                    // Modifying history generator to offset?
                    // Let's just create a raw pool here for history to simple things up or accept the limitation.
                    // Or better: Use random index for history fallback access if needed.
                    // Accessing raw data from history generator requires exposed data, which isn't there.
                    // Let's just trust prompt: "Ask questions from all subjects".
                    // For now, calling history(1) always returns "Amir Temur". That's bad.
                    // Let's modify history generator or just duplicate random picker here?
                    // Let's allow history generator to accept 'random' flag? Or just use a big count and slice.
                    const fullHist = BackupGenerator.history(20, level, skill); // Generate pool
                    qItem = fullHist[Math.floor(Math.random() * fullHist.length)];
                    qItem.motivation = "Tarix!";
                }

                qItem.id = i; // Reset ID
                list.push(qItem);
            }
            return list;
        }
    };

    // --- Quiz Core Logic ---
    const getRandomFromBank = (subj, level) => {
        // For IQ, mix static riddles and procedural logic
        if (subj === 'iq' && Math.random() < 0.6) {
            const arr = BackupGenerator.iq(1, level);
            return (arr && arr.length) ? arr[0] : null;
        }

        if (typeof QuestionBank === 'undefined' || !QuestionBank[subj] || !QuestionBank[subj][level]) {
            if (subj === 'history') {
                const skill = Math.random() > 0.5 ? 'world_history' : 'uzbek_history';
                const arr = BackupGenerator.history(1, level, skill);
                return (arr && arr.length) ? arr[0] : null;
            }
            return null;
        }
        const res = QuestionBank[subj][level];
        let qFuncOrList = null;

        if (subj === 'math') {
            const keys = Object.keys(res);
            const k = keys[Math.floor(Math.random() * keys.length)];
            qFuncOrList = res[k];
        } else if (Array.isArray(res)) {
            qFuncOrList = res;
        } else {
            const keys = Object.keys(res);
            const k = keys[Math.floor(Math.random() * keys.length)];
            qFuncOrList = res[k];
        }

        if (typeof qFuncOrList === 'function') {
            const arr = qFuncOrList(1);
            return (arr && arr.length) ? arr[0] : null;
        } else if (Array.isArray(qFuncOrList) && qFuncOrList.length > 0) {
            const raw = qFuncOrList[Math.floor(Math.random() * qFuncOrList.length)];
            if (Array.isArray(raw)) {
                return {
                    q: raw[0],
                    answer: raw[1],
                    options: raw.slice(1).sort(() => Math.random() - 0.5)
                };
            } else {
                return {
                    q: raw.q,
                    answer: raw.answer,
                    options: shuffle([...raw.options]),
                    explanation: raw.explanation,
                    motivation: raw.motivation
                };
            }
        }
        return null;
    };

    const generateQuestions = (level, skill, count) => {
        const localShuffle = (array) => array.sort(() => Math.random() - 0.5);
        let fullSet = [];

        // Helper to process arrays of questions
        const getBatchFromSource = (source, count) => {
            let list = [];
            let pool = [];
            // Flatten if source is object of arrays (e.g. merged skills)
            if (Array.isArray(source)) {
                pool = source;
            } else if (typeof source === 'object') {
                Object.values(source).forEach(val => {
                    if (Array.isArray(val)) pool = pool.concat(val);
                });
            }
            if (pool.length === 0) return [];
            const shuffled = localShuffle([...pool]);
            for (let i = 0; i < count; i++) {
                const raw = shuffled[i % shuffled.length];
                let processed = {};
                if (Array.isArray(raw)) {
                    const qText = raw[0];
                    const ans = raw[1];
                    const opts = raw.slice(1); // includes answer
                    processed = { q: qText, answer: ans, options: localShuffle([...opts]) };
                } else {
                    processed = { q: raw.q, answer: raw.answer, options: localShuffle([...raw.options]), explanation: raw.explanation, motivation: raw.motivation };
                }
                processed.id = i;
                if (!processed.motivation) processed.motivation = "Barakalla!";
                list.push(processed);
            }
            return list;
        };
        try {
            if (state.subject === 'mixed') {
                const subjs = ['english', 'iq', 'math', 'informatics', 'uzbek', 'history'];
                for (let i = 0; i < count; i++) {
                    const s = subjs[Math.floor(Math.random() * subjs.length)];
                    const qItem = getRandomFromBank(s, level);
                    if (qItem) {
                        qItem.id = i;
                        if (!qItem.motivation) qItem.motivation = "Barakalla!";
                        fullSet.push(qItem);
                    }
                }
            }
            // Attempt standard generation
            if (state.subject === 'english') {
                if (QuestionBank.english && QuestionBank.english[level]) {
                    let source = [];
                    if (skill === 'grammar' && QuestionBank.english[level].grammar) {
                        source = QuestionBank.english[level].grammar;
                    } else if (skill === 'vocabulary' && QuestionBank.english[level].vocabulary) {
                        source = QuestionBank.english[level].vocabulary;
                    } else {
                        if (QuestionBank.english[level].grammar) source = source.concat(QuestionBank.english[level].grammar);
                        if (QuestionBank.english[level].vocabulary) source = source.concat(QuestionBank.english[level].vocabulary);
                    }
                    if (source.length > 0) fullSet = getBatchFromSource(source, count);
                }
            } else if (state.subject === 'uzbek') {
                if (QuestionBank.uzbek && QuestionBank.uzbek[level]) {
                    fullSet = getBatchFromSource(QuestionBank.uzbek[level], count);
                }
            } else if (state.subject === 'history') {
                if (QuestionBank.history && QuestionBank.history[level]) {
                    fullSet = getBatchFromSource(QuestionBank.history[level], count);
                }
            } else if (state.subject === 'iq') {
                if (QuestionBank.iq && QuestionBank.iq[level]) {
                    fullSet = getBatchFromSource(QuestionBank.iq[level], count);
                }
            } else if (state.subject === 'math') {
                if (QuestionBank.math && QuestionBank.math[level]) {
                    if (skill === 'pure_math' && typeof QuestionBank.math[level].pure_math === 'function') {
                        fullSet = QuestionBank.math[level].pure_math(count);
                    } else if (skill === 'problems' && typeof QuestionBank.math[level].problems === 'function') {
                        fullSet = QuestionBank.math[level].problems(count);
                    } else {
                        let set1 = [], set2 = [];
                        if (typeof QuestionBank.math[level].pure_math === 'function') set1 = QuestionBank.math[level].pure_math(Math.floor(count / 2));
                        if (typeof QuestionBank.math[level].problems === 'function') set2 = QuestionBank.math[level].problems(count - set1.length);
                        fullSet = [...set1, ...set2];
                    }
                }
            } else if (state.subject === 'informatics') {
                if (QuestionBank.informatics && QuestionBank.informatics[level]) {
                    fullSet = getBatchFromSource(QuestionBank.informatics[level], count);
                }
            }


        } catch (e) {
            alert("Gen Error: " + e.message);
            console.warn("Standard question generation failed, switching to backup.", e);
        }

        // Fallback: If empty, use BackupGenerator
        if (!fullSet || fullSet.length === 0) {
            console.log("Using BackupGenerator for subject:", state.subject);
            if (state.subject === 'english') fullSet = BackupGenerator.english(count, level);
            else if (state.subject === 'math') fullSet = BackupGenerator.math(count, level);
            else if (state.subject === 'history') fullSet = BackupGenerator.history(count, level, state.skill);
            else if (state.subject === 'uzbek') fullSet = BackupGenerator.uzbek(count, level);
            // Mixed and IQ fallback if needed
            else if (state.subject === 'mixed') fullSet = BackupGenerator.mixed(count, level);
            else fullSet = BackupGenerator.iq(count, level);
        }

        return fullSet;
    }; // This closes generateQuestions

    // --- Actions ---
    const navigate = (viewId) => {
        AudioController.click(); // Sound on nav
        Confetti.stop(); // Stop any active celebration
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        state.currentView = viewId;
    };

    const handleWelcomeStart = () => {
        navigate('view-subjects');
    };

    const submitTeamNames = () => {
        const t1Input = document.getElementById('team1-input');
        const t2Input = document.getElementById('team2-input');

        state.team1Name = t1Input.value.trim() || "Jamoa 1";
        state.team2Name = t2Input.value.trim() || "Jamoa 2";

        // Assume logic flow: Subject -> Mode -> (TeamSetup) -> Level logic
        // We reuse logic from selectMode's non-team path basically
        if (state.subject === 'english') navigate('view-english-level');
        else if (state.subject === 'uzbek') navigate('view-uzbek-level');
        else if (state.subject === 'math') navigate('view-math-level');
        else if (state.subject === 'iq') navigate('view-iq-level');
        else if (state.subject === 'informatics') navigate('view-cs-level');
        else if (state.subject === 'history') navigate('view-history-level');
        else if (state.subject === 'mixed') navigate('view-question-count');
    };

    const selectSubject = (subj) => {
        state.subject = subj;
        state.level = null;
        state.skill = null;
        navigate('view-mode-select');
    };

    const selectMode = (mode) => {
        state.mode = mode;
        if (state.mode === 'team') {
            navigate('view-team-setup');
        } else {
            if (state.subject === 'english') navigate('view-english-level');
            else if (state.subject === 'uzbek') navigate('view-uzbek-level');
            else if (state.subject === 'iq') navigate('view-iq-level');
            else if (state.subject === 'informatics') navigate('view-cs-level');
            else if (state.subject === 'history') navigate('view-history-level');
            else if (state.subject === 'mixed') navigate('view-math-level'); // Re-use generic
            else navigate('view-math-level');
        }
    };

    const handleLevelBack = () => navigate('view-mode-select');

    const selectLevel = (level) => {
        state.level = level;
        if (state.subject === 'english') navigate('view-english-skill');
        else if (state.subject === 'uzbek') navigate('view-uzbek-skill');
        else if (state.subject === 'iq') {
            state.skill = 'general_logic';
            navigate('view-question-count');
            const btn = document.getElementById('btn-diff-5');
            if (state.mode === 'team') btn.style.display = 'block';
            else btn.style.display = 'none';
        } else if (state.subject === 'history') {
            navigate('view-history-skill');
        } else if (state.subject === 'mixed') {
            navigate('view-question-count'); // Skip skill for mixed
            const btn = document.getElementById('btn-diff-5');
            if (state.mode === 'team') btn.style.display = 'block';
            else btn.style.display = 'none';
        } else if (state.subject === 'informatics') {
            state.skill = null; // No sub-skill
            navigate('view-question-count');
            const btn = document.getElementById('btn-diff-5');
            if (state.mode === 'team') btn.style.display = 'block';
            else btn.style.display = 'none';
        }
        else navigate('view-math-skill');
    };

    const selectSkill = (skill) => {
        state.skill = skill;
        navigate('view-question-count');
        const btn = document.getElementById('btn-diff-5');
        if (state.mode === 'team') btn.style.display = 'block';
        else btn.style.display = 'none';
    };

    const handleCountBack = () => {
        if (state.subject === 'english') navigate('view-english-skill');
        else if (state.subject === 'math') navigate('view-math-skill');
        else if (state.subject === 'history') navigate('view-history-skill');
        else if (state.subject === 'uzbek') navigate('view-uzbek-skill');
        else navigate('view-subjects');
    };

    const setQuestionCount = (n) => {
        state.winCondition = (n === 'diff_5') ? 'diff_5' : 'fixed_count';
        state.questionCount = (n === 'diff_5') ? 100 : n;
        state.gameMode = 'count';
        state.timeLimit = 0;
        prepareQuizStart();
    };

    const setTimeMode = (minutes) => {
        state.gameMode = 'time';
        state.timeLimit = minutes * 60;
        state.questionCount = 1000; // Infinite feel
        prepareQuizStart();
    };

    const setCustomTime = () => {
        const input = document.getElementById('custom-time-input');
        const minutes = parseInt(input.value);
        if (!minutes || minutes <= 0) {
            alert("Iltimos, to'g'ri vaqt kiriting (daqiqa)!");
            return;
        }
        setTimeMode(minutes);
    };

    const toggleCustomTime = () => {
        const section = document.getElementById('custom-time-section');
        section.style.display = (section.style.display === 'none' || section.style.display === '') ? 'flex' : 'none';
    };

    const prepareQuizStart = () => {
        let subjName = "";
        if (state.subject === 'english') subjName = "Ingliz Tili";
        else if (state.subject === 'math') subjName = "Matematika";
        else if (state.subject === 'history') subjName = "Tarix";
        else if (state.subject === 'informatics') subjName = "Informatika";
        else if (state.subject === 'uzbek') subjName = "O'zbek Tili";
        else if (state.subject === 'mixed') subjName = "Aralash";
        else subjName = "IQ Test";

        const modeText = state.mode === 'team' ? "(Jamoaviy)" : "";
        const typeText = state.gameMode === 'time' ? `${state.timeLimit / 60} Daqiqa` : state.questionCount;

        const summary = `${subjName} ${modeText} | ${capitalize(state.level)} | ${typeText}`;
        document.getElementById('quiz-summary-text').textContent = summary;

        navigate('view-pre-quiz');
    };

    // Deprecated but kept if needed, alias to new
    const selectCount = setQuestionCount;

    const makeBet = (team) => {
        state.betTeam = team;
        navigate('view-pre-quiz');
    };

    const startQuiz = () => {
        const music = document.getElementById('bg-music');
        if (music && state.selectedMusic !== 'none') {
            music.currentTime = 0; // Restart from beginning
            music.play().catch(() => { });
        }

        // Universal Timer Logic
        if (state.timerInterval) clearInterval(state.timerInterval);
        const timerEl = document.getElementById('quiz-timer');
        const splitTimerEl = document.getElementById('split-quiz-timer');
        const progressEl = document.getElementById('quiz-progress');

        if (state.gameMode === 'time') {
            const updateTimer = () => {
                const m = Math.floor(state.timeLimit / 60);
                const s = state.timeLimit % 60;
                const timeText = `${m}:${s < 10 ? '0' : ''}${s}`;

                if (timerEl) timerEl.innerText = timeText;
                if (splitTimerEl) splitTimerEl.innerText = timeText;

                if (state.timeLimit <= 10) {
                    if (timerEl) timerEl.classList.add('pulse-red');
                    if (splitTimerEl) splitTimerEl.classList.add('pulse-red');
                }

                if (state.timeLimit <= 0) {
                    clearInterval(state.timerInterval);
                    finishQuiz();
                }
                state.timeLimit--;
            };

            // Initial visibility setup
            if (state.mode === 'solo') {
                if (timerEl) timerEl.style.display = 'inline-block';
                if (progressEl) progressEl.style.display = 'none';
                if (splitTimerEl) splitTimerEl.style.display = 'none';
            } else {
                if (timerEl) timerEl.style.display = 'none';
                if (splitTimerEl) splitTimerEl.style.display = 'inline-block';
            }

            updateTimer();
            state.timerInterval = setInterval(updateTimer, 1000);
        } else {
            if (timerEl) timerEl.style.display = 'none';
            if (splitTimerEl) splitTimerEl.style.display = 'none';
            if (state.mode === 'solo' && progressEl) progressEl.style.display = 'inline-block';
        }

        if (state.mode === 'solo') {
            state.questions = generateQuestions(state.level, state.skill, state.questionCount);
            if (!state.questions || state.questions.length === 0) {
                alert("Savollar topilmadi! Iltimos, bo'limni to'g'ri tanlang.");
                navigate('view-subjects');
                return;
            }
            state.currentQuestionIndex = 0;
            state.score = 0;

            navigate('view-quiz');
            renderQuestion();
        } else {
            state.team1.questions = generateQuestions(state.level, state.skill, state.questionCount);
            state.team2.questions = generateQuestions(state.level, state.skill, state.questionCount);

            if (!state.team1.questions.length || !state.team2.questions.length) {
                alert("Savollar topilmadi! Iltimos, bo'limni to'g'ri tanlang.");
                navigate('view-subjects');
                return;
            }

            state.team1.score = 0; state.team1.currentQuestionIndex = 0; state.team1.finished = false;
            state.team2.score = 0; state.team2.currentQuestionIndex = 0; state.team2.finished = false;
            document.getElementById('t1-overlay').classList.remove('active');
            document.getElementById('t2-overlay').classList.remove('active');
            navigate('view-split-quiz');
            renderTeamQuestion('team1');
            renderTeamQuestion('team2');
        }
    };

    const renderQuestion = () => {
        try {
            const qData = state.questions[state.currentQuestionIndex];
            if (!qData) {
                alert("Xatolik: Savol ma'lumotlari topilmadi (Index: " + state.currentQuestionIndex + ")");
                return;
            }
            document.getElementById('question-text').textContent = `${state.currentQuestionIndex + 1}. ${qData.q}`;
            if (state.gameMode !== 'time') {
                document.getElementById('quiz-progress').textContent = `Savol ${state.currentQuestionIndex + 1}/${state.questions.length}`;
            }
            document.getElementById('quiz-score').textContent = `Ball: ${state.score}`;

            const container = document.getElementById('answers-container');
            container.innerHTML = '';
            document.getElementById('quiz-feedback').classList.add('hidden');
            document.getElementById('answers-container').classList.remove('hidden');

            qData.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'btn-answer';
                btn.textContent = opt.toString();
                btn.onclick = () => handleAnswer(opt.toString(), qData.answer, btn);
                container.appendChild(btn);
            });
        } catch (e) {
            alert("Render Error: " + e.message);
            console.error(e);
        }
    };

    const handleAnswer = (selected, correct, btnElement) => {
        const buttons = document.querySelectorAll('.btn-answer');
        buttons.forEach(b => b.disabled = true);
        const qData = state.questions[state.currentQuestionIndex];
        let isCorrect = (selected === correct);

        if (isCorrect) {
            state.score++;
            btnElement.classList.add('correct-anim');
            AudioController.correct();
        } else {
            btnElement.classList.add('wrong-anim');
            buttons.forEach(b => { if (b.textContent === correct) b.classList.add('correct-anim'); });
            AudioController.wrong();
        }

        // FEEDBACK LOGIC: Only for IQ subject
        if (state.subject === 'iq') {
            const feedbackEl = document.getElementById('quiz-feedback');
            document.getElementById('feedback-answer-status').textContent = isCorrect ? "To'g'ri!" : "Noto'g'ri!";
            document.getElementById('feedback-answer-status').style.color = isCorrect ? "var(--success)" : "var(--error)";
            document.getElementById('feedback-correct-answer').textContent = correct;
            document.getElementById('feedback-explanation').textContent = qData.explanation || (isCorrect ? "Javob to'g'ri topildi." : "To'g'ri javobni eslab qoling.");
            document.getElementById('feedback-motivation').textContent = qData.motivation || (isCorrect ? "Barakalla!" : "Keyingisida omad!");

            setTimeout(() => {
                document.getElementById('answers-container').classList.add('hidden');
                feedbackEl.classList.remove('hidden');
            }, 600);
        } else {
            // For History, English, Math: Auto-advance
            setTimeout(() => {
                nextQuestion();
            }, 1200);
        }
    };

    const nextQuestion = () => {
        state.currentQuestionIndex++;
        if (state.currentQuestionIndex < state.questions.length) renderQuestion();
        else finishQuiz();
    };

    const renderTeamQuestion = (teamKey) => {
        const tState = state[teamKey];
        if (tState.finished) return;
        const qData = tState.questions[tState.currentQuestionIndex];
        const prefix = (teamKey === 'team1' ? 't1' : 't2');

        document.getElementById(`${prefix}-question`).textContent = `${tState.currentQuestionIndex + 1}. ${qData.q}`;
        document.getElementById(`${prefix}-progress`).textContent = `${tState.currentQuestionIndex + 1}/${tState.questions.length}`;
        document.getElementById(`${prefix}-score`).textContent = `Ball: ${tState.score}`;

        const container = document.getElementById(`${prefix}-answers`);
        container.innerHTML = '';
        qData.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.textContent = opt.toString();
            btn.onclick = (e) => handleTeamAnswer(teamKey, opt.toString(), qData.answer, e.target, container);
            container.appendChild(btn);
        });
    };

    const handleTeamAnswer = (teamKey, selected, correct, btnElement, container) => {
        const buttons = container.querySelectorAll('button');
        buttons.forEach(b => b.disabled = true);
        const tState = state[teamKey];

        if (selected === correct) {
            tState.score++;
            btnElement.style.border = "2px solid var(--success)";
            btnElement.style.background = "#d1fae5";
            AudioController.correct();
        } else {
            btnElement.style.border = "2px solid var(--error)";
            btnElement.style.background = "#fee2e2";
            AudioController.wrong();
        }

        // For IQ, show feedback then advance. For others, just advance.
        const delay = state.subject === 'iq' ? 800 : 0; // No delay for non-IQ subjects to auto-advance

        setTimeout(() => {
            tState.currentQuestionIndex++;

            // Win by 5 Logic
            if (state.winCondition === 'diff_5') {
                const diff = Math.abs(state.team1.score - state.team2.score);
                if (diff >= 5) {
                    finishQuiz();
                    return;
                }
            }

            if (tState.currentQuestionIndex < tState.questions.length) renderTeamQuestion(teamKey);
            else {
                tState.finished = true;
                const prefix = (teamKey === 'team1' ? 't1' : 't2');
                document.getElementById(`${prefix}-overlay`).classList.add('active');
                if (state.team1.finished && state.team2.finished) finishQuiz();
            }
        }, delay);
    };

    const finishQuiz = () => {
        if (state.timerInterval) clearInterval(state.timerInterval);
        const music = document.getElementById('bg-music');
        if (music) { music.pause(); music.currentTime = 0; }

        if (state.mode === 'solo') {
            document.getElementById('final-score').textContent = state.score;
            document.querySelector('.score-display').innerHTML = `<span id="final-score">${state.score}</span> / ${state.questions.length}`;
            navigate('view-results');
            if (state.score / state.questions.length >= 0.8) {
                AudioController.win();
                Confetti.start();
            }
        } else {
            const s1 = state.team1.score; const s2 = state.team2.score;
            document.getElementById('t1-final-score').textContent = s1;
            document.getElementById('t2-final-score').textContent = s2;

            // Set Names in Result
            document.querySelector('#view-split-results .result-card.left h3').textContent = state.team1Name;
            document.querySelector('#view-split-results .result-card.right h3').textContent = state.team2Name;

            let winnerText = "Durrang!";
            if (s1 > s2) winnerText = `${state.team1Name} Yutdi!`;
            else if (s2 > s1) winnerText = `${state.team2Name} Yutdi!`;

            document.getElementById('split-winner-text').textContent = winnerText;
            navigate('view-split-results');
            AudioController.win(); // Play win sound for team mode too
            Confetti.start();
        }
    };

    const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

    const selectMusic = (trackKey) => {
        state.selectedMusic = trackKey;
        const music = document.getElementById('bg-music');

        // Update UI (Checkmarks)
        ['default', 'sweater_weather', 'none'].forEach(key => {
            const btn = document.getElementById(`music-btn-${key}`);
            if (btn) {
                const check = btn.querySelector('.checkmark');
                if (key === trackKey) {
                    check.style.display = 'inline-block';
                    btn.classList.add('selected');
                } else {
                    check.style.display = 'none';
                    btn.classList.remove('selected');
                }
            }
        });

        if (trackKey === 'none') {
            music.pause();
            music.currentTime = 0;
        } else {
            let src = state.musicFiles[trackKey];
            if (trackKey === 'sweater_weather') {
                src = 'The Neighbourhood Sweater Weather (Lyrics).m4a';
            }

            if (!music.src.includes(encodeURI(src)) && !music.src.includes(src)) {
                music.src = src;
            }

            music.play().catch(e => console.log("Autoplay prevented:", e));
        }
    };

    const stopMusic = () => {
        const music = document.getElementById('bg-music');
        if (music) {
            music.pause();
            music.currentTime = 0;
        }
    };

    return {
        init,
        navigate, selectSubject, selectMode, handleLevelBack, selectLevel,
        selectSkill, handleCountBack, selectCount, setQuestionCount, setTimeMode, setCustomTime, toggleCustomTime, makeBet,
        startQuiz, stopQuiz: finishQuiz,
        nextQuestion, handleWelcomeStart, submitTeamNames, selectMusic, stopMusic
    };
})();

window.onload = App.init;
