// Ensure local time is Tashkent (Asia/Tashkent) for all runtime date operations.
process.env.TZ = 'Asia/Tashkent';

import dotenv from 'dotenv';
dotenv.config({ override: true });
import http from 'http';
import { Telegraf, Markup, session, Scenes } from 'telegraf';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is not set.');
  process.exit(1);
}

const firebaseConfig = {
  apiKey: 'AIzaSyCJfV6DDuYMnPqV6tQRPy68rHmAajD1roY',
  authDomain: 'primaryclassesbot.firebaseapp.com',
  projectId: 'primaryclassesbot',
  storageBucket: 'primaryclassesbot.firebasestorage.app',
  messagingSenderId: '368397912297',
  appId: '1:368397912297:web:217269346c415afd4e4878',
};

const firebaseApp = initializeApp(firebaseConfig);
// const auth = getAuth(firebaseApp);
// signInAnonymously(auth)
//   .then(() => console.log('Firebase: Anonim tarzda tizimga kirildi'))
//   .catch((error) => console.error('Firebase Auth Error:', error));

const db = getFirestore(firebaseApp);
const bot = new Telegraf(token);

const roleKeyboard = Markup.keyboard([
  ['\u{1F9D1}\u{200D}\u{1F3EB} Sinf rahbari', '\u{1F468}\u{200D}\u{1F3EB} Fan o\'qituvchi'],
  ['\u{1F9D1}\u{200D}\u{1F4BC} Rahbariyat'],
]).resize();

const classMenuKeyboard = Markup.keyboard([
  ['\u{1F4DD} Kunlik hisobot'],
  ['\u{26A0}\u{FE0F} Muammoli o\'quvchi'],
  ['\u{2B05}\u{FE0F} Orqaga'],
]).resize();

const teacherMenuKeyboard = Markup.keyboard([
  ['\u{1F4DD} Kunlik fan hisobot'],
  ['\u{2B05}\u{FE0F} Orqaga'],
]).resize();

const adminMenuKeyboard = Markup.keyboard([
  ['\u{1F4CB} Kunlik hisobotlar'],
  ['\u{2699}\u{FE0F} Sozlamalar'],
  ['\u{2B05}\u{FE0F} Orqaga'],
]).resize();

const settingsMenuKeyboard = Markup.keyboard([
  ['\u{2795} Admin qo\'shish', '\u{1F465} Adminlar ro\'yxati'],
  ['\u{2B05}\u{FE0F} Orqaga'],
]).resize();

const backKeyboard = Markup.keyboard([['\u{2B05}\u{FE0F} Orqaga']]).resize();

const isAdmin = async (chatId, ctx) => {
  if (ctx?.session?.isAdmin !== undefined) return ctx.session.isAdmin;

  const superAdminId = process.env.SUPER_ADMIN_ID;
  if (chatId && superAdminId && chatId.toString() === superAdminId.toString()) {
    if (ctx?.session) ctx.session.isAdmin = true;
    return true;
  }

  try {
    const q = query(collection(db, 'admins'), where('chatId', '==', chatId.toString()));
    const snapshot = await getDocs(q);
    const isAuth = !snapshot.empty;
    if (ctx?.session) ctx.session.isAdmin = isAuth;
    return isAuth;
  } catch (error) {
    console.error('isAdmin check error:', error);
    return false;
  }
};

const ensureText = async (ctx) => {
  const text = ctx.message?.text;
  if (text === '\u{2B05}\u{FE0F} Orqaga') {
    await ctx.scene.leave();
    if (ctx.session.role === 'class_teacher') await showClassMenu(ctx);
    else if (ctx.session.role === 'subject_teacher') await showTeacherMenu(ctx);
    else if (ctx.session.role === 'admin') await showAdminMenu(ctx);
    else await showRoleMenu(ctx);
    return null;
  }
  if (!text) {
    await ctx.reply('Iltimos, matn kiriting:', backKeyboard);
    return null;
  }
  return text;
};

const saveDocument = async (collectionName, payload) => {
  try {
    await addDoc(collection(db, collectionName), {
      ...payload,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error(`Error saving to ${collectionName}:`, error);
    throw error; // Re-throw to handle in UI if needed
  }
};

const getCollectionDocs = async (collectionName) => {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching from ${collectionName}:`, error);
    return []; // Return empty array on error to prevent crash
  }
};

const getLatestDocs = async (collectionName, count = 10) => {
  try {
    const q = query(
      collection(db, collectionName),
      orderBy('createdAt', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error fetching latest from ${collectionName}:`, error);
    return [];
  }
};

const pad2 = (value) => String(value).padStart(2, '0');

const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const getLocalTime = (date = new Date()) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const isLateSubmission = (date = new Date()) => date.getHours() >= 21;

const parseYes = (text) => {
  const value = text.trim().toLowerCase();
  return value === 'ha' || value === 'xa' || value === 'yes' || value === '1';
};

const problemScene = new Scenes.WizardScene(
  'problem-student',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Muammoli o\'quvchi ismini kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.studentName = text;
    await ctx.reply('Muammo turi (bilim / intizom):', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.issueType = text;
    await ctx.reply('Ko\'rilgan chorani yozing:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.actionTaken = text;
    await saveDocument('problemStudents', {
      ...ctx.wizard.state.data,
      role: 'class_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('Ma\'lumot rahbariyatga yuborildi', classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const classDailyReportScene = new Scenes.WizardScene(
  'class-daily-report',
  async (ctx) => {
    const now = new Date();
    ctx.wizard.state.data = {
      dateKey: getLocalDateKey(now),
      submittedAt: getLocalTime(now),
      isLate: isLateSubmission(now),
      role: 'class_teacher',
      reportType: 'daily_class',
    };
    await ctx.reply(
      `Kunlik sinf hisobot. Muddat: 21:00 gacha.\nSana: ${ctx.wizard.state.data.dateKey}\nSinf nomini kiriting:`,
      backKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.className = text;
    await ctx.reply('Dars mavzusini kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.lessonTopic = text;
    await ctx.reply('Dars maqsadi (qisqa):', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.lessonGoal = text;
    await ctx.reply("Qo'llangan metodikani kiriting:", backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.method = text;
    await ctx.reply('Bugun nechta o\'quvchi qatnashdi?', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.attendance = Number(text || 0);
    await ctx.reply('O\'quvchilar faolligi (1-5):', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.activityScore = Number(text || 0);
    await ctx.reply('O\'zlashtirish darajasi (1-5):', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.performanceScore = Number(text || 0);
    await ctx.reply('Uyga vazifa berildimi? (ha/yo\'q)', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    const hasHomework = parseYes(text);
    ctx.wizard.state.data.hasHomework = hasHomework;
    if (hasHomework) {
      await ctx.reply('Uyga vazifa (qisqa):', backKeyboard);
      return ctx.wizard.next();
    }
    await ctx.reply("Muammo bormi? (ha/yo'q)", backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.homework = text;
    await ctx.reply("Muammo bormi? (ha/yo'q)", backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    const hasIssue = parseYes(text);
    ctx.wizard.state.data.hasIssue = hasIssue;
    if (hasIssue) {
      await ctx.reply('Muammo turi va qisqa tavsifini yozing:', backKeyboard);
      return ctx.wizard.next();
    }

    await saveDocument('dailyReports', {
      ...ctx.wizard.state.data,
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });

    const lateNote = ctx.wizard.state.data.isLate
      ? '\nEslatma: Hisobot 21:00 dan keyin yuborildi.'
      : '';
    await ctx.reply(`Hisobot qabul qilindi.${lateNote}`, classMenuKeyboard);
    return ctx.scene.leave();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.issueDetail = text;
    await ctx.reply('Ko\'rilgan chora va reja:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.actionPlan = text;

    await saveDocument('dailyReports', {
      ...ctx.wizard.state.data,
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });

    const lateNote = ctx.wizard.state.data.isLate
      ? '\nEslatma: Hisobot 21:00 dan keyin yuborildi.'
      : '';
    await ctx.reply(`Hisobot qabul qilindi.${lateNote}`, classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const subjectDailyReportScene = new Scenes.WizardScene(
  'subject-daily-report',
  async (ctx) => {
    const now = new Date();
    ctx.wizard.state.data = {
      dateKey: getLocalDateKey(now),
      submittedAt: getLocalTime(now),
      isLate: isLateSubmission(now),
      role: 'subject_teacher',
      reportType: 'daily_subject',
    };
    await ctx.reply(
      `Kunlik fan hisobot. Muddat: 21:00 gacha.\nSana: ${ctx.wizard.state.data.dateKey}\nFan nomini kiriting:`,
      backKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.subjectName = text;
    await ctx.reply('Sinfni kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.className = text;
    await ctx.reply('Dars mavzusini kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.lessonTopic = text;
    await ctx.reply('Dars maqsadi (qisqa):', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.lessonGoal = text;
    await ctx.reply("Qo'llangan metodikani kiriting:", backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.method = text;
    await ctx.reply('Bugun nechta o\'quvchi qatnashdi?', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.attendance = Number(text || 0);
    await ctx.reply('O\'quvchilar faolligi (1-5):', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.activityScore = Number(text || 0);
    await ctx.reply('O\'zlashtirish darajasi (1-5):', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.performanceScore = Number(text || 0);
    await ctx.reply('Uyga vazifa berildimi? (ha/yo\'q)', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    const hasHomework = parseYes(text);
    ctx.wizard.state.data.hasHomework = hasHomework;
    if (hasHomework) {
      await ctx.reply('Uyga vazifa (qisqa):', backKeyboard);
      return ctx.wizard.next();
    }
    await ctx.reply("Muammo bormi? (ha/yo'q)", backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.homework = text;
    await ctx.reply("Muammo bormi? (ha/yo'q)", backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    const hasIssue = parseYes(text);
    ctx.wizard.state.data.hasIssue = hasIssue;
    if (hasIssue) {
      await ctx.reply('Muammo turi va qisqa tavsifini yozing:', backKeyboard);
      return ctx.wizard.next();
    }

    await saveDocument('dailyReports', {
      ...ctx.wizard.state.data,
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });

    const lateNote = ctx.wizard.state.data.isLate
      ? '\nEslatma: Hisobot 21:00 dan keyin yuborildi.'
      : '';
    await ctx.reply(`Hisobot qabul qilindi.${lateNote}`, teacherMenuKeyboard);
    return ctx.scene.leave();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.issueDetail = text;
    await ctx.reply('Ko\'rilgan chora va reja:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.actionPlan = text;

    await saveDocument('dailyReports', {
      ...ctx.wizard.state.data,
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });

    const lateNote = ctx.wizard.state.data.isLate
      ? '\nEslatma: Hisobot 21:00 dan keyin yuborildi.'
      : '';
    await ctx.reply(`Hisobot qabul qilindi.${lateNote}`, teacherMenuKeyboard);
    return ctx.scene.leave();
  }
);

const addAdminScene = new Scenes.WizardScene(
  'add-admin',
  async (ctx) => {
    await ctx.reply(
      'Yangi adminning Telegram ID raqamini kiriting:\n(ID raqamini olish uchun @userinfobot dan foydalanish mumkin)',
      backKeyboard
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;

    const newAdminId = text.trim();
    if (!/^\d+$/.test(newAdminId)) {
      await ctx.reply('Xato! ID faqat raqamlardan iborat bo\'lishi kerak. Qaytadan kiriting:', backKeyboard);
      return;
    }

    ctx.wizard.state.newAdminId = newAdminId;
    await ctx.reply('Yangi admin uchun nom (izoh) kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;

    const adminName = text;
    await saveDocument('admins', {
      chatId: ctx.wizard.state.newAdminId,
      name: adminName,
      addedBy: ctx.from.id,
      username: ctx.from.username || 'unknown',
    });

    await ctx.reply(` ${adminName} muvaffaqiyatli admin qilib tayinlandi!`, adminMenuKeyboard);
    return ctx.scene.leave();
  }
);

const stage = new Scenes.Stage([
  problemScene,
  classDailyReportScene,
  subjectDailyReportScene,
  addAdminScene,
]);

bot.use(session());
bot.use(stage.middleware());

const showRoleMenu = async (ctx) => {
  ctx.session.screen = 'role';
  await ctx.reply(
    'Assalomu alaykum!\nRolingizni tanlang:',
    roleKeyboard
  );
};

const showClassMenu = async (ctx) => {
  ctx.session.screen = 'class_menu';
  await ctx.reply(
    'Sinf rahbari bo\'limi. Kerakli menyuni tanlang:',
    classMenuKeyboard
  );
};

const showTeacherMenu = async (ctx) => {
  ctx.session.screen = 'teacher_menu';
  await ctx.reply(
    'Fan o\'qituvchi bo\'limi. Kerakli menyuni tanlang:',
    teacherMenuKeyboard
  );
};

const showAdminMenu = async (ctx) => {
  ctx.session.screen = 'admin_menu';
  await ctx.reply(
    'Rahbariyat bo\'limi. Kerakli menyuni tanlang:',
    adminMenuKeyboard
  );
};

bot.start(async (ctx) => {
  ctx.session = {}; // Reset session
  await showRoleMenu(ctx);
});

bot.command('menu', async (ctx) => {
  await showRoleMenu(ctx);
});

bot.command('stop', async (ctx) => {
  ctx.session = {};
  await ctx.scene.leave();
  await ctx.reply('Bot to\'xtatildi. Qayta boshlash uchun /start ni bosing.', Markup.removeKeyboard());
});

bot.command('cancel', async (ctx) => {
  await ctx.scene.leave();
  await showRoleMenu(ctx);
});

bot.command('admin', async (ctx) => {
  const hasAccess = await isAdmin(ctx.chat.id, ctx);
  if (hasAccess) {
    ctx.session.role = 'admin';
    await showAdminMenu(ctx);
  } else {
    await ctx.reply('Sizda admin huquqi yo\'q. ');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    ` Bot buyruqlari:\n\n/start - Botni ishga tushirish\n/menu - Bosh menyu\n/stop - Botni to\'xtatish\n/cancel - Bekor qilish\n/admin - Admin paneli`
  );
});

bot.hears("\u{1F9D1}\u{200D}\u{1F3EB} Sinf rahbari", async (ctx) => {
  ctx.session.role = 'class_teacher';
  await showClassMenu(ctx);
});

bot.hears("\u{1F468}\u{200D}\u{1F3EB} Fan o'qituvchi", async (ctx) => {
  ctx.session.role = 'subject_teacher';
  await showTeacherMenu(ctx);
});

bot.hears("\u{1F9D1}\u{200D}\u{1F4BC} Rahbariyat", async (ctx) => {
  const hasAccess = await isAdmin(ctx.chat.id, ctx);
  if (!hasAccess) {
    await ctx.reply("Sizda ushbu bo'limga kirish huquqi yo'q.");
    return;
  }
  ctx.session.role = 'admin';
  await showAdminMenu(ctx);
});

bot.hears("\u{2B05}\u{FE0F} Orqaga", async (ctx) => {
  const screen = ctx.session?.screen;
  if (screen === 'settings_menu') {
    await showAdminMenu(ctx);
  } else if (
    screen === 'class_menu' ||
    screen === 'teacher_menu' ||
    screen === 'admin_menu'
  ) {
    await showRoleMenu(ctx);
  } else {
    // Default fallback
    await showRoleMenu(ctx);
  }
});

bot.hears("\u{1F4DD} Kunlik hisobot", async (ctx) => {
  await ctx.scene.enter('class-daily-report');
});

bot.hears("\u{26A0}\u{FE0F} Muammoli o'quvchi", async (ctx) => {
  await ctx.scene.enter('problem-student');
});

bot.hears("\u{1F4DD} Kunlik fan hisobot", async (ctx) => {
  await ctx.scene.enter('subject-daily-report');
});

bot.hears("\u{1F4CB} Kunlik hisobotlar", async (ctx) => {
  await ctx.reply("Ma'lumotlar yuklanmoqda, biroz kuting...", adminMenuKeyboard);
  const reports = await getCollectionDocs('dailyReports');
  const today = getLocalDateKey();
  const todayReports = reports.filter((report) => report.dateKey === today);
  const lateReports = todayReports.filter((report) => report.isLate);

  if (todayReports.length === 0) {
    await ctx.reply(`Bugun (${today}) kunlik hisobotlar yo'q.`, adminMenuKeyboard);
    return;
  }

  const formatReport = (report, index) => {
    const who = report.role === 'subject_teacher' ? "Fan o'qituvchi" : 'Sinf rahbari';
    const name = report.username ? `@${report.username}` : "noma'lum";
    const className = report.className ? `Sinf: ${report.className}` : '';
    const subjectName = report.subjectName ? `Fan: ${report.subjectName}` : '';
    const late = report.isLate ? 'Kech topshirilgan' : 'Vaqtida';
    const goal = report.lessonGoal ? `Maqsad: ${report.lessonGoal}` : '';
    const topic = report.lessonTopic ? `Mavzu: ${report.lessonTopic}` : '';
    const method = report.method ? `Metodika: ${report.method}` : '';
    const attendance = report.attendance !== undefined ? `Qatnashganlar: ${report.attendance}` : '';
    const activity = report.activityScore !== undefined ? `Faollik: ${report.activityScore}/5` : '';
    const performance =
      report.performanceScore !== undefined ? `O'zlashtirish: ${report.performanceScore}/5` : '';
    const homework = report.hasHomework
      ? `Uyga vazifa: ${report.homework || 'ha'}`
      : "Uyga vazifa: yo'q";
    const issue = report.hasIssue ? `Muammo: ${report.issueDetail || 'ha'}` : "Muammo: yo'q";
    const action = report.actionPlan ? `Chora/reja: ${report.actionPlan}` : '';
    const time = report.submittedAt ? `Vaqt: ${report.submittedAt}` : '';

    return [
      `${index + 1}) ${who} - ${name} (${late})`,
      className,
      subjectName,
      topic,
      goal,
      method,
      attendance,
      activity,
      performance,
      homework,
      issue,
      action,
      time,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const list = todayReports.slice(0, 5);
  await ctx.reply(
    `Bugungi kunlik hisobotlar: ${todayReports.length} ta (kech: ${lateReports.length}).`,
    adminMenuKeyboard
  );

  for (let i = 0; i < list.length; i += 1) {
    const report = list[i];
    const text = formatReport(report, i);
    const keyboard = Markup.inlineKeyboard([
      Markup.button.callback("\u{1F5D1}\u{FE0F} O'chirish", `delete_daily:${report.id}`),
    ]);
    await ctx.reply(text, keyboard);
  }
});

bot.hears("\u{2699}\u{FE0F} Sozlamalar", async (ctx) => {
  ctx.session.screen = 'settings_menu';
  await ctx.reply("Sozlamalar bo'limi:", settingsMenuKeyboard);
});

bot.hears("\u{2795} Admin qo'shish", async (ctx) => {
  await ctx.scene.enter('add-admin');
});

bot.hears("\u{1F465} Adminlar ro'yxati", async (ctx) => {
  await ctx.reply("Adminlar ro'yxati yuklanmoqda...");
  const admins = await getCollectionDocs('admins');
  if (admins.length === 0) {
    await ctx.reply("Hali qo'shimcha adminlar yo'q.", settingsMenuKeyboard);
    return;
  }

  let list = "Adminlar ro'yxati:\n\n";
  admins.forEach((admin, index) => {
    list += `${index + 1}. ${admin.name} (ID: ${admin.chatId})\n`;
  });

  await ctx.reply(list, settingsMenuKeyboard);
});

bot.action(/^delete_daily:(.+)$/, async (ctx) => {
  const hasAccess = await isAdmin(ctx.chat?.id, ctx);
  if (!hasAccess) {
    await ctx.answerCbQuery('Ruxsat yo\'q.', { show_alert: true });
    return;
  }

  const reportId = ctx.match?.[1];
  if (!reportId) {
    await ctx.answerCbQuery('Xato ID.', { show_alert: true });
    return;
  }

  await deleteDoc(doc(db, 'dailyReports', reportId));
  await ctx.answerCbQuery('O\'chirildi');
  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch (error) {
    // Message might be too old or already edited.
  }
});

bot.catch((err, ctx) => {
  console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
  ctx.reply('Xatolik yuz berdi. Iltimos, /start buyrug\'ini bosing.');
});

bot.telegram.setMyCommands([
  { command: 'start', description: 'Botni ishga tushirish' },
  { command: 'menu', description: 'Bosh menyu' },
  { command: 'admin', description: 'Admin paneli' },
  { command: 'stop', description: 'Botni to\'xtatish' },
  { command: 'help', description: 'Yordam' },
]);

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

const port = process.env.PORT || 10000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
});

server.listen(port, () => {
  console.log(`HTTP server listening on port ${port}`);
});
