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
  getDocs,
  getFirestore,
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
  ['🧑‍🏫 Sinf rahbari', '👨‍🏫 Fan o'qituvchi'],
  ['👩‍💼 Rahbariyat'],
]).resize();

const classMenuKeyboard = Markup.keyboard([
  ['📚 Sinf hisobot topshirish', '⭐ Haftaning yulduzi'],
  ['⚠️ Muammoli o'quvchilar', '📊 Sinf natijasi'],
  ['🔙 Orqaga'],
]).resize();

const teacherMenuKeyboard = Markup.keyboard([
  ['📘 Fan hisobot', '🔥 Qo'llangan metod'],
  ['🔙 Orqaga'],
]).resize();

const adminMenuKeyboard = Markup.keyboard([
  ['📊 Umumiy statistika', '🏆 Reyting'],
  ['📥 Hisobotlar', '⚙️ Sozlamalar'],
  ['🔙 Orqaga'],
]).resize();

const settingsMenuKeyboard = Markup.keyboard([
  ['➕ Admin qo'shish', '👥 Adminlar ro'yxati'],
  ['🔙 Orqaga'],
]).resize();

const backKeyboard = Markup.keyboard([['🔙 Orqaga']]).resize();

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
  if (text === '🔙 Orqaga') {
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

const classReportScene = new Scenes.WizardScene(
  'class-report',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Sinf nomini kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.className = text;
    await ctx.reply('O'quvchilar sonini kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.studentCount = Number(text || 0);
    await ctx.reply('Faollik (%) ni kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.activity = Number(text || 0);
    await ctx.reply('Intizom (%) ni kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.discipline = Number(text || 0);
    await ctx.reply('Qisqa izoh qoldiring:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.note = text;
    await saveDocument('classReports', {
      ...ctx.wizard.state.data,
      role: 'class_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('✅ Hisobot qabul qilindi', classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const starScene = new Scenes.WizardScene(
  'star-student',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Haftaning yulduzi o'quvchi ismini kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.studentName = text;
    await ctx.reply('Sababini yozing:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.reason = text;
    await saveDocument('stars', {
      ...ctx.wizard.state.data,
      role: 'class_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('🌟 Haftaning yulduzi qabul qilindi', classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const problemScene = new Scenes.WizardScene(
  'problem-student',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Muammoli o'quvchi ismini kiriting:', backKeyboard);
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
    await ctx.reply('Ko'rilgan chorani yozing:', backKeyboard);
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
    await ctx.reply('📌 Ma'lumot rahbariyatga yuborildi', classMenuKeyboard);
    return ctx.scene.leave();
  }
);

const subjectReportScene = new Scenes.WizardScene(
  'subject-report',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Fan nomini kiriting:', backKeyboard);
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
    await ctx.reply('Kirish testi (%) ni kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.entryTest = Number(text || 0);
    await ctx.reply('Chiqish testi (%) ni kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.exitTest = Number(text || 0);
    const growth = ctx.wizard.state.data.exitTest - ctx.wizard.state.data.entryTest;
    await saveDocument('subjectReports', {
      ...ctx.wizard.state.data,
      growth,
      role: 'subject_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply(`📊 Hisobot qabul qilindi\n🚀 O'sish: ${growth} %`, teacherMenuKeyboard);
    return ctx.scene.leave();
  }
);

const methodScene = new Scenes.WizardScene(
  'method-report',
  async (ctx) => {
    ctx.wizard.state.data = {};
    await ctx.reply('Qo'llangan metod nomini kiriting:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.methodName = text;
    await ctx.reply('Qisqa izoh yozing:', backKeyboard);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const text = await ensureText(ctx);
    if (!text) return;
    ctx.wizard.state.data.note = text;
    await saveDocument('methods', {
      ...ctx.wizard.state.data,
      role: 'subject_teacher',
      chatId: ctx.chat?.id ?? null,
      fromId: ctx.from?.id ?? null,
      username: ctx.from?.username ?? null,
    });
    await ctx.reply('✅ Metod bazaga saqlandi', teacherMenuKeyboard);
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
      await ctx.reply('Xato! ID faqat raqamlardan iborat bo'lishi kerak. Qaytadan kiriting:', backKeyboard);
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

    await ctx.reply(`✅ ${adminName} muvaffaqiyatli admin qilib tayinlandi!`, adminMenuKeyboard);
    return ctx.scene.leave();
  }
);

const stage = new Scenes.Stage([
  classReportScene,
  starScene,
  problemScene,
  subjectReportScene,
  methodScene,
  addAdminScene,
]);

bot.use(session());
bot.use(stage.middleware());

const showRoleMenu = async (ctx) => {
  ctx.session.screen = 'role';
  await ctx.reply(
    'Assalomu alaykum!\nTa'lim nazorat botiga xush kelibsiz 👋\nIltimos, rolingizni tanlang:',
    roleKeyboard
  );
};

const showClassMenu = async (ctx) => {
  ctx.session.screen = 'class_menu';
  await ctx.reply(
    'Sinf rahbari bo'limi tanlandi.\nQuyidagilardan birini tanlang:',
    classMenuKeyboard
  );
};

const showTeacherMenu = async (ctx) => {
  ctx.session.screen = 'teacher_menu';
  await ctx.reply(
    'Fan o'qituvchi bo'limi tanlandi.\nQuyidagilardan birini tanlang:',
    teacherMenuKeyboard
  );
};

const showAdminMenu = async (ctx) => {
  ctx.session.screen = 'admin_menu';
  await ctx.reply(
    'Rahbariyat bo'limi tanlandi.\nQuyidagilardan birini tanlang:',
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
  await ctx.reply('Bot to'xtatildi. Qayta boshlash uchun /start ni bosing.', Markup.removeKeyboard());
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
    await ctx.reply('Sizda admin huquqi yo'q. ❌');
  }
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 Bot buyruqlari:\n\n/start - Botni ishga tushirish\n/menu - Bosh menyu\n/stop - Botni to'xtatish\n/cancel - Bekor qilish\n/admin - Admin paneli`
  );
});

bot.hears('🧑‍🏫 Sinf rahbari', async (ctx) => {
  ctx.session.role = 'class_teacher';
  await showClassMenu(ctx);
});

bot.hears('👨‍🏫 Fan o'qituvchi', async (ctx) => {
  ctx.session.role = 'subject_teacher';
  await showTeacherMenu(ctx);
});

bot.hears('👩‍💼 Rahbariyat', async (ctx) => {
  const hasAccess = await isAdmin(ctx.chat.id, ctx);
  if (!hasAccess) {
    await ctx.reply('Sizda ushbu bo'limga kirish huquqi yo'q. ❌');
    return;
  }
  ctx.session.role = 'admin';
  await showAdminMenu(ctx);
});

bot.hears('🔙 Orqaga', async (ctx) => {
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

bot.hears('📚 Sinf hisobot topshirish', async (ctx) => {
  await ctx.scene.enter('class-report');
});

bot.hears('⭐ Haftaning yulduzi', async (ctx) => {
  await ctx.scene.enter('star-student');
});

bot.hears('⚠️ Muammoli o'quvchilar', async (ctx) => {
  await ctx.scene.enter('problem-student');
});

bot.hears('📊 Sinf natijasi', async (ctx) => {
  await ctx.reply('⏳ Ma'lumotlar yuklanmoqda, biroz kuting...', classMenuKeyboard);
  const reports = await getCollectionDocs('classReports');
  if (reports.length === 0) {
    await ctx.reply('Hali sinf hisobotlari yo'q.', classMenuKeyboard);
    return;
  }

  const avgActivity =
    reports.reduce((sum, report) => sum + (Number(report.activity) || 0), 0) /
    reports.length;
  const avgDiscipline =
    reports.reduce((sum, report) => sum + (Number(report.discipline) || 0), 0) /
    reports.length;

  await ctx.reply(
    `📊 Sinf natijasi:\nFaollik: ${avgActivity.toFixed(1)} %\nIntizom: ${avgDiscipline.toFixed(
      1
    )} %`,
    classMenuKeyboard
  );
});

bot.hears('📘 Fan hisobot', async (ctx) => {
  await ctx.scene.enter('subject-report');
});

bot.hears('🔥 Qo'llangan metod', async (ctx) => {
  await ctx.scene.enter('method-report');
});

bot.hears('📊 Umumiy statistika', async (ctx) => {
  await ctx.reply('⏳ Ma'lumotlar yuklanmoqda, biroz kuting...', adminMenuKeyboard);
  const [subjectReports, classReports] = await Promise.all([
    getCollectionDocs('subjectReports'),
    getCollectionDocs('classReports'),
  ]);

  const avgGrowth =
    subjectReports.length === 0
      ? 0
      : subjectReports.reduce((sum, report) => sum + (Number(report.growth) || 0), 0) /
        subjectReports.length;

  const topClass = classReports
    .filter((report) => report.className)
    .sort((a, b) => (Number(b.activity) || 0) - (Number(a.activity) || 0))[0];

  await ctx.reply(
    `📊 Umumiy statistika:\nO'rtacha o'sish: ${avgGrowth.toFixed(
      1
    )} %\nEng faol sinf: ${topClass?.className ?? 'Ma'lumot yo'q'}`,
    adminMenuKeyboard
  );
});

bot.hears('🏆 Reyting', async (ctx) => {
  await ctx.reply('⏳ Ma'lumotlar yuklanmoqda, biroz kuting...', adminMenuKeyboard);
  const [classReports, subjectReports] = await Promise.all([
    getCollectionDocs('classReports'),
    getCollectionDocs('subjectReports'),
  ]);

  const bestClassTeacher = classReports
    .filter((report) => report.username)
    .sort((a, b) => (Number(b.activity) || 0) - (Number(a.activity) || 0))[0];

  const bestSubjectTeacher = subjectReports
    .filter((report) => report.username)
    .sort((a, b) => (Number(b.growth) || 0) - (Number(a.growth) || 0))[0];

  await ctx.reply(
    `🏆 Reyting:\nEng yaxshi sinf rahbari: @${bestClassTeacher?.username ?? 'Ma'lumot yo'q'}\nEng katta o'sish ko'rsatgan fan o'qituvchi: @${
      bestSubjectTeacher?.username ?? 'Ma'lumot yo'q'
    }`,
    adminMenuKeyboard
  );
});

bot.hears('📥 Hisobotlar', async (ctx) => {
  await ctx.reply('⏳ Ma'lumotlar yuklanmoqda, biroz kuting...', adminMenuKeyboard);
  const [classReports, subjectReports] = await Promise.all([
    getCollectionDocs('classReports'),
    getCollectionDocs('subjectReports'),
  ]);

  await ctx.reply(
    `📥 Hisobotlar:\nSinf rahbari hisobotlari: ${classReports.length} ta\nFan o'qituvchi hisobotlari: ${subjectReports.length} ta`,
    adminMenuKeyboard
  );
});

bot.hears('⚙️ Sozlamalar', async (ctx) => {
  ctx.session.screen = 'settings_menu';
  await ctx.reply('⚙️ Sozlamalar bo'limi:', settingsMenuKeyboard);
});

bot.hears('➕ Admin qo'shish', async (ctx) => {
  await ctx.scene.enter('add-admin');
});

bot.hears('👥 Adminlar ro'yxati', async (ctx) => {
  await ctx.reply('⏳ Adminlar ro'yxati yuklanmoqda...');
  const admins = await getCollectionDocs('admins');
  if (admins.length === 0) {
    await ctx.reply('Hali qo'shimcha adminlar yo'q.', settingsMenuKeyboard);
    return;
  }

  let list = '👥 Adminlar ro'yxati:\n\n';
  admins.forEach((admin, index) => {
    list += `${index + 1}. ${admin.name} (ID: ${admin.chatId})\n`;
  });

  await ctx.reply(list, settingsMenuKeyboard);
});

bot.catch((err, ctx) => {
  console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
  ctx.reply('Xatolik yuz berdi. Iltimos, /start buyrug'ini bosing.');
});

bot.telegram.setMyCommands([
  { command: 'start', description: 'Botni ishga tushirish' },
  { command: 'menu', description: 'Bosh menyu' },
  { command: 'admin', description: 'Admin paneli' },
  { command: 'stop', description: 'Botni to'xtatish' },
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
